import { PretestContentStage } from './pretest-content-stage-v1.mjs';
import { createPretestContentSender } from './pretest-content-sender-v1.mjs';
import { sealContentEvent } from './pretest-content-seal-v1.mjs';
import { canonical } from './sealed-batch.mjs';

const contentTypes=new Set(['content_checkpoint','content_changed']);
const collector='collector-v1', cloud='pubsub-v1';
const pilotIdPattern=/^pretest-content-[a-zA-Z0-9_-]{1,24}$/;
const result=(status,acknowledgedCount=0)=>({status,acknowledgedCount});
const authOf=reply=>({ticket:reply.ticket,ticketId:reply.ticketId,issuedAt:reply.issuedAt,expiresAt:reply.expiresAt});

export function createPretestProtectedContent({target,ingress,getCurrent,getProof,fetcher,onHealth}){
  const stage=new PretestContentStage(`izone-exam-journal-v2:${target.origin}${target.pathname}:pretest-content-v1`);
  // Store failures fall back in the recorder and must not start an unhandled rejection.
  stage.ready.catch(()=>{});
  let running,contextCache,keyCache,retryAt=0,failures=0,lastBinding='';

  async function post(url,body,timeout=2500){
    const response=await fetcher(url,{method:'POST',credentials:'omit',cache:'no-store',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
    const value=await response.json();
    if(!response.ok||value?.ok!==true)throw Error(value?.error??'PRETEST_CONTENT_UNAVAILABLE');
    return value;
  }

  function captured(){
    const current=getCurrent(),proof=getProof();
    if(!current?.bindingId||!(proof.examSessionToken||proof.attemptToken))return null;
    return {current,proof,key:canonical(proof)};
  }

  const sameOwner=owner=>getCurrent()?.bindingId===owner.current.bindingId&&canonical(getProof())===owner.key;
  function verifyContext(reply,owner){
    if(reply.bindingId!==owner.current.bindingId||reply.destination!==cloud||!pilotIdPattern.test(reply.pilotId??'')||
      typeof reply.ticket!=='string'||typeof reply.ticketId!=='string'||!Number.isSafeInteger(reply.expiresAt)||
      !Number.isSafeInteger(reply.issuedAt)||reply.expiresAt<=reply.issuedAt||!sameOwner(owner))throw Error('PRETEST_CONTENT_SCOPE_MISMATCH');
    return reply;
  }

  async function context(owner){
    const now=performance.now();
    if(contextCache?.key===owner.key&&contextCache.until>now)return contextCache.route;
    let route;
    try{route=await post(target.href+'/journal-content-context',owner.proof);}
    catch{
      // An unavailable grant cannot select a cloud destination for unseen rows.
      // The existing Collector validates the independent native owner, and
      // previously sealed cloud batches keep their destination and renewal path.
      route={destination:collector};
    }
    if(!sameOwner(owner))throw Error('PRETEST_CONTENT_SCOPE_CHANGED');
    if(route.destination===cloud)verifyContext(route,owner);
    else if(route.destination!==collector)throw Error('PRETEST_CONTENT_CONTEXT_INVALID');
    contextCache={key:owner.key,route,until:Math.min(now+15_000,
      route.destination===cloud?now+(route.expiresAt-route.issuedAt)-1000:Infinity)};
    return route;
  }

  async function choose(row,route){
    const fallback={destination:collector,events:[row.event]};
    if(route.destination!==cloud)return fallback;
    const recipient=route.contentRecipient;
    const id=recipient?.keyId;
    if(typeof id!=='string'||!id||!recipient.key)return fallback;
    try{
      const fingerprint=canonical(recipient);
      if(keyCache?.fingerprint!==fingerprint){
        const key=await crypto.subtle.importKey('jwk',recipient.key,{name:'RSA-OAEP',hash:'SHA-256'},false,['wrapKey']);
        keyCache={fingerprint,key};
      }
      return {destination:cloud,pilotId:route.pilotId,events:await sealContentEvent({...row.event,source:'client'},row.binding,keyCache.key,canonical,id)};
    }catch{return fallback;}
  }

  async function flushOne({keepalive=false,force=false}={}){
    if(keepalive||globalThis.navigator?.onLine===false)return result('deferred');
    const owner=captured();
    if(!owner)return result('no_identity');
    const binding=owner.current.bindingId;
    if(lastBinding!==binding){retryAt=0;failures=0;lastBinding=binding;}
    if(!force&&performance.now()<retryAt)return result('deferred');
    try{
      const pending=(await stage.list(binding)).filter(row=>row.state==='pending').slice(0,32);
      if(pending.length){
        const route=await context(owner);
        for(const row of pending){
          if(!sameOwner(owner))return result('held');
          try{await stage.choose(binding,row.id,entry=>choose(entry,route));}
          catch(error){
            if(error.message!=='CONTENT_STAGE_FULL')throw error;
            await stage.choose(binding,row.id,entry=>({destination:collector,events:[entry.event]}));
          }
        }
      }
      const sender=createPretestContentSender({stage,
        grant:async batch=>{
          if(!sameOwner(owner))return null;
          if(batch.destination===collector)return {bindingId:binding,destination:collector,auth:getCurrent().auth};
          const route=contextCache?.key===owner.key&&contextCache.until>performance.now()?contextCache.route:null;
          if(route?.pilotId===batch.pilotId)return {bindingId:binding,destination:cloud,auth:authOf(route)};
          if(!pilotIdPattern.test(batch.pilotId??''))throw Error('PRETEST_CONTENT_PILOT_MISSING');
          const renew=verifyContext(await post(target.href+'/journal-content-context',{...owner.proof,sealed:{
            pilotId:batch.pilotId,scopeId:binding,destination:cloud,batchId:batch.batchId,eventPayloadSha256:batch.eventPayloadSha256,
          }}),owner);
          if(renew.pilotId!==batch.pilotId)throw Error('PRETEST_CONTENT_PILOT_MISMATCH');
          return {bindingId:binding,destination:cloud,auth:authOf(renew)};
        },post:(destination,body)=>{
          if(!sameOwner(owner))throw Error('PRETEST_CONTENT_SCOPE_CHANGED');
          return post(destination===cloud?ingress:target.href+'/journal-collector-sealed',body,10_000);
        }});
      const settled=await Promise.allSettled([sender.flush(binding,collector,{force}),sender.flush(binding,cloud,{force})]);
      const count=settled.reduce((sum,row)=>sum+(row.status==='fulfilled'&&row.value.status==='acknowledged'?row.value.count:0),0);
      if(settled.some(row=>row.status==='rejected')){
        contextCache=undefined;
        const error=settled.find(row=>row.status==='rejected').reason;
        throw Object.assign(Error(error?.message??'PRETEST_CONTENT_SEND_FAILED'),{settledCount:count});
      }
      failures=0;retryAt=0;
      return result('ok',count);
    }catch(error){
      retryAt=performance.now()+Math.min(60_000,1000*2**Math.min(failures++,6));
      try{onHealth({status:'degraded',errorCode:/^[A-Z0-9_]{1,80}$/.test(error.message)?error.message:'PRETEST_CONTENT_RETRY'});}catch{}
      return result('degraded',error.settledCount??0);
    }
  }

  return {accepts:(event,owner)=>contentTypes.has(event.type)&&captured()?.current.bindingId===owner.bindingId,
    outbox:{putMany:rows=>stage.stage(rows)},flush(settings){
      if(running)return Promise.resolve(result('deferred'));
      running=flushOne(settings).finally(()=>{running=undefined;});return running;
    },async close(){await running?.catch(()=>{});await stage.close().catch(()=>{});}};
}

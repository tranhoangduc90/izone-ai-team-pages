import {MAGIC,CHUNK_SIZES,partContext,sha256} from './protocol.mjs';

// Nhận metadata đã được bên cấp quyền xác minh và khóa đúng phiên. Tải Cloudflare
// trước, kiểm giải mã/hash rồi mới ghép Blob. Lỗi quyền dừng; lỗi nguồn mới dùng
// Pages. Không bắt đầu, nộp, reset hay thay đồng hồ của bất kỳ bài học nào.
export async function downloadAudio(m,options={}){
  const fetchImpl=options.fetchImpl||fetch,parts=options.parts||new Map();
  if(m.version!==1||!CHUNK_SIZES.includes(m.chunkSize)||!Number.isSafeInteger(m.byteLength)||m.byteLength<1||!/^[a-f0-9]{64}$/.test(m.sha256)||m.context?.assetHash!==m.sha256||m.chunks?.length!==Math.ceil(m.byteLength/m.chunkSize))throw Error('MANIFEST_DENIED');
  const primary=new URL(m.primaryUrl),fallback=new URL(m.fallbackUrl);
  if(!['https://izone-audio-delivery-stage.tranhoangduc90.workers.dev','https://izone-audio-delivery.tranhoangduc90.workers.dev'].includes(primary.origin)||!primary.pathname.startsWith('/parts/')||primary.search||primary.hash||primary.username||primary.password)throw Error('PRIMARY_DENIED');
  if(fallback.origin!=='https://tranhoangduc90.github.io'||!['/izone-ai-team-pages/term-tests/','/izone-ai-team-pages/listening-practice/audio-assets/','/izone-ai-team-pages/listening-homework/audio-assets/'].some(p=>fallback.pathname.startsWith(p))||fallback.search||fallback.hash||fallback.username||fallback.password)throw Error('FALLBACK_DENIED');
  if(!m.chunks.every((x,i)=>x.byteLength===Math.min(m.chunkSize,m.byteLength-i*m.chunkSize)&&/^[a-f0-9]{64}$/.test(x.sha256)))throw Error('MANIFEST_DENIED');
  const key=await crypto.subtle.importKey('raw',options.key,{name:'AES-GCM'},false,['decrypt']);
  const concurrency=Number.isSafeInteger(options.concurrency)?Math.max(1,Math.min(4,options.concurrency)):2;
  let next=0,loaded=0,disablePrimary=!!options.disablePrimary,fatal=null,refreshed=false,refreshPromise=null,failedParts=0,lastPrimarySuccess=performance.now(),activeLanes=concurrency;
  const controllers=new Set();
  const result=new Array(m.chunks.length),events=[];
  const event=e=>{events.push(e);options.onEvent?.(e);};
  const check=()=>{options.signal?.throwIfAborted();if(fatal)throw fatal;};
  const verify=async(bytes,expected)=>bytes.byteLength===expected.byteLength&&await sha256(bytes)===expected.sha256;
  async function network(url,init,timeout){
    const controller=new AbortController(),abort=()=>controller.abort(options.signal?.reason);
    controllers.add(controller);
    options.signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>controller.abort(),timeout);
    try{check();const response=await fetchImpl(url,{...init,credentials:'omit',signal:controller.signal});const body=new Uint8Array(await response.arrayBuffer());return{response,body};}
    finally{clearTimeout(timer);controllers.delete(controller);options.signal?.removeEventListener('abort',abort);}
  }
  async function cloudflare(i,expected){
    const u=new URL(m.primaryUrl+'/'+m.chunkSize+'/'+i);
    if(options.caseId)u.searchParams.set('case',options.caseId+'-'+i);
    const usedTicket=m.ticket;
    const {response,body}=await network(u,{headers:{Authorization:'Bearer '+usedTicket},cache:'no-store'},options.primaryTimeoutMs||6000);
    event({source:'cloudflare',index:i,status:response.status,wireBytes:body.length});
    const platformQuota=response.status===403&&/\b(?:Error\s*(?:code[: ]*)?|error code:\s*)1027\b/i.test(new TextDecoder().decode(body).slice(0,16000));
    if([401,403].includes(response.status)&&!platformQuota){
      let code;try{code=JSON.parse(new TextDecoder().decode(body)).code;}catch{}
      if(response.status===401&&code==='EXPIRED'&&options.refresh){
        if(usedTicket!==m.ticket)return cloudflare(i,expected);
        if(!refreshed){refreshed=true;refreshPromise=Promise.resolve().then(()=>options.refresh()).then(ticket=>{m={...m,ticket};});}
        if(refreshPromise){await refreshPromise;if(usedTicket!==m.ticket)return cloudflare(i,expected);}
      }
      throw Object.assign(Error('ACCESS_DENIED'),{accessDenied:true,status:response.status});
    }
    if(platformQuota)throw Error('WORKER_QUOTA_1027');
    if(!response.ok)throw Error('PRIMARY_HTTP_'+response.status);
    if(body.length!==expected.byteLength+33||!MAGIC.every((n,j)=>body[j]===n))throw Error('ENVELOPE_INVALID');
    const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:body.slice(5,17),additionalData:partContext(m.context,m.chunkSize,i,expected.byteLength),tagLength:128},key,body.slice(17)));
    if(!await verify(plain,expected))throw Error('PRIMARY_HASH_MISMATCH');return plain;
  }
  async function pages(i,expected){
    const start=i*m.chunkSize;
    event({source:'pages-start',index:i,scope:disablePrimary?'source':'part'});
    const {response,body}=await network(m.fallbackUrl,{headers:{Range:`bytes=${start}-${start+expected.byteLength-1}`},cache:'default'},options.fallbackTimeoutMs||30000);
    event({source:'pages',index:i,status:response.status,wireBytes:body.length});
    if(!response.ok)throw Error('FALLBACK_HTTP_'+response.status);
    if(response.status===200&&body.length===m.byteLength){
      if(await sha256(body)!==m.sha256)throw Error('FALLBACK_HASH_MISMATCH');
      for(let j=0;j<m.chunks.length;j++)parts.set(m.sha256+':'+m.chunkSize+':'+j,body.slice(j*m.chunkSize,j*m.chunkSize+m.chunks[j].byteLength));
      return body.slice(start,start+expected.byteLength);
    }
    if(!await verify(body,expected))throw Error('FALLBACK_HASH_MISMATCH');return body;
  }
  async function one(i){
    check();const expected=m.chunks[i],id=m.sha256+':'+m.chunkSize+':'+i;
    let bytes=parts.get(id);
    if(bytes&&await verify(bytes,expected))event({source:'cache',index:i,wireBytes:0});
    else{
      bytes=null;parts.delete(id);
      if(!disablePrimary){
        let failure;
        for(let attempt=0;attempt<=(options.primaryRetries??1);attempt++){
          try{bytes=await cloudflare(i,expected);failedParts=0;lastPrimarySuccess=performance.now();break;}
          catch(error){
            check();if(error.accessDenied)throw error;failure=error;
            // Khi có timeout, giảm sức ép còn hai luồng cho phần còn lại;
            // lượt tải sau vẫn thử Cloudflare với cấu hình ưu tiên ban đầu.
            if(error.name==='AbortError')activeLanes=Math.min(activeLanes,2);
            event({source:'primary-error',index:i,reason:error.name==='AbortError'?'AbortError':error.message||error.name});
            // Một phần kẹt chỉ nhờ Pages cứu phần đó. Quota rõ ràng hoặc nhiều
            // phần liên tiếp hỏng mới ngừng nguồn; không chờ hai lượt timeout.
            const sourceWide=['WORKER_QUOTA_1027','PRIMARY_HTTP_429'].includes(error.message);
            if(sourceWide){if(!disablePrimary){disablePrimary=true;options.onPrimaryFailure?.(error);}break;}
            if(error.name==='AbortError'||disablePrimary)break;
          }
        }
        if(!bytes&&!disablePrimary&&++failedParts>=3&&next<m.chunks.length){
          const serverOutage=/^PRIMARY_HTTP_5\d{2}$/.test(failure?.message||'');
          const noProgress=performance.now()-lastPrimarySuccess>=Math.max(12000,2*(options.primaryTimeoutMs||6000));
          if(serverOutage||noProgress){disablePrimary=true;options.onPrimaryFailure?.(failure);}
        }
      }
      if(!bytes){check();bytes=await pages(i,expected);}
      parts.set(id,bytes);
    }
    check();options.onVerifiedPart?.(id,bytes);result[i]=bytes;loaded+=bytes.byteLength;options.onProgress?.({loaded,total:m.byteLength,complete:loaded===m.byteLength});
  }
  async function runner(lane){while(next<m.chunks.length&&lane<activeLanes){check();const i=next++;try{await one(i);}catch(error){fatal=error;for(const controller of controllers)controller.abort();throw error;}}}
  const done=await Promise.allSettled(Array.from({length:concurrency},(_,lane)=>runner(lane)));
  const rejected=done.find(x=>x.status==='rejected');if(rejected)throw rejected.reason;
  const blob=new Blob(result,{type:'audio/mpeg'});
  if(blob.size!==m.byteLength||await sha256(await blob.arrayBuffer())!==m.sha256)throw Error('WHOLE_HASH_MISMATCH');
  return{blob,events,parts};
}

import {API,BUILD,PRODUCT,SLUG} from './config.mjs?v=20261112-submission-reconciliation';
import {sanitize} from '../ic2311-listening-retake-substitute1-k56/log-contract.mjs';
const K='izone-k67-listening-makeup:log:v1:';
const code=v=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{1,79}$/.test(v)?v:'UNCLASSIFIED_EXCEPTION';
export class Telemetry{
 constructor({tabId,audioOwnerId}){this.base={schemaVersion:1,buildVersion:BUILD,product:PRODUCT,testSlug:SLUG,tabId,audioOwnerId,pageInstanceId:crypto.randomUUID()};this.rows=[];this.sequence=0;this.retryAt=0;this.failures=0;this.busy=false;this.dropped=null;this.snapshot=()=>({});this.activeRequests=new Map();addEventListener('pagehide',()=>{for(const stop of this.activeRequests.values())stop('NAVIGATION_ABORTED');});}
 bind(identity,permit,{background=true}={}){this.base={...this.base,...Object.fromEntries(['classCode','attemptId','generation','audioOwnerId','studentInternalId'].map(k=>[k,identity[k]]))};this.permit=permit;this.key=K+identity.attemptId;try{const old=JSON.parse(localStorage.getItem(this.key)||'[]');if(Array.isArray(old))this.rows=old.slice(-1000);}catch{}if(background){this.timer=setInterval(()=>void this.flush(),5000);addEventListener('online',()=>{this.retryAt=0;void this.flush();});}}
 emit(eventName,fields={}){
  for(const k of ['audioBefore','audioAfter'])if(fields[k])fields[k]={...fields[k],serverAckedHeardSeconds:this.serverAckedHeardSeconds??null,serverAckedAt:this.serverAckedAt??null};
  const row=sanitize({...this.base,eventId:crypto.randomUUID(),eventName,occurredAt:new Date().toISOString(),clientMonoMs:performance.now(),sequence:++this.sequence,phase:this.snapshot().controllerStateBefore||'initialization',recoveryId:this.recoveryId,...fields});
  if(this.rows.length>=1000||JSON.stringify(this.rows).length>1048576){let i=this.rows.findIndex(r=>r.eventName==='audio_progress');if(i<0)i=0;const[old]=this.rows.splice(i,1);this.dropped??={droppedCount:0,firstDroppedAt:old.occurredAt,firstDroppedSequence:old.sequence};this.dropped.droppedCount++;this.dropped.lastDroppedAt=old.occurredAt;this.dropped.lastDroppedSequence=old.sequence;}
  this.rows.push(row);this.persist();return row.eventId;
 }
 persist(){if(this.key)try{localStorage.setItem(this.key,JSON.stringify(this.rows));}catch{}}
 async flush(){
  if(!this.permit||this.busy||!this.rows.length||performance.now()<this.retryAt)return;this.busy=true;
  if(this.dropped){const gap=this.dropped;this.dropped=null;this.emit('log_gap',{...gap,gapReason:'queue_overflow'});}
  const batch=this.rows.slice(0,80),ids=new Set(batch.map(r=>r.eventId)),requestId=crypto.randomUUID();let status=null;
  try{const r=await fetch(API+'/events',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.permit,'X-Request-Id':requestId},body:JSON.stringify({events:batch}),signal:AbortSignal.timeout(8000)});status=r.status;const v=await r.json();if(!r.ok||!v.accepted)throw Error();this.rows=this.rows.filter(r=>!ids.has(r.eventId));this.failures=0;this.persist();}
  catch{this.retryAt=performance.now()+Math.min(60000,2000*2**Math.min(5,this.failures++));this.emit('log_export_failed',{requestId,errorCode:'LOG_COLLECTOR_UNAVAILABLE',errorOrigin:'logger',httpStatus:status});}finally{this.busy=false;}
 }
 async request(endpoint,body,{permit=this.permit,operationId=body?.operationId,timeoutMs=8000,signal,abortReason='USER_CANCELLED',method='POST'}={}){
  const requestId=crypto.randomUUID(),start=performance.now(),controller=new AbortController(),recoveryId=this.recoveryId;let why='',completed=false;
  const completedEvent=fields=>{if(completed)return;completed=true;this.emit('client_request_completed',{requestId,operationId,recoveryId,endpointId:endpoint.replace(/^\/+/, '').replaceAll('/','.'),elapsedMs:performance.now()-start,timeoutMs,...fields});};
  const stop=(reason=abortReason)=>{why=typeof reason==='string'?reason:abortReason;controller.abort();if(why==='NAVIGATION_ABORTED')completedEvent({outcome:'aborted',errorCode:why,errorOrigin:'client_transport',exceptionName:'AbortError',abortReason:why,audioAfter:this.snapshot()});};signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();this.activeRequests.set(requestId,stop);
  const timer=setTimeout(()=>{why='CLIENT_TIMEOUT';controller.abort();},timeoutMs);
  this.emit('client_request_sent',{requestId,operationId,recoveryId,endpointId:endpoint.replace(/^\/+/, '').replaceAll('/','.'),method,timeoutMs,revisionSent:body?.revision??null,audioBefore:this.snapshot()});
  try{
   const r=await fetch(API+endpoint,{method,credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json','X-Request-Id':requestId,...operationId?{'X-Operation-Id':operationId}:{},...permit?{Authorization:'Bearer '+permit}:{}},...method==='GET'?{}:{body:JSON.stringify(body??{})},signal:controller.signal});
   const headerElapsedMs=performance.now()-start;let value;try{value=await r.json();}catch{throw Object.assign(Error(),{code:r.ok?'API_CONTRACT_MISMATCH':'HTTP_ERROR',httpStatus:r.status,errorOrigin:r.ok?'client_transport':'proxy_or_api'});}
   this.emit('client_response_received',{requestId,operationId,recoveryId,httpStatus:r.status,headerElapsedMs,elapsedMs:performance.now()-start,revisionReceived:value.revision??null});
   if(!r.ok||value.ok!==true)throw Object.assign(Error(),{code:code(value.error||'HTTP_ERROR'),httpStatus:r.status,errorOrigin:['api','db','proxy'].includes(value.errorOrigin)?value.errorOrigin:'proxy_or_api',held:value.held});
   completedEvent({outcome:'success',httpStatus:r.status});return {value,requestId};
  }catch(error){
   const errorCode=why||error.code||(!navigator.onLine?'NETWORK_UNREACHABLE':'FETCH_FAILED_UNCLASSIFIED');
   completedEvent({outcome:why==='CLIENT_TIMEOUT'?'timeout':why?'aborted':error.httpStatus?'http_error':'network_failure',errorCode:code(errorCode),errorOrigin:error.errorOrigin||'client_transport',exceptionName:['AbortError','TimeoutError','TypeError','Error'].includes(error.name)?error.name:'OtherError',abortReason:why||undefined,httpStatus:error.httpStatus??null,audioAfter:this.snapshot()});
   throw Object.assign(Error(code(errorCode)),{code:code(errorCode),requestId,httpStatus:error.httpStatus,held:why?undefined:error.held});
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);this.activeRequests.delete(requestId);}
 }
 decision(requestId,operationId,applied,fields={}){this.emit(applied?'client_response_applied':'client_response_ignored',{requestId,operationId,...fields,audioAfter:this.snapshot()});}
}

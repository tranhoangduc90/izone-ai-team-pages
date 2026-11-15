import {bindListeningReport} from '../substitute-shared/listening-report-v1.mjs';
import {captureListeningEvidence,renderListeningEvidence} from '../term-test-2-computer-based/listening-report-evidence-v1.mjs';
import {listeningProfiles} from './listening-profiles-v1.mjs';

export async function sendListeningReport({apiBase,slug,body,permit}){
  if(!Object.hasOwn(listeningProfiles,slug))throw Error('LISTENING_REPORT_PROFILE_UNKNOWN');
  const response=await fetch(apiBase+'/api/term-tests/'+slug+'/listening/report',{
    method:'POST',headers:{'Content-Type':'application/json',...(permit?{'x-term2-permit':permit}:{})},
    body:JSON.stringify(body),signal:AbortSignal.timeout(8000)
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw Object.assign(Error(result?.error||'LISTENING_REPORT_UNAVAILABLE'),{code:result?.error});
  return result;
}

let opening;
const dbName='izone-k67-product-listening-report-v1';
function database(){
  opening ||= new Promise((resolve,reject)=>{
    const request=indexedDB.open(dbName,1);
    request.onupgradeneeded=()=>{
      const records=request.result.createObjectStore('reports',{keyPath:'key'});
      records.createIndex('scope','scope');
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  }).catch(error=>{opening=undefined;throw error;});
  return opening;
}

async function transaction(mode,work){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('reports',mode);
    const result=work(tx.objectStore('reports'));
    tx.oncomplete=()=>resolve(result.result);
    tx.onerror=tx.onabort=()=>reject(tx.error);
  });
}

const day=86400000;
const permanent=new Set(['LISTENING_REPORT_SCOPE_MISMATCH','LISTENING_REPORT_TIME_MISMATCH','LISTENING_REPORT_INVALID']);
export function createListeningReportOutbox({slug,mode,sessionId,generation,send,observe=()=>{}}){
  const profile=listeningProfiles[slug]?.audio;
  if(!profile)throw Error('LISTENING_REPORT_PROFILE_UNKNOWN');
  const scope=[slug,mode,sessionId,generation].join(':');
  let running=false,closed=false,delayUntil=0;
  const expire=()=>Date.now()+day;
  async function flush(){
    if(running||closed||navigator.onLine===false||Date.now()<delayUntil)return;
    running=true;
    try{
      const rows=await transaction('readonly',store=>store.index('scope').getAll(scope));
      for(const row of rows){
        if(closed)break;
        if(row.expiresAt<Date.now()){
          await transaction('readwrite',store=>store.delete(row.key));
          observe('report_delivery',{status:'expired',operationId:row.operationId});
          continue;
        }
        let pngBase64;
        try{if(row.view)pngBase64=renderListeningEvidence(row.view);}catch{}
        const {operationId,positionSeconds,reportedAt}=row;
        const submit=includePhoto=>send({mode,generation,examSessionToken:sessionId,operationId,
          audioHash:profile.sha256,positionSeconds,reportedAt,
          ...(includePhoto&&pngBase64?{pngBase64}:{})});
        let result;
        try{result=await submit(true);}
        catch(error){
          if(error.code==='LISTENING_REPORT_IMAGE_INVALID'&&pngBase64)result=await submit(false);
          else if(permanent.has(error.code)){
            await transaction('readwrite',store=>store.delete(row.key));
            observe('report_delivery',{status:'rejected',operationId});
            continue;
          }else throw error;
        }
        if(!result?.ok||!result.incidentId)throw Error('LISTENING_REPORT_ACK_MISSING');
        await transaction('readwrite',store=>store.delete(row.key));
        observe('report_delivery',{status:result.status,operationId,incidentId:result.incidentId});
      }
    }catch{delayUntil=Date.now()+8000;}
    finally{running=false;}
  }
  const online=()=>{delayUntil=0;void flush();};
  window.addEventListener('online',online);
  const timer=setInterval(flush,8000);
  void flush();
  return {
    async add(operationId,draft){
      if(closed||!operationId||!draft)return;
      try{
        const key=scope+':'+operationId;
        await transaction('readwrite',store=>store.put({key,scope,operationId,...draft,expiresAt:expire()}));
        observe('report_delivery',{status:'outbox_saved',operationId});
        void flush();
      }catch{observe('report_delivery',{status:'outbox_unavailable',operationId});}
    },
    close(){closed=true;clearInterval(timer);window.removeEventListener('online',online);}
  };
}

export function attachListeningReport({slug,audio,button,host,assetHash,active,observe,onCapture}){
  const profile=listeningProfiles[slug]?.audio;
  if(!profile||!audio||!button||!host)return;
  bindListeningReport({audio,button,host,profile,assetHash,active,
    observe(result,position){
      observe('manual_report_classified',{mapVersion:profile.version,
        decision:result.decision,positionSeconds:Math.round(position*1000)/1000,
        ...(result.gap?{gapId:result.gap.id,remainingSeconds:result.remainingSeconds}:{}),
        ...(result.reason?{reason:result.reason}:{})});
    },
    capture(positionSeconds){
      const reportedAt=new Date().toISOString();
      let view=null;
      try{
        const form=document.getElementById('listeningView');
        if(form?.isConnected&&!form.hidden)view=captureListeningEvidence({player:audio,form,reportedAt,positionSeconds});
      }catch{}
      onCapture({view,positionSeconds,reportedAt});
    }
  });
}

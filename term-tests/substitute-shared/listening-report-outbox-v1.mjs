import {renderListeningEvidence} from './listening-report-evidence-v1.mjs';

const path='/substitute-listening-report-api';
const maxAge=60*60*1000;
const snapshot='listening-report';

export function createListeningReportOutbox({offline,owner,testSlug,permit,active,reportStatus}){
  let inMemory;
  let working=false;
  let timer=0;
  let delay=2000;
  const wake=()=>{
    clearTimeout(timer);
    timer=0;
    if(!working)void flush();
  };
  function retry(){
    if(!active()||!navigator.onLine||timer)return;
    timer=setTimeout(wake,delay);
    delay=Math.min(60000,delay*2);
  }
  function observe(status,operationId){
    reportStatus({phase:'manual_report_delivery',mapVersion:1,status,operationId});
  }
  async function save(value){
    inMemory=value;
    try{await offline.saveSnapshot(snapshot,value);}catch{}
  }
  async function enqueue(row,evidence){
    if(!active()||!row?.operationId||!evidence)return;
    const value={operationId:row.operationId,reportedAt:row.capturedAt,positionSeconds:evidence.positionSeconds,
      assetHash:owner.verifiedReportAudioHash,createdAt:Date.now(),view:evidence};
    await save(value);
    wake();
  }
  async function flush(){
    if(!active()||!navigator.onLine)return;
    working=true;
    try{
      const item=inMemory===undefined?await offline.loadSnapshot(snapshot):inMemory;
      if(!item||!active())return;
      if(Date.now()-item.createdAt>=maxAge){
        await save(null);
        observe('expired',item.operationId);
        return;
      }
      const {interruption}=await offline.listeningOutcome();
      if(!active())return;
      if(interruption?.operationId!==item.operationId||interruption.reason!=='learner_report')return;
      if(interruption.status!=='acknowledged'){retry();return;}
      let pngBase64;
      try{if(item.view.viewportWidth>0)pngBase64=renderListeningEvidence(item.view);}catch{}
      if(item.incidentId&&!pngBase64){retry();return;}
      const response=await fetch('https://ducizone.ddns.net'+path,{
        method:'POST',headers:{'content-type':'application/json'},cache:'no-store',credentials:'omit',redirect:'error',
        signal:AbortSignal.timeout(10000),
        body:JSON.stringify({testSlug,classCode:owner.classCode,studentRef:owner.studentRef,clientRunId:owner.clientRunId,
          historyEpoch:owner.historyEpoch,...permit(),operationId:item.operationId,reportedAt:item.reportedAt,
          positionSeconds:item.positionSeconds,assetHash:item.assetHash,
          ...(pngBase64?{pngBase64}:{}),...(item.incidentId?{incidentId:item.incidentId}:{})}),
      });
      if(!active())return;
      if(response.status===429||response.status>=500){retry();return;}
      if(!response.ok){
        await save(null);
        observe('rejected',item.operationId);
        return;
      }
      const result=await response.json();
      if(!active())return;
      if(!/^[0-9a-f-]{36}$/i.test(result.incidentId||'')){retry();return;}
      // A retry may discover a previous queue row that was committed without its photo.
      if(pngBase64&&(result.hasPhoto===true||result.status==='photo_queued'||result.status==='sent')){
        await save(null);
        observe('photo_accepted',item.operationId);
      }else{
        await save({...item,incidentId:result.incidentId});
        observe('text_accepted',item.operationId);
        retry();
      }
    }catch{retry();}
    finally{working=false;}
  }
  window.addEventListener('online',wake);
  window.addEventListener('substitute:listening-interruption-ack',wake);
  return {enqueue,wake};
}

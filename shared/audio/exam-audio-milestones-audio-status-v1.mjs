// Observations are optional and captured without delaying the authorized transfer.
export function createExamAudioMilestones({assetId,sha256,byteLength},enabled){
 const win=globalThis.window;
 if(!enabled||win?.TERM_TEST_APP_CONFIG?.EXAM_JOURNAL_ENABLED!==true||win.TERM_TEST_CONFIG?.slug!==assetId)return null;
 const metadata={assetId,sha256,byteLength,transportRevision:'20261111-audio-milestones-v2',
  telemetryVersion:2,startedAt:new Date().toISOString()};
 let observer;
 try{
  observer=typeof win.EXAM_JOURNAL_AUDIO_TRANSFER==='function'
   ?Promise.resolve(win.EXAM_JOURNAL_AUDIO_TRANSFER(metadata))
   :import('../../term-tests/shared/exam-journal/bootstrap-capture-audio-status-v1.mjs?v=20261111-audio-milestones-v2').then(({connectAudioCapture})=>{
    const classCodeHint=(new URL(win.location.href).searchParams.get('class')||'').trim().toUpperCase();
    return connectAudioCapture(metadata,{classCodeHint});
   });
 }catch{return null;}
 observer=observer.catch(()=>null);
 const recorded=new Set();
 const dispatch=(method,fields)=>{
  const record={...fields,observedAt:new Date().toISOString()};
  void observer.then(sink=>sink?.[method]?.(record)).catch(()=>{});
 };
 return {
  event({phase,source,wireBytes}){
   const key=phase+':'+source;
   if(recorded.has(key)||recorded.size>=8)return;
   recorded.add(key);
   dispatch('event',{phase,source,wireBytes});
  },
  complete(blob){dispatch('complete',{byteLength:blob.size,verified:true});},
  fail(error){dispatch('fail',{name:error?.name,message:error?.message});}
 };
}

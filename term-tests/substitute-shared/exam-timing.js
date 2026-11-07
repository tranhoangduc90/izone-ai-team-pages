(function(){
 'use strict';
 const VERSION='substitute-audio-transfer-20261014-v1';
 const substituteSlug=/^substitute-test-[12]-k(?:56|67)$/;
 const endedByRun=new Map();
 const provisionalStarts=new Map(),syncingStarts=new Set();
 const confirmingRuns=new Set(),confirmedRuns=new Set();
 function officialOwner(audio){
  const owner=window.TERM_TEST_BOOTSTRAP;
  return owner?.officialAudioElement===audio?owner:null;
 }
 function observeEnd(audio,owner,decision,review={}){
  try{
   if(!owner?.examSessionId||owner!==window.TERM_TEST_BOOTSTRAP||window.SUBSTITUTE_STATE.blocked)return;
   const app=window.TERM_TEST_APP_CONFIG,slug=window.TERM_TEST_CONFIG?.slug;
   if(app?.EXAM_JOURNAL_ENABLED!==true||!substituteSlug.test(slug||''))return;
   const endpoint=app.EXAM_JOURNAL_BASE_URL||new URL(app.API_BASE_URL).origin+'/substitute-journal-api/'+slug;
   const key=JSON.stringify([new URL(endpoint,window.location.href).href,slug]);
   const measured=(name,value)=>Number.isFinite(value)&&value>=0&&value<=86400?{[name]:value}:{};
   window[Symbol.for('izone.examJournal.connections.v1')]?.get(key)?.recordListeningEnd(owner,{
    ...measured('durationSeconds',audio?.duration),...measured('positionSeconds',audio?.currentTime),
    ...(typeof audio?.ended==='boolean'?{ended:audio.ended}:{}),
    checkpointState:{telemetryVersion:1,decision,assetId:slug,
     ...measured('configuredDurationSeconds',Number(window.TERM_TEST_CONFIG.listening?.durationSeconds)),...review}
   });
  }catch{} // Lỗi quan sát không được ngăn xác nhận giờ thi.
 }
 function validAudioEnd(audio,owner=officialOwner(audio)){
  if(!substituteSlug.test(window.TERM_TEST_CONFIG?.slug||''))return true;
  const expected=Number(window.TERM_TEST_CONFIG.listening?.durationSeconds);
  const duration=Number(audio?.duration),position=Number(audio?.currentTime);
  const failure=!Number.isFinite(expected)||expected<=0||!Number.isFinite(duration)||!Number.isFinite(position)
   ?'metadata_unavailable':Math.abs(duration-expected)>2?'duration_mismatch':
    position<duration-1||position>duration+0.25?'position_outside_end':null;
  if(failure)observeEnd(audio,owner,failure);
  return !failure;
 }
 async function request(route,payload){
  const controller=new AbortController(),untrack=window.SUBSTITUTE_STATE.track(controller),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch(window.TERM_TEST_APP_CONFIG.API_BASE_URL,{method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain;charset=UTF-8'},
    body:JSON.stringify({route,payload:window.SUBSTITUTE_STATE.payload(payload)}),signal:controller.signal});
   if(!response.ok){
    const result=await response.json().catch(()=>null);
    throw Object.assign(new Error(result?.code||'Không xác nhận được thời gian làm bài.'),
     {accessDenied:[400,401,403,409,410,422].includes(response.status)});
   }
   return await response.json();
  }finally{clearTimeout(timer);untrack();}
 }
 async function start(state,audioPreparation){
  if(window.SUBSTITUTE_STATE.meta?.examTimingVersion!==VERSION||state.listeningStartedAt&&!state.examSessionId)return null;
  let data;
  try{data=await request('/api/test/exam/session',{classCode:state.classCode,studentRef:state.studentRef,clientRunId:state.clientRunId,
   ...(state.examOrder?{examOrder:state.examOrder}:{}),...(audioPreparation||{}),
   ...(state.classCode&&/^substitute-test-[12]-k(?:56|67)$/.test(window.TERM_TEST_CONFIG?.slug||'')
    ?{deviceId:state.annotationRunId,generation:Number(state.generation)||0}:{})});}
  catch(error){
   if(error.accessDenied||!/^substitute-test-[12]-k(?:56|67)$/.test(window.TERM_TEST_CONFIG?.slug||'')||!state.offlinePermit
    ||state.examSessionId!==state.clientRunId||!state.offlineDeviceId||state.offlineDeviceId!==state.annotationRunId)throw error;
   data={testSlug:window.TERM_TEST_CONFIG.slug,classCode:state.classCode,studentRef:state.studentRef,
    clientRunId:state.clientRunId,historyEpoch:window.SUBSTITUTE_STATE.meta.historyEpoch,timingVersion:VERSION,
    examOrder:state.examOrder||'listening-first',readingStartedAt:state.readingStartedAt||'',
    listeningStartedAt:state.listeningStartedAt||'',listeningDeadlineAt:state.listeningDeadlineAt||'',
    audioEndedAt:state.audioEndedAt||'',transferSeconds:300,
    serverNow:new Date((window.IZONE_EXAM_CLOCK?.estimate(state.serverTimeOffsetMs)
     ??(Date.now()+(Number(state.serverTimeOffsetMs)||0)))).toISOString(),
    offlinePermit:state.offlinePermit,offlineDeviceId:state.offlineDeviceId,
    offlineGeneration:state.offlineGeneration,offlineListeningPending:state.offlineListeningPending===true};
  }
  if(data.clientRunId!==state.clientRunId||data.classCode!==state.classCode||data.studentRef!==state.studentRef||data.timingVersion!==VERSION)throw new Error('Thời gian trả về không đúng lượt thi.');
  if(state.examOrder&&data.examOrder!==state.examOrder)throw new Error('Thứ tự làm bài không đúng lượt thi.');
  // Cùng lượt: mốc provisional đã lưu không bị phản hồi chưa xác nhận của server xóa đi.
  // Khi server đã có mốc xác nhận, luôn dùng deadline của server.
  const provisional=!data.audioEndedAt&&state.audioEndedAt&&Number.isFinite(Date.parse(state.listeningDeadlineAt||''))
   ?{audioEndedAt:state.audioEndedAt,listeningDeadlineAt:state.listeningDeadlineAt}:{};
  const provisionalListening=state.offlineListeningPending&&Number.isFinite(Date.parse(state.listeningStartedAt||''))
   &&!data.listeningStartedAt?{listeningStartedAt:state.listeningStartedAt,offlineListeningPending:true}:{};
  if(provisionalListening.listeningStartedAt){
   provisionalStarts.set(state.clientRunId,provisionalListening.listeningStartedAt);
   window.setTimeout(()=>{const bootstrap=window.TERM_TEST_BOOTSTRAP;
    if(bootstrap?.clientRunId===state.clientRunId)void syncProvisionalListening(bootstrap,provisionalListening.listeningStartedAt);},1500);
  }
  window.IZONE_EXAM_CLOCK?.observe(data);
  return {...data,...provisional,...provisionalListening,examSessionId:data.clientRunId};
 }
 async function syncProvisionalListening(bootstrap,startedAt){
  if(!navigator.onLine||syncingStarts.has(bootstrap.clientRunId))return;
  syncingStarts.add(bootstrap.clientRunId);
  try{
   await window.SUBSTITUTE_SYNC_PENDING?.();
   const data=await request('/api/test/exam/listening/start',{classCode:bootstrap.classCode,studentRef:bootstrap.studentRef,
    clientRunId:bootstrap.clientRunId,deviceId:bootstrap.offlineDeviceId,generation:bootstrap.offlineGeneration,
    offlinePermit:bootstrap.offlinePermit,listeningStartedAt:startedAt});
   if(data.clientRunId!==bootstrap.clientRunId||data.listeningStartedAt!==startedAt)throw Error('EXAM_TIMING_CONFLICT');
   provisionalStarts.delete(bootstrap.clientRunId);
   window.dispatchEvent(new CustomEvent('term-test:listening-phase-started',{detail:{...data,offlineListeningPending:false}}));
  }catch{window.setTimeout(()=>syncProvisionalListening(bootstrap,startedAt),15000);}
  finally{syncingStarts.delete(bootstrap.clientRunId);}
 }
 async function startListeningPhase(){
  const bootstrap=window.TERM_TEST_BOOTSTRAP;
  if(!bootstrap?.examSessionId||bootstrap.examOrder!=='reading-first'||window.SUBSTITUTE_STATE.blocked)throw new Error('LISTENING_PHASE_NOT_ALLOWED');
  let data;
  try{data=await request('/api/test/exam/listening/start',{classCode:bootstrap.classCode,studentRef:bootstrap.studentRef,
   clientRunId:bootstrap.clientRunId,deviceId:bootstrap.offlineDeviceId||null,
   generation:bootstrap.offlineGeneration??null});}
  catch(error){
   if(!bootstrap.offlinePermit||!bootstrap.offlineDeviceId||!window.SUBSTITUTE_OFFLINE)throw error;
   const startedAt=new Date((window.IZONE_EXAM_CLOCK?.estimate(bootstrap.serverTimeOffsetMs)
    ??(Date.now()+(Number(bootstrap.serverTimeOffsetMs)||0)))).toISOString();
   data={clientRunId:bootstrap.clientRunId,examOrder:'reading-first',timingVersion:VERSION,
    listeningStartedAt:startedAt,serverNow:startedAt,offlineListeningPending:true};
   provisionalStarts.set(bootstrap.clientRunId,startedAt);
   window.setTimeout(()=>syncProvisionalListening(bootstrap,startedAt),1000);
  }
  if(data.clientRunId!==bootstrap.clientRunId||data.examOrder!=='reading-first'||data.timingVersion!==VERSION
   ||!Number.isFinite(Date.parse(data.listeningStartedAt||'')))throw new Error('EXAM_TIMING_CONFLICT');
  window.IZONE_EXAM_CLOCK?.observe(data);
  window.dispatchEvent(new CustomEvent('term-test:listening-phase-started',{detail:data}));
  return data;
 }
 window.addEventListener?.('online',()=>{
  const bootstrap=window.TERM_TEST_BOOTSTRAP;
  if(!bootstrap?.offlinePermit)return;
  const startedAt=provisionalStarts.get(bootstrap.clientRunId)
   ||(bootstrap.offlineListeningPending?bootstrap.listeningStartedAt:'');
  if(startedAt)void syncProvisionalListening(bootstrap,startedAt);
 });
 function ended(audio,observedAudioEndedAt,owner=officialOwner(audio)){
  const bootstrap=window.TERM_TEST_BOOTSTRAP;if(!bootstrap?.examSessionId||window.SUBSTITUTE_STATE.blocked||!validAudioEnd(audio,owner))return false;
  const previousEnd=endedByRun.get(bootstrap.clientRunId);
  const audioEndedAt=previousEnd||observedAudioEndedAt||bootstrap.audioEndedAt||new Date((window.IZONE_EXAM_CLOCK?.estimate(bootstrap.serverTimeOffsetMs) ?? (Date.now()+(Number(bootstrap.serverTimeOffsetMs)||0)))).toISOString();
  endedByRun.set(bootstrap.clientRunId,audioEndedAt);
  const patch={audioEndedAt,listeningDeadlineAt:new Date(Date.parse(audioEndedAt)+300000).toISOString()};
  observeEnd(audio,owner,'review_started',{
   clockSource:previousEnd||bootstrap.audioEndedAt?'saved_end':observedAudioEndedAt?'media_end_sample':'media_end_estimate',
   reviewStartedAt:patch.audioEndedAt,reviewDeadlineAt:patch.listeningDeadlineAt
  });
  window.dispatchEvent(new CustomEvent('term-test:listening-timing-updated',{detail:patch}));
  if(confirmingRuns.has(bootstrap.clientRunId)||confirmedRuns.has(bootstrap.clientRunId))return;
  confirmingRuns.add(bootstrap.clientRunId);
  async function confirm(){
   if(window.SUBSTITUTE_STATE.blocked){confirmingRuns.delete(bootstrap.clientRunId);return;}
   try{
    const data=await request('/api/test/exam/audio-ended',{classCode:bootstrap.classCode,studentRef:bootstrap.studentRef,clientRunId:bootstrap.clientRunId,
     audioEndedAt,heardSeconds:audio.duration});
    if(data.clientRunId!==bootstrap.clientRunId||data.timingVersion!==VERSION)throw new Error('EXAM_TIMING_CONFLICT');
    if(Number.isFinite(Date.parse(data.audioEndedAt))&&Number.isFinite(Date.parse(data.listeningDeadlineAt))){
     observeEnd(audio,owner,'review_confirmed',{clockSource:'server_ack',
      reviewStartedAt:new Date(data.audioEndedAt).toISOString(),reviewDeadlineAt:new Date(data.listeningDeadlineAt).toISOString()});
    }
    window.dispatchEvent(new CustomEvent('term-test:listening-timing-updated',{detail:data}));
    confirmedRuns.add(bootstrap.clientRunId);confirmingRuns.delete(bootstrap.clientRunId);
   }catch{if(!window.SUBSTITUTE_STATE.blocked)setTimeout(confirm,15000);}
  }confirm();
  return true;
 }
 window.SUBSTITUTE_EXAM=Object.freeze({start,startListeningPhase,ended,validAudioEnd});
}());

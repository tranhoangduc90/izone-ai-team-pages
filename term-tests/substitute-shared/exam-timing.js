(function(){
 'use strict';
 const VERSION='substitute-audio-transfer-20261014-v1';
 const endedByRun=new Map();
 const confirmingRuns=new Set(),confirmedRuns=new Set();
 function validAudioEnd(audio){
  if(window.TERM_TEST_CONFIG?.slug!=='substitute-test-2-k67')return true;
  const expected=Number(window.TERM_TEST_CONFIG.listening?.durationSeconds);
  const duration=Number(audio?.duration),position=Number(audio?.currentTime);
  return Number.isFinite(expected)&&expected>0&&Number.isFinite(duration)&&Number.isFinite(position)
   &&Math.abs(duration-expected)<=2&&position>=duration-1&&position<=duration+0.25;
 }
 async function request(route,payload){
  const controller=new AbortController(),untrack=window.SUBSTITUTE_STATE.track(controller),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch(window.TERM_TEST_APP_CONFIG.API_BASE_URL,{method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain;charset=UTF-8'},
    body:JSON.stringify({route,payload:window.SUBSTITUTE_STATE.payload(payload)}),signal:controller.signal});
   const result=await response.json();if(!response.ok)throw new Error(result.code||'Không xác nhận được thời gian làm bài.');return result;
  }finally{clearTimeout(timer);untrack();}
 }
 async function start(state){
  if(window.SUBSTITUTE_STATE.meta?.examTimingVersion!==VERSION||state.listeningStartedAt&&!state.examSessionId)return null;
  const data=await request('/api/test/exam/session',{classCode:state.classCode,studentRef:state.studentRef,clientRunId:state.clientRunId,
   ...(state.examOrder?{examOrder:state.examOrder}:{}),
   ...(state.classCode&&window.TERM_TEST_CONFIG?.slug==='substitute-test-2-k67'
    ?{deviceId:state.annotationRunId,generation:Number(state.generation)||0}:{})});
  if(data.clientRunId!==state.clientRunId||data.classCode!==state.classCode||data.studentRef!==state.studentRef||data.timingVersion!==VERSION)throw new Error('Thời gian trả về không đúng lượt thi.');
  if(state.examOrder&&data.examOrder!==state.examOrder)throw new Error('Thứ tự làm bài không đúng lượt thi.');
  // Cùng lượt: mốc provisional đã lưu không bị phản hồi chưa xác nhận của server xóa đi.
  // Khi server đã có mốc xác nhận, luôn dùng deadline của server.
  const provisional=!data.audioEndedAt&&state.audioEndedAt&&Number.isFinite(Date.parse(state.listeningDeadlineAt||''))
   ?{audioEndedAt:state.audioEndedAt,listeningDeadlineAt:state.listeningDeadlineAt}:{};
  window.IZONE_EXAM_CLOCK?.observe(data);
  return {...data,...provisional,examSessionId:data.clientRunId};
 }
 async function startListeningPhase(){
  const bootstrap=window.TERM_TEST_BOOTSTRAP;
  if(!bootstrap?.examSessionId||bootstrap.examOrder!=='reading-first'||window.SUBSTITUTE_STATE.blocked)throw new Error('LISTENING_PHASE_NOT_ALLOWED');
  const data=await request('/api/test/exam/listening/start',{classCode:bootstrap.classCode,studentRef:bootstrap.studentRef,
   clientRunId:bootstrap.clientRunId,deviceId:bootstrap.offlineDeviceId||null,
   generation:bootstrap.offlineGeneration??null});
  if(data.clientRunId!==bootstrap.clientRunId||data.examOrder!=='reading-first'||data.timingVersion!==VERSION
   ||!Number.isFinite(Date.parse(data.listeningStartedAt||'')))throw new Error('EXAM_TIMING_CONFLICT');
  window.IZONE_EXAM_CLOCK?.observe(data);
  window.dispatchEvent(new CustomEvent('term-test:listening-phase-started',{detail:data}));
  return data;
 }
 function ended(audio,observedAudioEndedAt){
  const bootstrap=window.TERM_TEST_BOOTSTRAP;if(!bootstrap?.examSessionId||window.SUBSTITUTE_STATE.blocked||!validAudioEnd(audio))return false;
  const audioEndedAt=endedByRun.get(bootstrap.clientRunId)||observedAudioEndedAt||bootstrap.audioEndedAt||new Date((window.IZONE_EXAM_CLOCK?.estimate(bootstrap.serverTimeOffsetMs) ?? (Date.now()+(Number(bootstrap.serverTimeOffsetMs)||0)))).toISOString();
  endedByRun.set(bootstrap.clientRunId,audioEndedAt);
  const patch={audioEndedAt,listeningDeadlineAt:new Date(Date.parse(audioEndedAt)+300000).toISOString()};
  window.dispatchEvent(new CustomEvent('term-test:listening-timing-updated',{detail:patch}));
  if(confirmingRuns.has(bootstrap.clientRunId)||confirmedRuns.has(bootstrap.clientRunId))return;
  confirmingRuns.add(bootstrap.clientRunId);
  async function confirm(){
   if(window.SUBSTITUTE_STATE.blocked){confirmingRuns.delete(bootstrap.clientRunId);return;}
   try{
    const data=await request('/api/test/exam/audio-ended',{classCode:bootstrap.classCode,studentRef:bootstrap.studentRef,clientRunId:bootstrap.clientRunId,
     audioEndedAt,heardSeconds:audio.duration});
    if(data.clientRunId!==bootstrap.clientRunId||data.timingVersion!==VERSION)throw new Error('EXAM_TIMING_CONFLICT');
    window.dispatchEvent(new CustomEvent('term-test:listening-timing-updated',{detail:data}));
    confirmedRuns.add(bootstrap.clientRunId);confirmingRuns.delete(bootstrap.clientRunId);
   }catch{if(!window.SUBSTITUTE_STATE.blocked)setTimeout(confirm,15000);}
  }confirm();
  return true;
 }
 window.SUBSTITUTE_EXAM=Object.freeze({start,startListeningPhase,ended,validAudioEnd});
}());

(function(){
 'use strict';
 const VERSION='substitute-audio-transfer-20261014-v1';
 const endedByRun=new Map();
 const confirmingRuns=new Set(),confirmedRuns=new Set();
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
  const data=await request('/api/test/exam/session',{classCode:state.classCode,studentRef:state.studentRef,clientRunId:state.clientRunId});
  if(data.clientRunId!==state.clientRunId||data.classCode!==state.classCode||data.studentRef!==state.studentRef||data.timingVersion!==VERSION)throw new Error('Thời gian trả về không đúng lượt thi.');
  // Cùng lượt: mốc provisional đã lưu không bị phản hồi chưa xác nhận của server xóa đi.
  // Khi server đã có mốc xác nhận, luôn dùng deadline của server.
  const provisional=!data.audioEndedAt&&state.audioEndedAt&&Number.isFinite(Date.parse(state.listeningDeadlineAt||''))
   ?{audioEndedAt:state.audioEndedAt,listeningDeadlineAt:state.listeningDeadlineAt}:{};
  return {...data,...provisional,examSessionId:data.clientRunId};
 }
 function ended(audio,observedAudioEndedAt){
  const bootstrap=window.TERM_TEST_BOOTSTRAP;if(!bootstrap?.examSessionId||window.SUBSTITUTE_STATE.blocked)return;
  const audioEndedAt=endedByRun.get(bootstrap.clientRunId)||observedAudioEndedAt||bootstrap.audioEndedAt||new Date(Date.now()+(Number(bootstrap.serverTimeOffsetMs)||0)).toISOString();
  endedByRun.set(bootstrap.clientRunId,audioEndedAt);
  const patch={audioEndedAt,listeningDeadlineAt:new Date(Date.parse(audioEndedAt)+300000).toISOString(),serverNow:new Date(Date.now()+(Number(bootstrap.serverTimeOffsetMs)||0)).toISOString()};
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
 }
 window.SUBSTITUTE_EXAM=Object.freeze({start,ended});
}());

const mode='on-demand-v1',revision=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function practiceHistoryPath(path){
 if(!/^\/(?:login|shared-login|state|begin|resume|activate|pulse|pause|reset|submit|result)(?:[/?]|$)/.test(path))return path;
 const url=new URL(path,'https://practice.invalid');url.searchParams.set('history',mode);return url.pathname+url.search;
}
/** Reuse only the same owner's already-loaded immutable history with an exact content revision. */
export function expandPracticeHistory(value,previous){
 if(value?.historyMode===undefined)return value;
 const invalid=()=>{throw Object.assign(Error('Lịch sử trả về chưa hợp lệ; giữ bản đang xem.'),{code:'HISTORY_RESPONSE_INVALID'});};
 if(value.historyMode!==mode||!Array.isArray(value.attempts))invalid();
 const same=Boolean(value.identity&&previous?.identity&&['bindingId','studentRef','assignmentId'].every(key=>value.identity[key]&&value.identity[key]===previous.identity[key]));
 const cached=new Map(same?(previous.attempts||[]).map(attempt=>[attempt.id,attempt]):[]),seen=new Set();
 const attempts=value.attempts.map((attempt,index)=>{
  if(!attempt?.id||seen.has(attempt.id)||!revision(attempt.detailRevision)||typeof attempt.detailsLoaded!=='boolean'||index===value.attempts.length-1&&!attempt.detailsLoaded)invalid();
  seen.add(attempt.id);if(attempt.detailsLoaded)return attempt;
  if(!Number.isInteger(attempt.answeredCount)||attempt.answeredCount<0||['draft','answers','notes','result','flags','annotations'].some(key=>key in attempt))invalid();
  const old=cached.get(attempt.id);
  return old?.detailsLoaded===true&&old.detailRevision===attempt.detailRevision?{...old,...attempt,detailsLoaded:true}:attempt;
 });
 if(value.attempt&&!attempts.some(attempt=>attempt.id===value.attempt.id&&attempt.detailsLoaded))invalid();
 return{...value,attempts,...(value.attempt?{attempt:attempts.find(attempt=>attempt.id===value.attempt.id)}:{})};
}

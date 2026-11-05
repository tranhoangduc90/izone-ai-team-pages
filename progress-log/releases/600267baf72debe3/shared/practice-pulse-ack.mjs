// Expand a committed checkpoint receipt using the request snapshot; history stays in the current record.
export function expandPracticePulseAck(response,{identity,lesson,record,lease,snapshot,capabilities}) {
 if(response?.ack===undefined)return response; // An older server keeps its original full response.
 const current=record?.attempts?.at(-1),a=response?.attempt;
 const invalid=()=>{throw Object.assign(Error('Máy chủ chưa xác nhận đúng bản nháp. Bản trên thiết bị vẫn được giữ.'),{code:'PULSE_ACK_INVALID'});};
 if(response.ack!=='practice-pulse-v1'||!current||!identity?.bindingId||response.bindingId!==identity.bindingId
  ||response.identity?.bindingId!==identity.bindingId||response.identity?.studentRef!==identity.studentRef
  ||response.identity?.assignmentId!==identity.assignmentId||!Array.isArray(response.events)||!Object.hasOwn(response,'firstCompleted')
  ||a?.id!==current.id||a.no!==current.no||a.leaseId!==lease?.id||a.status!=='running'
  ||!Number.isSafeInteger(a.sequence)||a.sequence!==snapshot?.sequence||current.sequence<a.sequence
  ||!Number.isFinite(a.usedMs)||a.usedMs<0||!Number.isFinite(a.remainingMs)||a.remainingMs<0)invalid();
 if(current.phase!==undefined&&(!['listening','review'].includes(a.phase)||!Number.isFinite(a.audioPosition)||a.audioPosition<0
  ||!Number.isFinite(a.reviewRemainingMs)||a.reviewRemainingMs<0))invalid();
 const draft={...snapshot,...(a.audioPosition!==undefined?{phase:a.phase,audioPosition:a.audioPosition}:{})};
 const accepted={...current,...draft,...a,draft};
 return{identity:response.identity,lesson,capabilities,attempts:[...record.attempts.slice(0,-1),accepted],events:response.events,firstCompleted:response.firstCompleted};
}

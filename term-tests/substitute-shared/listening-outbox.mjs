export function createListeningOutbox({database,transactionDone,requestResult,normalizeScope,key,uuid}){
 async function writeDecision(fn){
  const db=await database(),transaction=db.transaction('outbox','readwrite');
  const complete=transactionDone(transaction),items=transaction.objectStore('outbox');
  try{
   const value=await fn(items);
   await complete;
   return value;
  }catch(error){try{transaction.abort();}catch{}await complete.catch(()=>{});throw error;}
 }
 const interruptionKey=scope=>key(scope,'listening:interruption');
 const eofKey=scope=>key(scope,'listening:eof');
 async function queueSection(identity,skill,answers){
  const scope=normalizeScope(identity);
  if(!['reading','listening'].includes(skill))throw Error('OFFLINE_SKILL_INVALID');
  const payload=JSON.parse(JSON.stringify(answers));
  return writeDecision(async items=>{
   const itemKey=key(scope,'section:'+skill),old=await requestResult(items.get(itemKey));
   if(old){if(JSON.stringify(old.answers)!==JSON.stringify(payload))throw Error('OFFLINE_SUBMISSION_CONFLICT');return old;}
   if(skill==='listening'&&await requestResult(items.get(interruptionKey(scope))))throw Error('OFFLINE_LISTENING_INTERRUPTED');
   const row={key:itemKey,scope,skill,answers:payload,status:'pending',queuedAt:Date.now()};
   items.add(row);return row;
  });
 }
 async function listeningOutcome(identity){
  const scope=normalizeScope(identity),db=await database(),transaction=db.transaction('outbox','readonly');
  const complete=transactionDone(transaction),items=transaction.objectStore('outbox');
  const [interruption,submission,eof]=await Promise.all([
   requestResult(items.get(interruptionKey(scope))),requestResult(items.get(key(scope,'section:listening'))),
   requestResult(items.get(eofKey(scope)))]);
  await complete;
  return {interruption:interruption??null,submission:submission??null,eof:eof??null};
 }
 async function recordListeningEof(identity,value){
  const scope=normalizeScope(identity),itemKey=eofKey(scope);
  return writeDecision(async items=>{
   const previous=await requestResult(items.get(itemKey));
   if(previous)return previous;
   if(await requestResult(items.get(interruptionKey(scope)))||await requestResult(items.get(key(scope,'section:listening'))))return null;
   const row={key:itemKey,scope,audioEndedAt:value.audioEndedAt,listeningDeadlineAt:value.listeningDeadlineAt,
    heardSeconds:value.heardSeconds,status:'pending'};
   items.add(row);return row;
  });
 }
 async function acknowledgeListeningEof(identity,receipt){
  const scope=normalizeScope(identity),itemKey=eofKey(scope);
  return writeDecision(async items=>{
   const row=await requestResult(items.get(itemKey));
   if(!row||!receipt||receipt.testSlug!==scope.testSlug||receipt.classCode!==scope.classCode
    ||receipt.studentRef!==scope.studentRef||receipt.clientRunId!==scope.clientRunId||receipt.historyEpoch!==scope.historyEpoch
    ||receipt.offlineDeviceId!==scope.deviceId||receipt.offlineGeneration!==scope.generation
    ||receipt.audioEndedAt!==row.audioEndedAt||receipt.listeningDeadlineAt!==row.listeningDeadlineAt)
    throw Error('OFFLINE_EOF_RECEIPT_INVALID');
   const acknowledged={...row,status:'acknowledged'};
   items.put(acknowledged);return acknowledged;
  });
 }
 async function queueListeningInterruption(identity,value){
  const scope=normalizeScope(identity),itemKey=interruptionKey(scope);
  if(!uuid.test(value?.operationId)||!['learner_report','reload'].includes(value?.reason)
   ||!Number.isFinite(Date.parse(value?.capturedAt)))throw Error('OFFLINE_INTERRUPTION_INVALID');
  return writeDecision(async items=>{
   const previous=await requestResult(items.get(itemKey));
   if(previous)return previous;
   if(await requestResult(items.get(key(scope,'section:listening')))||await requestResult(items.get(eofKey(scope))))
    throw Error('OFFLINE_LISTENING_COMPLETED');
   const row={key:itemKey,scope,operationId:value.operationId,reason:value.reason,capturedAt:value.capturedAt,status:'pending'};
   items.add(row);return row;
  });
 }
 async function acknowledgeListeningInterruption(identity,receipt){
  const scope=normalizeScope(identity),itemKey=interruptionKey(scope);
  return writeDecision(async items=>{
   const row=await requestResult(items.get(itemKey)),outcome=receipt?.listeningInterruption;
   if(!row||!receipt||receipt.testSlug!==scope.testSlug||receipt.classCode!==scope.classCode||receipt.studentRef!==scope.studentRef
    ||receipt.clientRunId!==scope.clientRunId||receipt.historyEpoch!==scope.historyEpoch
    ||receipt.offlineDeviceId!==scope.deviceId||receipt.offlineGeneration!==scope.generation
    ||outcome?.operationId!==row.operationId||outcome.reason!==row.reason||outcome.capturedAt!==row.capturedAt
    ||!Number.isFinite(Date.parse(outcome.recordedAt)))throw Error('OFFLINE_INTERRUPTION_RECEIPT_INVALID');
   const result={...row,status:'acknowledged',recordedAt:outcome.recordedAt};
   items.put(result);return result;
  });
 }
 return {queueSection,listeningOutcome,recordListeningEof,acknowledgeListeningEof,queueListeningInterruption,acknowledgeListeningInterruption};
}

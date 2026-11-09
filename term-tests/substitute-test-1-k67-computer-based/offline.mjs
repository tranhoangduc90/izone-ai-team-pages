import {createListeningOutbox} from '../substitute-shared/listening-outbox.mjs?v=20261110-continuity-v1';
import {makeSubstituteBackup} from '../substitute-shared/backup-export.mjs';
const DB_NAME='izone-substitute-test-1-k67-offline-v1';
const AUDIO_SHA='59e69c9691841655a639a22fa9d7a8aec658e4c0c82c5e1451dd5bdd895d0b10';
const AUDIO_BYTES=8443625;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeScope(value){
 const scope={testSlug:String(value?.testSlug||''),historyEpoch:String(value?.historyEpoch||''),
  classCode:String(value?.classCode||'').toUpperCase(),studentRef:String(value?.studentRef||''),
  clientRunId:String(value?.clientRunId||'').toLowerCase(),deviceId:String(value?.deviceId||'').toLowerCase(),
  generation:Number(value?.generation)};
 if(scope.testSlug!=='substitute-test-1-k67'||!uuid.test(scope.historyEpoch)||!uuid.test(scope.clientRunId)
  ||!uuid.test(scope.deviceId)||!Number.isSafeInteger(scope.generation)||scope.generation<0
  ||!/^(?:DEMO|IC\d{3,8})$/.test(scope.classCode)||!/^[A-Za-z0-9_-]{1,100}$/.test(scope.studentRef))
  throw Error('OFFLINE_SCOPE_INVALID');
 return scope;
}
const owner=scope=>JSON.stringify([scope.testSlug,scope.historyEpoch,scope.classCode,scope.studentRef]);
const key=(scope,kind)=>JSON.stringify([scope.testSlug,scope.historyEpoch,scope.classCode,scope.studentRef,
 scope.clientRunId,scope.deviceId,scope.generation,kind]);
const requestResult=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('OFFLINE_STORAGE_FAILED'));});
const transactionDone=transaction=>new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onabort=()=>reject(transaction.error||Error('OFFLINE_STORAGE_FAILED'));
 transaction.onerror=()=>reject(transaction.error||Error('OFFLINE_STORAGE_FAILED'));});
let dbPromise;
function database(){
 if(!globalThis.indexedDB)return Promise.reject(Error('OFFLINE_STORAGE_UNAVAILABLE'));
 return dbPromise??=new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,2);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains('snapshots')){
    const snapshots=db.createObjectStore('snapshots',{keyPath:'key'});
    snapshots.createIndex('owner','owner');
   }
   if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets',{keyPath:'key'});
   if(!db.objectStoreNames.contains('outbox'))db.createObjectStore('outbox',{keyPath:'key'});
   if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('OFFLINE_STORAGE_UNAVAILABLE'));
 }).catch(error=>{dbPromise=null;throw error;});
}
export async function saveMeta(value){
 if(value?.testSlug!=='substitute-test-1-k67'||!uuid.test(String(value.historyEpoch||''))
  ||value.stateVersion!==2||(value.classes!==undefined&&!Array.isArray(value.classes)))throw Error('OFFLINE_META_INVALID');
 return put('meta',{key:'history',value:JSON.parse(JSON.stringify(value)),updatedAt:Date.now()});
}
export async function loadMeta(){return (await get('meta','history'))?.value??null;}
async function get(storeName,itemKey){
 const db=await database(),transaction=db.transaction(storeName,'readonly');
 const result=await requestResult(transaction.objectStore(storeName).get(itemKey));
 await transactionDone(transaction);return result;
}
async function put(storeName,item){
 const db=await database(),transaction=db.transaction(storeName,'readwrite');
 transaction.objectStore(storeName).put(item);await transactionDone(transaction);return item;
}
export async function saveSnapshot(identity,kind,value){
 const scope=normalizeScope(identity);
 if(!['lobby','app','ui'].includes(kind))throw Error('OFFLINE_KIND_INVALID');
 const serialized=JSON.stringify(value);
 if(serialized.length>4*1024*1024)throw Error('OFFLINE_SNAPSHOT_TOO_LARGE');
 return put('snapshots',{key:key(scope,kind),owner:owner(scope),kind,scope,updatedAt:Date.now(),value:JSON.parse(serialized)});
}
export async function loadSnapshot(identity,kind){
 const scope=normalizeScope(identity);return (await get('snapshots',key(scope,kind)))?.value??null;
}
export async function latestLobby(identity){
 const partial={testSlug:'substitute-test-1-k67',historyEpoch:String(identity.historyEpoch||''),
  classCode:String(identity.classCode||'').toUpperCase(),studentRef:String(identity.studentRef||'')};
 if(!uuid.test(partial.historyEpoch)||!/^(?:DEMO|IC\d{3,8})$/.test(partial.classCode)
  ||!/^[A-Za-z0-9_-]{1,100}$/.test(partial.studentRef))return null;
 const db=await database(),transaction=db.transaction('snapshots','readonly');
 const rows=await requestResult(transaction.objectStore('snapshots').index('owner').getAll(owner(partial)));
 await transactionDone(transaction);
 return rows.filter(row=>row.kind==='lobby').sort((a,b)=>b.updatedAt-a.updatedAt)[0]?.value??null;
}
export async function cachedStudents(identity){
 const epoch=String(identity.historyEpoch||''),classCode=String(identity.classCode||'').toUpperCase();
 if(!uuid.test(epoch)||!/^(?:DEMO|IC\d{3,8})$/.test(classCode))return [];
 const db=await database(),transaction=db.transaction('snapshots','readonly');
 const rows=await requestResult(transaction.objectStore('snapshots').getAll());await transactionDone(transaction);
 const seen=new Set();return rows.filter(row=>row.kind==='lobby'&&row.scope.historyEpoch===epoch
  &&row.scope.classCode===classCode&&row.value.offlinePermit&&row.value.studentRef)
  .sort((a,b)=>b.updatedAt-a.updatedAt).flatMap(row=>{
   const ref=row.value.studentRef;if(seen.has(ref))return [];seen.add(ref);
   return [{ref,name:row.value.studentName||ref}];
  });
}
export async function verifyAudio(blob){
 if(!(blob instanceof Blob)||blob.size!==AUDIO_BYTES)throw Error('OFFLINE_AUDIO_SIZE_MISMATCH');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==AUDIO_SHA)throw Error('OFFLINE_AUDIO_HASH_MISMATCH');
 return digest;
}
export async function saveAudio(identity,blob){
 const scope=normalizeScope(identity),digest=await verifyAudio(blob);
 await put('assets',{key:key(scope,'audio'),scope,sha256:digest,bytes:blob.size,blob,updatedAt:Date.now()});
 return {sha256:digest,bytes:blob.size};
}
export async function loadAudio(identity){
 const scope=normalizeScope(identity),row=await get('assets',key(scope,'audio'));
 if(!row||row.bytes!==AUDIO_BYTES||row.sha256!==AUDIO_SHA)return null;
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await row.blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
 return digest===AUDIO_SHA?row.blob:null;
}
export const {queueSection,listeningOutcome,recordListeningEof,acknowledgeListeningEof,
 queueListeningInterruption,acknowledgeListeningInterruption}=createListeningOutbox({
 database,transactionDone,requestResult,normalizeScope,key,uuid
});
async function allSections(identity){
 const scope=normalizeScope(identity),db=await database(),transaction=db.transaction('outbox','readonly');
 const rows=await requestResult(transaction.objectStore('outbox').getAll());await transactionDone(transaction);
 return rows.filter(row=>row.scope.testSlug===scope.testSlug&&row.scope.historyEpoch===scope.historyEpoch
  &&row.scope.classCode===scope.classCode&&row.scope.studentRef===scope.studentRef&&row.scope.clientRunId===scope.clientRunId
  &&row.scope.deviceId===scope.deviceId&&row.scope.generation===scope.generation)
  .sort((a,b)=>a.queuedAt-b.queuedAt);
}
export async function pendingSections(identity){return (await allSections(identity)).filter(row=>row.status==='pending'&&['reading','listening'].includes(row.skill));}
export async function queueWriting(identity,payload){
 const scope=normalizeScope(identity),itemKey=key(scope,'writing'),old=await get('outbox',itemKey);
 if(old)return old;
 return put('outbox',{key:itemKey,scope,skill:'writing',payload:JSON.parse(JSON.stringify(payload)),
  status:'pending',queuedAt:Date.now()});
}
export async function pendingWriting(identity){
 const row=await get('outbox',key(normalizeScope(identity),'writing'));
 return row?.status==='pending'?row:null;
}
export async function acknowledgeWriting(identity,receipt){
 const itemKey=key(normalizeScope(identity),'writing'),row=await get('outbox',itemKey);
 if(!row||receipt?.accepted!==true||!receipt?.grading||typeof receipt.grading.status!=='string')throw Error('OFFLINE_WRITING_RECEIPT_INVALID');
 return put('outbox',{...row,status:'acknowledged',receipt:{status:receipt.grading.status,
  ready:receipt.grading.ready===true},acknowledgedAt:Date.now()});
}
export async function acknowledgeSection(identity,skill,receipt){
 const scope=normalizeScope(identity),itemKey=key(scope,'section:'+skill),row=await get('outbox',itemKey);
 if(!row||receipt?.persisted!==true||!receipt.snapshotHash||!receipt.submittedAt)throw Error('OFFLINE_RECEIPT_INVALID');
 return put('outbox',{...row,status:'acknowledged',receipt:{snapshotHash:receipt.snapshotHash,submittedAt:receipt.submittedAt},acknowledgedAt:Date.now()});
}
export async function makeDownload(identity,appFallback=null){
 const scope=normalizeScope(identity);
 const [lobby,storedApp,sections]=await Promise.all([loadSnapshot(scope,'lobby').catch(()=>null),
  loadSnapshot(scope,'app').catch(()=>null),allSections(scope).catch(()=>[])]);
 const writing=await get('outbox',key(scope,'writing')).catch(()=>null);
 return makeSubstituteBackup({scope,lobby,app:appFallback??storedApp,sections,writing,title:"Substitute Test 1 K67"});
}

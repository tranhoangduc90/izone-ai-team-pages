// Lõi offline có cấu hình. Wrapper Term 2 giữ nguyên wire/storage v1.
export function createOfflineRuntime(profile){
// Bài làm được ghi ở máy trước; sync chỉ chuyển dữ liệu, không điều khiển audio.
const BUILD=profile.build;
const mini=profile.slug==='mini-test-k56';
const canonical=value=>JSON.stringify(value&&typeof value==='object'?(Array.isArray(value)?value.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))]))):value);
async function hash(value){const bytes=new TextEncoder().encode(canonical(value));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
const clone=x=>structuredClone(x),failure=()=>Object.assign(Error('Chưa lưu được bài trên thiết bị. Hãy tải bài về máy và báo giảng viên.'),{code:'LOCAL_PERSIST_FAILED'});
class ExamStore{
 constructor({local=globalThis.localStorage,idb=globalThis.indexedDB}={}){this.local=local;this.idb=idb;this.queue=Promise.resolve();this.revision=0;}
 async open(){
  try{this.db=await new Promise((ok,no)=>{const r=this.idb.open(profile.dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>ok(r.result);r.onerror=no;r.onblocked=no;});this.db.onversionchange=()=>{this.db.close();this.db=null;};}catch{}
  await this.put('probe',{probe:true});return this;
 }
 async get(key){
  let a,b;if(!key.endsWith(':audio'))try{a=JSON.parse(this.local.getItem(profile.localPrefix+key)||'null');}catch{}
  if(this.db)try{b=await new Promise((ok,no)=>{const r=this.db.transaction('records').objectStore('records').get(key);r.onsuccess=()=>ok(r.result);r.onerror=no;});}catch{}
  if(a&&b&&a._revision===b._revision&&canonical(a)!==canonical(b))throw Object.assign(failure(),{code:'LOCAL_REVISION_CONFLICT'});
  const selected=!a?b:!b?a:a._revision>=b._revision?a:b;this.revision=Math.max(this.revision,selected?._revision||0);return selected||null;
 }
 async keys(prefix){
  const keys=new Set();
  const localPrefix=profile.localPrefix+prefix;
  try{for(let i=0;i<this.local.length;i+=1){const key=this.local.key(i);if(key?.startsWith(localPrefix))keys.add(key.slice(profile.localPrefix.length));}}catch{}
  if(this.db)try{
   const stored=await new Promise((resolve,reject)=>{
    const range=IDBKeyRange.bound(prefix,prefix+'\uffff');
    const request=this.db.transaction('records').objectStore('records').getAllKeys(range);
    request.onsuccess=()=>resolve(request.result);request.onerror=reject;
   });
   for(const key of stored)keys.add(key);
  }catch{}
  return [...keys];
 }
 put(key,value){
  const copy=clone({...value,_revision:++this.revision});let local=false;
  if(!key.endsWith(':audio'))try{const raw=JSON.stringify(copy);this.local.setItem(profile.localPrefix+key,raw);local=this.local.getItem(profile.localPrefix+key)===raw;}catch{}
  const operation=this.queue.catch(()=>{}).then(async()=>{
   let db=false;
   if(this.db)try{await new Promise((ok,no)=>{let tx;try{tx=this.db.transaction('records','readwrite',{durability:'strict'});}catch{tx=this.db.transaction('records','readwrite');}tx.oncomplete=ok;tx.onabort=no;tx.onerror=no;tx.objectStore('records').put(copy,key);});db=true;}catch{}
   if(!local&&!db)throw failure();return copy;
  });this.queue=operation;return operation;
 }
}
function exportHtml(record){
 const s=record.snapshot||{},p=record.prepared||{},escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const data={schemaVersion:1,build:BUILD,testSlug:profile.slug,classCode:record.classCode,studentName:s.studentName||p.studentName,
  runReference:profile.runPrefix+String(p.attemptToken||'').slice(0,8),generation:p.generation,examMode:s.examMode||p.examMode,revision:record._revision,
  drafts:clone(s.drafts||{}),sections:clone(record.sections||{}),player:clone(record.player||{}),
  receipts:Object.fromEntries(Object.entries(record.receipts||{}).map(([key,r])=>[key,Object.fromEntries(['version','receiptId','operationId','payloadHash','section','kind','acceptedRevision','status','reason','serverCommittedAt'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]]))])),
  pending:(record.operations||[]).map(o=>({operationId:o.operationId,section:o.section,kind:o.kind,revision:o.revision,
   ...(record.heldSubmissions?.[o.operationId]?{capturedAt:o.occurredAt,held:clone(record.heldSubmissions[o.operationId])}:{})})),createdAt:new Date().toISOString()};
 for(const skill of ['listening','reading','writing']){
  const section=record.sections?.[skill];
  if(section?.sealed&&section.content){
   try{
    const content=JSON.parse(section.content);
    data.drafts[skill]=skill==='writing'?content:content.answers;
   }catch{}
  }
 }
 const rows=skill=>profile.answerKeys[skill].map(key=>`<tr><td>${escape(key)}</td><td>${escape(data.drafts[skill]?.[key]||'')}</td></tr>`).join('');
 if(profile.paper){delete data.drafts.writing;delete data.sections.writing;delete data.player;}
 const writing=profile.paper?'':'<h2>'+escape(profile.taskLabel)+'</h2><pre>'+escape(data.drafts.writing?.[profile.taskId]||'')+'</pre>';
 return '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>'+escape(profile.pageTitle)+'</title><style>body{font:17px system-ui;max-width:900px;margin:32px auto;padding:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:7px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>'+escape(profile.exportTitle)+'</h1><p>'+escape(data.studentName)+' · '+escape(data.classCode)+'</p><p>Lượt: '+escape(data.runReference)+' · Revision: '+escape(data.revision)+'</p><p>'+escape(data.pending.length?'Còn bài đang chờ máy chủ xác nhận. File này giữ nội dung, không thay biên nhận nộp bài.':'Xem trạng thái trong phần biên nhận. Thời gian máy không chứng nhận giờ nộp.')+'</p><h2>Listening</h2><table><tr><th>Câu</th><th>Bài làm</th></tr>'+rows('listening')+'</table><h2>Reading</h2><table><tr><th>Câu</th><th>Bài làm</th></tr>'+rows('reading')+'</table>'+writing+'<h2>Thông tin khôi phục</h2><pre>'+escape(JSON.stringify(data,null,2))+'</pre></html>';
}

class OfflineRuntime extends EventTarget{
 constructor({apiBase,classCode,store,fetchImpl=globalThis.fetch}){super();Object.assign(this,{apiBase,classCode,store});this.fetchImpl=(...args)=>fetchImpl(...args);this.busy=false;this.retryAt=0;this.failures=0;this.lastError='';this.owned=false;}
 get active(){return Boolean(this.record?.ready&&this.owned);}
 get build(){return BUILD;}
 get scope(){const p=this.record.prepared;return {attemptToken:p.attemptToken,examSessionToken:p.examSessionToken,generation:Number(p.generation)||0,ownerId:p.offline.ownerId};}
 get pending(){return this.record?.operations?.length||0;}
 get submissionRecovery(){return this.record?.prepared?.offline?.submissionRecoveryVersion===1;}
 get scopedSubmissionJournal(){return this.submissionRecovery||Boolean(profile.skillFallback);}
 get verifyRestoredDeadline(){return profile.verifyRestoredDeadline===true||this.submissionRecovery&&!profile.paper;}
 get heldSubmission(){
  if(!this.submissionRecovery)return null;
  const operation=this.record.operations.findLast(item=>this.record.heldSubmissions?.[item.operationId]?.expiresAt>this.now());
  return operation?{operationId:operation.operationId,...this.record.heldSubmissions[operation.operationId]}:null;
 }
 get message(){
  const held=this.heldSubmission;
  if(held)return 'Máy chủ đã giữ bản để đối soát · Mã đối soát '+held.operationId;
  return this.lastError||(this.criticalSaves?'Đang lưu bài trên thiết bị...':!this.record?'':this.record.review?'Bài được giữ trên thiết bị; cần giảng viên đối soát.':this.pending?'Đã lưu trên thiết bị — chờ đồng bộ. Mở lại đúng trình duyệt để tiếp tục gửi; không xóa dữ liệu.':Object.keys(this.record.receipts||{}).length?'Máy chủ đã xác nhận các thao tác đã gửi.':'Bài đã sẵn sàng. Nội dung làm bài được lưu trên thiết bị.');}
 async open(){
  await this.store.open();const pointer=await this.store.get('latest:'+this.classCode);
  if(pointer?.key){this.record=await this.store.get(pointer.key);this.key=pointer.key;}
  if(this.record){await this.claim();this.anchor();}
  globalThis.addEventListener?.('online',()=>{
   this.retryAt=0;
   if(mini)this.failures=0;
   void this.flush();
  });
  this.timer=setInterval(()=>{
   this.drainDiagnostics();
   if(this.record?.review&&this.record.heldSubmissions)this.changed();
   void this.flush();
  },5000);this.timer.unref?.();return this;
 }
 observe(action,details={}){
  const row={action,observedAt:new Date().toISOString(),diagnosticId:crypto.randomUUID(),...details};
  if(this.scopedSubmissionJournal){
   if(!this.active)return;
   try{
    const queue=this.record.submissionDiagnostics||=[];
    if(queue.length>=64){queue.shift();this.record.submissionDiagnosticsLost=(this.record.submissionDiagnosticsLost||0)+1;}
    queue.push(JSON.parse(JSON.stringify(row)));
    void this.persist(false,true).catch(()=>{});
    this.drainDiagnostics();
   }catch{}
   return;
  }
  this.diagnostics||=[];
  if(this.diagnostics.length>=128){this.diagnostics.shift();this.diagnosticLost=(this.diagnosticLost||0)+1;}
  this.diagnostics.push(row);this.drainDiagnostics();
 }
 setJournal(journal){this.journal=journal;this.journalRun=this.record;this.drainDiagnostics();}
 connectRecoveryJournal(){
  const config=globalThis.TERM_TEST_APP_CONFIG,run=this.record;
  if(config?.EXAM_JOURNAL_ENABLED!==true||globalThis.navigator?.onLine===false||this.journalConnecting
     ||performance.now()<(this.journalRetryAt||0)||!this.active)return;
  const endpoint=(config.EXAM_JOURNAL_BASE_URL||this.apiBase+'/api/term-tests/'+profile.slug)+(profile.skillFallback?'/skill-fallback':'');
  const getState=()=>this.record===run&&this.active?{...this.sectionResponse(),classCode:this.classCode,
   ...(profile.skillFallback?{clientRunId:this.scope.ownerId}:{})}:{};
  this.journalConnecting=import('../shared/exam-journal/bridge-recovery-v1.mjs?v=20261112-k56-submission-fallback')
   .then(({connectExamJournal})=>{
    if(this.record===run&&this.active)this.setJournal(connectExamJournal({enabled:true,endpoint,testSlug:profile.slug,
     build:this.build,getState,submissionMetadataOnly:true,
     ...(profile.skillFallback?{fetcher:(url,options)=>url===endpoint+'/journal-context'
      ? this.fetchImpl(url,options):globalThis.fetch(url,options)}:{})}));
   }).catch(()=>{this.journalRetryAt=performance.now()+10000;}).finally(()=>{this.journalConnecting=null;});
 }
 drainDiagnostics(){
  if(this.scopedSubmissionJournal){
   if(!this.active||!this.record.submissionDiagnostics?.length)return;
   if(this.journalRun!==this.record||!this.journal?.recordK56Submission||!this.journal.metadataOnlySubmission){this.connectRecoveryJournal();return;}
   try{
    const queue=this.record.submissionDiagnostics;
    let changed=false;
    while(queue.length){
     const row=queue[0],lost=this.record.submissionDiagnosticsLost;
     if(!this.journal.recordK56Submission(this.scope,'state_observed',{cause:profile.cause,
       checkpointState:{offlineVersion:1,...(this.submissionRecovery?{submissionRecoveryVersion:1}:{}),...row,...(lost?{lostDiagnostics:lost}:{})}}))break;
     if(lost)delete this.record.submissionDiagnosticsLost;
     queue.shift();changed=true;
    }
    if(changed)void this.persist(false,true).catch(()=>{});
   }catch{}
   return;
  }
  if(!this.journal?.recorder)return;
  while(this.diagnostics?.length){const row=this.diagnostics[0];try{const id=this.journal.recorder.record('state_observed',{cause:profile.cause,checkpointState:{offlineVersion:1,...row,...this.diagnosticLost?{lostDiagnostics:this.diagnosticLost}:{}}});if(!id)break;this.diagnostics.shift();}catch{break;}}
 }
 async claim(){
  if(this.owned)return;
  if(globalThis.navigator?.locks){await new Promise((resolve,reject)=>{navigator.locks.request(profile.lockPrefix+this.record.prepared.attemptToken,{ifAvailable:true},lock=>{
   if(!lock){reject(Error('Bài đang mở ở tab khác. Hãy quay lại tab đó.'));return;}
   this.owned=true;resolve();return new Promise(done=>{this.release=done;});
  }).catch(reject);});}
  else throw Error('Trình duyệt chưa hỗ trợ giữ quyền tab an toàn. Hãy dùng Chrome hoặc Edge trên máy tính.');
 }
 async detachLatest(){
  if(this.record)await this.persist();
  await this.store.put('latest:'+this.classCode,{key:null});
  this.owned=false;this.record=null;this.release?.();this.release=null;
 }
 async restorePrepared(prepared,studentRef){
  const key='run:'+prepared.attemptToken,record=await this.store.get(key);if(!record?.ready)return false;
  if(record.studentRef!==studentRef||record.prepared.examSessionToken!==prepared.examSessionToken||Number(record.prepared.generation)!==Number(prepared.generation))throw Error('Bản trên máy thuộc phiên khác. Giữ bài để giảng viên đối soát.');
  if(this.record&&this.record.prepared.attemptToken!==prepared.attemptToken)await this.detachLatest();
  this.record=record;this.key=key;await this.claim();this.anchor();await this.store.put('latest:'+this.classCode,{key});return true;
 }
  anchor(){
  this.clockWall=Date.now();this.clockMono=performance.now();this.clockServer=this.record?.lastNow||Date.parse(this.record?.prepared?.serverNow||new Date().toISOString());
  const elapsed=this.record?.savedWall===undefined?0:this.clockWall-this.record.savedWall;
  if(elapsed<0||!Number.isFinite(elapsed)){this.record.timeValid=false;this.observe('clock_review_required',{errorCode:'WALL_CLOCK_CHANGED'});}
  this.clockServer+=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
 }
 now(){return Math.max(this.clockServer+(performance.now()-this.clockMono),this.record?.lastNow||0);}
 async persist(critical=false,diagnostic=false){
  const run=this.record,key=this.key;
  if(!run)return;run.lastNow=this.now();run.savedWall=Date.now();
  if(critical){this.criticalSaves=(this.criticalSaves||0)+1;this.changed();}
  try{
   const saved=await this.store.put(key,run);
   run._revision=Math.max(run._revision||0,saved._revision);
   if(!diagnostic&&this.record===run){this.lastError='';this.changed();}
  }catch(e){
   if(!diagnostic&&this.record===run){
    this.lastError=e.message;this.observe('local_persist_failed',{errorCode:e.code||'LOCAL_PERSIST_FAILED'});this.changed();
   }
   throw e;
  }
  finally{if(critical){this.criticalSaves--;this.changed();}}
 }
 changed(){this.dispatchEvent(new Event('change'));}
 async prepare(prepared,{classCode,studentRef,mode}){
  const ownerKey=profile.localPrefix+'device:'+classCode;let ownerId;
  try{ownerId=localStorage.getItem(ownerKey)||crypto.randomUUID();localStorage.setItem(ownerKey,ownerId);}catch{throw failure();}
  const transport=profile.paper?{attemptMode:'answer_sheet',identityConfirmed:true}:{audioTransport:'r2-direct-v1'};
  const {audioDownload,...response}=await this.post('/offline/prepare',{attemptToken:prepared.attemptToken,examSessionToken:prepared.examSessionToken,generation:Number(prepared.generation)||0,ownerId,classCode,studentRef,mode,...transport},false);
  if(response.offline?.policy!==profile.policy||response.attemptToken!==prepared.attemptToken||response.examSessionToken!==prepared.examSessionToken||Number(response.generation)!==Number(prepared.generation)||(profile.paper&&response.attemptMode!=='answer_sheet'))throw Error('Chưa có quyền offline khớp lượt.');
  if(this.record&&this.record.prepared.attemptToken!==response.attemptToken)await this.detachLatest();
  this.record={classCode,studentRef,prepared:{...prepared,...response},snapshot:null,operations:[],receipts:{},sections:{},ready:false,player:{position:0,ended:false}};
  this.key='run:'+response.attemptToken;await this.claim();this.anchor();await this.persist();
  await this.store.put('latest:'+classCode,{key:this.key});
  return {...this.record.prepared,audioDownload};
 }
 async finishPreparation(blob){
  if(!profile.paper){
  const bytes=await blob.arrayBuffer(),audioHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  await this.store.put(this.key+':audio',{blob,hash:audioHash,bytes:blob.size});
  const read=await this.store.get(this.key+':audio');if(!(read?.blob instanceof Blob)||read.blob.size!==blob.size)throw Error('Chưa lưu được audio để mở lại offline.');
  this.record.audioHash=audioHash;this.record.audioBytes=blob.size;
  }
  await this.prepareCache();this.record.ready=true;
  try{await this.persist();}catch(error){this.record.ready=false;throw error;}
 }
 async audio(){const saved=await this.store.get(this.key+':audio');if(!(saved?.blob instanceof Blob))throw Error('Thiếu file audio đã lưu. Bài làm được giữ; hãy liên hệ giảng viên.');
  const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await saved.blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(actual!==this.record.audioHash)throw Error('Audio lưu trong máy chưa khớp. Bài làm được giữ.');return saved.blob;}
 async prepareCache(){
  if(!navigator.serviceWorker)throw Error('Trình duyệt chưa hỗ trợ mở lại bài offline.');
  const workerPath=this.workerPath||(profile.paper?'./offline-worker.js':'./offline-worker-audio-status-v2.js');
  const registration=await navigator.serviceWorker.register(workerPath+'?v='+BUILD,{scope:'./',type:'module',updateViaCache:'none'});
  if(registration.installing)await new Promise((ok,no)=>{const worker=registration.installing;worker.addEventListener('statechange',()=>{if(['installed','activated'].includes(worker.state))ok();if(worker.state==='redundant')no(Error('Chưa tải đủ gói web offline.'));});});
  if(registration.waiting){
   const waiting=registration.waiting;
   await new Promise((ok,no)=>{const channel=new MessageChannel(),id=setTimeout(()=>no(Error('Chưa đổi được vỏ offline; hãy thử lại.')),20000);channel.port1.onmessage=e=>{clearTimeout(id);e.data.ok?ok():no(Error(e.data.error));};waiting.postMessage({type:'ACTIVATE'},[channel.port2]);});
   if(waiting.state!=='activated')await new Promise((ok,no)=>{const id=setTimeout(()=>no(Error('Chưa kích hoạt bản offline mới.')),20000);waiting.addEventListener('statechange',()=>{if(waiting.state==='activated'){clearTimeout(id);ok();}else if(waiting.state==='redundant'){clearTimeout(id);no(Error('Bản offline chưa cài được.'));}});});
  }
  await navigator.serviceWorker.ready;
  const controlled=()=>Boolean(registration.active)&&navigator.serviceWorker.controller===registration.active;
  if(!controlled()){await new Promise((ok,no)=>{const id=setTimeout(()=>no(Error('Chưa kích hoạt được bản bài thi offline.')),20000),check=()=>{if(controlled()){clearTimeout(id);navigator.serviceWorker.removeEventListener('controllerchange',check);ok();}};navigator.serviceWorker.addEventListener('controllerchange',check);check();});}
  await new Promise((ok,no)=>{const channel=new MessageChannel(),id=setTimeout(()=>no(Error('Chưa kiểm xong tài nguyên offline.')),60000);channel.port1.onmessage=e=>{clearTimeout(id);e.data.ok&&e.data.build===BUILD?ok():no(Error(e.data.error||'Chưa tải đủ tài nguyên đúng build.'));};navigator.serviceWorker.controller.postMessage({type:'PREPARE',url:location.href},[channel.port2]);});
  try{await navigator.storage?.persist?.();}catch{}
 }
 saveSnapshot(snapshot){if(!this.active)return;this.record.snapshot=clone(snapshot);void this.persist(true).catch(()=>{});}
 async capture(snapshot){this.record.snapshot=clone(snapshot);await this.persist(true);}
 order(){const sections=this.record.prepared.examMode==='read_first'?['reading','listening']:['listening','reading'];if(!profile.paper)sections.push('writing');return sections;}
 sectionResponse(){const p=this.record.prepared,s=this.record.sections,order=this.order();return {...p,localOnly:true,completed:Boolean(s.listening?.sealed&&s.reading?.sealed),listeningSubmitted:Boolean(s.listening?.sealed),readingSubmitted:Boolean(s.reading?.sealed),
  ...(s.listening?.interrupted?{listeningInterrupted:true}:{}),nextSection:order.find(k=>!s[k]?.sealed&&!s[k]?.interrupted)||'result',...Object.fromEntries(order.flatMap(k=>[[k+'StartedAt',s[k]?.startedAt||null],[k+'DeadlineAt',s[k]?.deadlineAt||null]])),serverNow:new Date(this.now()).toISOString(),portalSyncStatus:'pending'};}
 async enqueue(section,kind,payload,revision,occurredAt,{verifiedRevision,reviewOnly=false,observedContent}={}){
  const run=this.record;
  const index=this.order().indexOf(section),prior=index?this.record.sections[this.order()[index-1]]:null;
  if(index<0)throw Error('Kỹ năng này không thuộc lượt thi.');
  if(index&&!prior?.sealed&&!prior?.interrupted)throw Error('Hãy khóa kỹ năng trước trước khi tiếp tục.');
  const item=this.record.sections[section];if(item?.sealed||item?.interrupted)throw Error('Bài đã khóa; không thay nội dung.');
  // DOM/IME có thể chốt giá trị cuối trước bộ đếm input của renderer.
  const content=kind==='interrupt'?item.content:canonical(section==='writing'?{[profile.taskId]:payload[profile.taskId]}:{answers:payload.answers});
  revision=Math.max(Number(revision)||0,item.revision||0);
  if(kind!=='start'&&item.content!==undefined&&item.content!==content)revision=Math.max(revision,(item.revision||0)+1);
  if(verifiedRevision!==undefined)revision=verifiedRevision;
  const op={...this.scope,operationId:crypto.randomUUID(),section,kind,revision:Number(revision)||0,occurredAt:occurredAt||new Date(this.now()).toISOString(),dependency:prior?.operationId||null,
   payload:{...payload,startedAt:item.startedAt,deadlineAt:item.deadlineAt,timeValid:!reviewOnly&&this.record.timeValid!==false}};
  if(kind==='draft')this.record.operations=this.record.operations.filter(x=>!(x.section===section&&x.kind==='draft'&&x.operationId!==this.inFlight));
  this.record.sections[section]={...item,revision,content,
   ...observedContent!==undefined?{unverifiedRestoredContent:observedContent}:{},
   ...kind==='seal'?{sealed:true,operationId:op.operationId}:{},...kind==='interrupt'?{interrupted:true,operationId:op.operationId}:{}};
  if(kind==='interrupt')this.pendingInterruptionId=op.operationId;
  this.record.operations.push(op);
  try{await this.persist(true);}
  catch(error){
   if(kind==='interrupt'){
    this.record.sections[section]=item;
    this.record.operations=this.record.operations.filter(operation=>operation.operationId!==op.operationId);
   }
   throw error;
  }finally{if(kind==='interrupt')this.pendingInterruptionId=null;}
  if(this.verifyRestoredDeadline&&(kind==='start'||kind==='draft')&&(section==='reading'||section==='writing')&&this.record===run){
   const current=run.sections[section],savedAt=this.now(),deadline=Date.parse(current.deadlineAt||'');
   if(!current.sealed&&savedAt<=deadline&&(!current.deadlineDraft||op.revision>=current.deadlineDraft.revision)){
    current.deadlineDraft={revision:op.revision,content,savedAt};
    await this.persist().catch(()=>{});
   }
  }
  if(kind==='seal'&&this.submissionRecovery&&this.record===run){
   this.observe('submission_device_saved',{section,operationId:op.operationId,revision:op.revision,
    capturedAtMs:Date.parse(op.occurredAt),automatic:payload.reason!=='manual'});
  }
  void this.flush();return op;
 }
 resumeDeadline(section){
  if(!this.verifyRestoredDeadline||!this.active)return;
  const item=this.record.sections[section],deadline=Date.parse(item?.deadlineAt||'');
  if(!item?.sealed&&this.now()>=deadline){
   if(this.restoredDeadlineRun!==this.record){
    this.restoredDeadlineRun=this.record;
    this.restoredDeadlines=new Set();
   }
   this.restoredDeadlines.add(section);
  }
 }
 async start(section){
  if(this.record.sections[section]?.startedAt){await this.persist();return this.sectionResponse();}
  if(!this.order().includes(section))throw Error('Kỹ năng này không thuộc lượt thi.');
  const timing=this.record.prepared.timing,start=this.now(),minutes=section==='reading'?timing?.readingDurationMinutes:timing?.writingDurationMinutes;
  this.record.sections[section]={startedAt:new Date(start).toISOString(),deadlineAt:profile.paper||section==='listening'?null:new Date(start+minutes*60000).toISOString(),sealed:false};
  await this.enqueue(section,'start',section==='writing'?{[profile.taskId]:''}:{answers:{}},0);return this.sectionResponse();
 }
 async draft(section,data,revision){
  if(!this.record.sections[section]?.startedAt||this.record.sections[section].sealed||this.record.sections[section].interrupted)return;
  const item=this.record.sections[section],deadline=Date.parse(item.deadlineAt||'');
  if(Number.isFinite(deadline)&&this.now()>deadline)return;
  await this.enqueue(section,'draft',section==='writing'?{[profile.taskId]:String(data[profile.taskId]??'')}:{answers:clone(data.answers||{})},revision);
 }
 async seal(section,data,revision,reason='manual'){
  if(this.record.sections[section]?.sealed){await this.persist();return this.sectionResponse();}
  if(this.record.sections[section]?.interrupted)throw Error('Lượt Listening đã khóa do gián đoạn.');
  if(section==='listening'&&reason!=='manual'&&!this.record.player.ended)throw Error('Audio chưa phát hết; không tự thu bài.');
  const item=this.record.sections[section];if(!item?.startedAt)throw Error('Chưa bắt đầu kỹ năng.');
  const at=this.now(),end=Date.parse(item.deadlineAt||'');
  // Timer callback muộn chỉ chốt ở deadline; editor đã khóa bởi bộ kiểm giờ của app.
  const p=section==='writing'?{[profile.taskId]:String(data[profile.taskId]??'')}:{answers:clone(data.answers||{})};
  if(section==='listening')Object.assign(p,{audioEnded:Boolean(this.record.player.ended),heardSeconds:this.record.player.position||0});
  if(this.verifyRestoredDeadline&&this.restoredDeadlineRun===this.record&&this.restoredDeadlines.has(section)&&at>=end){
   const draft=item.deadlineDraft,observedContent=canonical(p);
   const proven=draft&&Number.isSafeInteger(draft.revision)&&Number.isFinite(draft.savedAt)
    &&draft.savedAt>=Date.parse(item.startedAt)&&draft.savedAt<=end
    &&(draft.revision>0||draft.content===observedContent);
   const chosen=proven?JSON.parse(draft.content):p;
   const op=await this.enqueue(section,'seal',{...chosen,reason},revision,new Date(proven?end:at).toISOString(),{
    ...(proven?{verifiedRevision:draft.revision}:{reviewOnly:true}),
    ...(proven&&draft.content!==observedContent?{observedContent}:{})
   });
   this.observe(proven?'deadline_draft_verified':'deadline_draft_unverified',{
    section,operationId:op.operationId,revision:op.revision,deadlineAtMs:end,observedAtMs:at
   });
  }else await this.enqueue(section,'seal',{...p,reason},revision,new Date(Number.isFinite(end)?Math.min(end,at):at).toISOString());
  return this.sectionResponse();
 }
 async rememberHeld(run,op,held){
  if(!this.submissionRecovery||!op||op.kind!=='seal'||!held||!Number.isSafeInteger(held.heldAt)
     ||!Number.isSafeInteger(held.expiresAt)||held.expiresAt<=held.heldAt||held.payloadHash!==await hash(op))return false;
  if(this.record!==run||!this.owned||!run.operations.some(item=>item.operationId===op.operationId))return false;
  const holds=run.heldSubmissions||={};
  const previous=holds[op.operationId];
  if(previous?.payloadHash!==held.payloadHash||previous.expiresAt!==held.expiresAt){
   holds[op.operationId]={payloadHash:held.payloadHash,heldAt:held.heldAt,expiresAt:held.expiresAt};
   await this.persist().catch(()=>{});
  }
  return true;
 }
 async post(path,body,withPermit=true){
  const recovery=this.submissionRecovery,run=this.record;
  const track=!recovery||(run?.prepared?.attemptToken===body.attemptToken&&run?.prepared?.examSessionToken===body.examSessionToken
    &&Number(run.prepared.generation)===body.generation);
  const requestId=crypto.randomUUID(),began=performance.now();let status=null,errorCode=null;
  if(track)this.observe('request_sent',{requestId,operationId:body.operationId||null,endpoint:path,timeoutMs:8000});
  try{
  const response=await this.fetchImpl(this.apiBase+'/api/term-tests/'+profile.slug+path,{method:'POST',headers:{'Content-Type':'application/json','x-exam-journal-request-id':requestId,...(withPermit?{'x-term2-permit':this.record.prepared.offline.permit}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});status=response.status;
  let v;try{v=await response.json();}catch{throw Error('Chưa có xác nhận hợp lệ từ máy chủ.');}
  if(!response.ok||v.ok!==true)throw Object.assign(Error(v.message||'Máy chủ chưa nhận được bài.'),{status:response.status,code:v.error,...(recovery&&v.held?{held:v.held}:{})});return v;
  }catch(e){errorCode=/^[A-Z0-9_:-]{3,100}$/.test(e.code||'')?e.code:(['TimeoutError','AbortError'].includes(e.name)?'CLIENT_TIMEOUT':status?'HTTP_ERROR':'FETCH_FAILED');throw e;}
  finally{if(track&&this.record===run)this.observe('request_finished',{requestId,operationId:body.operationId||null,
   endpoint:path,httpStatus:status,errorCode,elapsedMs:performance.now()-began});}
 }
 async flush(){
  if(!this.active||this.busy||!this.pending||performance.now()<this.retryAt)return;
  if(this.record.review){
   await this.retainAfterReview();
   return;
  }
  if(mini&&globalThis.navigator?.onLine===false)return;
  const run=this.record;this.busy=true;
  try{while(this.pending&&this.record.operations[0].operationId!==this.pendingInterruptionId){const op=clone(this.record.operations[0]);this.inFlight=op.operationId;
   const status=await this.post('/offline/status',{...this.scope,operationId:op.operationId});
   if(this.record!==run||!this.owned)return;
   if(status.held)await this.rememberHeld(run,op,status.held);
   if(this.record!==run||!this.owned)return;
   const result=status.persisted?status:await this.post('/offline/operation',op),r=result.receipt;
   if(this.record!==run||!this.owned)return;
   if(!r||r.operationId!==op.operationId||r.attemptToken!==op.attemptToken||r.examSessionToken!==op.examSessionToken||r.generation!==op.generation||r.payloadHash!==await hash(op)||r.acceptedRevision!==op.revision)throw Error('Biên nhận chưa khớp bài đã khóa; bản trên máy vẫn được giữ.');
   this.record.receipts[op.operationId]=r;
   this.observe('receipt_read',{operationId:op.operationId,receiptId:r.receiptId||null,section:op.section,revision:op.revision,outcome:r.status});
   if(r.status!=='accepted'){
    if(result!==status&&result.held)await this.rememberHeld(run,op,result.held);
    if(this.record!==run||!this.owned)return;
    run.review=r.reason||'REVIEW_REQUIRED';await this.persist();break;
   }
   this.record.operations=this.record.operations.filter(x=>x.operationId!==op.operationId);
   if(run.heldSubmissions)delete run.heldSubmissions[op.operationId];
   if(run.submissionRetry?.operationId===op.operationId)delete run.submissionRetry;
   await this.persist();
  }this.failures=0;this.retryAt=0;}
  catch(e){
   if(this.record!==run||!this.owned)return;
   if(mini&&globalThis.navigator?.onLine===false)return;
   this.retryAt=performance.now()+Math.min(60000,1000*2**Math.min(6,this.failures++));
   const op=run.operations.find(item=>item.operationId===this.inFlight);
   const held=e.held&&await this.rememberHeld(run,op,e.held).catch(()=>false);
   if(this.record!==run||!this.owned)return;
   const retryCount=run.submissionRetry?.operationId===op?.operationId?(run.submissionRetry?.count||0):0;
   if(held&&['OFFLINE_START_REQUIRED','OFFLINE_DEPENDENCY'].includes(e.code)&&retryCount<3){
    run.submissionRetry={operationId:op.operationId,count:retryCount+1};
   }else if([400,401,403,409,422].includes(e.status))this.record.review=e.code||'REVIEW_REQUIRED';
   if(op&&run.heldSubmissions&&[401,403].includes(e.status))delete run.heldSubmissions[op.operationId];
   this.lastError='Bài vẫn được giữ trên thiết bị. '+e.message;this.changed();
   try{await this.store.put(this.key,this.record);}catch{}
  }
  finally{this.inFlight=null;this.busy=false;this.changed();}
 }
 async retainAfterReview(){
  const run=this.record;
  if(!this.submissionRecovery||run.prepared.offline.submissionHoldOnly!==true||globalThis.navigator?.onLine===false)return;
  const seals=run.operations.filter(op=>op.kind==='seal'&&!run.receipts[op.operationId]
    &&!run.heldSubmissions?.[op.operationId]&&!run.holdOnlySkipped?.[op.operationId]);
  if(!seals.length)return;
  this.busy=true;
  try{
   for(const op of seals){
    if(this.record!==run||!this.owned)return;
    try{
     const result=await this.post('/offline/hold',clone(op));
     if(this.record!==run||!this.owned)return;
     if(result.alreadyRecorded!==true){
      if(!await this.rememberHeld(run,op,result.held))throw Error('Bản đối soát chưa khớp bài đã khóa.');
      continue;
     }
    }catch(error){
     if(this.record!==run||!this.owned)return;
     if(![400,401,403,404,409,422].includes(error.status)){
      this.retryAt=performance.now()+Math.min(60000,1000*2**Math.min(6,this.failures++));
      return;
     }
    }
    (run.holdOnlySkipped||={})[op.operationId]=true;
    await this.persist().catch(()=>{});
   }
   this.failures=0;this.retryAt=0;
  }finally{this.busy=false;this.changed();}
 }
 mountListeningSavedCard(card){
  const labels=[...card.querySelectorAll('.eyebrow, h2, h2 + p')];
  const original=labels.map(label=>label.textContent);
  const render=()=>{
   const listening=this.record.sections.listening;
   const waiting=listening?.sealed&&this.record.receipts[listening.operationId]?.status!=='accepted';
   const copy=waiting?['Đã lưu bài Listening','Bài Listening đã lưu trên thiết bị',
    'Bạn có thể tiếp tục làm Reading. Hãy giữ bài trên thiết bị để đồng bộ khi có mạng.']:original;
   labels.forEach((label,index)=>{if(label.textContent!==copy[index])label.textContent=copy[index];});
  };
  this.addEventListener('change',render);
  render();
 }
 mountResultCard(card,{showBlankWriting=false}={}){
  const labels=[...card.querySelectorAll('.eyebrow, h2, h2 + p')];
  const original=labels.map(label=>label.textContent);
  const button=card.querySelector('#viewResult');
  let status='', locked=false;
  const render=()=>{
   const blank=showBlankWriting&&Object.values(this.record.receipts).some(receipt=>
    receipt.kind==='seal'&&receipt.section==='writing'&&receipt.status==='accepted'&&receipt.writingBlank);
   const next=this.record.review?'review':this.pending?'pending':blank?'blank':'';
   if(next===status)return;
   status=next;
   const copy={
    pending:['Bài làm đã khóa','Bài làm đã khóa trên thiết bị','Bài đã lưu trên thiết bị và đang chờ máy chủ xác nhận.'],
    review:['Bài làm đã khóa','Bài làm cần được đối soát','Bài đã lưu trên thiết bị. Hãy báo giảng viên để kiểm tra.'],
    blank:['Máy chủ đã nhận bài','Đã nộp · Bài trắng','Máy chủ đã nhận đoạn văn để trống.']
   }[next]||original;
   labels.forEach((label,index)=>{if(label.textContent!==copy[index])label.textContent=copy[index];});
   const waiting=next==='pending'||next==='review';
   if(waiting!==locked){locked=waiting;button.disabled=waiting;}
  };
  this.addEventListener('change',render);
  render();
 }
 mount({snapshot,host}){
  if(!this.active||this.panel?.isConnected)return;
  this.unmountStatus?.();
  const panel=document.createElement('div');panel.className='writing-save-status';panel.setAttribute('role','status');
  const copy=document.createElement('span'),button=document.createElement('button');button.type='button';button.className='button button-secondary';button.textContent='Tải bài làm về máy';panel.append(copy);(document.querySelector('.topbar')||panel).append(button);host.append(panel);this.panel=panel;
  const render=()=>{if(copy.textContent!==this.message)copy.textContent=this.message;};this.addEventListener('change',render);render();
  this.unmountStatus=()=>{this.removeEventListener('change',render);panel.remove();button.remove();};
  button.addEventListener('click',async()=>{try{await this.capture(snapshot());}catch{}const html=exportHtml(this.record),url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`${profile.filePrefix}-${this.classCode}-${this.scope.attemptToken.slice(0,8)}-r${this.record._revision||0}.html`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);copy.textContent='Đã tạo file tải xuống. Hãy kiểm tra file trong thư mục tải về.';});
 }
 attachPlayer({audio,resumeButton,manualButton,render,form,observeListening}){
  let held=Boolean(this.record.player.held),holdEpoch=0,submitted=false,last=audio.currentTime,lastAt=performance.now(),persistAt=0;const oldPosition=this.record.player.position||0;
  let incidentId=null;
  const eofObserved=new Set();
  const diagnose=(phase,details={})=>{try{observeListening?.({phase,...details});}catch{}};
  if(oldPosition>0&&!this.record.player.ended)audio.currentTime=Math.min(oldPosition,Math.max(0,audio.duration-.25));
  const lock=value=>{for(const input of form.querySelectorAll('input:not([type="range"]),select,textarea'))input.disabled=value;};
  const update=()=>{render(held?'Audio đang dừng — bài làm đã giữ':audio.ended?'Đã phát hết audio':'Đang phát bài thi',audio.currentTime,audio.duration);};
  const showPlayButton=()=>{
   const label=this.record.player.position>0?'Tiếp tục audio':'Phát audio';
   resumeButton.textContent=label;resumeButton.hidden=false;return label;
  };
  const hold=reason=>{if(submitted||audio.ended)return;held=true;holdEpoch++;this.record.player.held=true;this.observe('audio_command',{command:'pause',actor:'media_or_learner',position:audio.currentTime,ended:audio.ended,paused:audio.paused});audio.pause();lock(true);showPlayButton();render(reason+' · Không tự thu bài khi chưa nghe hết',audio.currentTime,audio.duration);void this.persist().catch(()=>{});};
  const playBlocked=({keepHeld=false}={})=>{
   const label=showPlayButton();
   const message='Trình duyệt chưa cho phát. Hãy bấm '+label;
   if(keepHeld)hold(message);else render(message,audio.currentTime,audio.duration);
  };
  manualButton.addEventListener('click',()=>{
   const report=observeListening&&!submitted&&!audio.ended;
   hold('Hãy kiểm tra tai nghe rồi tiếp tục đúng mốc');
   if(report){try{incidentId ||= crypto.randomUUID();diagnose('manual_pause',{incidentId});}catch{}}
  });
  audio.addEventListener('error',()=>hold('Trình phát gặp sự cố; bài làm và mốc nghe được giữ'));
  audio.addEventListener('playing',()=>{lastAt=performance.now();});
  audio.addEventListener('pause',()=>{if(!held&&!submitted&&!audio.ended&&this.record.sections.listening?.startedAt&&!this.record.sections.listening.sealed)hold('Audio đang dừng; thời gian chờ không được thu bài');});
  audio.addEventListener('timeupdate',()=>{
   if(submitted)return;
   if(audio.currentTime>last+.05){last=audio.currentTime;lastAt=performance.now();}
   this.record.player.position=Math.max(this.record.player.position||0,audio.currentTime);
   if(performance.now()-persistAt>750){persistAt=performance.now();void this.persist().catch(()=>{});}update();
  });
  audio.addEventListener('ended',async event=>{
   const expected=Number(this.record.prepared.timing.listeningDurationSeconds);
   if(submitted||!this.record.sections.listening?.startedAt)return;
   let decision='eof_accepted';
   if(!event.isTrusted)decision='eof_untrusted';
   else if(!audio.ended||audio.seeking||!Number.isFinite(audio.duration))decision='eof_media_state';
   else if(Math.abs(audio.duration-expected)>2)decision='eof_duration_mismatch';
   else if(audio.currentTime<audio.duration-.5)decision='eof_position_short';
   if(observeListening&&!eofObserved.has(decision)){
    eofObserved.add(decision);diagnose(decision,{configuredDurationSeconds:expected});
   }
   if(decision!=='eof_accepted')return;
   this.observe('audio_ended',{position:audio.currentTime,duration:audio.duration});this.record.player={position:audio.currentTime,ended:true};await this.persist();
   const button=document.createElement('button');button.type='submit';button.hidden=true;button.dataset.autoSubmit='true';form.append(button);form.requestSubmit(button);
  });
  const waitMedia=(event,action)=>new Promise((ok,no)=>{const clean=()=>{clearTimeout(timer);audio.removeEventListener(event,done);audio.removeEventListener('error',bad);},done=()=>{clean();ok();},bad=()=>{clean();no(Error('Chưa khôi phục được trình phát; bài và mốc nghe vẫn giữ.'));},timer=setTimeout(bad,10000);audio.addEventListener(event,done,{once:true});audio.addEventListener('error',bad,{once:true});try{action();}catch(e){clean();no(e);}});
  resumeButton.addEventListener('click',async()=>{if(resumeButton.disabled)return;const resumeEpoch=holdEpoch;resumeButton.disabled=true;try{
   if(audio.error||!Number.isFinite(audio.duration)){this.observe('audio_command',{command:'load',actor:'local_recovery',reasonCode:'RESET_LOCAL_DECODER'});await waitMedia('loadedmetadata',()=>audio.load());}
   if(!Number.isFinite(audio.duration)||audio.duration<=0)throw Error('Chưa đọc được thời lượng audio để tiếp tục đúng mốc.');
   const checkpoint=Math.min(this.record.player.position||0,Math.max(0,audio.duration-.25));
   if(audio.currentTime<checkpoint-.25){this.observe('audio_command',{command:'seek',actor:'local_recovery',position:audio.currentTime,target:checkpoint,reasonCode:'RESTORE_LOCAL_CHECKPOINT'});await waitMedia('seeked',()=>{audio.currentTime=checkpoint;});}
   if(resumeEpoch!==holdEpoch)return;
   const before=audio.currentTime;await audio.play();await new Promise(ok=>setTimeout(ok,3000));if(resumeEpoch!==holdEpoch)return;
   if(!this.record.player.ended&&audio.currentTime<=before+.5)throw Error('Audio chưa tiến lên. Hãy báo giảng viên; bài vẫn được giữ.');
   held=false;this.record.player.held=false;last=audio.currentTime;lastAt=performance.now();lock(false);resumeButton.hidden=true;void this.persist().catch(()=>{});update();
   if(incidentId){diagnose('local_resumed',{incidentId});incidentId=null;}
  }catch(e){hold(e.message);}finally{resumeButton.disabled=false;}});
  const timer=setInterval(()=>{if(!this.record.sections.listening?.startedAt||this.record.sections.listening.sealed||form.hidden||held||submitted)return;
   if(!audio.ended&&performance.now()-lastAt>5000)hold('Audio chưa tiến lên. Giữ đúng mốc để phục hồi');},1000);
  const controller={hold,playBlocked,beforeAutoSubmit:async()=>({submit:Boolean(this.record.player.ended),deadlineChanged:!this.record.player.ended}),submitting(){},submitFailed(){},finish(){submitted=true;audio.pause();clearInterval(timer);}};
  if(held){lock(true);showPlayButton();}
  window.K56_LISTENING_AUDIO=controller;this.player=audio;this.playerReady=true;update();return controller;
 }
}

return {BUILD,canonical,hash,ExamStore,exportHtml,OfflineRuntime};
}

// Opt in only for CBT routes with a server that accepts interruption operations.
export function withListeningContinuity(OfflineRuntime) {
 return class extends OfflineRuntime {
  preloadListening(blob, onReady, onFailure) {
   const audio = document.createElement('audio');
   const url = URL.createObjectURL(blob);
   const began = performance.now();
   const entry = { audio, url, ready: false, discard };
   audio.hidden = true;
   audio.preload = 'auto';
   document.body.append(audio);
   const timeout = setTimeout(failed, 15000);
   function cleanup() {
    clearTimeout(timeout);
    audio.removeEventListener('canplay', ready);
    audio.removeEventListener('error', failed);
   }
   function discard() {
    cleanup();
    audio.remove();
    URL.revokeObjectURL(url);
   }
   function failed() { onFailure(); }
   const runtime = this;
   function ready() {
    cleanup();
    entry.ready = true;
    runtime.observe('audio_player_ready', { elapsedMs: performance.now() - began });
    onReady();
   }
   audio.addEventListener('canplay', ready);
   audio.addEventListener('error', failed);
   audio.src = url;
   return entry;
  }

  showListeningInterruption(onContinue) {
    if (!this.record.sections.listening?.interrupted || this.record.listeningInterruptionAcknowledged
      || document.getElementById('offlineListeningInterrupted')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'offlineListeningInterrupted';
    dialog.className = 'cbt-identity-confirm';
    dialog.setAttribute('aria-label', 'Listening gián đoạn');
    const message = document.createElement('p');
    message.textContent = 'Bài thi listening cần được nghe liền mạch không trục trặc để đánh giá đúng năng lực thí sinh. Khi bạn không nghe được âm thanh, bạn không nên tiếp tục listening. Hãy tiếp tục làm kỹ năng tiếp theo, và sau buổi thi hãy liên hệ giảng viên để được nhận bài Listening thay thế.';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button-primary';
    button.textContent = 'Tôi đã hiểu. Đến phần thi tiếp theo.';
    dialog.addEventListener('cancel', event => event.preventDefault());
    button.addEventListener('click', async () => {
      button.disabled = true;
      this.record.listeningInterruptionAcknowledged = true;
      try { await this.persist(true); }
      catch {
        delete this.record.listeningInterruptionAcknowledged;
        status.textContent = 'Chưa lưu được xác nhận trên thiết bị. Hãy thử lại.';
        button.disabled = false;
        return;
      }
      dialog.close();
      dialog.remove();
      onContinue(this.sectionResponse());
    });
    dialog.append(message, status, button);
    document.body.append(dialog);
    dialog.showModal();
  }

 attachPlayer({ audio, resumeButton, manualButton, render, form, observeListening }) {
  const run = this.record;
  let started = false;
  let terminal = '';
  let interrupting = false;
  let playPending = false;
  const update = (message = 'Đang phát bài thi') => render(message, audio.currentTime, audio.duration);
  const submit = () => {
   const button = document.createElement('button');
   button.type = 'submit';
   button.hidden = true;
   button.dataset.autoSubmit = 'true';
   form.append(button);
   form.requestSubmit(button);
   button.remove();
  };
  const playBlocked = () => {
   if (started || terminal) return;
   resumeButton.textContent = 'Phát audio';
   resumeButton.hidden = false;
   update('Trình duyệt chưa cho phát. Hãy bấm Phát audio');
  };
  const canStart = () => this.record === run && this.owned && this.player === audio
   && !started && !terminal && !run.sections.listening?.sealed && !run.sections.listening?.interrupted;
  const playInitial = async () => {
   if (playPending || !canStart()) return;
   playPending = true;
   resumeButton.disabled = true;
   try {
    // A reload can retry only a confirmed rejection. Consume that evidence before calling play again.
    if (run.player.initialPlayBlocked === true) {
     delete run.player.initialPlayBlocked;
     try { await this.persist(true); }
     catch {
      if (canStart()) {
       run.player.initialPlayBlocked = true;
       playBlocked();
       update('Chưa lưu được lần thử phát. Hãy bấm Phát audio để thử lại.');
      }
      return;
     }
    }
    if (!canStart()) return;
    try { await audio.play(); }
    catch (error) {
     if (!canStart()) return;
     if (error?.name === 'NotAllowedError' && audio.paused && audio.currentTime === 0) {
      run.player.initialPlayBlocked = true;
      this.observe('audio_diagnostic', { event: 'play_blocked_before_start', position: 0 });
      try { await this.persist(true); }
      catch { /* The same tab can retry. A reload only trusts evidence that was saved. */ }
     }
     if (canStart()) playBlocked();
    }
   } finally {
    playPending = false;
    if (canStart()) resumeButton.disabled = false;
   }
  };
  resumeButton.addEventListener('click', () => { void playInitial(); });
  audio.addEventListener('playing', () => {
   if (!started) this.observe('audio_playing', { position: audio.currentTime,
    ...(this.listeningStartIntent === undefined ? {} : { elapsedMs: performance.now() - this.listeningStartIntent }) });
   started = true;
   resumeButton.hidden = true;
   if (!terminal) update();
  });
  audio.addEventListener('timeupdate', () => { if (!terminal) update(); });
  for (const event of ['waiting', 'error']) audio.addEventListener(event, () => {
   if (!terminal) this.observe('audio_diagnostic', { event, position: audio.currentTime });
  });
  manualButton.addEventListener('click', async () => {
   if (interrupting || (terminal && terminal !== 'interrupt') || audio.ended) return;
   interrupting = true;
   terminal = 'interrupt';
   manualButton.disabled = true;
   if (!audio.paused) audio.pause();
   for (const control of form.querySelectorAll('input:not([type="range"]),select,textarea,button[type="submit"]')) control.disabled = true;
   try {
    await this.interruptListening('learner_cannot_hear');
    form.dispatchEvent(new Event('term-test:listening-interrupted'));
   } catch {
    update('Chưa lưu được trạng thái gián đoạn. Hãy bấm Tôi không nghe được để thử lưu lại.');
    manualButton.disabled = false;
   } finally { interrupting = false; }
  });
  audio.addEventListener('ended', async event => {
   const expected = Number(this.record.prepared.timing.listeningDurationSeconds);
   if (terminal || !event.isTrusted || !audio.ended || audio.seeking || !Number.isFinite(audio.duration)
       || Math.abs(audio.duration - expected) > 2 || audio.currentTime < audio.duration - 0.5) return;
   terminal = 'ended';
   try { observeListening?.({ phase: 'eof_accepted', configuredDurationSeconds: expected }); } catch { /* Chẩn đoán không chặn thu bài. */ }
   this.observe('audio_ended', { position: audio.currentTime, duration: audio.duration });
   this.record.player = { position: audio.currentTime, ended: true };
   update('Đã phát hết audio');
   submit();
  });
  const controller = {
   playBlocked,
   playInitial,
   beforeAutoSubmit: async () => ({ submit: Boolean(this.record.player.ended), deadlineChanged: !this.record.player.ended }),
   submitting: () => {
    if (terminal) return;
    terminal = 'manual';
    manualButton.disabled = true;
    this.observe('listening_early_submit_confirmed');
    if (!audio.paused) audio.pause();
   },
   submitFailed() {},
   finish() { terminal ||= 'submitted'; manualButton.disabled = true; }
  };
  window.K56_LISTENING_AUDIO = controller;
  this.player = audio;
  this.playerReady = true;
  update();
  return controller;
 }

 async interruptListening(reason) {
  if (!['learner_cannot_hear', 'page_interrupted'].includes(reason)) throw Error('Lý do gián đoạn không hợp lệ.');
  if (this.interruptionPending) return this.interruptionPending;
  const listening = this.record.sections.listening;
  if (!listening?.startedAt || listening.sealed) throw Error('Lượt Listening đã kết thúc hoặc chưa bắt đầu.');
  if (listening.interrupted) return this.sectionResponse();
  this.interruptionPending = this.enqueue('listening', 'interrupt', { interruptionReason: reason }, listening.revision)
   .then(operation => {
    this.observe('listening_interrupted', { operationId: operation.operationId, reason });
    return this.sectionResponse();
   });
  try { return await this.interruptionPending; }
  finally { this.interruptionPending = null; }
 }

 async seal(section, data, revision, reason) {
  const alreadySealed = this.record.sections[section]?.sealed;
  const response = await super.seal(section, data, revision, reason);
  if (section === 'listening' && !alreadySealed) {
   this.observe('listening_local_collected', { operationId: this.record.sections.listening.operationId, reason });
  }
  return response;
 }
 };
}

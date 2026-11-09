// Kho và contract dùng dữ liệu giả; browser test kiểm IndexedDB/player thật riêng.
import test from 'node:test';import assert from 'node:assert/strict';
import {ExamStore,Term1Offline,exportHtml,hash} from '../term-tests/term-test-1-k56-computer-based/offline.mjs';
import {readFile} from 'node:fs/promises';
import {AUDIO,downloadWhole} from '../term-tests/term-test-1-k56-computer-based/audio-whole.mjs';
const local=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('Kho lỗi không báo lưu; fallback bền chọn revision, không theo giờ máy',async()=>{
 const storage=local(),store=await new ExamStore({local:storage,idb:null}).open();await store.put('run',{answer:'new',_savedAt:1});
 assert.equal((await store.get('run')).answer,'new');
 const denied=new ExamStore({idb:null,local:{setItem(){throw Error('quota');},getItem(){return null;}}});await assert.rejects(denied.open(),e=>e.code==='LOCAL_PERSIST_FAILED');
});
test('Tải file giữ nguyên Unicode và escape, không xuất quyền/khóa',()=>{
 const token=crypto.randomUUID(),session=crypto.randomUUID();
 const html=exportHtml({classCode:'FIXTURE',prepared:{attemptToken:token,offline:{permit:'SECRET_DO_NOT_EXPORT'},audioKey:'SECRET_KEY'},receipts:{one:{attemptToken:token,examSessionToken:session,receiptId:'receipt-public'}},snapshot:{studentName:'Tên giả',drafts:{writing:{task2:'<script>secret()</script>\nTiếng Việt'}}},operations:[]});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('Tiếng Việt'));assert.ok(!html.includes('SECRET_'));assert.ok(!html.includes('<script>'));
 assert.ok(!html.includes(token));assert.ok(!html.includes(session));assert.ok(html.includes('receipt-public'));
});
async function runtime(fetchImpl){const store=await new ExamStore({idb:null,local:local()}).open(),r=new Term1Offline({apiBase:'https://fixture.invalid',classCode:'FIXTURE',store,fetchImpl});
 r.record={ready:true,prepared:{attemptToken:crypto.randomUUID(),examSessionToken:crypto.randomUUID(),generation:0,examMode:'lis_first',serverNow:new Date().toISOString(),timing:{readingDurationMinutes:60,writingDurationMinutes:30},offline:{ownerId:crypto.randomUUID(),permit:'fixture'}},sections:{},player:{position:10,ended:false},receipts:{},operations:[]};r.key='fixture';r.owned=true;r.anchor();return r;}
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});
const completedReading=()=>({reading:{operationId:crypto.randomUUID(),startedAt:'2026-11-08T00:00:00.000Z',deadlineAt:'2026-11-08T00:40:00.000Z',revision:3}});
test('Bài chính nhận Reading đã chốt qua link dự phòng và tiếp tục theo đúng thứ tự',async()=>{
 for(const mode of ['lis_first','read_first']){
  const completedElsewhere=completedReading();let calls=0;
  const r=await runtime(async(url,options)=>{
   assert.match(url,/\/offline\/resume$/);assert.equal(options.headers['x-term2-permit'],'fixture');
   assert.deepEqual(JSON.parse(options.body),r.scope);calls++;return response({completedElsewhere});
  });
  r.record.prepared.examMode=mode;
  r.record.snapshot={drafts:{reading:{'1':'nháp thiết bị này'}}};
  if(mode==='lis_first') r.record.sections.listening={sealed:true};
  r.record.sections.reading={startedAt:completedElsewhere.reading.startedAt,sealed:false};
  await r.refreshCompletedElsewhere();
  assert.equal(calls,1);assert.equal(r.sectionResponse().nextSection,mode==='lis_first'?'writing':'listening');
  const stored=await r.store.get(r.key);
  assert.equal(stored.sections.reading.operationId,completedElsewhere.reading.operationId);
  assert.equal(stored.snapshot.drafts.reading['1'],'nháp thiết bị này');
  assert.deepEqual(stored.receipts,{});
  r.fetchImpl=async()=>{throw Error('offline');};
  const section=r.sectionResponse().nextSection;
  await r.start(section);
  assert.equal(r.record.operations[0].dependency,completedElsewhere.reading.operationId);
 }
});
test('Giữ nguyên nháp và hàng đợi nếu mốc chốt mới xung đột với bản trên máy',async()=>{
 const r=await runtime(async()=>{throw Error('offline');});
 const marker=completedReading();
 r.record.sections.reading={sealed:true,startedAt:marker.reading.startedAt,operationId:crypto.randomUUID()};
 r.record.operations.push({section:'writing',dependency:r.record.sections.reading.operationId});
 const local=structuredClone(r.record);
 await r.applyCompletedElsewhere(marker);
 assert.deepEqual(r.record,local);
 assert.equal(r.diagnostics.at(-1).action,'fallback_progress_conflict');
});
test('HTTP 200 thiếu receipt không xóa pending; lỗi mạng không gọi player',async()=>{
 const r=await runtime(async()=>response({ok:true,persisted:true}));let pause=0;r.player={pause(){pause++;}};
 await r.start('listening');await new Promise(ok=>setTimeout(ok,20));assert.equal(r.pending,1);assert.equal(pause,0);assert.match(r.message,/giữ|xác nhận/);
});
test('Từ chối quyền giữ nguyên bài chờ và bản khóa để hỗ trợ',async()=>{
 const r=await runtime(async()=>response({ok:false,error:'STALE_GENERATION',message:'giữ bài'},403));await r.start('listening');await new Promise(ok=>setTimeout(ok,20));assert.equal(r.pending,1);assert.equal(r.record.review,'STALE_GENERATION');assert.ok((await r.store.get(r.key)).operations.length);
});
test('ACK mất: receipt cùng operation/hash được đọc lại, không gửi bản thứ hai',async()=>{
 let writes=0,last;const receipts=new Map();const r=await runtime(async(url,options)=>{const b=JSON.parse(options.body);
  if(url.endsWith('/status'))return response({ok:true,persisted:receipts.has(b.operationId),receipt:receipts.get(b.operationId)});
  writes++;const receipt={...r.scope,version:1,operationId:b.operationId,payloadHash:await hash(b),acceptedRevision:b.revision,status:'accepted'};receipts.set(b.operationId,receipt);throw Error('response lost');});
 await r.start('listening');await new Promise(ok=>setTimeout(ok,20));assert.equal(r.pending,1);r.retryAt=0;await r.flush();assert.equal(r.pending,0);assert.equal(writes,1);
});
test('Không tự thu Listening chỉ do deadline hoặc play Promise thành công',async()=>{
 const r=await runtime(async()=>{throw Error('offline');});await r.start('listening');await assert.rejects(r.seal('listening',{answers:{}},0,'deadline'),/chưa phát hết/);assert.equal(r.record.sections.listening.sealed,false);
});
test('Gián đoạn khi offline được lưu một lần, không biến thành bài Listening đã nộp',async()=>{
 for(const mode of ['lis_first','read_first']){
  const r=await runtime(async()=>{throw Error('offline');});r.record.prepared.examMode=mode;
  if(mode==='read_first'){await r.start('reading');await r.seal('reading',{answers:{}},0);}
  await r.start('listening');
  const [first,second]=await Promise.all([r.interruptListening('learner_cannot_hear'),r.interruptListening('page_interrupted')]);
  assert.deepEqual(first,second);
  assert.equal(first.listeningInterrupted,true);assert.equal(first.listeningSubmitted,false);
  const next=mode==='lis_first'?'reading':'writing';assert.equal(first.nextSection,next);
  const stored=await r.store.get(r.key);const markers=stored.operations.filter(op=>op.kind==='interrupt');
  assert.equal(markers.length,1);assert.equal(markers[0].payload.interruptionReason,'learner_cannot_hear');
  assert.equal(stored.sections[next],undefined);
  await assert.rejects(r.seal('listening',{answers:{}},0),/gián đoạn/);
  await r.start(next);assert.equal(r.record.operations.at(-1).dependency,markers[0].operationId);
 }
});
test('Kho lỗi khi báo gián đoạn thì chưa đổi kỹ năng hay gửi trạng thái',async()=>{
 const r=await runtime(async()=>{throw Error('offline');});await r.start('listening');
 const saved=await r.store.get(r.key);
 r.store.put=async()=>{throw Error('quota');};
 await assert.rejects(r.interruptListening('learner_cannot_hear'),/quota/);
 assert.equal(r.sectionResponse().nextSection,'listening');
 assert.equal(r.record.operations.length,saved.operations.length);
 assert.equal(r.record.sections.listening.interrupted,undefined);
});
test('Đổi người giữ run cũ và bỏ ACK đang bay, không gắn vào lượt mới',async()=>{
 let finish;const r=await runtime(async()=>await new Promise(ok=>{finish=ok;}));
 await r.start('listening');await new Promise(ok=>setTimeout(ok,10));const key=r.key;
 await r.detachLatest();finish(response({ok:true,persisted:false}));await new Promise(ok=>setTimeout(ok,20));
 assert.equal(r.record,null);assert.equal((await r.store.get('latest:FIXTURE')).key,null);assert.equal((await r.store.get(key)).operations.length,1);
});
test('Đổi người sau lỗi chuẩn bị phải nhả lock lượt cũ và claim lượt mới',async()=>{
 const r=await runtime(async()=>{throw Error('offline');}),storage=local(),previous=globalThis.localStorage;globalThis.localStorage=storage;
 try{r.record.ready=false;r.record.snapshot={drafts:{writing:{task2:'kept old run'}}};const oldKey=r.key;let released=false;r.release=()=>{released=true;};
  const prepared={...r.record.prepared,attemptToken:crypto.randomUUID(),examSessionToken:crypto.randomUUID()};
  r.post=async()=>({...prepared,offline:{...prepared.offline,policy:'term1-offline-v1'}});
  r.claim=async()=>{assert.equal(released,true);assert.equal(r.owned,false);assert.equal(r.record.prepared.attemptToken,prepared.attemptToken);r.owned=true;};
  await r.prepare(prepared,{classCode:'FIXTURE',studentRef:crypto.randomUUID(),mode:'lis_first'});assert.equal((await r.store.get(oldKey)).snapshot.drafts.writing.task2,'kept old run');assert.equal(r.key,'run:'+prepared.attemptToken);
 }finally{globalThis.localStorage=previous;}
});
test('Giờ máy lùi khi mở lại được đánh dấu đối soát, không giả giờ hợp lệ',async()=>{
 const r=await runtime(async()=>{throw Error('offline');});r.record.lastNow=Date.now();r.record.savedWall=Date.now()+60000;
 const before=r.record.lastNow;r.anchor();assert.equal(r.record.timeValid,false);assert.ok(r.now()>=before);assert.ok(r.now()<before+1000);
});
test('Giá trị cuối cùng khác draft cùng counter có revision mới khi khóa',async()=>{
 const r=await runtime(async()=>{throw Error('offline');});await r.start('listening');await r.draft('listening',{answers:{1:'old'}},1);
 await r.seal('listening',{answers:{1:'last focused input'}},1);const last=r.record.operations.at(-1);
 assert.equal(last.revision,2);assert.equal(last.payload.answers[1],'last focused input');
});
test('Thiếu descriptor chỉ tải đúng Pages và từ chối khi byte/hash sai',async()=>{
 const file=new URL(AUDIO.pagesUrl).pathname.split('/').pop();
 const bytes=await readFile(new URL('../term-tests/k56-audio-assets/'+file,import.meta.url));
 const seen=[];
 const blob=await downloadWhole({fetchImpl:async url=>{seen.push(url);return new Response(bytes);}});
 assert.equal(blob.size,AUDIO.bytes);
 assert.deepEqual(seen,[AUDIO.pagesUrl]);
 await assert.rejects(downloadWhole({fetchImpl:async()=>new Response('short')}),error=>/byte\/hash/.test(error.cause?.message));
 bytes[0]^=1;
 await assert.rejects(downloadWhole({fetchImpl:async()=>new Response(bytes)}),error=>/byte\/hash/.test(error.cause?.message));
});

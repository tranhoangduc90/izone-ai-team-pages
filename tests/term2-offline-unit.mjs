// Kho và contract dùng dữ liệu giả; browser test kiểm IndexedDB/player thật riêng.
import test from 'node:test';import assert from 'node:assert/strict';
import {ExamStore,Term2Offline,exportHtml,hash} from '../term-tests/term-test-2-k56-computer-based/offline.mjs';
import {downloadWhole} from '../term-tests/term-test-2-k56-computer-based/audio-whole.mjs';
const local=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('Kho lỗi không báo lưu; fallback bền chọn revision, không theo giờ máy',async()=>{
 const storage=local(),store=await new ExamStore({local:storage,idb:null}).open();await store.put('run',{answer:'new',_savedAt:1});
 assert.equal((await store.get('run')).answer,'new');
 const denied=new ExamStore({idb:null,local:{setItem(){throw Error('quota');},getItem(){return null;}}});await assert.rejects(denied.open(),e=>e.code==='LOCAL_PERSIST_FAILED');
});
test('Tải file giữ nguyên Unicode và escape, không xuất quyền/khóa',()=>{
 const token=crypto.randomUUID(),session=crypto.randomUUID();
 const html=exportHtml({classCode:'FIXTURE',prepared:{attemptToken:token,offline:{permit:'SECRET_DO_NOT_EXPORT'},audioKey:'SECRET_KEY'},receipts:{one:{attemptToken:token,examSessionToken:session,receiptId:'receipt-public'}},snapshot:{studentName:'Tên giả',drafts:{writing:{task1:'<script>secret()</script>\nTiếng Việt'}}},operations:[]});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('Tiếng Việt'));assert.ok(!html.includes('SECRET_'));assert.ok(!html.includes('<script>'));
 assert.ok(!html.includes(token));assert.ok(!html.includes(session));assert.ok(html.includes('receipt-public'));
});
async function runtime(fetchImpl){const store=await new ExamStore({idb:null,local:local()}).open(),r=new Term2Offline({apiBase:'https://fixture.invalid',classCode:'FIXTURE',store,fetchImpl});
 r.record={ready:true,prepared:{attemptToken:crypto.randomUUID(),examSessionToken:crypto.randomUUID(),generation:0,examMode:'lis_first',serverNow:new Date().toISOString(),timing:{readingDurationMinutes:60,writingDurationMinutes:30},offline:{ownerId:crypto.randomUUID(),permit:'fixture'}},sections:{},player:{position:10,ended:false},receipts:{},operations:[]};r.key='fixture';r.owned=true;r.anchor();return r;}
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});
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
test('Đổi người giữ run cũ và bỏ ACK đang bay, không gắn vào lượt mới',async()=>{
 let finish;const r=await runtime(async()=>await new Promise(ok=>{finish=ok;}));
 await r.start('listening');await new Promise(ok=>setTimeout(ok,10));const key=r.key;
 await r.detachLatest();finish(response({ok:true,persisted:false}));await new Promise(ok=>setTimeout(ok,20));
 assert.equal(r.record,null);assert.equal((await r.store.get('latest:FIXTURE')).key,null);assert.equal((await r.store.get(key)).operations.length,1);
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
test('Pages sai hash phải dùng Cloudinary; thiếu file cả hai không báo ready',async()=>{
 const bytes=new TextEncoder().encode('fixture audio'),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''),seen=[];
 const blob=await downloadWhole({sources:['https://fixture/pages','https://fixture/cloudinary'],metadata:{bytes:bytes.length,sha256:sha},fetchImpl:async url=>{seen.push(url);return new Response(url.endsWith('pages')?new Uint8Array(bytes.length):bytes);}});
 assert.equal(blob.size,bytes.length);assert.equal(seen.length,2);
 await assert.rejects(downloadWhole({sources:['x','y'],metadata:{bytes:100,sha256:sha},fetchImpl:async()=>new Response('short')}),/hai nguồn/);
});

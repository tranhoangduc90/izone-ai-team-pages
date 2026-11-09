// Lỗi có kiểm soát trong browser riêng; mọi danh tính và API nộp là fixture.
import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile,readFile} from 'node:fs/promises';import {resolve} from 'node:path';
process.env.TERM2_FULL_ROUND='1';
const {fixture,wait}=await import('./term2-offline-browser.mjs');
async function ready(f,{timeout=60000}={}){const p=f.page;await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');await wait(p,()=>window.K56_TERM2_OFFLINE?.active,'Ready',timeout);}
test('Pages thật qua CORS, bytes/hash và duration từ decoder browser',{timeout:360000},async()=>{
 const f=await fixture('read_first');f.controls.realAudio=true;
 try{await ready(f,{timeout:260000});const evidence=await f.page.evaluate(async()=>{
  const {AUDIO}=await import('./audio-whole.mjs');const saved=await window.K56_TERM2_OFFLINE.audio();
  const duration=await new Promise((ok,no)=>{const a=new Audio(),url=URL.createObjectURL(saved);a.onloadedmetadata=()=>{ok(a.duration);URL.revokeObjectURL(url);};a.onerror=no;a.src=url;});
  return {pagesBytes:saved.size,sha256:AUDIO.sha256,duration};
 });assert.equal(evidence.pagesBytes,29173785);assert.ok(evidence.duration>1820&&evidence.duration<1826);
 if(process.env.TERM2_EVIDENCE)await writeFile(resolve(process.env.TERM2_EVIDENCE,'actual-cdn.json'),JSON.stringify(evidence,null,2));
 }finally{await f.close();}
});
test('R2 hết hạn chuyển Pages trước Start; cache thiếu không báo sẵn sàng',{timeout:130000},async()=>{
 const f=await fixture('lis_first');f.controls.r2Audio=true;f.controls.primaryAudioFail=true;f.controls.assetFailures.add('/term-tests/k56-test2-shared/styles.css');
 try{const p=f.page;await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>Boolean(window.K56_TERM2_OFFLINE?.record&&!window.K56_TERM2_OFFLINE.record.ready&&document.getElementById('bootstrapNotice')?.textContent.includes('Chưa tải đủ')),'Thiếu cache phải giữ khóa',65000);
  assert.equal(await p.evaluate(()=>Boolean(window.K56_TERM2_OFFLINE.record.sections.listening?.startedAt)),false);
  assert.deepEqual(f.controls.audioCalls.map(url=>new URL(url).hostname.split('.').slice(-2).join('.')),['cloudflarestorage.com','github.io']);
 }finally{await f.close();}
});
test('Hai tab không cùng sở hữu; đọc và focus giữ qua ba nhịp đồng bộ',{timeout:100000},async()=>{
 const f=await fixture('read_first');try{const p=f.page;await ready(f);await wait(p,()=>window.K56_TERM2_APP_READY,'Reading layout');await p.getByRole('button',{name:'Bắt đầu Reading',exact:false}).first().click();
  const field=p.locator('#readingQuestions input[data-number]').first();await field.fill('kept');await field.focus();
  await p.evaluate(()=>{document.querySelector('.cbt-reading-passage').scrollTop=300;});await p.waitForTimeout(400);
  const before=await p.evaluate(()=>({scroll:document.querySelector('.cbt-reading-passage').scrollTop,number:document.activeElement.dataset.number}));
  const second=await f.context.newPage();await second.goto(f.url);await second.waitForTimeout(1500);assert.match(await second.locator('body').innerText(),/tab khác/);await second.close();
  await p.waitForTimeout(16000);const after=await p.evaluate(()=>({scroll:document.querySelector('.cbt-reading-passage').scrollTop,number:document.activeElement.dataset.number}));assert.deepEqual(after,before);assert.equal(await field.inputValue(),'kept');assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
test('Quota/IDB abort vẫn phát audio, báo chưa lưu và cho tải nội dung hiện tại',{timeout:110000},async()=>{
 const f=await fixture('lis_first');try{const p=f.page;await ready(f);await p.click('#bootstrapPreview');await p.waitForTimeout(11000);await p.click('#bootstrapStart');await wait(p,()=>window.K56_TERM2_OFFLINE.playerReady,'Player');
  await p.evaluate(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const tx=original.apply(this,args);if(args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;};Storage.prototype.setItem=function(){throw new DOMException('Fixture quota','QuotaExceededError');};});
  const before=await p.evaluate(()=>window.K56_TERM2_OFFLINE.player.currentTime);await p.locator('#listeningQuestions input[data-number]').first().fill('last character giữ bài');await p.waitForTimeout(3500);
  assert.ok(await p.evaluate(()=>window.K56_TERM2_OFFLINE.player.currentTime)>before+2);assert.match(await p.evaluate(()=>window.K56_TERM2_OFFLINE.message),/Chưa lưu/);
  const pending=p.waitForEvent('download');await p.getByRole('button',{name:'Tải bài làm về máy'}).click();const download=await pending,file=await download.path();assert.ok((await readFile(file,'utf8')).includes('last character giữ bài'));
  assert.equal(await p.evaluate(()=>Boolean(window.K56_TERM2_OFFLINE.record.sections.listening.sealed)),false);
 }finally{await f.close();}
});
test('Timeout API không dừng/tua; báo sự cố vẫn lưu gián đoạn trên máy',{timeout:110000},async()=>{
 const f=await fixture('lis_first');try{const p=f.page;await ready(f);await p.locator('#bootstrapVolume').evaluate(el=>{el.value='0.4';el.dispatchEvent(new Event('input'));});await p.click('#bootstrapPreview');await p.waitForTimeout(11000);await p.click('#bootstrapStart');await wait(p,()=>window.K56_TERM2_OFFLINE.playerReady,'Player');
  assert.equal(await p.evaluate(()=>window.K56_TERM2_OFFLINE.player.volume),.4);f.controls.apiDelayMs=9000;
  const before=await p.evaluate(()=>window.K56_TERM2_OFFLINE.player.currentTime);await p.locator('#listeningQuestions input[data-number]').first().fill('keep during timeout');await p.waitForTimeout(12500);
  const after=await p.evaluate(()=>({time:window.K56_TERM2_OFFLINE.player.currentTime,paused:window.K56_TERM2_OFFLINE.player.paused,sealed:window.K56_TERM2_OFFLINE.record.sections.listening.sealed}));assert.ok(after.time>before+11);assert.equal(after.paused,false);assert.equal(after.sealed,false);
  await p.getByRole('button',{name:'Tôi không nghe được',exact:true}).click();
  await p.getByRole('button',{name:'Tôi đã hiểu. Đến phần thi tiếp theo.',exact:true}).waitFor();
  assert.equal(await p.locator('#listeningQuestions input[data-number]').first().isDisabled(),true);
  assert.equal(await p.evaluate(()=>window.K56_LISTENING_AUDIO.beforeAutoSubmit().then(x=>x.submit)),false);
  assert.equal(await p.evaluate(()=>window.K56_TERM2_OFFLINE.record.sections.listening.interrupted),true);
  assert.equal(await p.getByRole('button',{name:'Tiếp tục audio',exact:true}).isVisible(),false);
 }finally{await f.close();}
});
test('Đóng hẳn browser rồi mở lại offline giữ Reading/deadline và audio trong IndexedDB',{timeout:120000},async()=>{
 const f=await fixture('read_first',{profile:'persistent-'+randomUUID()});try{let p=f.page;await ready(f);await wait(p,()=>window.K56_TERM2_APP_READY,'Reading layout');await p.getByRole('button',{name:'Bắt đầu Reading',exact:false}).first().click();
  await p.locator('#readingQuestions input[data-number]').first().fill('đã lưu trước khi đóng trình duyệt');
  const before=await p.evaluate(async()=>{const r=window.K56_TERM2_OFFLINE;await r.store.queue;return {deadline:r.record.sections.reading.deadlineAt,started:r.record.sections.reading.startedAt};});
  f.disconnected=true;await f.reopen({offline:true});p=f.page;await p.goto(f.url);await wait(p,()=>window.K56_TERM2_APP_READY,'Mở lại browser offline');
  assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'đã lưu trước khi đóng trình duyệt');
  const after=await p.evaluate(async()=>{const r=window.K56_TERM2_OFFLINE;return {deadline:r.record.sections.reading.deadlineAt,started:r.record.sections.reading.startedAt,bytes:(await r.audio()).size};});
  assert.equal(after.deadline,before.deadline);assert.equal(after.started,before.started);assert.equal(after.bytes,29173785);
  await p.click('#submitReading');await wait(p,()=>Boolean(document.getElementById('bootstrapPreview')),'Listening lobby từ cache sau browser restart');await p.click('#bootstrapPreview');await p.waitForTimeout(11000);await p.click('#bootstrapStart');await wait(p,()=>window.K56_TERM2_OFFLINE.playerReady,'Listening từ file IndexedDB');await p.waitForTimeout(2000);assert.ok(await p.evaluate(()=>window.K56_TERM2_OFFLINE.player.currentTime)>1);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
test('Worker mới dùng cache riêng và không chiếm tab đang làm',{timeout:100000},async()=>{
 const f=await fixture('read_first');try{const p=f.page;await ready(f);await wait(p,()=>window.K56_TERM2_APP_READY,'Reading layout');await p.getByRole('button',{name:'Bắt đầu Reading',exact:false}).first().click();await p.locator('#readingQuestions input[data-number]').first().fill('old cache intact');
  const before=await p.evaluate(async()=>({controller:navigator.serviceWorker.controller.scriptURL,caches:await caches.keys()}));
  const metadata=await readFile(new URL('../term-tests/term-test-2-k56-computer-based/offline-assets.mjs',import.meta.url),'utf8');
  f.controls.assetOverrides.set('/term-tests/term-test-2-k56-computer-based/offline-assets.mjs',metadata.replace(/export const ASSET_BUILD_ID="[a-f0-9]+"/,`export const ASSET_BUILD_ID="${'f'.repeat(64)}"`));
  const other=await f.context.newPage();await other.goto(f.url);await other.waitForTimeout(500);
  await p.evaluate(async()=>{window.__workerUpdate=await navigator.serviceWorker.register('./offline-worker.js?fixture-upgrade=1',{type:'module',scope:'./',updateViaCache:'none'});});
  await wait(p,()=>Boolean(window.__workerUpdate.waiting),'Worker phải chờ');
  const rejected=await p.evaluate(()=>new Promise(ok=>{const c=new MessageChannel();c.port1.onmessage=e=>ok(e.data);window.__workerUpdate.waiting.postMessage({type:'ACTIVATE'},[c.port2]);}));assert.equal(rejected.ok,false);
  const after=await p.evaluate(async()=>({controller:navigator.serviceWorker.controller.scriptURL,caches:await caches.keys()}));assert.equal(after.controller,before.controller);assert.ok(after.caches.includes(before.caches[0]));assert.ok(after.caches.some(x=>x.endsWith('f'.repeat(64))));assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'old cache intact');assert.equal(await p.evaluate(()=>window.K56_TERM2_OFFLINE.record.sections.reading.sealed),false);
  await other.close();
 }finally{await f.close();}
});
test('Sự kiện lỗi không điều khiển trình phát; tải lại giữa lượt mở màn xác nhận gián đoạn',{timeout:100000},async()=>{
 const f=await fixture('lis_first');try{const p=f.page;await ready(f);await p.click('#bootstrapPreview');await p.waitForTimeout(11000);await p.click('#bootstrapStart');await wait(p,()=>window.K56_TERM2_OFFLINE.playerReady,'Player');await p.waitForTimeout(7500);
  const marker=await p.evaluate(()=>{const {player}=window.K56_TERM2_OFFLINE;player.dispatchEvent(new Event('error'));return player.currentTime;});assert.ok(marker>6);
  await p.waitForTimeout(1200);
  const state=await p.evaluate(()=>({position:window.K56_TERM2_OFFLINE.player.currentTime,sealed:window.K56_TERM2_OFFLINE.record.sections.listening.sealed,paused:window.K56_TERM2_OFFLINE.player.paused}));assert.ok(state.position>marker);assert.equal(state.sealed,false);assert.equal(state.paused,false);
  f.disconnected=true;await f.context.setOffline(true);await p.reload({waitUntil:'domcontentloaded'});
  await p.getByRole('button',{name:'Tôi đã hiểu. Đến phần thi tiếp theo.',exact:true}).waitFor();
  const operations=await p.evaluate(()=>window.K56_TERM2_OFFLINE.record.operations.filter(op=>op.kind==='interrupt').map(op=>op.payload.interruptionReason));
  assert.deepEqual(operations,['page_interrupted']);
  assert.equal(await p.getByRole('button',{name:'Tiếp tục audio',exact:true}).isVisible(),false);
 }finally{await f.close();}
});

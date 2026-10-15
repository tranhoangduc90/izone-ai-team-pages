import assert from 'node:assert/strict';
import test, {before, after} from 'node:test';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdir,access,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Đi qua UI/HTTP/SQL thật trên localhost; chỉ audio/tên/đề là giả, không mock luật bù giờ.
// Backend ứng viên lấy từ repo kề worktree hoặc biến môi trường rõ; thiếu thì fail, không skip.
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const pages=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const backend=process.env.K67_BACKEND_FIXTURE_ROOT||path.resolve(pages,'../classroom-mapping-review/products/term-mini-k67');
const evidence=process.env.K67_SLICE1_EVIDENCE||path.join(pages,'output/playwright/k67-audio-incidents');
let fixture,browser,base;let fixtureLog='';
before(async()=>{
  await mkdir(evidence,{recursive:true});await access(path.join(backend,'tools/preview-exam-order.mjs'));
  const portServer=createServer();portServer.listen(0,'127.0.0.1');await once(portServer,'listening');
  const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));base=`http://127.0.0.1:${port}`;
  fixture=spawn(process.execPath,['tools/preview-exam-order.mjs',pages],{cwd:backend,windowsHide:true,
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),K67_PREVIEW_AUDIO_SECONDS:'90',K67_PREVIEW_AUDIO_PROTECTION:'true'},stdio:['ignore','pipe','pipe']});
  fixture.stdout.on('data',data=>fixtureLog+=data);fixture.stderr.on('data',data=>fixtureLog+=data);
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
    if(fixture.exitCode!==null)throw new Error('Fixture không chạy: '+fixtureLog);
    try{if((await fetch(base+'/preview/status')).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal((await fetch(base+'/preview/status')).status,200);
  browser=await chromium.launch({headless:process.env.K67_BROWSER_HEADED!=='true',channel:process.env.K67_BROWSER_CHANNEL||'chrome'});
});
after(async()=>{await browser?.close();fixture?.kill();await writeFile(path.join(evidence,'fixture.log'),fixtureLog,'utf8');});
async function open(slug='term-test-1',mode='lis_first',init){
  const context=await browser.newContext();
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  if(init)await page.addInitScript(init);
  assert.equal((await context.request.post(base+'/preview/reset',{data:{}})).status(),200);
  await page.goto(base+`/term-tests/${slug}-computer-based/?class=IC2304&mode=${mode}`);
  await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
  await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
  if(mode==='read_first'){
    await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});
    await page.locator('#submitReading').click();
  }
  await page.locator('#bootstrapPreview').click();await page.locator('#bootstrapStart').click();
  await page.locator('#listeningView').waitFor({state:'visible'});
  const token=await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.examSessionToken);
  const read=async()=>{const r=await context.request.get(base+'/preview/audio-state?id='+token);assert.equal(r.status(),200);return r.json();};
  const clock=async patch=>{const r=await context.request.post(base+'/preview/incident-clock',{data:{id:token,...patch}});assert.equal(r.status(),200);};
  return{page,context,token,read,clock,errors};
}
async function sampleAndResume(page){
  await page.locator('#k67TestSound').click();await page.locator('#k67ResumeAudio').click();
  await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING&&!window.K67_ACTIVE_LISTENING.isHeld());
}

for(const mode of ['lis_first','read_first'])for(const fault of ['500','abort-reload'])test(`${mode}/${fault}: start mất phản hồi vẫn giữ thời gian; vào lại phát đúng mốc và bù một lần`,async()=>{
  const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(15000);page.on('dialog',d=>d.accept());
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  try{
    assert.equal((await context.request.post(base+'/preview/reset',{data:{}})).status(),200);
    let lost=false;
    await page.route('**/term-test-1/session/start',async route=>{
      if(lost)return route.continue();lost=true;const response=await route.fetch();assert.equal(response.status(),200);
      if(fault==='500')return route.fulfill({status:500,contentType:'application/json',body:'{"ok":false,"error":"START_RESPONSE_LOST","message":"Mô phỏng mất phản hồi start"}'});
      return route.abort();
    });
    await page.goto(base+`/term-tests/term-test-1-computer-based/?class=IC2304&mode=${mode}`);
    await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
    if(mode==='read_first'){await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});await page.locator('#submitReading').click();}
    await page.locator('#bootstrapPreview').click();await page.locator('#bootstrapStart').click();
    await page.locator('#bootstrapNotice').filter({hasText:'Chưa thể bắt đầu'}).waitFor();
    const token=await page.evaluate(()=>JSON.parse(localStorage.getItem('izone-test:term-test-1:IC2304')).examSessionToken);
    const read=()=>context.request.get(base+'/preview/audio-state?id='+token).then(r=>r.json());
    const held=await read();assert.ok(held.listening_started_at);assert.ok(held.listening_audio_incident_id,'Mất response phải có hold đã ghi');
    assert.equal(await page.locator('#listeningView').isVisible(),false);await page.waitForTimeout(1500);
    if(fault==='abort-reload')await page.reload();
    await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
    await page.waitForFunction(()=>!window.K67_ACTIVE_LISTENING.isHeld());
    const after=await read();assert.equal(after.listening_audio_incident_id,null);assert.ok(Number(after.listening_recovery_seconds)>=1);
    assert.equal(new Date(after.listening_deadline_at)-new Date(held.listening_deadline_at),Number(after.listening_recovery_seconds)*1000);
    assert.ok(await page.evaluate(()=>!window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused&&window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime<3));
    await page.screenshot({path:path.join(evidence,`start-${mode}-${fault}.png`),fullPage:true});
  }finally{await context.close();}
});

// IndexedDB thật qua trình duyệt: đọc byte đã lưu; không dùng mock làm thay việc ghi cache.
async function cacheRecords(page) {
  return page.evaluate(()=>new Promise((resolve,reject)=>{
    const r=indexedDB.open('izone-k67-encrypted-audio-v1',1);
    r.onerror=()=>reject(r.error);r.onsuccess=()=>{
      const db=r.result;if(!db.objectStoreNames.contains('audio')){db.close();resolve([]);return;}
      const q=db.transaction('audio').objectStore('audio').getAll();q.onsuccess=()=>{db.close();resolve(q.result.map(x=>({
        id:x.id,manifest:x.manifest,size:x.blob?.size,checksum:x.checksum,complete:x.complete,expiresAt:x.expiresAt,keys:Object.keys(x)})));};q.onerror=()=>reject(q.error);
    };
  }));
}
async function tamperCache(page,kind) {
  await page.evaluate(async kind=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('izone-k67-encrypted-audio-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const record=await new Promise((resolve,reject)=>{const r=db.transaction('audio').objectStore('audio').getAll();r.onsuccess=()=>resolve(r.result[0]);r.onerror=()=>reject(r.error);});
    if(kind==='version')record.manifest.assetVersion='sha256-'+'0'.repeat(64);
    if(kind==='expired')record.expiresAt='2000-01-01T00:00:00.000Z';
    if(kind==='incomplete')record.complete=false;
    if(kind==='length')record.blob=record.blob.slice(0,record.blob.size-10);
    if(['checksum','gcm','plaintext'].includes(kind)){
      let bytes=new Uint8Array(await record.blob.arrayBuffer());bytes[25]^=1;
      if(kind==='plaintext'){
        // Ciphertext hợp lệ GCM nhưng khác hash nội dung tin cậy: phải bị chặn rồi tải lại.
        const access=await fetch(`/api/term-tests/term-test-1/session/audio-access`,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({examSessionToken:window.TERM_TEST_BOOTSTRAP.examSessionToken,generation:0})}).then(r=>r.json());
        const raw=Uint8Array.from(atob(access.audioKey),c=>c.charCodeAt(0));
        const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
        const iv=crypto.getRandomValues(new Uint8Array(12));
        const wrong=new Uint8Array(record.manifest.byteLength);wrong.fill(7);
        const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,wrong));
        bytes=new Uint8Array(17+encrypted.length);bytes.set(new TextEncoder().encode('IZTT1'));bytes.set(iv,5);bytes.set(encrypted,17);
      }
      record.blob=new Blob([bytes]);
      if(kind!=='checksum')record.checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
    }
    if(['session','generation','slug','api'].includes(kind)){
      const id=JSON.parse(record.id);if(kind==='session')id[2]=crypto.randomUUID();if(kind==='generation')id[3]+=1;
      if(kind==='slug')id[1]='term-test-2';if(kind==='api')id[0]='https://other.example.test';record.id=JSON.stringify(id);
    }
    await new Promise((resolve,reject)=>{const tx=db.transaction('audio','readwrite'),s=tx.objectStore('audio');
      s.clear();s.put(record);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
  },kind);
}

for(const slug of ['term-test-1','term-test-2','mini-test-lesson-5'])for(const mode of ['lis_first','read_first'])test(`${slug}/${mode}: reload dùng ciphertext đã lưu, reauth, giữ đúng mốc/nháp rồi bù và nộp`,async()=>{
  const{page,context,read,clock,errors}=await open(slug,mode);
  try{
    const records=await cacheRecords(page);assert.equal(records.length,1);assert.equal(records[0].complete,true);
    assert.equal(records[0].size,records[0].manifest.encryptedByteLength);
    assert.deepEqual(records[0].keys.sort(),['id','manifest','blob','checksum','expiresAt','complete'].sort());
    const field=page.locator('#listeningQuestions [data-number]').first(),number=await field.getAttribute('data-number');
    if(await field.evaluate(n=>n.tagName)==='SELECT')await field.selectOption({index:1});else await field.fill('Nháp qua reload');
    const answer=await field.inputValue();await page.waitForTimeout(1200);
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    const before=await read(),anchor=Number(before.listening_audio_checkpoint_seconds);let downloads=0,accesses=0;
    await page.route('**/session/*/audio',r=>{downloads++;return r.abort();});
    await page.route('**/session/*/preview',r=>r.abort());
    page.on('request',r=>{if(r.url().endsWith('/audio-access'))accesses++;});
    await page.reload();await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
    assert.equal(downloads,0);assert.ok(accesses>=1);assert.equal(await page.locator('#submitListening').isDisabled(),true);
    assert.equal((await read()).listening_audio_incident_id,before.listening_audio_incident_id);
    assert.ok(Math.abs(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime)-anchor)<0.1);
    assert.equal(await page.locator(`#listeningQuestions [data-number="${number}"]`).inputValue(),answer);
    await clock({seconds:20});await sampleAndResume(page);
    const position=await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime);
    assert.ok(position>=anchor&&position<anchor+3);assert.ok((await read()).listening_recovery_seconds>=19);
    await page.locator('#submitListening').click();await page.waitForFunction(()=>document.getElementById('listeningView').hidden);
    assert.ok((await read()).listening_submitted_at);
    await page.waitForTimeout(150);assert.equal((await cacheRecords(page)).length,0);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

for(const kind of ['version','expired','incomplete','length','checksum','gcm','plaintext','session','generation','slug','api'])test(`Bản lưu ${kind}: không phát sai, tải lại đúng audio chỉ một lần`,async()=>{
  const{page,context,read,errors}=await open();
  try{
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    await tamperCache(page,kind);let downloads=0;
    page.on('request',r=>{if(/\/session\/[^/]+\/audio$/.test(r.url()))downloads++;});
    await page.reload();await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
    assert.equal(downloads,1);await sampleAndResume(page);assert.equal((await read()).listening_audio_incident_id,null);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Reload không có mạng API: không mở bài/khóa từ bản lưu; online xác thực lại và phục hồi được',async()=>{
  const{page,context,read,errors}=await open();
  try{
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    const incident=(await read()).listening_audio_incident_id;
    await page.route('**/api/**',r=>r.abort());await page.reload();
    await page.locator('#bootstrapRetry').waitFor({state:'visible'});
    assert.equal(await page.locator('#bootstrapStart').isDisabled(),true);assert.equal(await page.evaluate(()=>Boolean(window.TERM_TEST_BOOTSTRAP?.officialAudioElement)),false);
    assert.equal((await cacheRecords(page)).length,1);
    const storage=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));assert.doesNotMatch(storage,/audioKey|audioEnvelope|BEGIN PRIVATE KEY/);
    let downloads=0;await page.route('**/session/*/audio',r=>{downloads++;return r.abort();});
    await page.unroute('**/api/**');await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
    assert.equal((await read()).listening_audio_incident_id,incident);assert.equal(downloads,0);await sampleAndResume(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Cache tồn tại nhưng server từ chối quyền: không tải/giải mã hoặc mở đề',async()=>{
  const{page,context}=await open();
  try{
    await page.route('**/session/audio-access',r=>r.fulfill({status:409,contentType:'application/json',body:JSON.stringify({ok:false,error:'AUDIO_ACCESS_LOCKED',message:'Phiên đã hết quyền.'})}));
    let starts=0;page.on('request',r=>{if(r.url().endsWith('/session/start'))starts++;});
    await page.reload();await page.locator('#bootstrapRetry').waitFor({state:'visible'});
    assert.equal(await page.locator('#bootstrapStart').isDisabled(),true);assert.equal(starts,0);assert.equal(await page.locator('#listeningView').count(),0);
  }finally{await context.close();}
});

for(const fault of ['blocked','quota'])test(`IndexedDB ${fault}: báo chưa lưu, audio vẫn phát từ RAM và reload tải lại có quyền`,async()=>{
  const{page,context,errors}=await open('term-test-1','lis_first',fault==='blocked'?()=>{
    IDBFactory.prototype.open=function(){throw new DOMException('Storage thử bị chặn','SecurityError');};
  }:()=>{
    const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='audio')throw new DOMException('Quota thử hết','QuotaExceededError');return put.apply(this,args);};
  });
  try{
    assert.match(await page.locator('#k67AudioCacheStatus').innerText(),/chưa được lưu/);
    assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false);
    let downloads=0;page.on('request',r=>{if(/\/session\/[^/]+\/audio$/.test(r.url()))downloads++;});
    await page.reload();await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
    assert.equal(downloads,1);await sampleAndResume(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Đóng tab đang phát rồi mở trang mới: cache bền, cùng phiên được giữ và tiếp tục đúng mốc',async()=>{
  const f=await open();let page=f.page;
  try{
    await page.waitForTimeout(1300);const before=await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime);
    await page.close();page=await f.context.newPage();page.on('dialog',d=>d.accept());
    let downloads=0;await page.route('**/session/*/audio',r=>{downloads++;return r.abort();});
    await page.goto(base+'/term-tests/term-test-1-computer-based/?class=IC2304');
    await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
    assert.equal(downloads,0);assert.equal(await page.locator('#submitListening').isDisabled(),true);
    const anchor=Number((await f.read()).listening_audio_checkpoint_seconds);assert.ok(anchor>=before-0.3&&anchor<before+1);
    await sampleAndResume(page);
  }finally{await f.context.close();}
});

test('Reload sau audio ended: giữ giai đoạn xem lại, không phát lại hoặc mở giữ bài/đòi giáo viên',async()=>{
  const{page,context,read,clock,errors}=await open();
  try{
    await clock({startedSecondsAgo:91,deadlineSeconds:120});
    await page.evaluate(async()=>{const a=window.TERM_TEST_BOOTSTRAP.officialAudioElement;a.currentTime=a.duration-0.1;await a.play();});
    await page.waitForFunction(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.ended);
    await page.waitForTimeout(150);const before=await read();assert.equal(Number(before.listening_audio_checkpoint_seconds),90);
    await page.addInitScript(()=>{window.testPlayCalls=0;const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...a){window.testPlayCalls++;return play.apply(this,a);};});
    await page.reload();await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
    await page.waitForTimeout(2300);
    const after=await read();assert.equal(after.listening_audio_incident_id,null);assert.equal(after.listening_recovery_seconds,before.listening_recovery_seconds);
    assert.equal(after.listening_deadline_at,before.listening_deadline_at);assert.equal(await page.evaluate(()=>window.testPlayCalls),0);
    assert.equal(await page.locator('#submitListening').isEnabled(),true);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Nháp chưa được server lưu và sự cố chưa ACK vẫn nguyên qua reload mất mạng rồi online',async()=>{
  const{page,context,read,errors}=await open();
  try{
    await page.route('**/listening/draft',r=>r.abort());await page.route('**/session/audio-incident',r=>r.abort());
    const field=page.locator('#listeningQuestions [data-number]').first(),number=await field.getAttribute('data-number');
    if(await field.evaluate(n=>n.tagName)==='SELECT')await field.selectOption({index:1});else await field.fill('Nháp chưa gửi');
    const answer=await field.inputValue();await page.locator('#k67ReportAudio').click();
    assert.equal(await page.locator('#submitListening').isDisabled(),true);
    assert.notEqual((await read()).listening_draft[number],answer);
    await page.route('**/api/**',r=>r.abort());await page.reload();await page.locator('#bootstrapRetry').waitFor({state:'visible'});
    await page.unroute('**/api/**');await page.unroute('**/session/audio-incident');await page.unroute('**/listening/draft');
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
    assert.equal(await page.locator(`#listeningQuestions [data-number="${number}"]`).inputValue(),answer);
    assert.equal((await read()).listening_draft[number],answer);await sampleAndResume(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Kho lưu không phản hồi: hết thời gian chờ hữu hạn và phát từ RAM',async()=>{
  const{page,context}=await open('term-test-1','lis_first',()=>{IDBFactory.prototype.open=()=>({});});
  try{assert.match(await page.locator('#k67AudioCacheStatus').innerText(),/chưa được lưu/);assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false);}
  finally{await context.close();}
});

test('Ciphertext 40 MiB đọc lại sau reload; không lưu khóa và không xóa kho sản phẩm khác',async()=>{
  const{page,context}=await open();
  try{
    const result=await page.evaluate(async()=>{
      const scope={apiBase:location.origin,slug:'term-test-1',examSessionToken:crypto.randomUUID(),generation:0};
      const bytes=new Uint8Array(40*1024*1024+33);bytes.set(new TextEncoder().encode('IZTT1'));
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.subarray(33))),n=>n.toString(16).padStart(2,'0')).join('');
      const manifest={assetVersion:'sha256-'+hash,sha256:hash,byteLength:bytes.length-33,encryptedByteLength:bytes.length,envelopeVersion:'IZTT1'};
      const other=await new Promise((resolve,reject)=>{const r=indexedDB.open('other-product-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('keep');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      await new Promise(resolve=>{const t=other.transaction('keep','readwrite');t.objectStore('keep').put('Không xóa','marker');t.oncomplete=resolve;});other.close();
      const began=performance.now(),now=new Date().toISOString();let ticks=0;const interval=setInterval(()=>ticks++,20);
      await window.K67_AUDIO_STORE.put(scope,manifest,new Blob([bytes]),new Date(Date.now()+3600000).toISOString(),now);
      const blob=await window.K67_AUDIO_STORE.get(scope,manifest,now);clearInterval(interval);
      localStorage.setItem('large-audio-fixture',JSON.stringify({scope,manifest,now}));
      return{size:blob.size,elapsed:performance.now()-began,ticks};
    });
    assert.equal(result.size,40*1024*1024+33);assert.ok(result.ticks>0);assert.ok(result.elapsed<15000);
    await page.reload();await page.locator('#bootstrapStart').waitFor({state:'visible'});
    await page.waitForFunction(()=>window.K67_AUDIO_STORE);
    const readback=await page.evaluate(async()=>{
      const{scope,manifest,now}=JSON.parse(localStorage.getItem('large-audio-fixture'));
      const blob=await window.K67_AUDIO_STORE.get(scope,manifest,now);
      const marker=await new Promise((resolve,reject)=>{const r=indexedDB.open('other-product-fixture',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('keep').objectStore('keep').get('marker');q.onsuccess=()=>{db.close();resolve(q.result);};};});
      await window.K67_AUDIO_STORE.remove(scope);localStorage.removeItem('large-audio-fixture');return{size:blob.size,marker};
    });
    assert.equal(readback.size,result.size);assert.equal(readback.marker,'Không xóa');
    await writeFile(path.join(evidence,'cache-40mib.json'),JSON.stringify(result,null,2),'utf8');
  }finally{await context.close();}
});
for(const slug of ['term-test-1','term-test-2','mini-test-lesson-5'])for(const mode of ['lis_first','read_first'])test(`${slug}/${mode}: UI giữ qua deadline, khôi phục, bù và nộp đúng bản đã làm`,async()=>{
  const{page,context,read,clock,errors}=await open(slug,mode);
  try{
    const first=page.locator('#listeningQuestions [data-number]').first(),number=await first.getAttribute('data-number');
    if(await first.evaluate(n=>n.tagName)==='SELECT')await first.selectOption({index:1});else await first.fill('A');
    const value=await first.inputValue();
    await clock({deadlineSeconds:1});const before=await read();
    await page.locator('#k67ReportAudio').click();await page.locator('#k67AudioIncident').waitFor({state:'visible'});
    assert.equal(await first.isDisabled(),true);assert.equal(await page.locator('#submitListening').isDisabled(),true);
    await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    await page.waitForTimeout(1400);
    const held=await read();assert.equal(held.listening_submitted_at,null);assert.equal(held.listening_draft[number],value);
    await clock({seconds:30});await sampleAndResume(page);
    const resumed=await read();assert.equal(resumed.listening_audio_incident_id,null);
    assert.ok(resumed.listening_recovery_seconds>=29&&resumed.listening_recovery_seconds<=33);
    assert.equal(Date.parse(resumed.listening_deadline_at)-Date.parse(before.listening_deadline_at),resumed.listening_recovery_seconds*1000);
    assert.equal(await first.isDisabled(),false);assert.equal(await first.inputValue(),value);
    await page.locator('#submitListening').click();
    await page.waitForFunction(()=>document.getElementById('listeningView').hidden);
    assert.ok((await read()).listening_submitted_at);assert.deepEqual(errors,[]);
  }finally{await page.screenshot({path:path.join(evidence,slug+'-'+mode+'.png'),fullPage:true});await context.close();}
});

test('Mất mạng khi báo lỗi: giữ ngay tại máy, đồng bộ lại cùng sự cố rồi tiếp tục',async()=>{
  const{page,context,read,errors}=await open();
  try{
    await page.route('**/session/audio-incident',r=>r.abort());
    await page.locator('#k67ReportAudio').click();
    assert.equal(await page.locator('#submitListening').isDisabled(),true);
    assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.isHeld()),true);
    await page.waitForTimeout(500);assert.equal((await read()).listening_submitted_at,null);
    await page.unroute('**/session/audio-incident');await sampleAndResume(page);
    assert.equal((await read()).listening_audio_incident_id,null);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Confirm đã ghi nhưng mất ACK: gửi lại nguyên request, không bù lặp',async()=>{
  const{page,context,read,clock,errors}=await open();let lost=false;const confirms=[];
  try{
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    await clock({seconds:20});
    await page.route('**/session/audio-resume',async route=>{
      const body=route.request().postDataJSON();
      if(body.phase==='confirm'){confirms.push(body);if(!lost){lost=true;await route.fetch();return route.abort();}}
      return route.continue();
    });
    await sampleAndResume(page);assert.equal(confirms.length,2);assert.deepEqual(confirms[0],confirms[1]);
    const row=await read();assert.ok(row.listening_recovery_seconds>=19&&row.listening_recovery_seconds<=22);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Play bị chặn sau thử âm thanh: giữ bài; tải lại vẫn cùng sự cố/nháp và phục hồi được',async()=>{
  const{page,context,read,token,errors}=await open();
  try{
    const field=page.locator('#listeningQuestions [data-number]').first(),number=await field.getAttribute('data-number');
    if(await field.evaluate(n=>n.tagName)==='SELECT')await field.selectOption({index:1});else await field.fill('Bản nháp trước tải lại');
    const savedAnswer=await field.inputValue();
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    const incident=(await read()).listening_audio_incident_id;
    await page.evaluate(()=>{const audio=window.TERM_TEST_BOOTSTRAP.officialAudioElement;audio.play=()=>Promise.reject(new DOMException('Thử chặn autoplay','NotAllowedError'));});
    await page.locator('#k67TestSound').click();await page.locator('#k67ResumeAudio').click();await page.waitForTimeout(400);
    assert.equal((await read()).listening_audio_incident_id,incident);assert.equal(await page.locator('#submitListening').isDisabled(),true);
    await page.reload();await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.examSessionToken),token);
    assert.equal((await read()).listening_audio_incident_id,incident);
    assert.equal(await page.locator(`#listeningQuestions [data-number="${number}"]`).inputValue(),savedAnswer);
    assert.equal((await read()).listening_draft[number],savedAnswer);
    await sampleAndResume(page);assert.deepEqual(errors,[]);
  }catch(error){
    await page.screenshot({path:path.join(evidence,'reload-failure.png'),fullPage:true});
    await writeFile(path.join(evidence,'reload-failure.json'),JSON.stringify({errors,text:await page.locator('body').innerText(),
      storage:await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}))},null,2),'utf8');throw error;
  }finally{await context.close();}
});

test('Tiến độ API lỗi trong khi audio phát không mở sự cố hoặc dừng nghe',async()=>{
  const{page,context,read,errors}=await open();
  try{
    await page.route('**/session/audio-progress',r=>r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'}));
    const before=await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime);
    await page.waitForTimeout(5600);
    const after=await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime);
    assert.ok(after>before+4);assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.isHeld()),false);
    const row=await read();assert.equal(row.listening_audio_incident_id,null);assert.equal(row.listening_recovery_seconds,0);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Vượt ngân sách: khóa bài, hiện hỗ trợ giáo viên; giao diện hẹp không tràn',async()=>{
  const{page,context,read,clock,errors}=await open();
  try{
    await page.setViewportSize({width:390,height:844});
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    await clock({seconds:901});await page.locator('#k67TestSound').click();await page.locator('#k67ResumeAudio').click();
    await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().needsTeacher);
    assert.equal(await page.locator('#submitListening').isDisabled(),true);assert.equal(await page.locator('#k67ResumeAudio').isDisabled(),true);
    assert.equal((await read()).listening_recovery_seconds,0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(evidence,'held-mobile.png'),fullPage:true});assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Audio chính bị chặn lúc bắt đầu: server đã start nhưng UI giữ bài, thử lại và tiếp tục được',async()=>{
  const{page,context,read,errors}=await open('term-test-1','lis_first',()=>{
    const play=HTMLMediaElement.prototype.play;let blocked=false;
    HTMLMediaElement.prototype.play=function(){if(window.K67_ACTIVE_LISTENING&&!blocked){blocked=true;return Promise.reject(new DOMException('Chặn lúc start','NotAllowedError'));}return play.call(this);};
  });
  try{
    await page.locator('#k67AudioIncident').waitFor({state:'visible'});assert.equal(await page.locator('#submitListening').isDisabled(),true);
    assert.ok((await read()).listening_audio_incident_id);await sampleAndResume(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Pause và autoplay tiếp tục lỗi: tự thử hữu hạn, sau đó học viên kiểm âm thanh và phục hồi',async()=>{
  const{page,context,read,errors}=await open();
  try{
    await page.evaluate(()=>{
      const audio=window.TERM_TEST_BOOTSTRAP.officialAudioElement;
      window.originalOfficialPlay=audio.play.bind(audio);window.failedPlayAttempts=0;
      audio.play=()=>{window.failedPlayAttempts++;return Promise.reject(new DOMException('Bị chặn','NotAllowedError'));};audio.pause();
    });
    await page.waitForFunction(()=>window.failedPlayAttempts===2);
    await page.waitForTimeout(1600);assert.equal(await page.evaluate(()=>window.failedPlayAttempts),2);
    assert.equal(await page.locator('#submitListening').isDisabled(),true);assert.ok((await read()).listening_audio_incident_id);
    await page.evaluate(()=>{window.TERM_TEST_BOOTSTRAP.officialAudioElement.play=window.originalOfficialPlay;});
    await sampleAndResume(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Sau phục hồi, hết deadline hợp lệ tự nộp đúng một lần',async()=>{
  const{page,context,read,clock,errors}=await open();
  try{
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    await sampleAndResume(page);await clock({deadlineSeconds:1});
    let submissions=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/api/term-tests/term-test-1/listening')submissions++;});
    await page.waitForFunction(()=>document.getElementById('listeningView').hidden,{},{timeout:15000});
    const row=await read();assert.ok(row.listening_submitted_at);assert.equal(row.listening_audio_incident_id,null);assert.equal(submissions,1);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Bấm báo lỗi trong khi request nộp đang chờ: nộp bị từ chối vẫn giữ khóa đáp án',async()=>{
  const{page,context,read,errors}=await open();let release;
  const gate=new Promise(resolve=>release=resolve);let reached;
  const requestReached=new Promise(resolve=>reached=resolve);
  try{
    await page.route('**/term-tests/term-test-1/listening',async route=>{reached();await gate;return route.continue();});
    await page.locator('#submitListening').click();await requestReached;
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    release();await page.waitForFunction(()=>document.getElementById('listeningView').dataset.listeningSubmitting!=='true');
    assert.equal(await page.locator('#listeningQuestions [data-number]').first().isDisabled(),true);
    assert.equal(await page.locator('#submitListening').isDisabled(),true);assert.equal((await read()).listening_submitted_at,null);assert.deepEqual(errors,[]);
  }finally{release();await context.close();}
});

test('Progress phản hồi hold cũ sau resume mới không được giữ bài lại hoặc pause audio',async()=>{
  const{page,context,errors}=await open();let releaseFetch,releaseResponse,reached,captured;
  const fetchGate=new Promise(r=>releaseFetch=r),responseGate=new Promise(r=>releaseResponse=r);
  const requestReached=new Promise(r=>reached=r),responseCaptured=new Promise(r=>captured=r);let first=true;
  try{
    await page.route('**/session/audio-progress',async route=>{
      if(!first)return route.continue();first=false;reached();await fetchGate;
      const response=await route.fetch();captured();await responseGate;return route.fulfill({response});
    });
    await requestReached;
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    releaseFetch();await responseCaptured;await sampleAndResume(page);
    const revision=await page.evaluate(()=>window.K67_ACTIVE_LISTENING.getSnapshot().audioRevision);
    releaseResponse();await page.waitForTimeout(350);
    assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.isHeld()),false);
    assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.getSnapshot().audioRevision),revision);
    assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false);assert.deepEqual(errors,[]);
  }finally{releaseFetch();releaseResponse();await context.close();}
});

test('Mất toàn bộ ACK confirm qua hai sự cố liên tiếp không tạo vòng tự phục hồi vô hạn',async()=>{
  const{page,context,errors}=await open();const attempts=new Set();
  try{
    await page.route('**/session/audio-resume',async route=>{
      const body=route.request().postDataJSON();
      if(body.phase==='prepare')attempts.add(body.resumeAttemptId);
      if(body.phase==='confirm'){await route.fetch();return route.abort();}
      return route.continue();
    });
    await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.pause());
    const deadline=Date.now()+12000;
    while(attempts.size<2&&Date.now()<deadline)await page.waitForTimeout(100);
    assert.equal(attempts.size,2);await page.waitForTimeout(1600);assert.equal(attempts.size,2);
    assert.equal(await page.locator('#submitListening').isDisabled(),true);
    await page.unroute('**/session/audio-resume');await sampleAndResume(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

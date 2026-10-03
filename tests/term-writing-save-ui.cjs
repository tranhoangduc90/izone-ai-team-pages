// Dữ liệu vào: app Writing thật trong worktree, hai Task giả và phản hồi API có kiểm soát.
// Việc chính: gõ trong Chrome thử nghiệm, kiểm lời xác nhận, xung đột, retry và phục hồi.
// Kết quả: assertion theo bài người dùng nhìn thấy; không gọi hệ thống ngoài hoặc dữ liệu học viên.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root = join(__dirname, '..');
const sourceApp = process.env.D08_SOURCE_APP || join(root,'term-tests/shared/app.js');
const sourceText = readFileSync(sourceApp,'utf8');
const promptVersion = /const promptVersion = '([^']+)'/.exec(sourceText)?.[1];
const key = 'izone-test:term-test-1:CODEXDEMO806' + (promptVersion && /const storageKey = .*promptVersion/.test(sourceText) ? ':'+promptVersion : '');
const token = '44444444-4444-4444-8444-444444444444';
let server, browser, base;
const errors = [];
const canonical = (extra = {}) => ({ task1: 'Bài đã lưu Task 1', task2: 'Bài đã lưu Task 2', revision: 5,
  started: true, submitted: false, deadlineAt: new Date(Date.now() + 3_600_000).toISOString(), serverNow: new Date().toISOString(), ...extra });
const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"></head><body class="cbt-mode"><div id="app"></div><script>
window.TERM_TEST_APP_CONFIG={API_BASE_URL:location.origin+'/fixture-api'};
window.TERM_TEST_CONFIG={slug:'term-test-1',title:'Writing giả D08',listening:{title:'Listening',description:[],controls:[]},reading:{title:'Reading',description:[],controls:[]}};
window.TERM_TEST_CONTENT={variant:'semantic-html',deferResultsUntilComplete:true,timing:{writingMinutes:60},writing:{tasks:[{id:'task1',label:'Task 1',prompt:'Đề giả 1',recommendedMinutes:20,minimumWords:0},{id:'task2',label:'Task 2',prompt:'Đề giả 2',recommendedMinutes:40,minimumWords:0}]}};
</script><script src="/term-tests/k56-exam-order.js"></script><script src="/term-tests/shared/app.js"></script></body></html>`;
test.before(async () => {
  server = createServer(async (req, res) => {
    if (req.url.startsWith('/fixture.html')) { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); return res.end(html); }
    if (req.url.split('?')[0] === '/term-tests/shared/app.js') {
      res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8'});
      const app=await readFile(sourceApp,'utf8');
      return res.end(process.env.D08_DEBUG==='1'?app.replace('function handleWritingSaveError(error) {','function handleWritingSaveError(error) { console.error(error.stack);'):app);
    }
    if (req.url === '/term-tests/k56-exam-order.js') { res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8'}); return res.end(await readFile(join(root,'term-tests/k56-exam-order.js'),'utf8')); }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
});
test.after(async () => { await browser?.close(); await new Promise(resolve => server.close(resolve)); assert.deepEqual(errors,[]); });

async function open(onSave, restored = {}, serverDraft = canonical()) {
  const context = await browser.newContext();
  const page = await context.newPage(); page.setDefaultTimeout(8_000);
  page.on('pageerror',error => errors.push(error.message));
  if(process.env.D08_DEBUG==='1')page.on('console',msg=>console.error('BROWSER',msg.type(),msg.text()));
  await context.route('**/*',route => {
    if (route.request().url().startsWith(base)) return route.continue();
    errors.push('Yêu cầu ngoài fixture: '+route.request().url().split('?')[0]); return route.abort();
  });
  await page.addInitScript(({key,token,restored}) => {
    if (!sessionStorage.getItem(key)) sessionStorage.setItem(key,JSON.stringify({studentRef:'11111111-1111-4111-8111-111111111111',studentName:'Học viên giả D08',attemptToken:token,completed:true,listeningSubmitted:true,writingStarted:true,writingSubmitted:false,writingDirty:false,writingRevision:0,writingServerRevision:5,writingLayout:{activeTask:'task1',splits:{}},drafts:{writing:{task1:'Bài đã lưu Task 1',task2:'Bài đã lưu Task 2'}},...restored}));
    // Rút thời gian chờ autosave của fixture; HTTP timeout và clock nghiệp vụ không đổi.
    const set=window.setTimeout.bind(window);
    window.setTimeout=(fn,ms,...args)=>set(fn,ms>=3000&&ms<=15000?40:ms,...args);
  },{key,token,restored});
  const requests=[]; const transports=[];
  await page.route(base+'/fixture-api{,/**}',async route => {
    const raw=route.request().postDataJSON();
    const gateway=route.request().url()===base+'/fixture-api' && raw?.route;
    const url=gateway?raw.route+(raw.route.endsWith('/roster')?'?fixture=1':''):route.request().url();
    const fulfill=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    if (url.includes('/roster?')) return fulfill({class:{code:'CODEXDEMO806',name:'Lớp giả D08'},students:[{ref:'11111111-1111-4111-8111-111111111111',name:'Học viên giả D08'}]});
    if (url.endsWith('/result')) return fulfill({ok:true,attemptToken:token,completed:true,studentName:'Học viên giả D08',className:'Lớp giả D08',writing:serverDraft});
    if (url.endsWith('/client-event')) return fulfill({ok:true});
    if (url.endsWith('/writing')) { const payload=gateway?raw.payload:raw; requests.push(payload); transports.push({url:route.request().url(),body:raw,contentType:route.request().headers()['content-type']}); return onSave({route,payload,requests,fulfill}); }
    errors.push('API fixture chưa khai báo: '+url); return route.abort();
  });
  await page.goto(base+'/fixture.html?class=CODEXDEMO806');
  try { await page.locator('#writingView').waitFor({state:'visible'}); } catch(error) {
    console.error('D08_FIXTURE_STARTUP',JSON.stringify({notice:await page.locator('#notice').textContent().catch(()=>null),body:(await page.locator('body').innerText()).slice(0,1800),session:await session(page),errors}));
    await context.close();throw error;
  }
  if(process.env.D08_DEBUG==='1'){const close=context.close.bind(context);context.close=async()=>{console.error('D08_DEBUG',JSON.stringify({session:await session(page),requests,status:await page.locator('.writing-editor-meta span').first().textContent(),notice:await page.locator('#notice').textContent(),errors}));return close();};}
  return {page,context,requests,transports,editor:page.locator('[data-writing-task="task1"]')};
}
async function session(page) { return page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)||'{}'),key); }
async function waitSaved(page) { await page.waitForFunction(key=>JSON.parse(sessionStorage.getItem(key)||'{}').writingDirty===false,key); }

test('D08 thiếu accepted/revision không được báo đã lưu hoặc xóa bản local',async () => {
  const opened=await open(({payload,fulfill})=>fulfill({ok:true,writing:canonical({task1:payload.task1,task2:payload.task2,revision:undefined})}));
  try {
    await opened.editor.fill('Bản local phải được giữ');
    await opened.page.waitForFunction(()=>document.querySelector('.writing-editor-meta span')?.textContent.includes('Chưa'));
    assert.equal((await session(opened.page)).writingDirty,true);
    assert.equal(await opened.editor.inputValue(),'Bản local phải được giữ');
    assert.doesNotMatch(await opened.page.locator('.writing-editor-meta span').first().innerText(),/^Đã lưu/);
  } finally { await opened.context.close(); }
});

test('D08 xung đột giữ bài đang viết và bản server, không tự nâng phiên bản rồi đè',async () => {
  const opened=await open(({fulfill})=>fulfill({ok:true,writing:canonical({revision:6,accepted:false,reason:'revision_conflict',task1:'Bản từ tab khác'})}));
  try {
    await opened.editor.fill('Bản local đang viết');
    await opened.page.locator('#writingConflict').waitFor({state:'visible'});
    assert.equal(await opened.editor.inputValue(),'Bản local đang viết');
    assert.equal((await session(opened.page)).writingDirty,true);
    assert.equal((await session(opened.page)).writingConflict.task1,'Bản từ tab khác');
    const count=opened.requests.length; await opened.page.waitForTimeout(150);
    assert.equal(opened.requests.length,count,'Conflict gây vòng ghi đè tự động');
    assert.equal(opened.requests[0].baseRevision,5);
    await opened.page.reload();
    await opened.page.locator('#writingConflict').waitFor({state:'visible'});
    assert.equal(await opened.editor.inputValue(),'Bản local đang viết','Reload làm mất bản đang viết');
  } finally { await opened.context.close(); }
});

test('D08 gõ tiếp khi chờ phản hồi: base mới chỉ gắn khi request kế tiếp thực sự gửi',async () => {
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  let savedTask1='Bài đã lưu Task 1',serverRevision=5;
  const opened=await open(async ({payload,requests,fulfill})=>{
    if(requests.length===1) await pending;
    const unchanged=payload.task1===savedTask1;
    if(!unchanged){savedTask1=payload.task1;serverRevision+=1;}
    return fulfill({ok:true,writing:canonical({task1:payload.task1,task2:payload.task2,revision:serverRevision,accepted:true,reason:unchanged?'already_saved':'saved'})});
  });
  try {
    await opened.editor.fill('Snapshot A');
    await opened.page.waitForFunction(()=>document.querySelector('.writing-editor-meta span')?.textContent.includes('Đang lưu'));
    await opened.page.waitForTimeout(60);
    assert.equal(opened.requests.length,1);
    await opened.editor.fill('Snapshot B mới hơn');
    release(); await waitSaved(opened.page);
    assert.equal(await opened.editor.inputValue(),'Snapshot B mới hơn');
    assert.equal(opened.requests[0].baseRevision,5);
    assert.equal(opened.requests.find(x=>x.task1==='Snapshot B mới hơn').baseRevision,6);
    assert.equal((await session(opened.page)).writingServerRevision,7);
  } finally { release(); await opened.context.close(); }
});

test('D08 server đã nộp bản khác: giữ bản local phục hồi trước khi hiển thị bài chốt',async () => {
  const opened=await open(({fulfill})=>fulfill({ok:true,writing:canonical({revision:6,submitted:true,accepted:false,reason:'already_submitted',task1:'Bài chốt từ tab khác'})}));
  try {
    await opened.editor.fill('Bản local chưa được nhận');
    await opened.page.waitForFunction(key=>JSON.parse(sessionStorage.getItem(key)||'{}').writingSubmitted===true,key);
    const stored=await session(opened.page);
    assert.ok(stored.writingRecovery.some(item=>item.task1==='Bản local chưa được nhận'));
    assert.equal(stored.drafts.writing.task1,'Bài chốt từ tab khác');
  } finally { await opened.context.close(); }
});

test('D08 mất phản hồi sau ghi: retry cùng snapshot được xác nhận và giữ đúng bản',async () => {
  const opened=await open(({route,payload,requests,fulfill})=> requests.length===1?route.abort('failed'):fulfill({ok:true,writing:canonical({revision:6,accepted:true,reason:'already_saved',task1:payload.task1,task2:payload.task2})}));
  try {
    await opened.editor.fill('Bản gửi lại sau mất phản hồi'); await opened.page.waitForTimeout(80);
    await opened.page.waitForFunction(key=>JSON.parse(sessionStorage.getItem(key)||'{}').writingDirty===false,key);
    assert.equal(await opened.editor.inputValue(),'Bản gửi lại sau mất phản hồi');
    assert.ok(opened.requests.length>=2);
    assert.equal(opened.requests[0].baseRevision,5);
    assert.equal(opened.requests[1].baseRevision,5);
    assert.equal((await session(opened.page)).writingServerRevision,6);
  } finally { await opened.context.close(); }
});


test('D08 ACK nộp sai nội dung không được chốt UI hay xóa bài local',async () => {
  const opened=await open(({fulfill})=>fulfill({ok:true,writing:canonical({revision:6,submitted:true,accepted:true,reason:'saved',task1:'Bài khác với payload'})}));
  try {
    await opened.editor.fill('Bài chưa được xác nhận đúng');
    await opened.page.waitForFunction(()=>document.querySelector('.writing-editor-meta span')?.textContent.includes('Chưa'));
    const stored=await session(opened.page);
    assert.equal(stored.writingSubmitted,false);assert.equal(stored.writingDirty,true);
    assert.equal(await opened.editor.inputValue(),'Bài chưa được xác nhận đúng');
  } finally {await opened.context.close();}
});

test('D08 phản hồi version thấp hơn bản đã đọc không được lùi trạng thái',async () => {
  const opened=await open(({payload,fulfill})=>fulfill({ok:true,writing:canonical({revision:4,accepted:true,reason:'saved',task1:payload.task1,task2:payload.task2})}));
  try {
    await opened.editor.fill('Bài giữ phiên bản mới');
    await opened.page.waitForFunction(()=>document.querySelector('.writing-editor-meta span')?.textContent.includes('Chưa'));
    const stored=await session(opened.page);
    assert.equal(stored.writingServerRevision,5);assert.equal(stored.writingDirty,true);
    assert.equal(await opened.editor.inputValue(),'Bài giữ phiên bản mới');
  } finally {await opened.context.close();}
});

test('D08 chỉ lựa chọn rõ của học viên mới gửi bản local từ base mới và giữ bản khác',async () => {
  const opened=await open(({payload,requests,fulfill})=>requests.length===1
    ?fulfill({ok:true,writing:canonical({revision:6,accepted:false,reason:'revision_conflict',task1:'Bản server6'})})
    :fulfill({ok:true,writing:canonical({revision:7,accepted:true,reason:'saved',task1:payload.task1,task2:payload.task2})}));
  try {
    await opened.editor.fill('Bản local chọn tiếp tục');
    await opened.page.locator('#writingConflict').waitFor({state:'visible'});
    await opened.page.locator('#writingKeepLocal').click();await waitSaved(opened.page);
    assert.equal(opened.requests[1].baseRevision,6);
    assert.equal(opened.requests[1].task1,'Bản local chọn tiếp tục');
    const stored=await session(opened.page);assert.equal(stored.writingServerRevision,7);
    assert.ok(stored.writingRecovery.some(x=>x.task1==='Bản server6'));
    assert.ok(stored.writingRecovery.some(x=>x.task1==='Bản local chọn tiếp tục'));
  } finally {await opened.context.close();}
});

test('D08 chọn bản hệ thống giữ bản local phục hồi và không tạo lượt ghi khác',async () => {
  const opened=await open(({fulfill})=>fulfill({ok:true,writing:canonical({revision:6,accepted:false,reason:'revision_conflict',task1:'Bản server chọn'})}));
  try {
    await opened.editor.fill('Bản local để phục hồi');
    await opened.page.locator('#writingConflict').waitFor({state:'visible'});
    const before=opened.requests.length;await opened.page.locator('#writingUseServer').click();
    await opened.page.waitForTimeout(150);
    const stored=await session(opened.page);assert.equal(opened.requests.length,before);
    assert.equal(await opened.editor.inputValue(),'Bản server chọn');assert.equal(stored.writingDirty,false);
    assert.equal(stored.writingServerRevision,6);assert.ok(stored.writingRecovery.some(x=>x.task1==='Bản local để phục hồi'));
  } finally {await opened.context.close();}
});

test('D08 bản cũ chưa biết server version phải giữ local và đối chiếu rõ khi reload',async () => {
  const opened=await open(({fulfill})=>fulfill({ok:true}),{writingServerRevision:null,writingConfirmedDraft:null,writingDirty:true,drafts:{writing:{task1:'Bài local từ trang cũ',task2:'Task2 local cũ'}}});
  try {
    await opened.page.locator('#writingConflict').waitFor({state:'visible'});
    assert.equal(await opened.editor.inputValue(),'Bài local từ trang cũ');
    assert.equal(opened.requests.length,0,'Legacy tự rebase và ghi đè server');
    await opened.page.reload();await opened.page.locator('#writingConflict').waitFor({state:'visible'});
    assert.equal(await opened.editor.inputValue(),'Bài local từ trang cũ');
  } finally {await opened.context.close();}
});


test('D08 local từ trang cũ thiếu dirty/confirmed cũng không được mất khi restore',async () => {
  const opened=await open(({fulfill})=>fulfill({ok:true}),{writingServerRevision:null,writingConfirmedDraft:null,writingDirty:false,drafts:{writing:{task1:'Bài chưa gắn cờ dirty từ bản cũ',task2:'Task2 cần giữ'}}});
  try {
    await opened.page.locator('#writingConflict').waitFor({state:'visible'});
    assert.equal(await opened.editor.inputValue(),'Bài chưa gắn cờ dirty từ bản cũ');
    assert.equal(opened.requests.length,0);assert.equal((await session(opened.page)).writingDirty,true);
  } finally {await opened.context.close();}
});

// Đóng tab phải dùng cùng đường truyền với lưu thường, cả API trực tiếp và gateway.
test('D08 đóng tab giữ baseRevision và đúng gateway envelope',async () => {
  const opened=await open(({payload,fulfill})=>fulfill({ok:true,writing:canonical({revision:6,accepted:true,reason:'saved',task1:payload.task1,task2:payload.task2})}));
  try {
    await opened.editor.fill('Bản giữ khi đóng tab');
    await opened.page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
    await opened.page.waitForTimeout(80);
    assert.ok(opened.requests.length>0);assert.equal(opened.requests[0].baseRevision,5);
    assert.equal(opened.requests[0].task1,'Bản giữ khi đóng tab');
    const gateway=sourceText.includes('fetch(appConfig.API_BASE_URL,');
    assert.equal(opened.transports[0].url,gateway?base+'/fixture-api':base+'/fixture-api/api/term-tests/writing');
    if(gateway)assert.deepEqual(opened.transports[0].body,{route:'/api/term-tests/writing',payload:opened.requests[0]});
  } finally {await opened.context.close();}
});

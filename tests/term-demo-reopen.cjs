// Nhận source thật và bộ nhớ phiên giả; kiểm mở lại demo, đổi người và giữ phiên lớp thật.
// Mọi API đều bị chặn hoặc giả lập; lỗi assertion trả exit khác 0, không ghi dữ liệu thật.
const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname } = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root = resolve(__dirname, '..');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const OLD = '33333333-3333-4333-8333-333333333333';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
let browser, server, site;
before(async () => {
  server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const file = resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
      if (!file.startsWith(root + require('node:path').sep)) throw new Error('OUTSIDE_ROOT');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': (mime[extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  site = process.env.K67_DEMO_TEST_SITE || `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function fixture({slug='term-test-2', classCode='CODEXDEMO806', query='', retake=false}={}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  const requests = [], unexpected = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method()==='GET' && request.url().startsWith(site)) return route.continue();
    if (url.pathname.includes('/api/term-tests/')) {
      requests.push({path:url.pathname,method:request.method(),body:request.postDataJSON()});
      if (url.pathname.endsWith('/roster')) return route.fulfill({json:{class:{name:classCode},students:[{ref:A,name:'Học viên giả A'},{ref:B,name:'Học viên giả B'}]}});
      // Lỗi máy chủ có chủ đích: kiểm payload chuẩn bị và giữ token mà không nạp đề/audio.
      return route.fulfill({status:503,json:{error:'FIXTURE_STOP',message:'Dừng tại biên API giả'}});
    }
    unexpected.push(request.url());
    return route.abort();
  });
  await page.addInitScript(({slug,classCode,A,OLD,retake}) => {
    // Seed đúng dấu vết tồn tại từ lần làm trước, chỉ một lần cho mỗi context.
    if (sessionStorage.getItem('fixture-seeded')) return;
    sessionStorage.setItem('fixture-seeded','1');
    let suffix='';
    if(retake) {
      const grant=new URLSearchParams(location.search).get('retake');
      let hash=0x811c9dc5;
      for(const char of grant) { hash ^= char.charCodeAt(0); hash=Math.imul(hash,0x01000193); }
      suffix=':listening-retake:'+(hash>>>0).toString(16).padStart(8,'0');
    }
    const key=`izone-test:${slug}:${classCode}${suffix}`;
    const old={studentRef:A,studentName:'Học viên giả A',attemptToken:OLD,examSessionToken:OLD,listeningStartedAt:'2026-10-01T00:00:00Z',drafts:{listening:{q1:'OLD'},reading:{},writing:{task1:'OLD'}}};
    for(const storage of [sessionStorage,localStorage]) {
      storage.setItem(key,JSON.stringify(old));
      storage.setItem(`izone-test-ui:${slug}:${classCode}${suffix}`,JSON.stringify({audio:{started:true,time:120}}));
      storage.setItem(`izone-test-interactions:${slug}:${classCode}${suffix}:${OLD}`,'OLD');
      storage.setItem('unrelated-fixture','KEEP');
    }
  },{slug,classCode,A,OLD,retake});
  const route=retake?'term-test-1-listening-retake':`${slug}-computer-based`;
  await page.goto(`${site}term-tests/${route}/?class=${classCode}${query}`);
  await page.locator(`#bootstrapStudent option[value="${B}"]`).waitFor({state:'attached'});
  return {page,context,requests,unexpected,errors};
}

for(const slug of ['term-test-1','term-test-2','mini-test-lesson-5']) {
  test(`${slug}: mở lại demo có phiên cũ vẫn chọn được học viên khác và chuẩn bị đúng danh tính`,async()=>{
    const f=await fixture({slug});
    try {
      assert.equal(f.requests.filter(r=>r.method==='POST').length,0,'Demo tự mở lại bài trước khi chọn tên');
      await f.page.locator('#bootstrapStudent').selectOption(B);
      const dialog=f.page.getByRole('dialog',{name:'Xác nhận thông tin học viên'});
      await dialog.waitFor({state:'visible'});
      assert.match(await dialog.innerText(),/Học viên giả B/);
      await dialog.getByRole('button',{name:'Xác nhận, tiếp tục'}).click();
      await f.page.getByText('Chưa chuẩn bị được bài thi:',{exact:false}).waitFor();
      const prepared=f.requests.filter(r=>r.path.endsWith('/session/prepare'));
      assert.equal(prepared.length,1);
      assert.equal(prepared[0].body.studentRef,B);
      assert.equal(prepared[0].body.examSessionToken,undefined,'Gửi nhầm phiên cũ của A');
      assert.equal(prepared[0].body.legacyElapsedSeconds,0);
      assert.equal(await f.page.locator('#bootstrapDemoReset').isVisible(),true);
      const stored=await f.page.evaluate(({slug,OLD})=>[sessionStorage,localStorage].map(storage=>({state:JSON.parse(storage.getItem(`izone-test:${slug}:CODEXDEMO806`)),ui:storage.getItem(`izone-test-ui:${slug}:CODEXDEMO806`),interaction:storage.getItem(`izone-test-interactions:${slug}:CODEXDEMO806:${OLD}`),other:storage.getItem('unrelated-fixture')})),{slug,OLD});
      for(const row of stored) { assert.equal(row.state.studentRef,B);assert.ok(!row.state.attemptToken);assert.equal(row.ui,null);assert.equal(row.interaction,null);assert.equal(row.other,'KEEP'); }
      assert.deepEqual(f.unexpected,[]);assert.deepEqual(f.errors,[]);
    } finally {await f.context.close();}
  });
}

test('lớp thật giữ phiên cũ và chặn đổi học viên dù API tạm lỗi',async()=>{
  const f=await fixture({classCode:'SYNTHETIC67'});
  try{
    await f.page.getByText('Chưa chuẩn bị được bài thi:',{exact:false}).waitFor();
    assert.equal(await f.page.locator('#bootstrapStudent').inputValue(),A);
    assert.equal(f.requests.find(r=>r.path.endsWith('/session/resume-attempt')).body.attemptToken,OLD);
    assert.equal(await f.page.locator('#bootstrapStudent').isEnabled(),false,'Lớp thật cho đổi danh tính khi Listening đã bắt đầu');
    assert.equal(await f.page.locator('#bootstrapStudent').inputValue(),A);
    assert.deepEqual(f.unexpected,[]);assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
});

test('liên kết kết quả demo vẫn khôi phục đúng lượt được chỉ định',async()=>{
  const f=await fixture({query:`&demoStudent=${A}&demoAttempt=${OLD}`});
  try{
    await f.page.getByText('Chưa chuẩn bị được bài thi:',{exact:false}).waitFor();
    const resumed=f.requests.find(r=>r.path.endsWith('/session/resume-attempt'));
    assert.equal(resumed.body.studentRef,A);assert.equal(resumed.body.attemptToken,OLD);
    assert.equal(await f.page.locator('#bootstrapDemoReset').isVisible(),true);
    assert.deepEqual(f.unexpected,[]);assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
});

test('thi bù Listening giữ nguyên bộ nhớ riêng của lượt thi',async()=>{
  const grant='A'.repeat(50)+'.'+'B'.repeat(43);
  const f=await fixture({slug:'term-test-1',retake:true,query:`&retake=${grant}`});
  try{
    const saved=await f.page.evaluate(()=>[...Array(sessionStorage.length)].map((_,i)=>sessionStorage.key(i)).filter(k=>k.startsWith('izone-test:')) .map(k=>JSON.parse(sessionStorage.getItem(k))));
    assert.equal(saved.length,1);assert.equal(saved[0].attemptToken,OLD);
    assert.deepEqual(f.unexpected,[]);assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
});

// Trang Reading/Listening thật, phiên và bài giả; mọi API/media ngoài đều được chặn.
// Không gọi bắt đầu bài, AI hoặc Docs. Kết quả và ảnh lỗi được lưu để đọc lại.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = fileURLToPath(new URL('../', import.meta.url)), out = process.env.IDENTITY_EVIDENCE_DIR;
assert.ok(out); await mkdir(out, { recursive: true });
const key = 'izone:student-identity:v1', a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
const record = id => ({ version: 1, identity: { authority: 'erp-contact', id }, revision: 'fixture_' + id, updatedAt: new Date().toISOString() });
const doc = 'fixture-document-with-enough-characters';
// Chỉ metadata để kiểm đăng nhập bài mới; fixture không cung cấp đề, key hoặc audio.
const sharedListeningLesson = { authored: true, code: '7', lesson: 10, title: 'Inclusive design',
  questionIds: [31,32,33,34,35,36,37,38,39,40], totalMs: 606322, audioMs: 486322, reviewMs: 120000,
  groups: [{ id: 'notes', kind: 'completion', label: 'Note Completion', start: 31, end: 40 }] };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/empty') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>Thử</title>'); }
  const file = path.resolve(root, '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
  try {
    if (!file.startsWith(path.resolve(root) + path.sep) || /\.(mp3|wav|m4a|enc|ogg)$/i.test(file)) throw Error('Blocked');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true }), results = [];
const pageUrl = (kind, shared = false) => `${origin}/${kind}-practice/?${shared ? 'lesson=7' : `documentId=${doc}`}#login${shared ? '' : '?entry=fixture-entry-token'}`;
async function setup({ id, wrongDoc = false, blocked = false, delayLogin = false, identityDelay = 0, legacy, legacySamePerson = false, forgotten = false, legacyFailure = false, sharedListening = false, excludedRoster = false, otherClass = false, ambiguous = false, missingIdentity = false, delayRoster = false, baseRevision } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' }), errors = [], requests = [], external = [], sessions = new Map();
  let releaseLogin, loginSeen;
  const loginArrived = new Promise(r => loginSeen = r), gate = new Promise(r => releaseLogin = r);
  ctx.on('page', p => { p.setDefaultTimeout(8000); p.on('pageerror', e => errors.push(e.message)); });
  await ctx.addInitScript(({ origin, key, initial, blocked, legacy, forgotten }) => {
    if (location.origin !== origin) return;
    if (initial && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
    if(forgotten&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,identity:null,revision:'forgotten_fixture_123',updatedAt:new Date().toISOString()}));
    for(const [name,value] of Object.entries(legacy||{}))if(!localStorage.getItem(name))localStorage.setItem(name,JSON.stringify(value));
    window.__plays = 0; HTMLMediaElement.prototype.play = function () { window.__plays++; return Promise.resolve(); };
    if (blocked) for (const name of ['sessionStorage', 'localStorage']) Object.defineProperty(window, name,
      { configurable: true, get() { throw new DOMException('Fixture storage blocked', 'SecurityError'); } });
  }, { origin, key, initial: id ? record(id) : null, blocked, legacy, forgotten });
  function view(ref, shared = false) { return { ...(sharedListening ? {lesson: sharedListeningLesson} : {}), token: 'fixture-token-' + ref, identity: {
    studentRef: ref, name: ref === a ? 'Học viên A' : 'Học viên B', classCode: 'IC2304',
    bindingId: 'binding-' + ref, entryMode: shared ? 'shared' : 'homework',
    documentId: doc, documentUrl: 'https://docs.google.com/document/d/' + doc }, attempts: [], events: [], firstCompleted: null }; }
  await ctx.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (/\.(mp3|wav|m4a|enc|ogg)$/.test(url.pathname)) { external.push('audio blocked'); return route.abort(); }
    if (baseRevision && url.origin === origin && /^\/(reading|listening)-practice\/app.js$/.test(url.pathname)) return route.fulfill({contentType:'text/javascript',body:execFileSync('git',['show',baseRevision+':'+url.pathname.slice(1)],{cwd:root})});
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const body = req.postDataJSON(); requests.push({ path: url.pathname, body });
    if(process.env.ENTRY_BENCHMARK)await new Promise(resolve=>setTimeout(resolve,80));
    const send = (value, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.pathname === '/mapping-api/api/student-identity/resolve') {
      if(missingIdentity)return send({ok:true,status:'missing',identity:null,aliases:[]});
      if(identityDelay)await new Promise(resolve=>setTimeout(resolve,identityDelay));
      if(legacyFailure&&body.studentRef===b)return send({ok:false,message:'Nguồn cũ lỗi giả'},503);
      const id = body.identity?.id || (body.studentRef === b && !legacySamePerson ? '900002' : '900001');
      const aliases = [{ studentRef: body.studentRef || (id === '900002' ? b : a), studentName: id === '900002' ? 'Học viên B' : 'Học viên A', classId: '1293', classCode: otherClass ? 'IC9999' : 'IC2304' }];
      if (ambiguous && !body.studentRef) aliases.push({studentRef:b,studentName:'Bí danh thứ hai',classId:'1293',classCode:'IC2304'});
      return send({ ok: true, status: 'unique', identity: { authority: 'erp-contact', id }, aliases });
    }
    if (url.origin !== origin) { external.push(url.origin); return route.abort(); }
    if (url.pathname === '/api/open') return send({ classCode: 'IC2304', bindingId: 'binding-' + (wrongDoc ? b : a),
      selectedStudentRef: wrongDoc ? b : a, students: [{ id: a, name: 'Học viên A' }, { id: b, name: 'Học viên B' }] });
    if (url.pathname === '/api/library/7') return send({ ...(sharedListening ? {lesson: sharedListeningLesson} : {}), classes: [{ id: '1293', classCode: 'IC2304' }] });
    if (url.pathname === '/api/library/7/classes/1293') {if(delayRoster){loginSeen();await gate;}return send({ students: excludedRoster ? [{ id: b, name: 'Học viên B' }] : [{ id: a, name: 'Học viên A' }, { id: b, name: 'Học viên B' }] });}
    if (['/api/login', '/api/shared-login'].includes(url.pathname)) {
      loginSeen(); if (delayLogin) await gate;
      const value = view(body.studentRef, url.pathname.endsWith('shared-login')); sessions.set(value.token, value); return send(value);
    }
    if (url.pathname === '/api/state') {
      const token = (req.headers().authorization || '').replace(/^Bearer /, '');
      return sessions.has(token) ? send(sessions.get(token)) : send({ error: { code: 'UNAUTHORIZED', message: 'Phiên giả không tồn tại' } }, 401);
    }
    external.push(url.pathname); return send({ error: { code: 'UNEXPECTED', message: 'Yêu cầu ngoài fixture' } }, 503);
  });
  return { ctx, page: await ctx.newPage(), errors, external, requests, loginArrived, releaseLogin };
}
async function run(name, options, fn) {
  if(process.env.IDENTITY_ONLY&&!name.includes(process.env.IDENTITY_ONLY))return;
  const s = await setup(options);
  try { await fn(s); assert.deepEqual(s.errors, []); assert.deepEqual(s.external, []);
    assert.equal(s.requests.some(r => /\/(begin|activate|submit|audio|pause)$/.test(r.path)), false);
    results.push({ case: name, status: 'passed' }); console.log('Đạt:', name);
  } catch (error) { results.push({ case: name, status: 'failed', error: error.message, errors: s.errors, requests: s.requests });
    await s.page.screenshot({ path: path.join(out, name + '-failure.png'), fullPage: true }); throw error;
  } finally { s.releaseLogin(); await s.ctx.close(); }
}
async function prep(page) { await page.locator('[data-action="begin"]').waitFor(); assert.equal(await page.locator('#login-form').count(), 0); }
async function manual(page, shared = false) {
  await page.locator('#class-select').selectOption(shared ? '1293' : 'IC2304'); await page.locator('#student-select').selectOption(a);
  await page.locator('#login-submit').click(); await prep(page);
}
try {
  if(process.env.ENTRY_BENCHMARK){
    const samples=[];
    for(let sample=0;sample<10;sample++)for(const kind of ['reading','listening'])for(const version of ['before','after']){
      const s=await setup({id:'900001',sharedListening:kind==='listening',baseRevision:version==='before'?process.env.ENTRY_BASE:undefined});
      try{const start=performance.now();await s.page.goto(pageUrl(kind,true));await prep(s.page);
        assert.deepEqual(s.errors,[]);assert.deepEqual(s.external,[]);
        samples.push({sample,kind,version,ms:performance.now()-start,identityReads:s.requests.filter(r=>r.path==='/mapping-api/api/student-identity/resolve').length,apiRequests:s.requests.length});
      }finally{s.releaseLogin();await s.ctx.close();}
    }
    await writeFile(path.join(out,'measurement.json'),JSON.stringify(samples,null,2));console.log(JSON.stringify({samples:samples.length,latencyMs:80}));
  }else{
  for (const kind of ['reading', 'listening']) {
    // Cùng lượt vào thư viện: quy đổi một lần, sau roster vẫn phải giữ đúng
    // người và kiểm phiên trả về. Bộ test roster/race bên dưới giữ ranh giới đó.
    await run(kind + '-shared-one-identity-read', { id:'900001', sharedListening:kind==='listening' }, async ({page,requests})=>{
      await page.goto(pageUrl(kind,true)); await prep(page);
      assert.match(await page.locator('.identity-bar').innerText(),/Học viên A/);
      assert.equal(requests.filter(r=>r.path==='/mapping-api/api/student-identity/resolve').length,1);
    });
    await run(kind+'-identity-changed-while-roster-pending',{id:'900001',sharedListening:kind==='listening',delayRoster:true},async({page,ctx,loginArrived,releaseLogin,requests})=>{
      await page.goto(pageUrl(kind,true));await loginArrived;const other=await ctx.newPage();await other.goto(origin+'/empty');
      await other.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:record('900002')});releaseLogin();
      await page.locator('#login-form').waitFor();assert.equal(requests.some(r=>r.path==='/api/shared-login'),false);
    });
    await run(kind + '-remembered-skip-login', { id: '900001' }, async ({ page }) => {
      await page.goto(pageUrl(kind)); await prep(page); assert.match(await page.locator('.identity-bar').innerText(), /Học viên A/);
      assert.equal(await page.evaluate(() => window.__plays), 0);
    });
    await run(kind + '-first-producer-cross-product', {}, async ({ page, ctx }) => {
      await page.goto(pageUrl(kind)); await manual(page);
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').identity?.id === '900001', key);
      const other = await ctx.newPage(); await other.goto(pageUrl(kind === 'reading' ? 'listening' : 'reading')); await prep(other);
      assert.match(await other.locator('.identity-bar').innerText(), /Học viên A/);
    });
    await run(kind + '-first-producer-ready-before-next-product', {identityDelay:1500}, async ({page,ctx})=>{
      await page.goto(pageUrl(kind)); await manual(page);
      assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null')?.identity?.id,key),'900001');
      const next=await ctx.newPage();await next.goto(pageUrl(kind==='reading'?'listening':'reading'));await prep(next);
      assert.match(await next.locator('.identity-bar').innerText(),/Học viên A/);
    });
    await run(kind + '-wrong-document-owner', { id: '900001', wrongDoc: true }, async ({ page, requests }) => {
      await page.goto(pageUrl(kind)); await page.locator('#login-form').waitFor();
      assert.equal(requests.some(r => r.path === '/api/login'), false);
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).identity.id, key), '900001');
    });
    await run(kind + '-pinned-session-after-other-tab-switch', { id: '900001' }, async ({ page, ctx }) => {
      await page.goto(pageUrl(kind)); await prep(page);
      const other = await ctx.newPage(); await other.goto(origin + '/empty');
      await other.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: record('900002') });
      await page.reload(); await prep(page); assert.match(await page.locator('.identity-bar').innerText(), /Học viên A/);
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).identity.id, key), '900002');
    });
    await run(kind + '-blocked-storage-manual', { blocked: true }, async ({ page }) => {
      await page.goto(pageUrl(kind)); await manual(page); assert.match(await page.locator('.identity-bar').innerText(), /Học viên A/);
    });
    await run(kind + '-late-auto-login-not-applied', { id: '900001', delayLogin: true }, async ({ page, ctx, loginArrived, releaseLogin }) => {
      await page.goto(pageUrl(kind)); await loginArrived;
      const other = await ctx.newPage(); await other.goto(origin + '/empty');
      await other.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: record('900002') });
      releaseLogin(); await page.locator('#login-form').waitFor();
      assert.equal(await page.locator('.identity-bar').count(), 0);
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).identity.id, key), '900002');
    });
    await run(kind + '-switch-keeps-old-draft', { id: '900001' }, async ({ page }) => {
      await page.goto(pageUrl(kind)); await prep(page);
      await page.evaluate(() => localStorage.setItem('old-draft-A', 'Bài của A'));
      await page.getByRole('button', { name: 'Đổi người học', exact: true }).click(); await page.locator('#login-form').waitFor();
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).identity, key), null);
      assert.equal(await page.evaluate(() => localStorage.getItem('old-draft-A')), 'Bài của A');
      await page.reload(); await page.locator('#login-form').waitFor();
    });
  }
  await run('reading-shared-library-auto', { id: '900001' }, async ({ page }) => {
    await page.goto(pageUrl('reading', true)); await prep(page); assert.match(await page.locator('.identity-bar').innerText(), /Học viên A/);
  });
  await run('listening-shared-remembered-no-audio', {sharedListening:true,id:'900001'}, async({page,requests})=>{
    await page.goto(pageUrl('listening',true));await prep(page);
    assert.match(await page.locator('.identity-bar').innerText(),/Học viên A/);
    assert.equal(await page.evaluate(()=>window.__plays),0);
    assert.deepEqual(requests.find(r=>r.path==='/api/shared-login').body,{code:'7',classId:'1293',studentRef:a});
  });
  await run('listening-shared-first-producer-before-reading', {sharedListening:true,identityDelay:1500}, async({page,ctx})=>{
    await page.goto(pageUrl('listening',true));await manual(page,true);
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).identity.id,key),'900001');
    const next=await ctx.newPage();await next.goto(pageUrl('reading'));await prep(next);
    assert.match(await next.locator('.identity-bar').innerText(),/Học viên A/);
  });
  await run('listening-shared-blocked-storage-manual', {sharedListening:true,blocked:true}, async({page})=>{
    await page.goto(pageUrl('listening',true));await manual(page,true);
    assert.match(await page.locator('.identity-bar').innerText(),/Học viên A/);
    await page.locator('#toast').filter({hasText:'chưa nhớ được'}).waitFor();
  });
  await run('listening-shared-without-remembering', {sharedListening:true}, async({page})=>{
    await page.goto(pageUrl('listening',true));await page.locator('#class-select').selectOption('1293');
    await page.locator('#student-select').selectOption(a);await page.locator('#remember-student').uncheck();
    await page.locator('#login-submit').click();await prep(page);
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).identity,key),null);
  });
  await run('listening-shared-missing-identity-explains-profile', {sharedListening:true,missingIdentity:true},async({page})=>{
    await page.goto(pageUrl('listening',true));await manual(page,true);
    const notice=await page.locator('#toast').innerText();
    assert.match(notice,/Hồ sơ chưa đối chiếu/);
    assert.doesNotMatch(notice,/trình duyệt/);
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null')?.identity??null,key),null);
  });
  await run('listening-shared-pinned-session-other-tab', {sharedListening:true,id:'900001'}, async({page,ctx})=>{
    await page.goto(pageUrl('listening',true));await prep(page);
    const other=await ctx.newPage();await other.goto(origin+'/empty');
    await other.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:record('900002')});
    await page.reload();await prep(page);assert.match(await page.locator('.identity-bar').innerText(),/Học viên A/);
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).identity.id,key),'900002');
  });
  await run('listening-shared-late-auto-response-discarded', {sharedListening:true,id:'900001',delayLogin:true}, async({page,ctx,loginArrived,releaseLogin})=>{
    await page.goto(pageUrl('listening',true));await loginArrived;
    const other=await ctx.newPage();await other.goto(origin+'/empty');
    await other.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:record('900002')});
    releaseLogin();await page.locator('#login-form').waitFor();assert.equal(await page.locator('.identity-bar').count(),0);
  });
  await run('listening-shared-forget-preserves-draft', {sharedListening:true,id:'900001'}, async({page})=>{
    await page.goto(pageUrl('listening',true));await prep(page);
    await page.evaluate(()=>localStorage.setItem('old-draft-A','Bài của A'));
    await page.getByRole('button',{name:'Đổi người học',exact:true}).click();await page.locator('#login-form').waitFor();
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).identity,key),null);
    assert.equal(await page.evaluate(()=>localStorage.getItem('old-draft-A')),'Bài của A');
    await page.reload();await page.locator('#login-form').waitFor();
  });
  for(const [name,options] of [['not-in-roster',{excludedRoster:true}],['class-not-open',{otherClass:true}],['ambiguous-alias',{ambiguous:true}]]){
    await run('listening-shared-'+name,{sharedListening:true,id:'900001',...options},async({page,requests})=>{
      await page.goto(pageUrl('listening',true));await page.locator('#login-form').waitFor();
      assert.equal(requests.some(r=>r.path==='/api/shared-login'),false);
    });
  }
  const legacy={['izone:remembered-writing-student:v1:https://ducizone.ddns.net/writing-api']:{version:1,studentRef:a},
    'reading-practice67-identity':{studentId:b,classCode:'IC2304'}};
  await run('legacy-same-person-auto-migrated', {legacy,legacySamePerson:true},async({page})=>{
    await page.goto(pageUrl('listening'));await prep(page);
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).identity.id,key),'900001');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('reading-practice67-identity')).studentId),b);
  });
  await run('legacy-conflict-one-manual-choice', {legacy},async({page,ctx,requests})=>{
    await page.goto(pageUrl('reading'));await page.locator('#studentIdentityMigrationNotice').filter({hasText:'nhiều người'}).waitFor();
    assert.equal(requests.some(r=>r.path==='/api/login'),false);
    await manual(page);await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'{}').identity?.id==='900001',key);
    assert.equal(await page.locator('#studentIdentityMigrationNotice').count(),0);
    const other=await ctx.newPage();await other.goto(pageUrl('listening'));await prep(other);
  });
  await run('legacy-source-error-does-not-pick-other-record', {legacy,legacyFailure:true},async({page,requests})=>{
    await page.goto(pageUrl('reading'));await page.locator('#studentIdentityMigrationNotice').filter({hasText:'Chưa đối chiếu đủ'}).waitFor();
    assert.equal(requests.some(r=>r.path==='/api/login'),false);await manual(page);
  });
  await run('legacy-after-forget-not-imported-again', {legacy,forgotten:true},async({page,requests})=>{
    await page.goto(pageUrl('listening'));await page.locator('#login-form').waitFor();
    assert.equal(requests.some(r=>r.path==='/api/login'),false);
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).identity,key),null);
  });
  }
} finally {
  await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
  await browser.close(); await new Promise(r => server.close(r));
}

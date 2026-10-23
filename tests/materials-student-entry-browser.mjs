// UI thật Materials + Reading/Listening, API/đề/nháp giả trong RAM.
// Không có đường ra mạng thật, audio, nộp/chấm/Docs/Portal. Không chỉ gieo bộ nhớ
// để nhận là xuyên sản phẩm: hai ca producer chọn tên trên UI trước khi mở app khác.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.IDENTITY_EVIDENCE_DIR;
assert.ok(out); await mkdir(out, { recursive: true });
const site = 'https://tranhoangduc90.github.io', prefix = '/izone-ai-team-pages';
const entry = site + prefix + '/reading-skills67/materials-beyond-concrete/?server=1';
const api = '/reading67-materials/api/reading-skills67';
const key = 'izone:student-identity:v1';
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
const cls = { id: '1293', classCode: 'LOPTHU' };
const code = 'fixture-materials';
const classRef='33333333-3333-4333-8333-333333333333', assignmentId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const content = { code, version: 'fixture-v1', title: 'Bài đọc thử riêng', subtitle: 'Dữ liệu giả',
  instruction: 'Tìm đoạn.', blankValues: [], dropdownPlaceholders: [],
  paragraphs: [...'ABCDEFGH'].map(id => ({ id, text: 'Đoạn thử ' + id, target: 'p.' + id })),
  questions: [1,2,3,4].map(number => ({ number, text: 'Câu thử ' + number, hint: 'Gợi ý giả',
    targets: { radar: `q.${number}.radar`, evidence_l1: `q.${number}.evidence`, section: `q.${number}.section` } })) };
content.targets = [...content.paragraphs.map(p => ({ id: p.target })), ...content.questions.flatMap(q => Object.values(q.targets).map(id => ({ id })))];
const person = ref => ({ ownerId: ref, erpId: ref === b ? '900002' : '900001', courseId: cls.id,
  name: ref === b ? 'Học viên thử B' : 'Học viên thử A', className: cls.classCode });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
async function fixture(options = {}) {
  const context = await browser.newContext({ viewport: { width: options.width || 1440, height: 900 }, serviceWorkers: 'block' });
  const state = { deny: false, saveFailure: false, offline: false, ...options };
  const calls = [], unexpected = [], errors = [], sessions = new Map(), drafts = new Map();
  let releaseLogin; const gate = new Promise(r => releaseLogin = r);
  let loginSeen; const loginArrived = new Promise(r => loginSeen = r);
  context.on('page', page => { page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message)); });
  await context.addInitScript(({ blocked }) => {
    HTMLMediaElement.prototype.play = () => { throw new Error('Không được phát audio khi nhận diện'); };
    if (blocked) for (const name of ['localStorage','sessionStorage']) Object.defineProperty(window, name, {
      get() { throw new DOMException('Bộ nhớ thử bị chặn', 'SecurityError'); }, configurable: true });
  }, { blocked: options.blocked });
  function draft(ref) {
    if (!drafts.has(ref)) drafts.set(ref, { revision: 0, savedAt: null, body: { answers: {}, flags: [], notes: '', annotations: [] } });
    return drafts.get(ref);
  }
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    const send = (json, status = 200) => route.fulfill({ json, status });
    if (/\.(mp3|wav|m4a|ogg|enc)$/i.test(url.pathname)) { unexpected.push('audio'); return route.abort(); }
    if (url.origin === site && url.pathname === prefix + '/empty') return route.fulfill({ body: '<!doctype html><title>Tab thử</title>', contentType: 'text/html' });
    if (url.origin === site && url.pathname === prefix + '/progress-log/config.js') return route.fulfill({contentType:'text/javascript',body:'window.PROGRESS_LOG_CONFIG={API_BASE_URL:"https://ducizone.ddns.net"};'});
    if (url.origin === site && url.pathname.startsWith(prefix + '/')) {
      const relative = url.pathname.slice(prefix.length + 1) + (url.pathname.endsWith('/') ? 'index.html' : '');
      const file = resolve(root, relative);
      if (!file.startsWith(resolve(root) + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) return route.abort();
      try {
        let body = relative === 'reading-skills67/access.js' && options.base
          ? execFileSync('git', ['show', options.base + ':reading-skills67/access.js'], { cwd: root }) : await readFile(file);
        return route.fulfill({ body, contentType: ({ '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.html':'text/html; charset=utf-8', '.svg':'image/svg+xml', '.woff2':'font/woff2' })[extname(file)] || 'application/octet-stream' });
      } catch { return send({}, 404); }
    }
    if (url.origin !== 'https://ducizone.ddns.net') { unexpected.push(url.origin); return route.abort(); }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    const body = req.postDataJSON();
    calls.push({ path: url.pathname, method: req.method(), body });
    if (options.latency) await new Promise(r => setTimeout(r, options.latency));
    const resolveIdentity = () => {
      const id = body.identity?.id || (body.studentRef === b ? '900002' : '900001');
      const ref = id === '900002' ? b : a;
      return { ok: true, status: 'unique', identity: { authority:'erp-contact', id }, aliases: [{ studentRef: ref, studentName: person(ref).name, classId: cls.id, classCode: cls.classCode }] };
    };
    if (url.pathname === '/mapping-api/api/student-identity/resolve') return send(resolveIdentity());
    if(url.pathname.startsWith('/writing-api/api/v1/')) {
      const routePath=url.pathname.slice('/writing-api/api/v1'.length);
      if(routePath==='/roster'||routePath.endsWith('/roster'))return send({ok:true,activity:{slug:'sample-task'},classes:[{classRef,className:cls.classCode,
        students:[a,b].map(studentRef=>({studentRef,displayName:person(studentRef).name,alias:person(studentRef).name}))}]});
      if(routePath==='/sessions'&&req.method()==='POST') {
        const ref=body.studentRef, sid=ref===a?'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', session={ref:sid,sessionRef:sid,activity:'sample-task',activitySlug:'sample-task',
          classRef,studentRef:ref,draftVersion:0,sections:{},responses:{},comments:[],attempts:[],updatedAt:new Date().toISOString()};
        sessions.set(session.ref,session);return send({ok:true,session},201);
      }
      if(routePath.endsWith('/live'))return send({ok:true,accepted:true});
      if(routePath.endsWith('/teacher-comments'))return send({ok:true,threads:[]});
      const found=/^\/sessions\/([^/]+)$/.exec(routePath);
      if(found&&sessions.has(found[1]))return send({ok:true,session:sessions.get(found[1])});
    }
    if(/\/api\/speaking-homework(?:-independent)?\//.test(url.pathname)) {
      const endpoint=url.pathname.replace(/^.*\/api\/speaking-homework(?:-independent)?/,'');
      if(endpoint==='/classes')return send({ok:true,classes:[{classCode:cls.classCode,classRef:cls.id,ready:true,assignmentStatus:'open'}]});
      if(endpoint==='/assignment/roster')return send({ok:true,assignment:{assignmentCode:'67-speaking-diem_giua',classCode:cls.classCode,title:'Speaking thử',assignmentStatus:'open',
        students:[a,b].map(student_ref=>({student_ref,name:person(student_ref).name})),parts:[{part_key:'insert_middle',min_questions:3},{part_key:'freestyle',min_questions:1}],requiredPracticeCount:2,doctorEnabled:true}});
      if(endpoint==='/session/start-selected')return send({ok:true,session:{accessToken:'speaking-'+body.studentRef,studentRef:body.studentRef,classCode:cls.classCode,documentId:'fixture-doc-'+body.studentRef,intakeMode:'legacy'}});
      if(endpoint==='/open')return send({ok:true,status:'draft',links:[],practiceLinks:[]});
      if(endpoint==='/doctor/list')return send({ok:true,needed:[],allNeeded:[],practiced:[],sharedCatalog:[],neededCount:0,personalCount:0});
    }
    if(url.pathname.startsWith('/api/learning/')) {
      const endpoint=url.pathname.slice('/api/learning'.length);
      if(endpoint==='/assignments/open')return send({ok:true,assignment:{assignmentId,publicToken:assignmentId,sessionNumber:6,title:'Phiếu thử riêng',courseCode:'67',class:{id:cls.id,name:cls.classCode},
        roster:[a,b].map(studentRef=>({studentRef,name:person(studentRef).name})),definitionHash:'a'.repeat(64),
        definition:{kind:'reflection',blocks:[{blockId:assignmentId,checkpoint:1,title:'Ghi nhận',instructions:'',items:[{itemVersionId:assignmentId,itemFamilyId:assignmentId,position:1,skillCodes:[],interactionType:'long_text',required:true,prompt:'Câu thử',maxLength:600}]}]},
        blockReleases:[{blockId:assignmentId,status:'open'}],submissionWindow:{canSubmit:true,serverNow:new Date().toISOString(),effectiveClosesAt:new Date(Date.now()+3600000).toISOString(),completeStudents:0}}});
      if(endpoint==='/attempts/start')return send({ok:true,attempt:{attemptToken:'fixture-progress-'+body.studentRef,assignmentId,definitionHash:'a'.repeat(64),draftRevision:0,draft:{},checkpointSubmissions:[],identity:{studentRef:body.studentRef,studentName:person(body.studentRef).name,classId:cls.id,className:cls.classCode,sessionNumber:6}}});
      if(endpoint==='/student/course-journey')return send({ok:true,journey:{student:{studentRef:body.studentRef,name:person(body.studentRef).name},class:{classId:cls.id,name:cls.classCode},summary:{attendedSessions:0,submittedComplete:0,availableReports:0,totalSessions:18},sessions:[],reports:[],coverage:{plannedSessions:18,knownThroughSession:6,schedule:'teacher_confirmed'}}});
      if(endpoint==='/student/session-comments')return send({ok:true,classId:cls.id,studentRef:a,comments:[]});
    }
    if (url.pathname.startsWith(api)) {
      const endpoint = url.pathname.slice(api.length);
      if (endpoint === '/config') return send({ title: content.title, code, studentsOpen: !state.closed, homeworkEnabled: false });
      if (endpoint === '/classes') return state.offline ? send({ error:'CONTEXT_UNAVAILABLE' },503) : send({ classes:[cls] });
      if (endpoint === `/classes/${cls.id}/students`) return send({ students: [a,b].map(studentRef => ({ studentRef, name: person(studentRef).name })) });
      if (endpoint === '/identity/resolve') return send(resolveIdentity());
      if (endpoint === '/student/login') {
        loginSeen(); if (state.delayLogin) await gate;
        if (state.deny) return send({ error:'STUDENT_ACCESS_DENIED' },403);
        const ref = state.wrongOwner ? b : body.studentRef, token = 'fixture-' + ref;
        sessions.set(token, ref); return send({ ok:true, token, identity:person(ref) });
      }
      const token = req.headers().authorization?.replace(/^Bearer /,''), ref = sessions.get(token);
      if (!ref) return send({ error:'STUDENT_LOGIN_REQUIRED' },401);
      if (endpoint === '/student/logout') { sessions.delete(token); return send({ok:true}); }
      if (state.deny) return send({ error:'STUDENT_ACCESS_DENIED' },403);
      if (endpoint === '/lesson') return send({content, identity:person(ref)});
      if (endpoint === '/attempts' && req.method() === 'GET') return send({ attempts:[], archives:[] });
      if (endpoint === '/draft') {
        if (req.method() === 'GET') return send(draft(ref));
        if (state.saveFailure) return send({ error:'FIXTURE_SAVE_FAILED' },503);
        const saved = { revision: draft(ref).revision + 1, savedAt:new Date().toISOString(), body:body.body,
          completeness:{filled_cells:1,total_cells:20} };
        drafts.set(ref, saved); return send(saved);
      }
    }
    const practice = /^\/(reading|listening)-practice-api\/api(.*)$/.exec(url.pathname);
    if (practice) {
      const endpoint = practice[2];
      if (endpoint === '/open') return send({ classCode:cls.classCode, bindingId:'binding-A', selectedStudentRef:a,
        students:[a,b].map(id=>({ id,name:person(id).name })) });
      if (endpoint === '/login') {
        const ref = body.studentRef, token = 'practice-' + ref; sessions.set(token,ref);
        return send({ token, identity:{studentRef:ref,name:person(ref).name,classCode:cls.classCode,bindingId:'binding-A'}, attempts:[],events:[],firstCompleted:null });
      }
    }
    unexpected.push(req.method() + ' ' + url.pathname); return send({error:'UNEXPECTED_FIXTURE_ROUTE'},503);
  });
  const page = await context.newPage();
  const blank = async target => target.goto(site + prefix + '/empty');
  const setMemory = async (id, target = page) => {
    await blank(target);
    await target.evaluate(async id => {
      const {createStudentIdentityMemory}=await import('/izone-ai-team-pages/shared/student-identity.js');
      const m=createStudentIdentityMemory(); const r=await m.rememberAtomic({authority:'erp-contact',id},m.read().revision);
      if(r.status!=='ok')throw Error('Không gieo được danh tính fixture');
    }, id);
  };
  if (options.remembered) await setMemory('900001');
  return { context,page,state,calls,unexpected,errors,sessions,drafts,loginArrived,releaseLogin,setMemory };
}
async function ready(page, ref = a) { await page.locator('.learner').filter({hasText:person(ref).name}).waitFor(); }
async function manual(page, ref = a) {
  await page.selectOption('#entry-class', cls.id); await page.selectOption('#entry-student',ref); await page.locator('#entry-open').click(); await ready(page,ref);
}
async function scenario(name, options, action) {
  if(process.env.ENTRY_ONLY && !name.includes(process.env.ENTRY_ONLY))return;
  const f = await fixture(options);
  try { await action(f); assert.deepEqual(f.errors,[]); assert.deepEqual(f.unexpected,[]);
    assert.equal(f.calls.some(c=>/\/(submit|reset|grade|check|begin|activate)$/.test(c.path)),false);
    results.push({case:name,status:'passed'}); console.log('Đạt:',name);
  } catch(error) { results.push({case:name,status:'failed',error:error.message,calls:f.calls,errors:f.errors,unexpected:f.unexpected});
    await f.page.screenshot({path:resolve(out,name+'-failure.png'),fullPage:true}); throw error;
  } finally { f.releaseLogin(); await f.context.close(); }
}
const practiceUrl = kind => `${site}${prefix}/${kind}-practice/?documentId=fixture-document-with-enough-characters#login?entry=fixture-entry-token`;
try {
  if (process.env.ENTRY_BENCHMARK) {
    const samples=[];
    for(let sample=0;sample<10;sample++)for(const manualEntry of [false,true])for(const version of ['before','after']) {
      const f=await fixture({remembered:!manualEntry,base:version==='before'?process.env.ENTRY_BASE:undefined,latency:80});
      try { const start=performance.now(); await f.page.goto(entry); if(manualEntry)await manual(f.page);else await ready(f.page);
        samples.push({sample,version,mode:manualEntry?'first-manual':'remembered',ms:performance.now()-start,
          classReads:f.calls.filter(c=>c.path===api+'/classes').length,apiReads:f.calls.filter(c=>c.method==='GET').length});
      } finally {await f.context.close();}
    }
    await writeFile(resolve(out,'measurement.json'),JSON.stringify(samples,null,2)); console.log(JSON.stringify({samples:samples.length,latencyMs:80}));
  } else {
    await scenario('remembered-one-class-read', {remembered:true}, async f=>{
      await f.page.goto(entry);await ready(f.page);assert.equal(f.calls.filter(c=>c.path===api+'/classes').length,1);
    });
    await scenario('first-producer-reading-listening-same-browser', {}, async f=>{
      await f.page.goto(entry);await manual(f.page);assert.equal(f.calls.filter(c=>c.path===api+'/classes').length,1);
      for(const kind of ['reading','listening']) {const next=await f.context.newPage();await next.goto(practiceUrl(kind));
        await next.locator('[data-action="begin"]').waitFor();assert.match(await next.locator('.identity-bar').innerText(),/Học viên thử A/);}
    });
    await scenario('reading-producer-materials-receiver', {}, async f=>{
      await f.page.goto(practiceUrl('reading'));await f.page.selectOption('#class-select',cls.classCode);await f.page.selectOption('#student-select',a);
      await f.page.locator('#login-submit').click();await f.page.locator('[data-action="begin"]').waitFor();
      const next=await f.context.newPage();await next.goto(entry);await ready(next);assert.equal(await next.locator('#entry-open').count(),0);
    });
    await scenario('materials-producer-writing-speaking-progress-consumers', {}, async f=>{
      await f.page.goto(entry);await manual(f.page);
      const writing=await f.context.newPage();await writing.goto(site+prefix+'/writing-handouts/index.html?task=sample-task');await writing.locator('#workspace').waitFor();
      assert.equal(f.calls.find(c=>c.path==='/writing-api/api/v1/sessions').body.studentRef,a);
      const speaking=await f.context.newPage();await speaking.goto(site+prefix+'/speaking-homework/lesson-4.html');await speaking.locator('#homework-content').waitFor({state:'visible'});
      assert.equal(f.calls.find(c=>c.path.endsWith('/session/start-selected')).body.studentRef,a);
      const progress=await f.context.newPage();await progress.goto(site+prefix+'/progress-log/index.html#assignment='+assignmentId);await progress.locator('#formView').waitFor();
      assert.match(await progress.locator('#studentNameLabel').innerText(),/Học viên thử A/);
      assert.equal(f.calls.find(c=>c.path==='/api/learning/attempts/start').body.studentRef,a);
      assert.equal(await f.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).identity.id,key),'900001');
    });
    await scenario('writing-producer-materials-receiver', {}, async f=>{
      await f.page.goto(site+prefix+'/writing-handouts/index.html?task=sample-task');await f.page.selectOption('#class-id',classRef);await f.page.selectOption('#student-name',a);
      await f.page.locator('#identity-form [type="submit"]').click();await f.page.locator('#workspace').waitFor();
      const next=await f.context.newPage();await next.goto(entry);await ready(next);
    });
    await scenario('revoked-class-blocks-login', {remembered:true,deny:true}, async f=>{
      await f.page.goto(entry);await f.page.getByText('Học viên không còn quyền ở lớp này.',{exact:false}).waitFor();
      assert.equal(f.calls.some(c=>c.path===api+'/draft'),false);assert.equal(await f.page.locator('.learner').count(),0);
    });
    await scenario('wrong-session-owner-blocks-draft', {remembered:true,wrongOwner:true}, async f=>{
      await f.page.goto(entry);await f.page.getByText('Phiên trả về chưa đúng người/lớp.',{exact:false}).waitFor();assert.equal(f.calls.some(c=>c.path===api+'/draft'),false);
    });
    await scenario('closed-lesson-does-not-login', {remembered:true,closed:true}, async f=>{
      await f.page.goto(entry);await f.page.getByText('chưa mở cho học viên',{exact:false}).waitFor();assert.equal(f.calls.some(c=>c.path===api+'/student/login'),false);
    });
    await scenario('late-A-does-not-open-after-B', {remembered:true,delayLogin:true}, async f=>{
      await f.page.goto(entry);await f.loginArrived;const other=await f.context.newPage();await f.setMemory('900002',other);f.releaseLogin();
      await f.page.getByText('Người đã nhớ vừa đổi.',{exact:false}).waitFor();assert.equal(f.calls.some(c=>c.path===api+'/draft'),false);
    });
    await scenario('expired-session-reopens-same-owner-draft', {remembered:true}, async f=>{
      await f.page.goto(entry);await ready(f.page);f.drafts.set(a,{revision:1,savedAt:null,body:{answers:{'p.A':'NHAP-A'},flags:[],notes:'',annotations:[]}});
      f.sessions.clear();await f.page.reload();await ready(f.page);assert.equal(await f.page.locator('[data-target="p.A"]').inputValue(),'NHAP-A');
    });
    await scenario('saved-draft-A-pinned-after-B-and-reload-mobile', {remembered:true,width:390}, async f=>{
      await f.page.goto(entry);await ready(f.page);await f.page.locator('[data-target="p.A"]').fill('NHAP-A');
      await f.page.waitForResponse(r=>r.url().endsWith('/draft')&&r.request().method()!=='GET');
      const other=await f.context.newPage();await f.setMemory('900002',other);await other.goto(entry);await ready(other,b);
      assert.equal(await other.locator('[data-target="p.A"]').inputValue(),'');await f.page.reload();await ready(f.page);
      assert.equal(await f.page.locator('[data-target="p.A"]').inputValue(),'NHAP-A');
      await f.page.screenshot({path:resolve(out,'materials-student-mobile.png'),fullPage:true});
    });
    await scenario('failed-save-keeps-person-and-unsent-text', {remembered:true,saveFailure:true}, async f=>{
      await f.page.goto(entry);await ready(f.page);await f.page.locator('[data-target="p.A"]').fill('CHUA-LUU-A');
      await f.page.getByRole('button',{name:'Đổi người học',exact:true}).click();await f.page.getByText('FIXTURE_SAVE_FAILED',{exact:false}).first().waitFor();
      await ready(f.page);assert.equal(await f.page.locator('[data-target="p.A"]').inputValue(),'CHUA-LUU-A');assert.equal(f.calls.some(c=>c.path.endsWith('/student/logout')),false);
    });
    await scenario('source-offline-retry-does-not-cache-failure', {remembered:true,offline:true}, async f=>{
      await f.page.goto(entry);await f.page.getByText('Chưa kiểm được danh sách lớp.',{exact:false}).waitFor();f.state.offline=false;
      await f.page.reload();await ready(f.page);assert.equal(f.calls.filter(c=>c.path===api+'/classes').length,2);
    });
    await scenario('blocked-storage-manual-opens-without-claiming-memory', {blocked:true}, async f=>{
      await f.page.goto(entry);await manual(f.page);assert.equal(f.calls.some(c=>c.path===api+'/draft'),true);
    });
  }
} finally {await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));await browser.close();}

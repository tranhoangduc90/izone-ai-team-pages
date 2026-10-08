import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Nhận trang thật và API giả hai lớp; kiểm đường chọn tên, CTA, bộ nhớ và phiên bất biến.
// Kỳ vọng dựa vào request/đích Docs và trạng thái học viên nhìn thấy; lỗi in tên ca kiểm.
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.env.SPEAKING_EVIDENCE_DIR || join(root, 'output/playwright/speaking-identity');
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const path = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!path.startsWith(root)) throw Error('Outside root');
    res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' })[extname(path)] || 'application/octet-stream' });
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const key = 'izone:remembered-writing-student:v1:https://ducizone.ddns.net/writing-api';
const refA = '11111111-1111-4111-8111-111111111111';
const refOther = '33333333-3333-4333-8333-333333333333';
const refB = '22222222-2222-4222-8222-222222222222';
const lessons = [
  { number: 2, file: '', code: '67-speaking-paraphrase', parts: ['paraphrase', 'speaking'] },
  { number: 3, file: 'lesson-3.html', code: '67-speaking-lam_ro', parts: ['clarify_1', 'clarify_2', 'clarify_3', 'freestyle'] },
  { number: 4, file: 'lesson-4.html', code: '67-speaking-diem_giua', parts: ['insert_middle', 'freestyle'] },
  { number: 5, file: 'lesson-5.html', code: '67-speaking-on_tap_lam_ro_diem_giua', parts: ['review_clarify_middle', 'freestyle'] },
  { number: 6, file: 'lesson-6.html', code: '67-speaking-ly_do_hanh_vi', parts: ['benefit_harm', 'reason_action', 'freestyle'] },
];
const results = [];
let browser;
async function scenario(name, fn) {
  try { await fn(); results.push({ name, outcome: 'passed' }); }
  catch (error) { results.push({ name, outcome: 'failed', error: error.message }); throw error; }
}
async function setup(lesson, options = {}) {
  const context = await browser.newContext({ viewport: { width: options.width || 1280, height: 900 } });
  const page = await context.newPage();
  if (options.clock) await page.clock.install();
  const requests = [];
  const errors = [];
  let pending = false;
  let opens = 0;
  const mainLinks = new Map();
  const practices = new Map();
  let submitted = false;
  let rosterError = options.rosterError || false;
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ key, remembered, unavailable, writeBlocked, legacyDraft }) => {
    if (remembered) localStorage.setItem(key, JSON.stringify({ version: 1, studentRef: remembered }));
    if (legacyDraft) localStorage.setItem('speaking-homework:lesson-2:11111111-1111-4111-8111-111111111111', JSON.stringify({ paraphrase: 'legacy-link' }));
    if (unavailable) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Disabled', 'SecurityError'); } });
    if (writeBlocked) {
      Storage.prototype.setItem = function () { throw new DOMException('Quota', 'QuotaExceededError'); };
      Storage.prototype.removeItem = function () { throw new DOMException('Quota', 'QuotaExceededError'); };
    }
  }, { key, remembered: options.remembered, unavailable: options.unavailable, writeBlocked: options.writeBlocked, legacyDraft: options.legacyDraft });
  await page.route('https://ducizone.ddns.net/mapping-api/api/speaking-homework*/**', async route => {
    const path = new URL(route.request().url()).pathname.split(/\/api\/speaking-homework(?:-independent)?/)[1];
    const body = route.request().postDataJSON();
    requests.push({ path, body });
    let data;
    let status = 200;
    const code = body?.classCode || 'IC2304';
    if (path === '/classes') data = { classes: [{ classCode: 'IC2304', classRef: 'class-a', assignmentStatus: 'open', ready: true }, { classCode: 'IC2305', classRef: 'class-b', assignmentStatus: 'open', ready: true }, { classCode: 'IC2306', ready: false, assignmentStatus: 'draft' }] };
    else if (path === '/identity/resolve') data = { status: options.resolveStatus || 'unique', classCode: body.studentRef === refB ? 'IC2305' : 'IC2304', studentRef: body.studentRef };
    else if (path === '/assignment/open') data = { assignment: { classCode: 'IC2304' } };
    else if (path === '/assignment/roster') {
      if (options.delayA && code === 'IC2304') await new Promise(resolve => setTimeout(resolve, 250));
      if (rosterError) { status = 503; data = { ok: false, message: 'Mạng lớp tạm lỗi' }; }
      else data = { assignment: { title: `Homework Lesson ${lesson.number}`, classCode: code, assignmentCode: lesson.code,
        students: options.empty ? [] : options.duplicate ? [{ student_ref: refA, name: 'Tên trùng' }, { student_ref: refA, name: 'Tên trùng' }]
          : code === 'IC2304' ? [{ student_ref: refOther, name: 'Tên trùng' }, { student_ref: refA, name: 'Tên trùng' }] : [{ student_ref: refB, name: 'Học viên lớp B' }],
        parts: lesson.parts.map((part_key, index) => ({ part_key, min_questions: lesson.number === 6 ? [0, 2, 1][index] : part_key === 'freestyle' && (lesson.number === 5 || lesson.number === 4 && code === 'IC2304') ? 1 : 3 })), requiredPracticeCount: lesson.number >= 4 ? 2 : 0, assignmentStatus: 'open', doctorEnabled: lesson.number !== 3 } };
    } else if (path === '/session/start-selected') data = { session: { accessToken: `${code}-${body.studentRef}`, classCode: options.badSession ? 'IC9999' : code, studentRef: body.studentRef, documentId: body.documentId || `own-${code}-${body.studentRef}` } };
    else if (path === '/open') {
      opens += 1;
      if (options.failPoll && opens === 3) { status = 429; data = { ok: false, message: 'Đợi rồi thử lại' }; }
      else if (options.completeFlow) data = { status: submitted ? 'submitted' : 'draft', receipt: submitted ? { id: 'test-receipt' } : null, links: [...mainLinks.values()], practiceLinks: [...practices.values()] };
      else data = { status: 'draft', links: pending ? [{ part: lesson.parts[0], check_status: opens > (options.failPoll ? 3 : 2) ? 'rejected' : 'pending', share_url: 'https://chatgpt.com/share/11111111-1111-4111-8111-111111111111' }] : [], practiceLinks: [] };
    } else if (path === '/checks/request') { pending = true; mainLinks.set(body.part, { part: body.part, share_url: body.url, check_status: 'accepted', question_count: 3 }); data = { check: { status: 'pending' } }; }
    else if (path === '/doctor/practice/request' || path === '/doctor/practice/extra/request') { practices.set(body.slot || 3, { id: 'practice-' + (body.slot || 3), slot: body.slot || 3, exercise_id: body.exerciseId, share_url: body.url, status: 'accepted', analysis_status: 'done' }); data = {}; }
    else if (path === '/finish') { submitted = true; data = { receipt: { id: 'test-receipt' } }; }
    else if (path === '/doctor/list') data = { needed: [], allNeeded: [], practiced: [], neededCount: 0, personalCount: 0, sharedCatalog: options.completeFlow ? [1, 2].map(index => ({ exercise_id: `exercise-${index}`, title: `Bài tập ${index}`, exercise_url: `https://example.com/exercise-${index}` })) : [] };
    else throw Error(`Unexpected API: ${path}`);
    try { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ ok: true, ...data }) }); }
    catch (error) { if (!options.delayA) throw error; }
  });
  await page.goto(`${origin}/speaking-homework/${lesson.file}${options.query || ''}`);
  await page.waitForFunction(() => !document.getElementById('class-select').disabled || !document.getElementById('reload-roster').hidden);
  return { page, context, requests, errors, clearError() { rosterError = false; } };
}
async function choose(page, code, ref) {
  await page.locator('#class-select').selectOption(code);
  await page.locator('#student-select').selectOption(ref);
}
async function open(page) {
  await page.locator('#open-homework').click();
  await page.locator('#homework-content').waitFor({ state: 'visible' });
}
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  for (const lesson of lessons) {
    await scenario(`L${lesson.number}: manual / mobile / keyboard / session frozen / idle`, async () => {
      const { page, context, requests, errors } = await setup(lesson, { width: 390, clock: true });
      assert.equal(await page.locator('#remember-student').isChecked(), true);
      assert.equal(await page.locator('#open-homework').isDisabled(), true);
      await page.screenshot({ path: join(output, `lesson-${lesson.number}-mobile-login.png`), fullPage: true });
      await choose(page, 'IC2305', refB);
      await page.locator('#open-homework').focus();
      await page.keyboard.press('Enter');
      await page.locator('#homework-content').waitFor({ state: 'visible' });
      assert.equal(requests.filter(r => r.path === '/session/start-selected').length, 1);
      assert.equal(await page.locator('#active-class').innerText(), 'IC2305');
      assert.equal(await page.locator('#return-homework').getAttribute('href'), `https://docs.google.com/document/d/own-IC2305-${refB}/edit?tab=t.0`);
      await page.evaluate(({ key, refA }) => { localStorage.setItem(key, JSON.stringify({ version: 1, studentRef: refA })); window.dispatchEvent(new StorageEvent('storage', { key })); }, { key, refA });
      assert.equal(await page.locator('#active-student').innerText(), 'Học viên lớp B');
      const before = requests.filter(r => r.path === '/open').length;
      await page.clock.runFor(60_000);
      assert.equal(requests.filter(r => r.path === '/open').length, before, 'Phiên nhàn rỗi không polling');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.equal(await page.locator('#parts .task-card').count(), lesson.parts.length);
      assert.equal(await page.locator('#doctor-list').count(), lesson.number === 3 ? 0 : 1);
      await page.screenshot({ path: join(output, `lesson-${lesson.number}-mobile-open.png`), fullPage: true });
      assert.deepEqual(errors, []);
      await context.close();
    });
    await scenario(`L${lesson.number}: shared memory preselect wins over class hint, no autosession`, async () => {
      const { page, context, requests, errors } = await setup(lesson, { remembered: refB, query: '?class=IC2304' });
      assert.equal(await page.locator('#class-select').inputValue(), 'IC2305');
      assert.equal(await page.locator('#student-select').inputValue(), refB);
      assert.equal(requests.some(r => r.path === '/session/start-selected'), false);
      await page.screenshot({ path: join(output, `lesson-${lesson.number}-desktop-remembered.png`), fullPage: true });
      await open(page);
      assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key), { version: 1, studentRef: refB });
      await page.locator('#change-student').click();
      assert.equal(await page.evaluate(key => localStorage.getItem(key), key), null);
      assert.equal(await page.locator('#student-select').inputValue(), '');
      assert.deepEqual(errors, []);
      await context.close();
    });
    await scenario(`L${lesson.number}: remembered change learner before session`, async () => {
      const test = await setup(lesson, { remembered: refB, width: 360 });
      await test.page.locator('#forget-remembered').click();
      assert.equal(await test.page.evaluate(key => localStorage.getItem(key), key), null);
      assert.equal(await test.page.locator('#student-select').inputValue(), '');
      assert.equal(test.requests.some(r => r.path === '/session/start-selected'), false);
      assert.equal(await test.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await test.context.close();
    });
    await scenario(`L${lesson.number}: CTA mismatch / other owner same class / switch class clears old Doc`, async () => {
      const { page, context, requests } = await setup(lesson, { remembered: refB, query: '?documentId=original-doc&class=IC2304' });
      assert.equal(await page.locator('#class-select').inputValue(), 'IC2304');
      assert.equal(await page.locator('#student-select').inputValue(), '');
      assert.match(await page.locator('#identity-message').innerText(), /IC2304.*IC2305/);
      await page.locator('#student-select').selectOption(refOther);
      await open(page);
      assert.equal(requests.findLast(r => r.path === '/session/start-selected').body.documentId, 'original-doc');
      await page.locator('#change-student').click();
      await page.locator('#student-select').selectOption(refA);
      await open(page);
      assert.equal(requests.findLast(r => r.path === '/session/start-selected').body.documentId, 'original-doc');
      await page.locator('#change-student').click();
      await choose(page, 'IC2305', refB);
      await open(page);
      assert.equal(requests.findLast(r => r.path === '/session/start-selected').body.documentId, undefined);
      assert.equal(await page.locator('#return-homework').getAttribute('href'), `https://docs.google.com/document/d/own-IC2305-${refB}/edit?tab=t.0`);
      await context.close();
    });
  }
  await scenario('Lesson 2 preserves old direct draft only in original class, never CTA or other class', async () => {
    for (const [code, ref, query, expected] of [['IC2304', refA, '', 'legacy-link'], ['IC2305', refB, '', ''], ['IC2304', refA, '?documentId=other-doc&class=IC2304', '']]) {
      const test = await setup(lessons[0], { legacyDraft: true, query });
      await choose(test.page, code, ref);
      await open(test.page);
      assert.equal(await test.page.locator('#paraphrase-link').inputValue(), expected);
      await test.context.close();
    }
  });
  await scenario('Stale roster arriving after class change / clear', async () => {
    const { page, context, errors } = await setup(lessons[0], { delayA: true });
    await page.locator('#class-select').selectOption('IC2304');
    await page.locator('#class-select').selectOption('IC2305');
    await page.locator('#student-select').selectOption(refB);
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#student-select').inputValue(), refB);
    await page.locator('#class-select').selectOption('IC2304');
    await page.locator('#class-select').selectOption('');
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#student-select option').count(), 1);
    assert.equal(await page.locator('#open-homework').isDisabled(), true);
    assert.deepEqual(errors, []);
    await context.close();
  });
  for (const options of [{ empty: true }, { duplicate: true }, { badSession: true }, { resolveStatus: 'ambiguous', remembered: refA }, { resolveStatus: 'missing', remembered: refB }, { remembered: 'not-a-uuid' }, { unavailable: true }, { writeBlocked: true }]) {
    await scenario(`Guard and storage: ${Object.keys(options).join(',')}`, async () => {
      const { page, context, requests, errors } = await setup(lessons[0], options);
      await page.locator('#class-select').selectOption('IC2304');
      if (options.empty || options.duplicate) {
        await page.waitForFunction(() => !document.getElementById('identity-message').textContent.includes('Đang tải'));
        assert.equal(await page.locator('#open-homework').isDisabled(), true);
      } else {
        await page.locator('#student-select').selectOption(refA);
        if (options.badSession) {
          await page.locator('#open-homework').click();
          await page.getByText(/Phiên trả về chưa khớp/).waitFor();
          assert.equal(await page.locator('#homework-content').isVisible(), false);
        } else {
          await page.locator('#remember-student').uncheck();
          await open(page);
          if (options.writeBlocked || options.unavailable) assert.equal(await page.locator('#memory-status').isVisible(), true);
        }
      }
      assert.equal(requests.filter(r => r.path === '/session/start-selected').length, options.empty || options.duplicate ? 0 : 1);
      assert.deepEqual(errors, []);
      await context.close();
    });
  }
  await scenario('Roster error retry keeps selected class / memory removal before opening', async () => {
    const test = await setup(lessons[0], { rosterError: true });
    await test.page.locator('#class-select').selectOption('IC2305');
    await test.page.getByText(/Mạng lớp tạm lỗi/).waitFor();
    test.clearError();
    await test.page.locator('#reload-roster').click();
    await test.page.locator('#student-select').selectOption(refB);
    await test.page.evaluate(key => window.dispatchEvent(new StorageEvent('storage', { key, newValue: null })), key);
    assert.equal(await test.page.locator('#student-select').inputValue(), '');
    assert.equal(await test.page.locator('#open-homework').isDisabled(), true);
    await test.context.close();
  });
  for (const lesson of lessons.filter(item => item.number >= 4)) {
  await scenario(`Lesson ${lesson.number}: all main + two distinct practice links / receipt / extra practice`, async () => {
    const test = await setup(lesson, { completeFlow: true, query:'?documentId=canary-doc&class=IC2304' });
    const { page, requests } = test;
    await choose(page, 'IC2304', refA);
    await open(page);
    if (lesson.number === 5) {
      assert.match(await page.locator('#review_clarify_middle-card .instruction-lead').innerText(),/3 câu.*một hoặc cả hai/);
      assert.match(await page.locator('#freestyle-card .instruction-lead').innerText(),/1 câu/);
      assert.equal(await page.locator('#review_clarify_middle-card .practice-button').getAttribute('href'),
        'https://ducizone.short.gy/luyen_tap_lam_ro_chen_diem_giua');
    }
    const share = index => `https://chatgpt.com/share/00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
    if (lesson.number === 6) {
      assert.match(await page.locator('#benefit_harm-card .instruction-lead').innerText(), /Không có số lượng/);
      assert.match(await page.locator('#reason_action-card .instruction-lead').innerText(), /2 câu/);
      assert.match(await page.locator('#freestyle-card .instruction-lead').innerText(), /1 câu/);
      assert.equal(await page.locator('#progress-bar').getAttribute('aria-valuemax'), '5');
      await page.locator('#benefit_harm-link').fill('https://chatgpt.com/c/private');
      await page.locator('#benefit_harm-confirm').click();
      await page.locator('#benefit_harm-result').getByText('Link chưa đúng').waitFor();
      assert.equal(requests.filter(r => r.path === '/checks/request').length, 0);
    }
    for (const [index, part] of lesson.parts.entries()) {
      await page.locator(`#${part}-link`).fill(share(index + 1));
      await page.locator(`#${part}-confirm`).click();
      await page.locator(`#${part}-result`).getByText('Đã xác nhận hội thoại').waitFor();
    }
    await page.locator('#practice-1-exercise').selectOption('exercise-1');
    await page.locator('#practice-1-link').fill(share(lesson.parts.length + 1));
    await page.locator('#practice-1-confirm').click();
    await page.locator('#practice-1-result').getByText('Đã nhận bài bổ trợ').waitFor();
    await page.locator('#practice-2-exercise').selectOption('exercise-1');
    await page.locator('#practice-2-link').fill(share(lesson.parts.length + 2));
    await page.locator('#practice-2-confirm').click();
    await page.locator('#practice-2-result').getByText('Trùng bài tập').waitFor();
    assert.equal(requests.filter(r => r.path === '/doctor/practice/request').length, 1);
    assert.equal(requests.some(r => r.path === '/finish'), false);
    await page.locator('#practice-2-exercise').selectOption('exercise-2');
    await page.locator('#practice-2-confirm').click();
    await page.locator('#completion-card').waitFor({ state: 'visible' });
    assert.equal(requests.filter(r => r.path === '/finish').length, 1);
    assert.equal(await page.locator('#progress-count').innerText(), `Đã xác nhận ${lesson.parts.length + 2}/${lesson.parts.length + 2} hội thoại`);
    assert.equal(await page.locator('#return-homework').getAttribute('href'),'https://docs.google.com/document/d/canary-doc/edit?tab=t.0');
    await page.screenshot({path:join(output,`lesson-${lesson.number}-completed.png`),fullPage:true});
    await page.locator('#extra-exercise').selectOption('exercise-1');
    await page.locator('#extra-link').fill(share(lesson.parts.length + 3));
    await page.locator('#extra-confirm').click();
    assert.equal(requests.filter(r => r.path === '/doctor/practice/extra/request').length, 1);
    assert.deepEqual(test.errors, []);
    await test.context.close();
  });
  }
  await scenario('CTA without class hint resolves Doc class and UUID name duplicates stay exact', async () => {
    const test = await setup(lessons[1], { remembered: refA, query: '?documentId=original-doc' });
    assert.equal(await test.page.locator('#class-select').inputValue(), 'IC2304');
    assert.equal(await test.page.locator('#student-select').inputValue(), refA);
    assert.equal(test.requests.some(r => r.path === '/session/start-selected'), false);
    await test.context.close();
  });
  await scenario('Pending polling only / 429 exponential backoff / stop after resolved', async () => {
    const { page, context, requests } = await setup(lessons[0], { clock: true, failPoll: true });
    await choose(page, 'IC2304', refA);
    await open(page);
    await page.locator('#paraphrase-link').fill('https://chatgpt.com/share/11111111-1111-4111-8111-111111111111');
    await page.locator('#paraphrase-confirm').click();
    await page.locator('#paraphrase-result').getByText('Đang đọc hội thoại').waitFor();
    await page.clock.runFor(15_000);
    await page.getByText(/Tạm mất kết nối/).waitFor();
    const failedCount = requests.filter(r => r.path === '/open').length;
    await page.clock.runFor(29_000);
    assert.equal(requests.filter(r => r.path === '/open').length, failedCount, '429 phải chờ 30 giây mới thử lại');
    await page.clock.runFor(1_000);
    await page.locator('#paraphrase-result').getByText('Chưa nhận link này').waitFor();
    const count = requests.filter(r => r.path === '/open').length;
    await page.clock.runFor(60_000);
    assert.equal(requests.filter(r => r.path === '/open').length, count);
    await context.close();
  });
} finally {
  await writeFile(join(output, 'identity-results.json'), JSON.stringify({ outcome: results.every(r => r.outcome === 'passed') ? 'passed' : 'failed', cases: results }, null, 2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(`Speaking identity browser: ${results.length} cases PASS`);

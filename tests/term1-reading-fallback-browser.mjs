import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { fixture as browserFixture, wait } from './term2-offline-browser.mjs';

test('Reading dự phòng qua UI và backend thật, phục hồi ngoại tuyến và có đúng một điểm /26', { timeout: 60000 }, async t => {
  const output = process.env.TERM2_EVIDENCE;
  const backend = process.env.TERM1_FALLBACK_BACKEND;
  const runtime = process.env.TERM2_RUNTIME_ROOT;
  const portalSource = process.env.TERM1_FALLBACK_PORTAL;
  assert.ok(output && backend && runtime && portalSource && process.env.TERM2_DEPS_PACKAGE);
  const { normalize } = await import(pathToFileURL(resolve(portalSource, 'src/contract.mjs')));
  const { inspectExam, verifyExam } = await import(pathToFileURL(resolve(portalSource, 'src/exam-contract.mjs')));
  process.env.K56_TEST_PRODUCT = '1';
  process.env.TERM2_FIXTURE_IMPORT_ONLY = '1';
  const { fixture } = await import(pathToFileURL(resolve(backend, 'backend/ops/releases/term1-offline-20261107/test.mjs')));
  const { registerTerm1SkillRoutes } = await import(pathToFileURL(resolve(runtime, 'src/term1-skill-routes.mjs')));
  const require = createRequire(process.env.TERM2_DEPS_PACKAGE);
  const express = require('express');
  const native = await fixture('lis_first', { skipPrepare: true, realtime: true });
  t.after(native.close);
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../term-tests/term-test-1-k56-computer-based/content.js', import.meta.url), 'utf8'), context);
  native.content.reading = context.window.K56_TERM_TEST_CONTENT.reading;

  const studentRef = randomUUID();
  const explanation = { number: 1, source: 'Passage 1 · đoạn 1',
    evidence: 'more sensors and cleverer software', explanation: 'Đối chiếu đời máy mới và đời máy trước.' };
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerTerm1SkillRoutes(router, {
    authenticate: (req, res, next) => req.get('x-fixture-teacher') === 'yes' ? next() : res.sendStatus(401),
    readTeacherScope: async (_db, input) => assert.equal(input.student, studentRef),
    transaction: work => native.db.transaction(work),
    prepare: (slug, _input, _create, db) => native.load(db, slug, native.a),
    load: native.load,
    findStudent: async (_db, input) => input.classCode === 'IC5601' && input.studentRef === studentRef
      ? { class_id: '5601', student_id: '5602' } : null,
    assets: {}, policy: 'term1-offline-v1',
    readReview: async (attempt, section) => {
      assert.equal(attempt.attempt_token, native.a);
      assert.equal(section, 'reading');
      return [explanation];
    },
    limiter: (_req, _res, next) => next(), readLimiter: (_req, _res, next) => next(), allowNew: () => true
  });
  app.use('/api/term-tests', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const skillsApi = 'http://127.0.0.1:' + server.address().port + '/api/term-tests/term-test-1-k56/skill-fallback';
  const issue = await fetch(skillsApi + '/issue', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-fixture-teacher': 'yes' },
    body: JSON.stringify({ classCode: 'IC5601', section: 'reading', studentRef }) });
  assert.equal(issue.status, 200);
  const grant = await issue.json();

  const browser = await browserFixture('read_first', { product: 1 });
  t.after(browser.close);
  const page = browser.page;
  async function capture(screen) {
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({ path: resolve(output, `reading-fallback-${screen}-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  const fallback = new URL('../term-test-1-k56-reading-fallback/?class=IC5601', browser.url);
  fallback.hash = new URLSearchParams({ g: grant.token });
  let disconnected = false, droppedAck = false;
  await browser.context.route('**/api/term-tests/term-test-1-k56/**', async route => {
    const request = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (disconnected) return route.abort();
    const relative = new URL(request.url()).pathname.split('/term-test-1-k56/')[1];
    assert.match(relative, /^(?:skill-fallback|offline)\//);
    assert.equal(request.headers()['x-term1-skill-grant'], grant.token);
    const destination = relative.startsWith('offline/') ? native.base + '/' + relative : skillsApi + relative.slice('skill-fallback'.length);
    const response = await fetch(destination, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-term1-skill-grant': grant.token }, body: request.postData() });
    const json = await response.json();
    if (json.receipt?.kind === 'seal' && !droppedAck) { droppedAck = true; return route.abort(); }
    return route.fulfill({ status: response.status, headers: cors, json });
  });

  await page.goto(fallback.href);
  await page.locator('#activationCode').fill('INVALID');
  await page.getByRole('button', { name: 'Kiểm tra thông tin học viên' }).click();
  await page.locator('#bootstrapNotice').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#identityConfirm').isVisible(), false);
  await page.locator('#activationCode').fill(grant.activationCode);
  await page.getByRole('button', { name: 'Kiểm tra thông tin học viên' }).click();
  await page.locator('#identityConfirm').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#confirmStudentName').textContent(), 'Học viên giả');
  await capture('confirm');
  await page.click('#confirmIdentity');
  await wait(page, () => window.K56_TERM1_APP_READY && document.querySelector('.cbt-reading-form'), 'Reading đã chuẩn bị');
  await page.getByRole('button', { name: 'Bắt đầu Reading', exact: true }).click();
  await page.locator('#readingView').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#readingQuestions [data-number]').count(), 26);
  assert.equal(await page.locator('#listeningView').isVisible(), false);
  assert.equal(await page.getByRole('button', { name: 'Xem giải thích câu 1', exact: true }).count(), 0);
  const anotherTab = await browser.context.newPage();
  try {
    await anotherTab.goto(fallback.href);
    await anotherTab.getByText('Bài đang mở ở tab khác.', { exact: false }).waitFor({ state: 'visible' });
    const wrong = new URL(fallback);
    wrong.hash = new URLSearchParams({ g: grant.grantId + '.' + 'x'.repeat(43) });
    await anotherTab.goto(wrong.href);
    await anotherTab.reload();
    await anotherTab.getByText('Link chưa khớp bài đã lưu.', { exact: false }).waitFor({ state: 'visible' });
    assert.equal(await anotherTab.locator('#readingView').count(), 0);
  } finally { await anotherTab.close(); }
  disconnected = true;
  await browser.context.setOffline(true);
  const firstText = page.locator('#readingQuestions input[data-number]').first();
  await firstText.fill('Giữ nháp <script>');
  await wait(page, () => window.K56_TERM1_OFFLINE.record.snapshot?.drafts?.reading?.['7'] === 'Giữ nháp <script>', 'Nháp lưu trên máy');
  await page.reload();
  await wait(page, () => window.K56_TERM1_APP_READY && document.querySelector('.cbt-reading-form'), 'Mở lại offline');
  assert.equal(await firstText.inputValue(), 'Giữ nháp <script>');
  await capture('exam');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải bài làm về máy' }).click();
  const download = await downloading;
  const backup = await readFile(await download.path(), 'utf8');
  assert.match(backup, /Giữ nháp &lt;script&gt;/);
  assert.ok(!backup.includes(grant.token) && !backup.includes(grant.activationCode));
  await page.click('#submitReading');
  await wait(page, () => window.K56_TERM1_OFFLINE.record.sections.reading?.sealed, 'Nộp offline');
  assert.equal(await page.locator('#viewResult').isDisabled(), true);
  disconnected = false;
  await browser.context.setOffline(false);
  await wait(page, () => window.K56_TERM1_OFFLINE.pending === 0, 'Biên nhận sau mất ACK', 20000);
  assert.equal(droppedAck, true);
  await page.click('#viewResult');
  await page.locator('#resultView').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#summaryGrid').getByText('0/26 câu đúng').count(), 1);
  assert.equal(await page.locator('#questionDetails [data-skill="Reading"]').count(), 1);
  assert.equal(await page.locator('#questionDetails [data-skill="Listening"]').count(), 0);
  await capture('result');
  await page.locator('#questionDetails summary').click();
  const showExplanation = page.getByRole('button', { name: 'Xem giải thích câu 1', exact: true });
  await showExplanation.click();
  const review = page.getByRole('dialog', { name: 'Reading · Câu 1' });
  assert.equal(await review.getByText(explanation.evidence, { exact: true }).count(), 1);
  assert.equal(await review.getByText(explanation.explanation, { exact: true }).count(), 1);
  await capture('review');
  await page.keyboard.press('Escape');
  await review.waitFor({ state: 'hidden' });
  assert.equal(await showExplanation.evaluate(button => document.activeElement === button), true);
  const grades = await native.db.query('SELECT field, grade FROM assessment.k56_portal_field_dispatch WHERE attempt_id=$1', [native.a]);
  assert.deepEqual(grades.rows.map(row => [row.field, Number(row.grade)]), [['reading', 0]]);
  const event = normalize({ eventId: native.a + ':reading', revision: 1, kind: 'exam_grade', mode: 'write',
    classId: '5601', studentId: '5602', targetName: 'Term Test 1 Reading', maxGrade: 26, value: Number(grades.rows[0].grade) },
  { id: 'fixture', classIds: ['5601'], studentsByClass: { 5601: ['5602'] }, kinds: ['exam_grade'] });
  const reading = { student_id: 5602, class_test_id: 101, grade: null, meta: { records: [] } };
  const listening = { student_id: 5602, class_test_id: 102, grade: 18, meta: { records: [] } };
  const portal = { course_class_id: 5601,
    class_tests: [{ id: 101, name: 'Term Test 1 Reading', max_grade: 26 }, { id: 102, name: 'Term Test 1 Listening', max_grade: 40 }],
    student_test_grades: [reading, listening],
    class_registrations: [{ contact: { id: 5602 }, class_registration: { id: 100, course_class_id: 5601 } }] };
  const write = inspectExam(event, portal);
  assert.equal(write.decision, 'write');
  assert.deepEqual(write.body, { class_test_id: 101, student_id: 5602, grade: 0, record_id: null });
  reading.grade = 7;
  assert.equal(inspectExam(event, portal).decision, 'conflict');
  reading.grade = write.body.grade;
  assert.equal(verifyExam(event, portal, write.snapshot).confirmed, true);
  assert.equal(inspectExam(event, portal).decision, 'match');
  assert.equal(listening.grade, 18);
  browser.assertJournalFaultExercised();
  assert.deepEqual(browser.errors, []);
  await writeFile(resolve(output, 'reading-fallback-result.json'), JSON.stringify({ grade: 0, max: 26, droppedAck,
    dispatches: grades.rows.length, portalFixtureTarget: write.body.class_test_id, fixtureReadback: true }, null, 2));
});

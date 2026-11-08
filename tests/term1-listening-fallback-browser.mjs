import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { ASSETS } from '../shared/audio/catalog.mjs';
import { fixture as browserFixture, wait } from './term2-offline-browser.mjs';

const full = process.env.TERM1_LISTENING_FULL === '1';
test('Listening dự phòng · ' + (full ? 'audio thật đủ giờ 1×' : 'khôi phục và chặn EOF giả'), { timeout: full ? 2200000 : 75000 }, async t => {
  const { TERM2_EVIDENCE: output, TERM1_FALLBACK_BACKEND: backend, TERM2_RUNTIME_ROOT: runtime, TERM2_DEPS_PACKAGE: deps } = process.env;
  assert.ok(output && backend && runtime && deps);
  process.env.K56_TEST_PRODUCT = '1';
  process.env.TERM2_FIXTURE_IMPORT_ONLY = '1';
  const { fixture } = await import(pathToFileURL(resolve(backend, 'backend/ops/releases/term1-offline-20261107/test.mjs')));
  const { registerTerm1SkillRoutes } = await import(pathToFileURL(resolve(runtime, 'src/term1-skill-routes.mjs')));
  const require = createRequire(deps), express = require('express');
  const native = await fixture('read_first', { skipPrepare: true, realtime: true });
  t.after(native.close);
  const sandbox = { window: {} };
  vm.runInNewContext(await readFile(new URL('../term-tests/term-test-1-k56-computer-based/content.js', import.meta.url), 'utf8'), sandbox);
  native.content.listening = sandbox.window.K56_TERM_TEST_CONTENT.listening;
  const asset = ASSETS['term-test-1-k56'];
  const studentRef = randomUUID(), scope = { classCode: 'IC5601', studentRef, section: 'listening' };
  const app = express(), router = express.Router(), noop = (_req, _res, next) => next();
  app.use(express.json());
  registerTerm1SkillRoutes(router, { authenticate: noop, readTeacherScope: async (_db, input) => assert.equal(input.student, studentRef),
    transaction: work => native.db.transaction(work), prepare: (slug, _input, _create, db) => native.load(db, slug, native.a), load: native.load,
    findStudent: async () => ({ class_id: '5601', student_id: '5602' }), assets: {}, policy: 'term1-offline-v1', limiter: noop, readLimiter: noop,
    allowNew: () => true, issueAudio: () => ({ version: 1, policy: 'r2-direct-v1', method: 'GET',
      url: 'https://e340869dcc6ff285504947407d148104.r2.cloudflarestorage.com/izone-audio-r2-lab-20261023/' + asset.key + '?X-Amz-Signature=fixture',
      sha256: asset.sha256, byteLength: asset.byteLength, validForSeconds: 600, fallback: 'public-pages' }) });
  app.use('/api/term-tests', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(done => server.once('listening', done));
  t.after(() => new Promise(done => server.close(done)));
  const skillsApi = 'http://127.0.0.1:' + server.address().port + '/api/term-tests/term-test-1-k56/skill-fallback';
  const { body: grant } = await require('supertest')(app).post('/api/term-tests/term-test-1-k56/skill-fallback/issue').send(scope).expect(200);
  const browser = await browserFixture('read_first', { product: 1 });
  t.after(browser.close);
  const page = browser.page;
  browser.controls.primaryAudioFail = !full;
  const link = new URL('../term-test-1-k56-listening-fallback/?class=IC5601', browser.url);
  link.hash = new URLSearchParams({ g: grant.token });
  let disconnected = false;
  await browser.context.route('**/api/term-tests/term-test-1-k56/**', async route => {
    const request = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (disconnected) return route.abort();
    const relative = new URL(request.url()).pathname.split('/term-test-1-k56/')[1];
    assert.match(relative, /^(?:skill-fallback|offline)\//);
    assert.equal(request.headers()['x-term1-skill-grant'], grant.token);
    const destination = relative.startsWith('offline/') ? native.base + '/' + relative : skillsApi + relative.slice('skill-fallback'.length);
    const response = await fetch(destination, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-term1-skill-grant': grant.token }, body: request.postData() });
    return route.fulfill({ status: response.status, headers: cors, json: await response.json() });
  });

  await page.goto(link.href);
  await page.locator('#activationCode').fill(grant.activationCode);
  await page.getByRole('button', { name: 'Kiểm tra thông tin học viên' }).click();
  await page.locator('#identityConfirm').waitFor({ state: 'visible' });
  await page.click('#confirmIdentity');
  await page.locator('#skillPreview').waitFor({ state: 'visible', timeout: 30000 });
  assert.equal(await page.locator('#skillStart').isDisabled(), true);
  await page.click('#skillPreview');
  await page.locator('#skillStart:enabled').waitFor({ state: 'visible', timeout: 20000 });
  assert.ok(browser.controls.audioCalls.some(url => url.includes('r2.cloudflarestorage.com')));
  if (!full) assert.ok(browser.controls.audioCalls.some(url => url.includes('github.io')));
  await page.click('#skillStart');
  await wait(page, () => window.K56_TERM1_OFFLINE?.player?.currentTime >= 2, 'Audio đã phát thật');
  const started = await page.evaluate(() => ({ rate: window.K56_TERM1_OFFLINE.player.playbackRate, duration: window.K56_TERM1_OFFLINE.player.duration,
    at: Date.parse(window.K56_TERM1_OFFLINE.record.sections.listening.startedAt) }));
  assert.equal(started.rate, 1);
  assert.ok(Math.abs(started.duration - 1848) < 2);
  await page.locator('#listeningQuestions input[data-number="1"]').fill('A');
  disconnected = true;
  await browser.context.setOffline(true);
  await page.evaluate(() => window.K56_TERM1_OFFLINE.player.dispatchEvent(new Event('ended')));
  assert.equal(await page.evaluate(() => Boolean(window.K56_TERM1_OFFLINE.record.sections.listening.sealed)), false);
  const checkpoint = await page.evaluate(async () => {
    const runtime = window.K56_TERM1_OFFLINE;
    runtime.player.pause();
    await runtime.persist(true);
    return runtime.record.player.position;
  });
  await page.reload();
  await wait(page, () => window.K56_TERM1_OFFLINE?.playerReady, 'Mở lại Listening offline');
  assert.equal(await page.locator('#listeningQuestions input[data-number="1"]').inputValue(), 'A');
  const restored = await page.evaluate(() => window.K56_TERM1_OFFLINE.player.currentTime);
  assert.ok(checkpoint >= 1 && Math.abs(restored - checkpoint) < 0.6, `Mốc ${checkpoint}, mở lại ${restored}`);
  await page.getByRole('button', { name: 'Tiếp tục audio', exact: true }).click();
  await wait(page, () => window.K56_TERM1_OFFLINE.player.currentTime > 4, 'Audio tiếp tục ở 1×');
  assert.equal(await page.evaluate(() => window.K56_TERM1_OFFLINE.player.playbackRate), 1);
  await page.screenshot({ path: resolve(output, 'listening-resumed.png') });
  await writeFile(resolve(output, 'listening-checkpoint.json'), JSON.stringify({ full, started, checkpoint, restored, sources: browser.controls.audioCalls }, null, 2));
  if (full) {
    await page.waitForFunction(() => window.K56_TERM1_OFFLINE.record.sections.listening.sealed, undefined, { timeout: 1980000 });
    assert.ok(Date.now() - started.at >= (started.duration - 1) * 1000);
    assert.equal(await page.evaluate(() => window.K56_TERM1_OFFLINE.record.player.ended), true);
  } else {
    await page.click('#submitListening');
  }
  await page.locator('#resultReadyView').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#viewResult').isDisabled(), true);
  disconnected = false;
  await browser.context.setOffline(false);
  await wait(page, () => window.K56_TERM1_OFFLINE.pending === 0, 'Biên nhận khi có mạng', 25000);
  await page.click('#viewResult');
  await page.locator('#resultView').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#summaryGrid').getByText('1/40 câu đúng').count(), 1);
  const grade = await native.db.query('SELECT field,grade FROM assessment.k56_portal_field_dispatch WHERE attempt_id=$1', [native.a]);
  assert.deepEqual(grade.rows.map(row => [row.field, Number(row.grade)]), [['listening', 1]]);
  browser.assertJournalFaultExercised();
  assert.deepEqual(browser.errors, []);
  await writeFile(resolve(output, 'listening-result.json'), JSON.stringify({ full, started, checkpoint, restored, grade: 1, scale: 40, wallMs: Date.now() - started.at }, null, 2));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createState } from '../writing-handouts/lesson5-demo/core.mjs';
import { serveDirectory } from './fixtures/static-ui-server.mjs';

const { chromium } = createRequire(resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const assignment = 'hw-k67-writing-lesson4-101';
const documentId = 'fixture-lesson4-docs-000001';
const studentRef = 'fixture-student';
const classRef = 'IC9999';
const title = 'Chuẩn bị ý tưởng · Mua sắm không cần thiết';
const lesson = {
  activity: 'lesson4', number: 4, title, topic: 'Synthetic topic for browser testing.', classes: [classRef],
  workflowMode: 'whole-chain-v1', handoutMode: 'two-bodies-v1', outlineOnly: true, ideaHint: 'Chốt dàn ý.',
};
const person = { role: 'student', id: 'fixture-person', classId: '101', label: 'Học viên thử' };
const identity = { ownerId: studentRef, courseId: person.classId, erpId: '201', name: person.label, className: classRef };
const editor = '/student/assignments/' + assignment + '/handout-editor';
const token = 'A'.repeat(43);
const challenge = 'M'.repeat(43);
const csrf = '1';

async function exercise(t, options, verify) {
  const server = process.env.LESSON4_ENTRY_SITE ? null : await serveDirectory(resolve(import.meta.dirname, '..'));
  const site = process.env.LESSON4_ENTRY_SITE || server.origin;
  const origin = new URL(site).origin;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(async () => { await browser.close(); await server?.close(); });
  const page = await browser.newPage({ viewport: { width: options.mobile ? 390 : 1360, height: 850 } });
  page.setDefaultTimeout(6000);
  const calls = [];
  const confirmed = [];
  let rosterFailures = options.retry ? 1 : 0;
  await page.addInitScript(() => {
    const nodes = new WeakSet();
    window.openingMessages = [];
    new MutationObserver(() => {
      for (const host of document.querySelectorAll('#lesson-access p[role=status], #verified-handout-opening:not([hidden]) p')) {
        if (!nodes.has(host) && /^(Đang kiểm tra quyền|Đang mở)/.test(host.textContent)) {
          nodes.add(host);
          window.openingMessages.push(host.textContent);
        }
      }
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    const prefix = '/homework-writing67-api/api';
    if (!url.pathname.startsWith(prefix)) return route.abort();
    const path = url.pathname.slice(prefix.length);
    const headers = {
      'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type,authorization,x-hw-access,x-hw-csrf,x-hw-student,x-hw-document,x-hw-assignment,x-hw-handout,if-none-match',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    calls.push(path);
    if (options.slow) await new Promise(resolve => setTimeout(resolve, 160));
    const send = (json, status = 200) => route.fulfill({ json, status, headers });
    if (path === '/access/config') return send({ version: 1, product: 'homework-writing-5667-local', mode: 'online',
      teacherConsumer: 'homeworkwriting', privateDocsEntry: true });
    if (path === '/access/student/link') {
      const input = request.postDataJSON();
      if (!input.selfMatchToken) return send({ choiceRequired: true, selfMatch: { token: challenge, account: 'fixture@example.test' },
        choices: [{ studentRef, classId: person.classId, classCode: classRef, name: person.label }] });
      confirmed.push(input);
      return send({ token, person, identity, csrf });
    }
    if (path === '/session') return send({ person, csrf });
    if (path === '/access/entry') return send({ entry: { documentId, assignmentId: assignment, studentRef, classId: person.classId } });
    if (path === '/access/identity/resolve') return send({ ok: true, status: 'unique', identity: { authority: 'erp-contact', id: '201' },
      aliases: [{ studentRef, classId: person.classId, classCode: classRef, studentName: person.label }] });
    assert.equal(request.headers().authorization, 'Bearer ' + token);
    if (path === editor + '/lessons/lesson4') return send({ ok: true, lesson });
    if (path === editor + '/roster') {
      if (rosterFailures > 0) { rosterFailures--; return send({ ok: false, error: 'ROSTER_UNAVAILABLE' }, 503); }
      return send({ ok: true, classes: [{ classRef, className: classRef, students: [
        { studentRef: options.wrong ? 'another-student' : studentRef, displayName: person.label },
      ] }] });
    }
    if (path === editor + '/sessions') {
      assert.deepEqual(request.postDataJSON(), { activity: 'lesson4', classRef, studentRef });
      assert.equal(request.headers()['x-hw-csrf'], csrf);
      return send({ ok: true, token: 'B'.repeat(43), session: { ...createState(0, lesson), activity: 'lesson4',
        outlineOnly: true, classRef, studentRef, ref: 'fixture-session' } });
    }
    if (path === editor + '/sessions/fixture-session/practice') return send({ ok: true, practice: { status: 'not_started' } });
    return send({ ok: false }, 404);
  });

  const query = new URLSearchParams({ mode: 'student', assignment, documentId, workspace: 'k67' });
  await page.goto(site + '/writing-handouts/lesson4/?' + query);
  await page.locator('#hw-entry-student').selectOption('0');
  await verify({ page, calls, confirmed });
}

test('Lesson 4 asks for name confirmation once, then restores without remounting the waiting card', async t => {
  await exercise(t, { slow: true, mobile: true }, async ({ page, calls, confirmed }) => {
    const host = await page.locator('#lesson-access').elementHandle();
    assert.equal(await page.locator('#lesson-access h1').innerText(), title);
    await page.getByRole('button', { name: 'Xác nhận và vào bài' }).click();
    await page.locator('.share-practice').waitFor();
    assert.equal(await page.locator('#hw-entry-confirm[open]').count(), 0);
    assert.deepEqual(confirmed, [{ classId: person.classId, studentRef, selfMatchToken: challenge }]);
    assert.equal(calls.filter(path => path === editor + '/sessions').length, 1);
    assert.equal(await host.evaluate(el => el.isConnected && el.hidden), true);
    assert.deepEqual(await page.evaluate(() => window.openingMessages), ['Đang mở bài của bạn…']);
    calls.length = 0;
    await page.reload();
    await page.locator('.share-practice').waitFor();
    assert.deepEqual(await page.evaluate(() => window.openingMessages), ['Đang mở bài của bạn…']);
    assert.equal(calls.includes('/access/student/link'), false);
    assert.equal(await page.locator('#identity').isVisible(), false);
    assert.equal(await page.locator('#confirm').isVisible(), false);
  });
});

test('Lesson 4 retries transient roster errors inside the same card', async t => {
  await exercise(t, { retry: true, slow: true }, async ({ page, calls }) => {
    await page.getByRole('button', { name: 'Xác nhận và vào bài' }).click();
    await page.locator('#lesson-access').getByRole('button', { name: 'Thử lại' }).click();
    await page.locator('.share-practice').waitFor();
    assert.equal(calls.filter(path => path === '/access/config').length, 1);
    assert.equal(calls.filter(path => path === editor + '/roster').length, 2);
    assert.equal(calls.filter(path => path === editor + '/sessions').length, 1);
  });
});

test('Lesson 4 denies a mismatched Docs owner before opening a Handout session', async t => {
  await exercise(t, { wrong: true }, async ({ page, calls }) => {
    await page.getByRole('button', { name: 'Xác nhận và vào bài' }).click();
    const error = page.locator('#lesson-access').getByRole('alert');
    await error.waitFor();
    assert.match(await error.innerText(), /Docs cá nhân/);
    assert.equal(calls.includes(editor + '/sessions'), false);
    assert.equal(await page.locator('#workspace').isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Thử lại' }).count(), 0);
  });
});

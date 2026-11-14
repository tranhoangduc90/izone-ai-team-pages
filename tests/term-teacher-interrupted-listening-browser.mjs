import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { serve } from './helpers/result-details-browser-fixture.mjs';

const playwright = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const { chromium } = playwright.chromium ? playwright : playwright.default;

test('Teacher K67 switches from a complete result to a student with interrupted Listening', async t => {
  const server = await serve();
  t.after(() => server.close());
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ serviceWorkers: 'block' });
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  const reviewer = { email: 'teacher@fixture.test', displayName: 'Giảng viên thử', role: 'teacher' };
  const cls = { id: '9999', name: 'IC9999', accessMode: 'assigned_teacher', isAssignedTeacher: true };
  const exam = { slug: 'term-test-2', title: 'Term Test 2', version: 1 };
  const section = (answer, band) => ({
    correct: 1, total: 1, band,
    details: [{ number: 1, studentAnswer: answer, correctAnswer: answer, result: 'correct' }]
  });
  const previous = {
    ref: '70000000-0000-4000-8000-000000000001', name: 'Học viên A', status: 'completed',
    result: { listening: section('Listening A', 7), reading: section('Reading A', 7) }
  };
  const interrupted = {
    ref: '70000000-0000-4000-8000-000000000002', name: 'Học viên B', status: 'completed',
    completedAt: '2026-11-14T13:20:52Z',
    result: { listening: null, listeningStatus: 'interrupted', reading: section('Reading B', 6.5) },
    writing: { status: 'ready', task1Score: 6, task2Score: 5, writingScore: 5.5 }
  };
  const requestedTasks = [];
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(server.base).origin) return route.continue();
    if (url.hostname !== 'ducizone.ddns.net' || request.method() !== 'GET') return route.abort();
    if (url.pathname.endsWith('/api/auth/session')) return route.fulfill({ json: { ok: true, reviewer } });
    if (url.pathname.endsWith('/teacher/options')) {
      return route.fulfill({ json: { ok: true, reviewer, classes: [cls], tests: [exam] } });
    }
    if (url.pathname.endsWith('/teacher/results')) {
      return route.fulfill({ json: { ok: true, reviewer, class: cls, test: exam, students: [previous, interrupted] } });
    }
    if (url.pathname.endsWith('/teacher/writing-detail')) {
      const task = Number(url.searchParams.get('task'));
      requestedTasks.push([url.searchParams.get('class'), url.searchParams.get('test'), url.searchParams.get('student'), task]);
      return route.fulfill({ json: { ok: true, studentName: interrupted.name,
        writing: { taskNumber: task, taskScore: interrupted.writing[`task${task}Score`], essay: `Writing B, Task ${task}` } } });
    }
    return route.fulfill({ status: 404, json: { ok: false } });
  });

  const url = `${server.base}term-tests/teacher/?class=${cls.name}&test=${exam.slug}`;
  await page.goto(`${url}&student=${previous.ref}`);
  const result = page.locator('#studentView');
  await result.getByRole('heading', { name: previous.name }).waitFor();
  await result.getByText('1/1 · Band 7', { exact: true }).first().waitFor();
  await page.getByRole('tab', { name: interrupted.name }).click();

  assert.deepEqual(errors, []);
  assert.equal(await result.locator('h2').textContent(), interrupted.name);
  assert.equal(new URL(page.url()).searchParams.get('student'), interrupted.ref);
  await result.getByText('Gián đoạn', { exact: true }).waitFor();
  assert.equal(await result.locator('details[data-skill="Listening"]').count(), 0);
  const reading = result.locator('details[data-skill="Reading"]');
  await reading.locator('summary').click();
  await reading.getByText('Reading B', { exact: true }).first().waitFor();
  for (const task of [1, 2]) {
    await result.getByRole('button', { name: new RegExp(`Xem bài chấm chi tiết Writing Task ${task}`) }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText(`${interrupted.name} · Kết quả Writing`).waitFor();
    await dialog.getByText(`Writing B, Task ${task}`, { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Đóng bài chấm Writing' }).click();
  }
  assert.deepEqual(requestedTasks, [1, 2].map(task => [cls.name, exam.slug, interrupted.ref, task]));

  await page.reload();
  await result.getByRole('heading', { name: interrupted.name }).waitFor();
  await result.getByText('Gián đoạn', { exact: true }).waitFor();

  await page.getByRole('tab', { name: 'Tổng quan' }).click();
  const row = page.getByRole('row').filter({ hasText: interrupted.name });
  await row.getByText('Gián đoạn', { exact: true }).waitFor();
  await row.getByRole('button', { name: 'Xem', exact: true }).click();
  await result.getByRole('heading', { name: interrupted.name }).waitFor();
  await result.getByText('1/1 · Band 6.5', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { serve } from './helpers/result-details-browser-fixture.mjs';

const playwright = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const { chromium } = playwright.chromium ? playwright : playwright.default;

test('All four Substitute dashboards show interrupted Listening and retain Reading and Writing', async t => {
  const server = await serve();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(async () => { await browser.close(); await server.close(); });
  const page = await browser.newPage({ serviceWorkers: 'block' });
  page.setDefaultTimeout(5000);
  await page.addInitScript(() => {
    window.IzoneTeacherSso = { restore: async () => true };
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const slugs = ['1-k56', '2-k56', '1-k67', '2-k67'].map(suffix => 'substitute-test-' + suffix);
  const classCode = 'IC9999';
  const studentRef = 'fixture-student';
  const attemptToken = 'fixture-attempt';
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(server.base).origin) return route.continue();
    if (url.hostname !== 'ducizone.ddns.net' || route.request().method() !== 'GET') return route.abort();
    if (url.pathname.endsWith('/teacher/scopes')) {
      return route.fulfill({ json: { scopes: slugs.map(testSlug => ({ testSlug, classCode })) } });
    }
    const testSlug = url.searchParams.get('test');
    const row = { testSlug, classCode, studentRef, attemptToken, studentName: 'Học viên B',
      listeningStatus: 'replacement_required', portalStatus: 'listening_replacement_required',
      status: 'ready', scores: { reading: { raw: 1, max: 1, band: 6.5 } }, result: { taskScore: 6 } };
    if (url.pathname.endsWith('/teacher/results')) {
      return route.fulfill({ json: { testSlug, classCode, results: [row], hasMore: false } });
    }
    if (url.pathname.endsWith('/teacher/result')) {
      assert.deepEqual([url.searchParams.get('student'), url.searchParams.get('attempt')], [studentRef, attemptToken]);
      return route.fulfill({ json: { ...row, taskNumber: 2, source: {
        listening: { availability: 'interrupted' },
        reading: { availability: 'available', section: { details: [
          { number: 1, studentAnswer: 'Reading B', correctAnswer: 'B', result: 'correct' }
        ] } },
        writing: [{ taskNumber: 2, availability: 'available', essay: 'Writing B' }]
      } } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  for (const slug of slugs) {
    await page.goto(`${server.base}term-tests/${slug}-results/?class=${classCode}`);
    const row = page.getByRole('row').filter({ hasText: 'Học viên B' });
    await row.getByRole('button', { name: 'Chi tiết' }).click();
    const detail = page.locator('#student-detail');
    await detail.getByText('Writing B', { exact: true }).waitFor();
    await detail.locator('details[data-skill="Reading"] summary').click();
    await detail.getByText('Reading B', { exact: true }).waitFor();
    assert.equal(await row.locator('td').nth(1).textContent(), 'Gián đoạn');
    assert.match(await row.locator('td').nth(5).textContent(), /Cần thi thay thế Listening/);
    await detail.getByText('Listening · gián đoạn', { exact: true }).waitFor();
    assert.equal(await detail.locator('details[data-skill="Listening"] table').count(), 0);
  }
  assert.deepEqual(errors, []);
});

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Nhận trang thật và API giả bài đã đóng; server mới quyết định ai có biên nhận cũ.
// Kiểm CTA còn mở được luyện thêm, người chưa nộp bị từ chối, link chung không mở mới.
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(process.env.SPEAKING_PAGES_ROOT || fileURLToPath(new URL('../', import.meta.url)));
const output = process.env.SPEAKING_EVIDENCE_DIR || resolve(root, 'output/playwright/speaking-closed');
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const route = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (route.endsWith('/') ? route + 'index.html' : route));
    if (!file.startsWith(root)) throw Error('Outside root');
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' })[extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const ref = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const key = 'izone:remembered-writing-student:v1:https://ducizone.ddns.net/writing-api';
const lessons = [[2, '', '67-speaking-paraphrase', ['paraphrase','speaking']], [3, 'lesson-3.html', '67-speaking-lam_ro', ['clarify_1','clarify_2','clarify_3','freestyle']], [4, 'lesson-4.html', '67-speaking-diem_giua', ['insert_middle','freestyle']]];
const cases = [];
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  for (const [number, file, assignmentCode, parts] of lessons) {
    for (const mode of ['closed_active', 'closed_inactive', 'unsubmitted', 'generic', 'switch_class']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
      const page = await context.newPage();
      page.setDefaultTimeout(4000);
      const requests = [];
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ key, ref }) => localStorage.setItem(key, JSON.stringify({ version: 1, studentRef: ref })), { key, ref });
      await page.route('https://ducizone.ddns.net/mapping-api/api/speaking-homework/**', async route => {
        const path = new URL(route.request().url()).pathname.split('/api/speaking-homework')[1];
        const body = route.request().postDataJSON();
        requests.push({ path, body });
        let data; let status = 200;
        if (path === '/classes') data = { classes: [...(mode === 'closed_inactive' ? [] : [{ classCode: 'IC2304', ready: false, assignmentStatus: 'missing' }]), { classCode: 'IC2305', ready: true, assignmentStatus: 'open' }] };
        else if (path === '/identity/resolve') data = { status: mode === 'closed_inactive' ? 'missing' : 'unique', classCode: 'IC2304', studentRef: ref };
        else if (path === '/assignment/open') data = { assignment: { classCode: 'IC2304', assignmentStatus: 'closed' } };
        else if (path === '/assignment/roster') data = { assignment: { title: `Homework Lesson ${number}`, classCode: body.classCode, assignmentCode, assignmentStatus: body.documentId ? 'closed' : 'open', students: [{ student_ref: body.classCode === 'IC2304' ? ref : other, name: 'Học viên thử' }], parts: parts.map(part_key => ({ part_key })), requiredPracticeCount: number === 4 ? 2 : 0, doctorEnabled: number !== 3 } };
        else if (path === '/session/start-selected') {
          if (mode === 'unsubmitted') { status = 403; data = { ok: false, error: 'HOMEWORK_CLOSED', message: 'Chỉ học viên đã nộp bài mới có thể vào luyện thêm.' }; }
          else data = { session: { accessToken: 'A'.repeat(40), classCode: body.classCode, studentRef: body.studentRef, documentId: body.documentId || 'own-new-doc' } };
        } else if (path === '/open') data = { status: 'submitted', receipt: { id: 'old-receipt' }, links: [], practiceLinks: [] };
        else if (path === '/doctor/list') data = { needed: [], allNeeded: [], practiced: [], neededCount: 0, personalCount: 0, sharedCatalog: [] };
        else throw Error(`Unexpected API ${path}`);
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ ok: true, ...data }) });
      });
      const name = `Lesson ${number}: ${mode}`;
      try {
        await page.goto(`http://127.0.0.1:${server.address().port}/speaking-homework/${file}${mode === 'generic' ? '?class=IC2304' : '?documentId=old-submitted-doc&class=IC2304'}`);
        await page.waitForFunction(() => !document.getElementById('class-select').disabled);
        if (mode === 'generic') {
          assert.equal(await page.locator('#class-select option[value="IC2304"]').evaluate(option => option.disabled), true);
          assert.equal(await page.locator('#open-homework').isDisabled(), true);
          assert.equal(requests.some(r => r.path === '/session/start-selected'), false);
        } else {
          await page.locator('#student-select').selectOption(ref);
          assert.equal(await page.locator('#class-select').inputValue(), 'IC2304');
          if (mode === 'switch_class') {
            await page.locator('#class-select').selectOption('IC2305');
            await page.locator('#student-select').selectOption(other);
            assert.equal(await page.locator('#class-select option[value="IC2304"]').evaluate(option => option.disabled), true);
          }
          await page.locator('#open-homework').click();
          if (mode === 'unsubmitted') {
            await page.getByText('Chỉ học viên đã nộp bài mới có thể vào luyện thêm.', { exact: false }).waitFor();
            assert.equal(await page.locator('#homework-content').isVisible(), false);
          } else {
            await page.locator('#completion-card').waitFor({ state: 'visible' });
            const last = requests.findLast(r => r.path === '/session/start-selected').body;
            assert.equal(last.documentId, mode === 'switch_class' ? undefined : 'old-submitted-doc');
            assert.equal(await page.locator('#active-class').innerText(), mode === 'switch_class' ? 'IC2305' : 'IC2304');
            if (number !== 3) assert.equal(await page.locator('#extra-practice').isVisible(), true);
            if (mode === 'closed_inactive') await page.screenshot({ path: join(output, `lesson-${number}-closed-cta-open.png`), fullPage: true });
          }
        }
        assert.deepEqual(errors, []);
        cases.push({ name, outcome: 'passed' });
      } catch (error) {
        cases.push({ name, outcome: 'failed', error: error.message });
        await page.screenshot({ path: join(output, `closed-red-${number}-${mode}.png`), fullPage: true });
        throw error;
      } finally { await context.close(); }
    }
  }
} finally {
  await writeFile(join(output, 'closed-cta-results.json'), JSON.stringify({ outcome: cases.every(c => c.outcome === 'passed') ? 'passed' : 'failed', cases }, null, 2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(`Closed CTA: ${cases.length} cases PASS`);

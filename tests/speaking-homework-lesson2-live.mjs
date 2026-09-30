import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Dữ liệu vào: trang buổi 2 thật và API mô phỏng có roster, bài nộp, Bác sĩ AI.
// Việc chính: chạy hành trình trên Chromium ở máy tính và điện thoại.
// Kết quả: bắt lỗi giao diện, link sai, biên nhận và bài luyện thêm; lỗi hiện ở test.
const playwrightPath = process.env.PLAYWRIGHT_MODULE;
if (!playwrightPath) throw new Error('Cần PLAYWRIGHT_MODULE trỏ tới bản Playwright có sẵn.');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (request, response) => {
  try {
    const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = normalize(join(root, route.endsWith('/') ? `${route}index.html` : route));
    if (!file.startsWith(root)) throw new Error('Outside root');
    const content = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    response.end(content);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const studentRef = '22222222-2222-4222-8222-222222222222';
const docId = 'studentLesson2DocIC2304';
const share1 = 'https://chatgpt.com/share/6a4b8dc6-aa30-83ec-82cb-b235ee51d460';
const share2 = 'https://chatgpt.com/share/6a4be00b-b504-83ec-806f-7c999ef9dd7b';
const share3 = 'https://chatgpt.com/share/6a4bee6e-ea7c-83ec-b859-8a6e3e123ce1';
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const links = new Map(); let submitted = false; let extra = [];
    await page.route('https://ducizone.ddns.net/mapping-api/api/speaking-homework/**', async route => {
      const path = new URL(route.request().url()).pathname.split('/api/speaking-homework')[1];
      const body = route.request().postDataJSON();
      let data;
      if (path === '/assignment/direct-open') data = { assignment: { title: 'Homework Lesson 2', classCode: 'IC2304', students: [{ student_ref: studentRef, name: 'Học viên thử' }], parts: [{ part_key: 'paraphrase' }, { part_key: 'speaking' }] } };
      else if (path === '/session/direct-start') data = { session: { accessToken: 'A'.repeat(40), documentId: docId } };
      else if (path === '/open') data = { status: submitted ? 'submitted' : 'draft', receipt: submitted ? { id: 'receipt' } : null, links: [...links.values()], practiceLinks: extra };
      else if (path === '/doctor/list') data = { needed: [{ exercise_id: 'exercise-1', title: 'Luyện phát âm', exercise_url: 'https://example.org/exercise', recommendation_count: 3, practice_count: 0 }], allNeeded: [{ exercise_id: 'exercise-1', title: 'Luyện phát âm', exercise_url: 'https://example.org/exercise', recommendation_count: 3, practice_count: 0 }], practiced: [], neededCount: 1, personalCount: 1 };
      else if (path === '/checks/request') { links.set(body.part, { part: body.part, share_url: body.url, check_status: 'accepted', question_count: body.part === 'paraphrase' ? 5 : 3 }); data = { check: { status: 'pending' } }; }
      else if (path === '/finish') { submitted = true; data = { receipt: { id: 'receipt' } }; }
      else if (path === '/doctor/practice/extra/request') { extra = [{ id: '33333333-3333-4333-8333-333333333333', slot: 3, share_url: body.url, status: 'accepted', analysis_status: 'done' }]; data = { check: { status: 'pending' } }; }
      else throw new Error(`Unexpected API: ${path}`);
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, ...data }) });
    });
    await page.goto(`http://127.0.0.1:${address.port}/speaking-homework/`);
    await page.locator('#student-select').selectOption(studentRef);
    await page.getByRole('button', { name: 'Mở bài nộp' }).click();
    await page.locator('#paraphrase-link').fill('https://chatgpt.com/s/t_6ab7c876892881919d9c9cfff0af4c32');
    await page.locator('#paraphrase-confirm').click();
    assert.match(await page.locator('#paraphrase-result').innerText(), /một phản hồi/i);
    await page.locator('#paraphrase-link').fill(share1);
    await page.locator('#paraphrase-confirm').click();
    await page.locator('#speaking-link').fill(share2);
    await page.locator('#speaking-confirm').click();
    await page.locator('#completion-card').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#return-homework').getAttribute('href'), `https://docs.google.com/document/d/${docId}/edit?tab=t.0`);
    assert.equal(await page.locator('#doctor-list li').count(), 1);
    await page.locator('#extra-exercise').selectOption('exercise-1');
    await page.locator('#extra-link').fill(share3);
    await page.locator('#extra-confirm').click();
    await page.getByText('Đã phân tích và cập nhật danh sách cá nhân.').waitFor();
    assert.equal(extra.length, 1);
    assert.equal(await page.locator('.guide-content img').count(), 9);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
    await page.reload();
    await page.locator('#identity-confirmed').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#active-student').innerText(), 'Học viên thử');
    await context.close();
  }
  process.stdout.write('Lesson 2 live: desktop + mobile, link sai, 2 link đạt, biên nhận, Bác sĩ AI, ghi nhớ học viên, 9 ảnh: PASS\n');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

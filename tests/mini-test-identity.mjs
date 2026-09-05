import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');

const root = fileURLToPath(new URL('..', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};
const clientEventPayloads = [];
const unavailableRequests = new Set();

// Dữ liệu vào: yêu cầu file tĩnh từ trang Mini Test trên localhost.
// Việc chính: chỉ đọc file nằm trong repo và trả đúng kiểu nội dung.
// Kết quả: trình duyệt chạy đúng source chuẩn bị phát hành; đường dẫn sai trả 404.
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (request.method === 'POST' && pathname.endsWith('/client-event')) {
      // Dữ liệu vào: telemetry kỹ thuật do bất kỳ trang giả lập nào gửi trong lúc kiểm thử.
      // Việc chính: đọc payload, giữ lại để soát quyền riêng tư và trả đúng trạng thái production.
      // Kết quả: static server không báo 404 cho route API hợp lệ nhưng nằm ngoài repo Pages.
      // Khi JSON hỏng: chuyển sang nhánh lỗi 404 để bài kiểm thử phát hiện qua console trình duyệt.
      let rawBody = '';
      for await (const chunk of request) rawBody += chunk;
      clientEventPayloads.push(JSON.parse(rawBody || '{}'));
      response.writeHead(202, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    const relative = pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
    const filePath = normalize(join(root, relative));
    if (!filePath.startsWith(normalize(root))) throw new Error('Đường dẫn ngoài repo');
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    unavailableRequests.add(`${request.method} ${request.url}`);
    response.writeHead(404).end('Không tìm thấy');
  }
});

await new Promise((resolve) => server.listen(4174, '127.0.0.1', resolve));
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
});

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(`answer-sheet: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(`answer-sheet console: ${message.text()}`);
  });
  const temporaryStudentRef = '00000000-0000-4000-8000-000000000021';
  let registrationPayload = null;
  let listeningPayload = null;

  // Dữ liệu vào: API roster của lớp IC2238 với một học viên giả lập.
  // Việc chính: không gọi hệ thống thật và không dùng dữ liệu học viên thật.
  // Kết quả: giao diện phải hiện dropdown, cho chọn tên và giữ tên sau khi tải lại.
  await page.route('**/api/term-tests/roster?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        class: { code: 'IC2238', name: 'IC2238' },
        students: [{ ref: '11111111-1111-4111-8111-111111111111', name: 'Học viên thử nghiệm' }],
      }),
    });
  });
  await page.route('**/api/term-tests/mini-test-lesson-5/attempt/active', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, active: false }),
    });
  });
  await page.route('**/api/term-tests/mini-test-lesson-5/temporary-students', async (route) => {
    registrationPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        student: { ref: temporaryStudentRef, name: 'Học viên mã tạm', temporary: true },
      }),
    });
  });
  await page.route('**/api/term-tests/mini-test-lesson-5/listening', async (route) => {
    listeningPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        attemptToken: '00000000-0000-4000-8000-000000000031',
        studentName: 'Học viên mã tạm',
        completed: false,
        portalSyncStatus: 'not_applicable',
      }),
    });
  });
  await page.route('**/api/term-tests/result', async route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      completed: false,
      studentName: 'Học viên mã tạm',
      className: 'IC2238',
      writing: null,
      exam: {},
    }),
  }));

  const url = 'http://127.0.0.1:4174/term-tests/mini-test-lesson-5/?class=IC2238';
  const navigation = await page.goto(url);
  if (navigation?.status() !== 200) throw new Error(`Trang kiểm thử trả mã ${navigation?.status()}`);

  const identity = page.locator('#identityView');
  const listening = page.locator('#listeningView');
  const studentSelect = page.locator('#studentSelect');
  await studentSelect.waitFor({ state: 'visible' });

  if (!(await identity.isVisible())) throw new Error('Khối chọn học viên đang bị ẩn');
  if (!(await listening.isVisible())) throw new Error('Phần Listening không hiển thị cùng bộ chọn tên');
  if ((await studentSelect.locator('option').count()) !== 3) throw new Error('Dropdown thiếu lựa chọn học viên tạm');

  await studentSelect.selectOption('11111111-1111-4111-8111-111111111111');
  if ((await studentSelect.inputValue()) !== '11111111-1111-4111-8111-111111111111') throw new Error('Không chọn được học viên');

  await page.reload();
  await studentSelect.waitFor({ state: 'visible' });
  if ((await studentSelect.inputValue()) !== '11111111-1111-4111-8111-111111111111') throw new Error('Tên đã chọn không được giữ sau khi tải lại');

  await studentSelect.selectOption('__temporary__');
  const temporaryForm = page.locator('#temporaryStudentForm');
  if (!(await temporaryForm.isVisible())) throw new Error('Biểu mẫu tên và mã tạm không hiển thị');
  await page.locator('#temporaryStudentName').fill('  Học viên   mã tạm ');
  await page.locator('#temporaryStudentCode').fill('t01');
  await page.locator('#registerTemporaryStudent').click();
  await page.waitForFunction(ref => document.querySelector('#studentSelect')?.value === ref, temporaryStudentRef);

  if (registrationPayload?.classCode !== 'IC2238'
    || registrationPayload?.studentName !== 'Học viên mã tạm'
    || registrationPayload?.temporaryCode !== 'T01') {
    throw new Error('Payload đăng ký học viên tạm không được chuẩn hóa đúng');
  }
  if (await temporaryForm.isVisible()) throw new Error('Biểu mẫu mã tạm chưa đóng sau khi xác nhận');
  if (await page.locator('#temporaryStudentCode').inputValue()) throw new Error('Ô mã tạm chưa được xóa');

  const storedIdentity = await page.evaluate(() => `${localStorage.getItem('izone-test:mini-test-lesson-5:IC2238') || ''}${sessionStorage.getItem('izone-test:mini-test-lesson-5:IC2238') || ''}`);
  if (storedIdentity.includes('T01') || storedIdentity.toLowerCase().includes('temporarycode')) {
    throw new Error('Mã tạm bị lưu trong bộ nhớ trình duyệt');
  }

  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-number="11"]').selectOption('A');
  await page.locator('#submitListening').click();
  await page.waitForFunction(() => document.querySelector('#listeningSavedView')?.hidden === false);
  if (listeningPayload?.studentRef !== temporaryStudentRef) {
    throw new Error('Bài Listening không gắn với UUID của học viên tạm');
  }

  await page.reload();
  await studentSelect.waitFor({ state: 'attached' });
  if ((await studentSelect.inputValue()) !== temporaryStudentRef) throw new Error('Hồ sơ tạm không được phục hồi sau khi tải lại');
  if ((await studentSelect.locator('option').count()) !== 4) throw new Error('Hồ sơ tạm chưa được ghép cục bộ mà không lộ qua roster');

  const cbtContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cbtPage = await cbtContext.newPage();
  cbtPage.on('pageerror', error => browserErrors.push(`computer-based: ${error.message}`));
  cbtPage.on('console', message => {
    if (message.type() === 'error') browserErrors.push(`computer-based console: ${message.text()}`);
  });
  let cbtRegistrationPayload = null;
  let preparePayload = null;
  await cbtPage.route('**/api/term-tests/roster?*', async route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      class: { code: 'IC2262', name: 'IC2262' },
      students: [{ ref: 'student-test-002', name: 'Học viên trong lớp' }],
    }),
  }));
  await cbtPage.route('**/api/term-tests/mini-test-lesson-5/temporary-students', async route => {
    cbtRegistrationPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        student: { ref: temporaryStudentRef, name: 'Học viên CBT tạm', temporary: true },
      }),
    });
  });
  await cbtPage.route('**/api/term-tests/mini-test-lesson-5/session/prepare', async route => {
    preparePayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        examSessionToken: '00000000-0000-4000-8000-000000000041',
        listeningStartedAt: null,
        listeningDeadlineAt: null,
        listeningSubmitted: false,
        attemptToken: null,
        encryptedAudioUrl: '/fake-audio.enc',
        previewAudioUrl: '/fake-preview.mp3',
      }),
    });
  });
  await cbtPage.route('**/fake-audio.enc', async route => route.fulfill({ status: 200, body: 'encrypted-audio' }));
  await cbtPage.route('**/fake-preview.mp3', async route => route.fulfill({ status: 200, body: 'preview-audio' }));

  const cbtUrl = 'http://127.0.0.1:4174/term-tests/mini-test-lesson-5-computer-based/?class=IC2262';
  await cbtPage.goto(cbtUrl);
  const cbtStudentSelect = cbtPage.locator('#bootstrapStudent');
  await cbtStudentSelect.waitFor({ state: 'visible' });
  if ((await cbtStudentSelect.locator('option').count()) !== 3) throw new Error('CBT thiếu lựa chọn học viên tạm');
  await cbtStudentSelect.selectOption('__temporary__');
  await cbtPage.locator('#bootstrapTemporaryStudentName').fill('Học viên CBT tạm');
  await cbtPage.locator('#bootstrapTemporaryStudentCode').fill('T02');
  await cbtPage.locator('#bootstrapRegisterTemporaryStudent').click();
  await cbtPage.waitForFunction(() => document.querySelector('#bootstrapDownloadStatus')?.textContent.includes('100%'));
  if (cbtRegistrationPayload?.temporaryCode !== 'T02' || preparePayload?.studentRef !== temporaryStudentRef) {
    throw new Error('CBT không dùng đúng UUID sau khi đăng ký mã tạm');
  }
  const cbtStoredIdentity = await cbtPage.evaluate(() => `${localStorage.getItem('izone-test:mini-test-lesson-5:IC2262') || ''}${sessionStorage.getItem('izone-test:mini-test-lesson-5:IC2262') || ''}`);
  if (cbtStoredIdentity.includes('T02')) throw new Error('CBT lưu mã tạm trong bộ nhớ trình duyệt');
  await cbtContext.close();

  const termContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const termPage = await termContext.newPage();
  termPage.on('pageerror', error => browserErrors.push(`term-test: ${error.message}`));
  termPage.on('console', message => {
    if (message.type() === 'error') browserErrors.push(`term-test console: ${message.text()}`);
  });
  await termPage.route('**/api/term-tests/roster?*', async route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      class: { code: 'IC2238', name: 'IC2238' },
      students: [{ ref: '00000000-0000-4000-8000-000000000051', name: 'Học viên Term Test' }],
    }),
  }));
  await termPage.goto('http://127.0.0.1:4174/term-tests/term-test-1/?class=IC2238');
  const termStudentSelect = termPage.locator('#studentSelect');
  await termStudentSelect.waitFor({ state: 'visible' });
  if ((await termStudentSelect.locator('option[value="__temporary__"]').count()) !== 0
    || (await termPage.locator('#temporaryStudentForm').count()) !== 0) {
    throw new Error('Lựa chọn mã tạm bị hiện nhầm trên Term Test');
  }
  await termContext.close();
  if (clientEventPayloads.some(payload => 'answers' in payload || 'studentName' in payload)) {
    throw new Error('Telemetry chứa tên hoặc đáp án học viên');
  }
  if (browserErrors.length) {
    throw new Error(`Trình duyệt phát sinh lỗi: ${browserErrors.join(' | ')}; yêu cầu 404: ${[...unavailableRequests].join(', ')}`);
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    identityVisible: await identity.isVisible(),
    listeningVisible: await listening.isVisible(),
    optionCount: await studentSelect.locator('option').count(),
    temporaryStudentRef,
    answerSheetSubmissionUsesTemporaryRef: listeningPayload?.studentRef === temporaryStudentRef,
    computerBasedPrepareUsesTemporaryRef: preparePayload?.studentRef === temporaryStudentRef,
    clientEventCount: clientEventPayloads.length,
    termTestUnaffected: true,
  }, null, 2));
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

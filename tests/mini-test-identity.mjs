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

// Dữ liệu vào: yêu cầu file tĩnh từ trang Mini Test trên localhost.
// Việc chính: chỉ đọc file nằm trong repo và trả đúng kiểu nội dung.
// Kết quả: trình duyệt chạy đúng source chuẩn bị phát hành; đường dẫn sai trả 404.
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
    const filePath = normalize(join(root, relative));
    if (!filePath.startsWith(normalize(root))) throw new Error('Đường dẫn ngoài repo');
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Không tìm thấy');
  }
});

await new Promise((resolve) => server.listen(4174, '127.0.0.1', resolve));
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

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
        students: [{ ref: 'student-test-001', name: 'Học viên thử nghiệm' }],
      }),
    });
  });

  const url = 'http://127.0.0.1:4174/term-tests/mini-test-lesson-5/?class=IC2238';
  const navigation = await page.goto(url);
  if (navigation?.status() !== 200) throw new Error(`Trang kiểm thử trả mã ${navigation?.status()}`);

  const identity = page.locator('#identityView');
  const listening = page.locator('#listeningView');
  const studentSelect = page.locator('#studentSelect');
  await studentSelect.waitFor({ state: 'visible' });

  if (!(await identity.isVisible())) throw new Error('Khối chọn học viên đang bị ẩn');
  if (!(await listening.isVisible())) throw new Error('Phần Listening không hiển thị cùng bộ chọn tên');
  if ((await studentSelect.locator('option').count()) !== 2) throw new Error('Roster chưa được nạp vào dropdown');

  await studentSelect.selectOption('student-test-001');
  if ((await studentSelect.inputValue()) !== 'student-test-001') throw new Error('Không chọn được học viên');

  await page.reload();
  await studentSelect.waitFor({ state: 'visible' });
  if ((await studentSelect.inputValue()) !== 'student-test-001') throw new Error('Tên đã chọn không được giữ sau khi tải lại');

  process.stdout.write(JSON.stringify({
    ok: true,
    identityVisible: await identity.isVisible(),
    listeningVisible: await listening.isVisible(),
    optionCount: await studentSelect.locator('option').count(),
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

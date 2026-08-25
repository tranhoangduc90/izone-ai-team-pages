import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');

/**
 * DÀNH CHO NGƯỜI VẬN HÀNH
 * - Nhận vào: một Google Docs demo đã được cho phép và mã bài tương ứng.
 * - Việc chính: mở đúng GitHub Pages như học viên, theo dõi các trạng thái và chờ n8n ghi kết quả.
 * - Tạo ra: ảnh chụp giao diện hoàn tất cùng bản tóm tắt không chứa nội dung bài làm.
 * - Khi lỗi: dừng với thông báo rõ bước nào chưa đạt; không in nội dung Google Docs hay dữ liệu học viên.
 */
const documentId = process.env.CHECK_NOW_DOCUMENT_ID;
const assignmentCode = process.env.CHECK_NOW_ASSIGNMENT_CODE;
if (!/^[A-Za-z0-9_-]{20,}$/.test(documentId ?? '')) throw new Error('Thiếu Document ID demo hợp lệ');
if (!/^67-(reading|listening)-\d{2}$/.test(assignmentCode ?? '')) throw new Error('Thiếu mã bài demo hợp lệ');

const siteUrl = new URL('https://tranhoangduc90.github.io/izone-ai-team-pages/check-now.html');
siteUrl.searchParams.set('documentId', documentId);
siteUrl.searchParams.set('assignmentCode', assignmentCode);

const root = fileURLToPath(new URL('../..', import.meta.url));
const outputDir = join(root, 'output', 'playwright');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const observedStages = new Set();
  const networkStatuses = [];

  page.on('response', async (response) => {
    if (!response.url().includes('ducizone.ddns.net/webhook/')) return;
    networkStatuses.push({ method: response.request().method(), status: response.status() });
  });

  const navigation = await page.goto(siteUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (navigation?.status() !== 200) throw new Error(`GitHub Pages trả mã ${navigation?.status()}`);
  if (new URL(page.url()).search) throw new Error('Giao diện chưa xóa Document ID và mã bài khỏi thanh địa chỉ');
  if (await page.locator('.brand-row').count()) throw new Error('Dòng tiêu đề riêng của một bài vẫn còn trên giao diện dùng chung');

  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    const active = await page.locator('.step.active').getAttribute('data-stage').catch(() => null);
    if (active) observedStages.add(active);
    if (await page.getByRole('heading', { name: 'Bài đã được chấm xong' }).isVisible().catch(() => false)) break;
    if (await page.locator('#error-box').isVisible().catch(() => false)) {
      const message = await page.locator('#error-message').innerText();
      throw new Error(`Giao diện báo lỗi: ${message}`);
    }
    await page.waitForTimeout(200);
  }

  await page.getByRole('heading', { name: 'Bài đã được chấm xong' }).waitFor({ timeout: 1000 });
  if ((await page.locator('.step.done').count()) !== 3) throw new Error('Ba giai đoạn chưa cùng hoàn tất');
  const finalMessage = (await page.locator('#result').innerText()).replace(/\s+/g, ' ').trim();
  if (!finalMessage.includes('Hãy quay lại file Docs để xem kết quả và sửa lại.')) {
    throw new Error('Thông báo hoàn tất chưa đúng nội dung đã thống nhất');
  }
  await page.screenshot({ path: join(outputDir, `check-now-live-${assignmentCode}-done.png`), fullPage: true });

  process.stdout.write(JSON.stringify({
    ok: true,
    assignmentCode,
    observedStages: [...observedStages],
    networkStatuses,
    finalMessage,
  }, null, 2));
} finally {
  await browser.close();
}

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { startFixture, learners, lessons, share } from './fixtures/speaking-draft-server.mjs';

// Test qua trang thật: xóa là bản nháp rỗng, không phải yêu cầu điền lại link máy chủ.
// Kỳ vọng ở ô nhập, tiến độ và request hoàn tất; không thêm hook test vào production.
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(process.env.SPEAKING_PAGES_ROOT || fileURLToPath(new URL('../', import.meta.url)));
const output = process.env.SPEAKING_EVIDENCE_DIR || join(root, 'output/playwright/speaking-draft-clear');
await mkdir(output, { recursive: true });
const results = [];
const browser = await chromium.launch({ executablePath: process.env.SPEAKING_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
async function run(name, lesson, options, test) {
  const fixture = await startFixture(root, options);
  const context = await browser.newContext({ viewport: { width: lesson.number % 2 ? 390 : 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.clock.install();
  if (options.submitted) await page.addInitScript(({ lesson, ref }) => {
    const doc = `fixture-${lesson.number}-${ref}`;
    const key = lesson.number === 2 ? `speaking-homework:lesson-2:IC2304:${doc}:${ref}`
      : `speaking-homework:lesson-${lesson.number}:${doc}:${ref}`;
    localStorage.setItem(key, JSON.stringify({ [lesson.parts[0]]: '', practice_1_link: '', practice_1_exercise: '' }));
  }, { lesson, ref: learners[0] });
  if (options.writeBlocked) await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Quota', 'QuotaExceededError'); };
  });
  async function open(ref = learners[0]) {
    await page.locator('#class-select').selectOption('IC2304');
    await page.locator('#student-select').selectOption(ref);
    await page.locator('#open-homework').click();
    await page.locator('#homework-content').waitFor({ state: 'visible' });
  }
  try {
    await page.goto(`${fixture.origin}/speaking-homework/${lesson.file}`);
    await open();
    await test({ page, context, fixture, open });
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    results.push({ name, outcome: 'passed' });
  } catch (error) {
    results.push({ name, outcome: 'failed', error: error.message });
    await page.screenshot({ path: join(output, `failed-${results.length}.png`), fullPage: true });
  } finally { await context.close(); await fixture.close(); }
}
try {
  for (const lesson of lessons) for (const status of ['rejected', 'pending', 'accepted']) {
    await run(`L${lesson.number}: clear ${status}, poll, reload, learner isolation`, lesson, { status }, async ({ page, fixture, open }) => {
      const first = page.locator(`#${lesson.parts[0]}-link`);
      assert.equal(await first.inputValue(), share(1), 'Thiết bị mới vẫn nạp link máy chủ');
      await first.press('ControlOrMeta+A');
      await first.press('Backspace');
      assert.equal(await first.inputValue(), '', 'Xóa ký tự cuối phải giữ ô rỗng');
      assert.equal(await page.locator('#progress-bar').getAttribute('aria-valuenow'), lesson.number >= 4 && status === 'accepted' ? '1' : '0');
      if (lesson.number >= 4) {
        const practice = page.locator('#practice-1-link');
        assert.equal(await practice.inputValue(), share(11));
        if (status === 'accepted') {
          await page.locator('#practice-1-exercise').selectOption('exercise-2');
          assert.equal(await page.locator('#progress-bar').getAttribute('aria-valuenow'), '0', 'Đổi bài không dùng kết quả đạt của kỹ năng cũ');
          await page.locator('#practice-1-exercise').selectOption('exercise-1');
        }
        await practice.press('ControlOrMeta+A');
        await practice.press('Delete');
        assert.equal(await practice.inputValue(), '', 'Bài bổ trợ không khôi phục link cũ');
        await page.locator('#practice-1-exercise').selectOption('');
        assert.equal(await page.locator('#practice-1-exercise').inputValue(), '', 'Chọn trống không khôi phục bài cũ');
      }
      await page.locator(`#${lesson.parts[1]}-link`).fill(share(22));
      const current = fixture.record(lesson, learners[0]);
      current.links.get(lesson.parts[0]).check_status = 'accepted';
      if (status === 'pending') {
        const before = fixture.openCount;
        await page.clock.runFor(15_000);
        await page.waitForFunction(() => document.getElementById('change-student').disabled === false);
        assert.ok(fixture.openCount > before, 'Đã chạy cập nhật kết quả đến muộn');
      }
      assert.equal(await first.inputValue(), '');
      assert.equal(fixture.requests.some(r => r.path === '/finish'), false);
      await page.reload(); await open();
      assert.equal(await first.inputValue(), '', 'Tải lại phải giữ nháp rỗng');
      if (lesson.number >= 4) {
        assert.equal(await page.locator('#practice-1-link').inputValue(), '');
        assert.equal(await page.locator('#practice-1-exercise').inputValue(), '');
      }
      await page.locator('#change-student').click(); await open(learners[1]);
      assert.equal(await first.inputValue(), '', 'Không lấy nháp hoặc link của người trước');
      await first.fill(share(40));
      await page.locator('#change-student').click(); await open();
      assert.equal(await first.inputValue(), '', 'Quay lại đúng nháp rỗng của hồ sơ đầu');
      await first.fill(share(30));
      await page.locator(`#${lesson.parts[0]}-confirm`).click();
      await page.locator(`#${lesson.parts[0]}-result`).getByText('Đã xác nhận hội thoại').waitFor();
      assert.equal(current.links.get(lesson.parts[0]).share_url, share(30));
      await page.screenshot({ path: join(output, `lesson-${lesson.number}-${status}.png`), fullPage: true });
    });
  }
  for (const lesson of lessons) await run(`L${lesson.number}: submitted receipt overrides stale empty draft`, lesson, { status: 'accepted', submitted: true }, async ({ page, fixture, open }) => {
    assert.equal(await page.locator(`#${lesson.parts[0]}-link`).inputValue(), share(1));
    assert.equal(await page.locator(`#${lesson.parts[0]}-link`).isDisabled(), true);
    assert.equal(await page.locator('#completion-card').isVisible(), true);
    await page.reload(); await open();
    assert.equal(await page.locator(`#${lesson.parts[0]}-link`).inputValue(), share(1));
    assert.equal(fixture.requests.some(r => r.path === '/finish'), false);
  });
  await run('L6: storage unavailable, polling failure, retry preserves edits', lessons[4], { status: 'pending', writeBlocked: true }, async ({ page, fixture }) => {
    await page.locator('#benefit_harm-link').fill('');
    await page.locator('#practice-1-link').fill('');
    fixture.setFailOpen(true);
    await page.clock.runFor(15_000);
    await page.getByText(/Tạm mất kết nối/).waitFor();
    assert.equal(await page.locator('#benefit_harm-link').inputValue(), '');
    fixture.setFailOpen(false);
    await page.clock.runFor(30_000);
    assert.equal(await page.locator('#benefit_harm-link').inputValue(), '');
    assert.equal(await page.locator('#practice-1-link').inputValue(), '');
  });
  await run('L6: deleted accepted link blocks finish when final practice arrives', lessons[4], { status: 'accepted', seedAll: true, missingLast: true }, async ({ page, fixture }) => {
    await page.locator('#benefit_harm-link').fill('');
    await page.locator('#practice-2-exercise').selectOption('exercise-2');
    await page.locator('#practice-2-link').fill(share(12));
    await page.locator('#practice-2-confirm').click();
    await page.locator('#practice-2-result').getByText('Đã nhận bài bổ trợ').waitFor();
    assert.equal(await page.locator('#benefit_harm-link').inputValue(), '');
    assert.equal(await page.locator('#completion-card').isVisible(), false);
    assert.equal(fixture.requests.filter(r => r.path === '/finish').length, 0);
    assert.equal(await page.locator('#progress-bar').getAttribute('aria-valuenow'), '4');
  });
} finally {
  await browser.close();
  await writeFile(join(output, 'draft-clear-results.json'), JSON.stringify({ outcome: results.some(r => r.outcome === 'failed') ? 'failed' : 'passed', cases: results }, null, 2));
}
for (const row of results) console.log(`${row.outcome}: ${row.name}${row.error ? ' — ' + row.error : ''}`);
console.log(`Draft clear browser: ${results.filter(r => r.outcome === 'passed').length}/${results.length} passed`);
if (results.some(r => r.outcome === 'failed')) process.exitCode = 1;

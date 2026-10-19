import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { startFixture, learners, lessons } from './fixtures/speaking-draft-server.mjs';

// Trang thật, API giả tại ranh giới mạng: bắt nộp thiếu, mất phản hồi và retry vô hạn.
// Không gửi bài/AI/Docs thật. Chống trùng transaction được kiểm riêng ở PostgreSQL.
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(process.env.SPEAKING_PAGES_ROOT || fileURLToPath(new URL('../', import.meta.url)));
const output = process.env.SPEAKING_EVIDENCE_DIR; assert.ok(output); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const results = [], selected = lessons.filter(l => !process.env.SPEAKING_LESSONS || process.env.SPEAKING_LESSONS.split(',').includes(String(l.number)));
const settle = () => new Promise(r => setTimeout(r, 100));
async function run(name, lesson, width, task, prepare = () => {}) {
  if (process.env.SPEAKING_CASE && !name.includes(process.env.SPEAKING_CASE)) return;
  const fixture = await startFixture(root, { status: 'accepted', seedAll: true });
  const record = fixture.record(lesson, learners[0]); prepare(record);
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(6000); page.on('dialog', d => d.accept());
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await page.clock.install();
  const sent = () => fixture.requests.filter(r => r.path === '/finish');
  async function open(target = page) {
    await target.goto(`${fixture.origin}/speaking-homework/${lesson.file}`);
    await target.waitForFunction(() => !document.getElementById('class-select').disabled || !document.getElementById('homework-content').hidden);
    if (!(await target.locator('#homework-content').isVisible())) {
      await target.locator('#class-select').selectOption('IC2304'); await target.locator('#student-select').selectOption(learners[0]); await target.locator('#open-homework').click();
    }
    await target.locator('#homework-content').waitFor({ state: 'visible' });
  }
  const completed = (target = page) => target.locator('#completion-card').waitFor({ state: 'visible' });
  const waiting = () => page.waitForFunction(() => document.getElementById('submit-status-title')?.textContent.includes('chờ kết nối'));
  const retryVisible = () => page.locator('#submit-homework').waitFor({ state: 'visible' });
  try {
    await task({ page, context, fixture, record, open, completed, sent, waiting, retryVisible });
    assert.deepEqual(errors, []); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    results.push({ name: `L${lesson.number}/${width}: ${name}`, outcome: 'passed' });
  } catch (error) {
    results.push({ name: `L${lesson.number}/${width}: ${name}`, outcome: 'failed', error: error.message });
    await page.screenshot({ path: join(output, `failed-${results.length}.png`), fullPage: true }).catch(() => {});
  } finally { await context.close(); await fixture.close(); }
}
try {
  for (const lesson of selected) {
    for (const width of [390, 768, 1440]) await run('đủ phần tự nộp không bấm nút; reload giữ receipt', lesson, width, async ({ page, record, open, completed, sent }) => {
      const proofPart = lesson.number === 6 ? lesson.parts[1] : lesson.parts[0];
      const first = record.links.get(proofPart); first.question_count = 0; first.evidence = { acceptanceBasis: 'chatbot_completion', recoveryId: 'fixture' };
      await open(); await completed(); assert.equal(sent().length, 1); assert.equal(sent()[0].body.manualSubmit, undefined);
      assert.equal(await page.locator('#change-student').isDisabled(), false, 'Nộp xong vẫn đổi người được');
      assert.match(await page.locator(`#${proofPart}-result`).innerText(), /Chatbot đã xác nhận/);
      await open(); await completed(); assert.equal(sent().length, 1);
      if (lesson.number === 8) await page.locator('#completion-card').screenshot({ path: join(output, `success-${width}.png`) });
    });
    for (const target of [...lesson.parts.map(part => ({ part })), ...(lesson.number >= 4 ? [1, 2].map(slot => ({ slot })) : [])]) {
      await run(`phần cuối ${target.part || 'bổ trợ ' + target.slot} mới nộp`, lesson, 390, async ({ page, open, completed, sent }) => {
        await open(); await settle(); assert.equal(sent().length, 0);
        await page.locator(`#${target.part || 'practice-' + target.slot}-confirm`).click(); await completed(); assert.equal(sent().length, 1);
      }, r => { if (target.part) r.links.get(target.part).check_status = 'pending'; else r.practice.get(target.slot).status = 'pending'; });
    }
  }
  for (const lesson of selected.filter(l => [2, 3, 8].includes(l.number))) {
    await run('đang nộp khóa sửa và đổi người', lesson, 390, async ({ page, open, completed }) => {
      let release; const gate = new Promise(r => { release = r; });
      await page.route('**/__api/finish', async route => { await gate; await route.continue(); });
      await open(); await page.waitForFunction(() => document.getElementById('ready-submit-card')?.getAttribute('aria-busy') === 'true');
      assert.match(await page.locator('#submit-status-title').innerText(), /Đang nộp/);
      assert.equal(await page.locator('#submit-homework').isVisible(), false); assert.equal(await page.locator('#change-student').isDisabled(), true);
      assert.equal(await page.locator(`#${lesson.parts[0]}-link`).isDisabled(), true);
      await page.locator('#ready-submit-card').screenshot({ path: join(output, `sending-L${lesson.number}.png`) }); release(); await completed();
    });
    await run('mất mạng trước ghi, đọc lại rồi thử sau 15 giây', lesson, 390, async ({ page, open, completed, sent, waiting }) => {
      let attempts = 0; await page.route('**/__api/finish', route => ++attempts === 1 ? route.abort('connectionfailed') : route.continue());
      await open(); await waiting(); await page.clock.fastForward(15_001); await completed(); assert.equal(attempts, 2); assert.equal(sent().length, 1);
    });
    await run('đã lưu nhưng mất phản hồi không gửi lần hai', lesson, 1440, async ({ page, record, open, completed }) => {
      let attempts = 0; await page.route('**/__api/finish', route => { attempts++; record.submitted = true; return route.abort('connectionfailed'); });
      await open(); await completed(); await page.clock.fastForward(120_000); assert.equal(attempts, 1);
    });
    await run('mất mạng kéo dài dừng hữu hạn; nút thử lại phục hồi', lesson, 390, async ({ page, open, completed, sent, waiting, retryVisible }) => {
      let offline = false, attempts = 0;
      await page.route('**/__api/finish', route => { attempts++; offline = true; return route.abort('connectionfailed'); });
      await page.route('**/__api/open', route => offline ? route.abort('connectionfailed') : route.continue());
      await open(); await waiting(); await page.clock.fastForward(15_001); await settle(); await page.clock.fastForward(30_001); await retryVisible();
      assert.equal(attempts, 1); await page.clock.fastForward(120_000); assert.equal(attempts, 1);
      offline = false; await page.unroute('**/__api/finish'); await page.locator('#submit-homework').click(); await completed(); assert.equal(sent().length, 1);
    });
    await run('409 giữ lỗi nghiệp vụ và không tự thử', lesson, 390, async ({ page, open, retryVisible }) => {
      let attempts = 0; await page.route('**/__api/finish', route => { attempts++; return route.fulfill({ status: 409, json: { ok: false, message: 'Phần cuối cần xác minh lại.' } }); });
      await open(); await retryVisible(); assert.match(await page.locator('#submit-status-message').innerText(), /Phần cuối cần xác minh lại/);
      await page.clock.fastForward(120_000); assert.equal(attempts, 1);
    });
    await run('200 thiếu biên nhận không báo thành công', lesson, 390, async ({ page, open, waiting, retryVisible }) => {
      let attempts = 0; await page.route('**/__api/finish', route => { attempts++; return route.fulfill({ json: { ok: true } }); });
      await open(); await waiting(); await page.clock.fastForward(15_001); await settle(); await page.clock.fastForward(30_001); await retryVisible();
      assert.equal(attempts, 3); assert.equal(await page.locator('#completion-card').isVisible(), false);
    });
    await run('429 tôn trọng thời gian máy chủ', lesson, 390, async ({ page, open, completed, waiting }) => {
      let attempts = 0; await page.route('**/__api/finish', route => ++attempts === 1 ? route.fulfill({ status: 429, headers: { 'retry-after': '45' }, json: { ok: false } }) : route.continue());
      await open(); await waiting(); await page.clock.fastForward(15_001); await settle(); assert.equal(attempts, 1);
      await page.clock.fastForward(30_001); await completed(); assert.equal(attempts, 2);
    });
    await run('polling công nhận phần cuối cũng tự nộp', lesson, 390, async ({ page, record, open, completed, sent }) => {
      await open(); assert.equal(sent().length, 0); record.links.get(lesson.parts[0]).check_status = 'accepted';
      await page.clock.fastForward(15_001); await completed(); assert.equal(sent().length, 1);
    }, r => { r.links.get(lesson.parts[0]).check_status = 'pending'; });
    await run('hai tab cùng nộp, mỗi tab chỉ gửi một lần', lesson, 1440, async ({ page, context, fixture, open, completed, sent }) => {
      const other = await context.newPage(); let release, attempts = 0; const gate = new Promise(r => { release = r; });
      await context.route('**/__api/finish', async route => { if (++attempts === 2) release(); await gate; await route.continue(); });
      await open();
      // Tab hai dùng danh tính đã nhớ từ tab một, không chọn lại trong lúc tự nhận diện.
      await other.goto(`${fixture.origin}/speaking-homework/${lesson.file}`);
      await Promise.all([completed(), completed(other)]); assert.equal(sent().length, 2);
    });
    await run('Doctor tạm lỗi không chặn các phần đã công nhận', lesson, 390, async ({ page, open, completed, sent }) => {
      await page.route('**/__api/doctor/list', route => route.fulfill({ status: 503, json: { ok: false } }));
      await open(); await completed(); assert.equal(sent().length, 1);
    });
    await run('đổi người trong thời gian chờ không nộp phiên cũ', lesson, 390, async ({ page, open, waiting, fixture }) => {
      let attempts = 0; await page.route('**/__api/finish', route => { attempts++; return route.abort('connectionfailed'); });
      await open(); await waiting(); await page.locator('#change-student').click();
      await page.locator('#class-select').selectOption('IC2304'); await page.locator('#student-select').selectOption(learners[1]);
      await page.locator('#open-homework').click(); await page.locator('#homework-content').waitFor({ state: 'visible' });
      await page.clock.fastForward(120_000); await settle(); assert.equal(attempts, 1);
      assert.equal(fixture.requests.findLast(r => r.path === '/session/start-selected').body.studentRef, learners[1]);
      assert.equal(await page.locator('#completion-card').isVisible(), false);
    });
    await run('phản hồi draft cũ về sau receipt không làm lùi trạng thái', lesson, 390, async ({ page, record, open, completed }) => {
      let releaseSend, releaseRead, openCalls = 0, staleStarted;
      const sendGate = new Promise(r => { releaseSend = r; }), readGate = new Promise(r => { releaseRead = r; });
      const started = new Promise(r => { staleStarted = r; });
      await page.route('**/__api/finish', async route => { await sendGate; await route.continue(); });
      await page.route('**/__api/open', async route => {
        if (++openCalls === 1) return route.continue();
        const snapshot = { ok: true, status: 'draft', receipt: null, links: [...record.links.values()], practiceLinks: [...record.practice.values()] };
        staleStarted(); await readGate; await route.fulfill({ json: snapshot });
      });
      await open(); await page.clock.fastForward(15_001); await started;
      releaseSend(); await completed(); releaseRead(); await settle();
      assert.equal(await page.locator('#completion-card').isVisible(), true);
    }, r => { r.links.get(lesson.parts[0]).analysis_status = 'pending'; });
  }
} finally { await browser.close(); await writeFile(join(output, 'auto-submit.json'), JSON.stringify(results, null, 2), 'utf8'); }
console.log(JSON.stringify({ tests: results.length, passed: results.filter(r => r.outcome === 'passed').length, failures: results.filter(r => r.outcome === 'failed') }));
if (results.some(r => r.outcome === 'failed')) process.exitCode = 1;

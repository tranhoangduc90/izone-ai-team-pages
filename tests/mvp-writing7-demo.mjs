import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// Kiểm hành trình thực trong trình duyệt: điều hướng, nội dung, màn hẹp và kết quả.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = (process.env.MVP_DEMO_URL || 'http://127.0.0.1:8797/').replace(/\/$/, '') + '/';
const qa = process.env.MVP_DEMO_QA_DIR || path.resolve('output/playwright/mvp-writing7');
let browser;
let stepCount;
const title = page => page.locator('#screen-title').innerText();
const open = async (suffix = '#buoc=1', width = 1440) => {
  const page = await browser.newPage({viewport:{width,height:900}});
  await page.goto(base + suffix);
  await page.locator('#screen-title').waitFor();
  return page;
};
before(async () => {
  await mkdir(qa, {recursive:true});
  browser = await chromium.launch({headless:true,channel:'chrome'});
  const page = await open();
  stepCount = await page.locator('#step-select option').count();
  await page.close();
});
after(async () => { if (browser) await browser.close(); });

test('Đi trọn Next và trở lại bằng Previous giữ đúng thứ tự và đủ đầu ra', async () => {
  const page = await open();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  assert.ok(stepCount >= 25, 'Hành trình cần các bước nhỏ, không chỉ vài trang tổng hợp.');
  assert.equal(await page.locator('#previous').isDisabled(), true);
  const visited = [];
  const content = [];
  for (let i = 0; i < stepCount; i++) {
    visited.push(await title(page));
    content.push(await page.locator('#screen-body').innerText());
    assert.equal(await page.locator('#step-count').innerText(), `${i+1} / ${stepCount}`);
    for (const id of ['student-note','teacher-note','ai-note','outcome']) {
      assert.ok((await page.locator('#'+id).innerText()).length > 12, `Thiếu vai trò ở bước ${i+1}.`);
    }
    if (i < stepCount - 1) await page.locator('#next').click();
  }
  assert.equal(await page.locator('#next').isDisabled(), true);
  const all = content.join('\n');
  for (const key of ['Dàn ý toàn bài','Thân bài 2','Điền ngôn ngữ','Homework','Điểm Task 2','TR','CC','Nhận xét và giải thích','Bản chỉnh']) {
    assert.ok(all.includes(key), `Thiếu nội dung đầu cuối: ${key}`);
  }
  assert.ok(all.includes('giả định') || all.includes('minh họa'));
  for (let i = stepCount - 2; i >= 0; i--) {
    await page.locator('#previous').click();
    assert.equal(await title(page), visited[i]);
  }
  assert.equal(await page.locator('#previous').isDisabled(), true);
  assert.deepEqual(errors, []);
  await page.screenshot({path:path.join(qa,'desktop-start.png'),fullPage:true});
  await page.close();
});

test('Các nút trong màn chuyển đúng một bước và không gọi hệ thống chấm thật', async () => {
  const page = await open();
  const requests = [];
  page.on('request', req => requests.push({url:req.url(),method:req.method()}));
  for (let i = 0; i < stepCount - 1; i++) {
    await page.locator('#step-select').selectOption(String(i));
    const action = page.locator('[data-action="next"]');
    if (await action.count()) {
      await action.click();
      assert.equal(await page.locator('#step-count').innerText(), `${i+2} / ${stepCount}`);
    }
  }
  assert.ok(requests.every(r => r.method === 'GET' && new URL(r.url).origin === new URL(base).origin));
  await page.close();
});

test('Dàn ý đủ bốn phần và lớp tám người có việc riêng', async () => {
  const page = await open();
  for (let i = 0; i < stepCount; i++) {
    await page.locator('#step-select').selectOption(String(i));
    const current = await title(page);
    if (current === 'Hoàn thành dàn ý toàn bài') {
      assert.equal(await page.locator('.outline-section').count(),4);
      assert.equal(await page.locator('.chain').count(),4);
      await page.screenshot({path:path.join(qa,'desktop-outline.png'),fullPage:true});
    }
    if (current === 'Trong lúc giảng viên chữa một người') assert.equal(await page.locator('tbody tr').count(),8);
  }
  await page.close();
});

test('Chọn chặng, bàn phím và lịch sử trình duyệt giữ đúng màn', async () => {
  const page = await open();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#step-count').innerText(),`2 / ${stepCount}`);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#step-count').innerText(),`1 / ${stepCount}`);
  await page.locator('[data-chapter="2"]').click();
  assert.equal(await title(page),'Mở homework viết full bài');
  await page.locator('#next').click();
  assert.equal(await title(page),'Viết bản full lần đầu');
  await page.goBack();
  assert.equal(await title(page),'Mở homework viết full bài');
  await page.goForward();
  assert.equal(await title(page),'Viết bản full lần đầu');
  await page.locator('#restart').click();
  assert.equal(await title(page),'Bắt đầu buổi Writing');
  await page.close();
});

test('Deep link và reload tới đúng bước; hash sai về đầu an toàn', async () => {
  const page = await open(`#buoc=${stepCount}`);
  assert.equal(await title(page),'Kết thúc hành trình của buổi học');
  await page.reload();
  assert.equal(await title(page),'Kết thúc hành trình của buổi học');
  for (const value of ['0','-1','9999999999999999999','abc','2%3Cscript%3E']) {
    await page.goto(base + '#buoc=' + value);
    assert.equal(await title(page),'Bắt đầu buổi Writing');
  }
  await page.locator('#next').click();
  assert.ok(page.url().endsWith('#buoc=2'));
  await page.close();
});

test('Điểm được gắn nhãn minh họa; các câu chữa mở đúng nội dung', async () => {
  const page = await open();
  await page.locator('[data-chapter="3"]').click();
  assert.equal(await page.locator('.band').innerText(),'6.5');
  assert.equal(await page.locator('.criterion').count(),4);
  assert.ok((await page.locator('#screen-body').innerText()).includes('Không phải chấm thật'));
  await page.screenshot({path:path.join(qa,'desktop-score.png'),fullPage:true});
  while (await title(page) !== 'Xem từng câu: sửa chỗ nào, vì sao') await page.locator('#next').click();
  await page.locator('[data-sentence="1"]').click();
  assert.ok((await page.locator('#sentence-detail').innerText()).includes('mâu thuẫn với thân bài 2'));
  await page.locator('[data-sentence="2"]').click();
  assert.ok((await page.locator('#sentence-detail').innerText()).includes('Không cần thay'));
  await page.locator('[data-sentence="0"]').click();
  assert.ok((await page.locator('#sentence-detail').innerText()).includes('Will never'));
  await page.screenshot({path:path.join(qa,'desktop-sentence.png'),fullPage:true});
  await page.close();
});

test('Màn 390 px và 360 px đi được mọi bước, không tràn ngang toàn trang', async () => {
  const page = await open('#buoc=1',390);
  for (const width of [390,360]) {
    await page.setViewportSize({width,height:844});
    for (let i = 0; i < stepCount; i++) {
      await page.goto(base + `#buoc=${i+1}`);
      const dimensions = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
      assert.ok(dimensions.scroll <= dimensions.width+1, `Tràn ngang ${width}px ở bước ${i+1}.`);
      assert.equal(await page.locator('#next').isVisible(),true);
      assert.equal(await page.locator('#previous').isVisible(),true);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'#buoc=1');
  await page.screenshot({path:path.join(qa,'mobile-start.png'),fullPage:true});
  await page.locator('[data-chapter="3"]').click();
  await page.screenshot({path:path.join(qa,'mobile-score.png'),fullPage:true});
  await page.close();
});

test('Tài nguyên đúng origin, không có lỗi console hoặc lỗi tải', async () => {
  const page = await browser.newPage();
  const issues = [];
  const requests = [];
  page.on('pageerror', e => issues.push(e.message));
  page.on('console', m => { if(m.type()==='error') issues.push(m.text()); });
  page.on('requestfailed', r => issues.push(r.url()));
  page.on('response', r => { if(r.status()>=400) issues.push(`${r.status()} ${r.url()}`); });
  page.on('request', r => requests.push(r.url()));
  await page.goto(base);
  await page.locator('#screen-title').waitFor();
  await page.locator('[data-chapter="3"]').click();
  await page.locator('#next').click();
  assert.deepEqual(issues,[]);
  assert.ok(requests.every(url => new URL(url).origin===new URL(base).origin));
  await page.close();
});

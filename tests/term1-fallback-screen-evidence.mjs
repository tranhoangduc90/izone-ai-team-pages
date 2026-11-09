import { resolve } from 'node:path';
import assert from 'node:assert/strict';

export async function rosterFixture(browser, studentRef) {
  await browser.context.route('**/api/term-tests/roster?*', route => {
    assert.equal(new URL(route.request().url()).searchParams.get('class'), 'IC5601');
    return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' },
      json: { ok: true, students: [{ ref: studentRef, name: 'Học viên giả' }] } });
  });
}

export async function chooseFallbackLearner(page, studentRef) {
  assert.equal(await page.locator('#activationCode').count(), 0);
  await page.getByRole('textbox', { name: 'Mã lớp' }).fill('ic5601');
  await page.getByRole('button', { name: 'Chọn lớp', exact: true }).click();
  await page.getByRole('combobox', { name: 'Họ và tên' }).selectOption(studentRef);
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
}

export async function captureSkillScreen(page, output, skill, screen) {
  const previous = page.viewportSize();
  try {
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => document.fonts.ready.then(() => true));
      await page.screenshot({ path: resolve(output, `${skill}-fallback-${screen}-${width}.png`) });
    }
  } finally {
    await page.setViewportSize(previous);
  }
}

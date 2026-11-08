import { resolve } from 'node:path';

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

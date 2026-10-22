// Kiểm chữ phương án và control bằng Chrome; không gọi API hoặc dùng dữ liệu lớp thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');

test('Preset Thủy: phương án 16px, radio/checkbox rõ và chọn được ở laptop/điện thoại',async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage();
  const base=await readFile(new URL('../progress-log/styles.css',import.meta.url),'utf8');
  const thuy=(await readFile(new URL('../progress-log/thuy-live/styles.css',import.meta.url),'utf8')).replace(/^@import[^;]+;/u,'');
  try{
    await page.setContent(`<style>${base}\n${thuy}</style><body class="thuy-live thuy-student">
      <label class="choice"><input type="radio" name="single" value="A"><span class="choice-key">A</span><span class="choice-text">Phương án dài bằng tiếng Việt để kiểm việc đọc trên điện thoại.</span></label>
      <label class="choice"><input type="radio" name="single" value="B"><span class="choice-key">B</span><span class="choice-text">Phương án thứ hai.</span></label>
      <label class="choice"><input type="checkbox" name="multiple"><span class="choice-key">A</span><span class="choice-text">Có thể chọn nhiều mục.</span></label></body>`);
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});
      const metrics=await page.locator('.choice').first().evaluate(row=>({fontSize:getComputedStyle(row).fontSize,
        lineHeight:getComputedStyle(row).lineHeight,height:row.getBoundingClientRect().height,
        controlWidth:row.querySelector('input').getBoundingClientRect().width,
        controlOpacity:getComputedStyle(row.querySelector('input')).opacity,
        legacyMarker:getComputedStyle(row.querySelector('.choice-key')).display}));
      assert.equal(metrics.fontSize,'16px');assert.equal(metrics.lineHeight,'24px');
      assert.ok(metrics.height>=48);assert.equal(metrics.controlWidth,18);
      assert.equal(metrics.controlOpacity,'1');assert.equal(metrics.legacyMarker,'none');
      await page.locator('input[value=A]').check();await page.locator('input[value=B]').check();
      assert.equal(await page.locator('input[value=A]').isChecked(),false);
      await page.locator('input[type=checkbox]').check();assert.equal(await page.locator('input[value=B]').isChecked(),true);
      await page.locator('input[type=checkbox]').focus();await page.keyboard.press('Space');
      assert.equal(await page.locator('input[type=checkbox]').isChecked(),false);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
  }finally{await browser.close();}
});

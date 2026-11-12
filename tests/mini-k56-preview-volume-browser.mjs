import assert from 'node:assert/strict';

process.env.K56_FIXTURE_IMPORT_ONLY = '1';
const {fixture, wait} = await import('./term2-offline-browser.mjs');
const f = await fixture('lis_first', {product:'mini'});
try {
  f.controls.r2Audio = true;
  const p = f.page;
  await p.goto(f.url);
  await p.locator(`#bootstrapStudent option[value="${f.student}"]`).waitFor({state:'attached'});
  await p.selectOption('#bootstrapStudent', f.student);
  await p.click('#confirmIdentity');
  await wait(p, () => window.K56_MINI_OFFLINE?.active && document.querySelector('#bootstrapVolume')?.disabled === false,
    'Audio and offline shell prepared', 30000);
  const slider = p.locator('#bootstrapVolume');
  await slider.press('Home');
  await slider.press('ArrowRight');
  await slider.press('ArrowRight');
  assert.equal(await slider.inputValue(), '0.3');
  await p.reload();
  await wait(p, () => window.K56_MINI_OFFLINE?.active && document.querySelector('#bootstrapPreview')?.disabled === false,
    'Restored offline preview', 20000);
  assert.equal(await slider.inputValue(), '0.3', 'The volume selection is shown after reload');
  await p.evaluate(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      HTMLMediaElement.prototype.play = play;
      window.miniPreviewPlayer = this;
      return play.call(this);
    };
  });
  await p.click('#bootstrapPreview');
  await wait(p, () => window.miniPreviewPlayer?.currentTime > 0.2, 'Preview actually playing');
  assert.equal(await p.evaluate(() => window.miniPreviewPlayer.volume), 0.3,
    'The restored preview player must use the volume shown by the slider');
  await wait(p, () => document.querySelector('#bootstrapStart')?.disabled === false, 'Start is available after the preview');
  await p.click('#bootstrapStart');
  await wait(p, () => window.K56_MINI_OFFLINE?.player?.currentTime > 0.2, 'Official audio actually playing');
  assert.equal(await p.evaluate(() => window.K56_MINI_OFFLINE.player.volume), 0.3);
  assert.deepEqual(f.errors, []);
  console.log('PASS restored Mini preview plays at the selected volume of 0.3');
} finally { await f.close(); }

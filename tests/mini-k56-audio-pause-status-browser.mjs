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
  await p.click('#bootstrapPreview');
  await p.click('#bootstrapStart');
  await wait(p, () => window.K56_MINI_OFFLINE?.player?.currentTime > 0.3, 'Official audio playing');
  const stoppedAt = await p.evaluate(async () => {
    const player = window.K56_MINI_OFFLINE.player;
    const pause = new Promise(resolve => player.addEventListener('pause',resolve,{once:true}));
    player.pause();
    await pause;
    player.dispatchEvent(new Event('timeupdate'));
    return player.currentTime;
  });
  assert.match(await p.locator('#listeningView span.cbt-audio-status').textContent(), /Audio đang bị gián đoạn/);
  await p.waitForTimeout(5200);
  const state = await p.evaluate(() => {
    const runtime = window.K56_MINI_OFFLINE;
    const listening = runtime.record.sections.listening;
    return {paused:runtime.player.paused, time:runtime.player.currentTime,
      recordedInterruption:Boolean(listening.interrupted), submitted:Boolean(listening.sealed)};
  });
  assert.deepEqual(state,{paused:true,time:stoppedAt,recordedInterruption:false,submitted:false});
  await p.getByRole('button',{name:'Tôi không nghe được',exact:true}).click();
  await p.locator('#offlineListeningInterrupted[open]').waitFor();
  await wait(p, () => Object.values(window.K56_MINI_OFFLINE?.record.receipts || {})
    .some(row => row.section === 'listening' && row.kind === 'interrupt' && row.status === 'accepted'), 'Interruption confirmed');
  assert.deepEqual(f.errors, []);
  console.log('PASS actual pause stays visible through timeupdate and interruption remains a learner action');
} finally { await f.close(); }

import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

process.env.K56_FIXTURE_IMPORT_ONLY = '1';
const {fixture, wait} = await import('./term2-offline-browser.mjs');
const nativeFile = process.env.K56_MINI_FIXTURE_FILE;
const fullAudio = process.env.MINI_RETRY_FULL_AUDIO === '1';
let nativeFixture, migration;
if (nativeFile) {
  process.env.K56_MINI_FIXTURE_IMPORT_ONLY = '1';
  process.env.MINI_K56_CBT_OFFLINE_NEW = 'true';
  process.env.K56_MINI_HOLD_CLASSES = 'IC5601';
  process.env.K56_MINI_HOLD_HOURS = '24';
  process.env.K56_MINI_HOLD_LIMIT = '100';
  ({fixture:nativeFixture} = await import(pathToFileURL(nativeFile)));
  migration = await readFile(process.env.K56_MINI_RECOVERY_MIGRATION, 'utf8');
}

for (const [mode, reloadWhilePlaying] of [['lis_first',false], ['read_first',false], ['lis_first',true]]) {
  const result = reloadWhilePlaying ? 'a second reload after playback counts as interrupted' : 'reaches the Listening receipt';
  test(`Mini K56 retries a blocked start and ${result} (${mode})`, {timeout: fullAudio ? 540000 : 120000}, async t => {
    const native = await nativeFixture?.(mode, false, {realtime:true, listeningInterruption:true});
    if (native) {
      t.after(() => native.close());
      await native.db.exec('CREATE ROLE k56_shared_api NOLOGIN');
      await native.db.exec(migration);
    }
    const f = await fixture(mode, {product: 'mini', native});
    f.controls.r2Audio = true;
    try {
      const p = f.page;
      await p.goto(f.url);
      await p.locator(`#bootstrapStudent option[value="${f.student}"]`).waitFor({state:'attached'});
      await p.selectOption('#bootstrapStudent', f.student);
      await p.click('#confirmIdentity');
      if (mode === 'read_first') {
        await p.locator('#k56SectionReady:not([hidden]) button').click();
        await p.locator('#readingQuestions [data-number="1"]').fill('fixture reading answer');
        await p.click('#submitReading');
      }
      f.controls.loseAck = true;
      await p.click('#bootstrapPreview');
      await wait(p, () => !document.querySelector('#bootstrapStart').disabled, 'Đã đủ thời gian nghe thử');
      await p.evaluate(() => {
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
          HTMLMediaElement.prototype.play = play;
          return Promise.reject(new DOMException('Fixture blocked first official play', 'NotAllowedError'));
        };
      });
      await p.click('#bootstrapStart');
      const playButton = p.getByRole('button', {name:'Phát audio', exact:true});
      await playButton.waitFor();
      const attempt = await p.evaluate(() => {
        const runtime = window.K56_MINI_OFFLINE;
        return {id:runtime.record.prepared.attemptToken, startedAt:runtime.record.sections.listening.startedAt,
          time:runtime.player.currentTime, paused:runtime.player.paused};
      });
      assert.ok(attempt.startedAt && attempt.paused);
      assert.equal(attempt.time, 0);
      await p.reload();
      await wait(p, () => document.querySelector('#offlineListeningInterrupted[open]') ||
        (window.K56_MINI_OFFLINE?.playerReady && !document.querySelector('.cbt-audio-play')?.hidden), 'Listening recovery', 20000);
      assert.equal(await p.locator('#offlineListeningInterrupted[open]').count(), 0,
        'A rejected play at time zero must not be recorded as interrupted');
      assert.equal(await p.evaluate(() => window.K56_MINI_OFFLINE.player.paused &&
        window.K56_MINI_OFFLINE.player.currentTime === 0), true, 'Reload waits for an explicit play click');
      await playButton.click();
      await wait(p, () => window.K56_MINI_OFFLINE?.player.currentTime > 0.2, 'Cùng lượt phát sau thao tác người học');
      assert.deepEqual(await p.evaluate(() => ({id:window.K56_MINI_OFFLINE.record.prepared.attemptToken,
        startedAt:window.K56_MINI_OFFLINE.record.sections.listening.startedAt})), {id:attempt.id, startedAt:attempt.startedAt});
      if (reloadWhilePlaying) {
        await p.reload();
        await p.locator('#offlineListeningInterrupted[open]').waitFor();
        await wait(p, () => Object.values(window.K56_MINI_OFFLINE?.record.receipts || {})
          .some(row => row.section === 'listening' && row.kind === 'interrupt' && row.status === 'accepted'), 'Đã ghi nhận gián đoạn thật');
        return;
      }
      await p.locator('#listeningQuestions [data-number="1"]').fill('fixture listening answer');
      // Seek only in the fixture, then let the real MP3 reach its native ended event.
      if (!fullAudio) await p.evaluate(() => { const audio = window.K56_MINI_OFFLINE.player; audio.currentTime = audio.duration - 0.7; });
      await wait(p, () => Object.values(window.K56_MINI_OFFLINE?.record.receipts || {})
        .some(row => row.section === 'listening' && row.kind === 'seal' && row.status === 'accepted'),
        'Đọc lại biên nhận Listening', fullAudio ? 480000 : 25000);
      const listening = native ? (await native.db.query(
        'SELECT kind FROM assessment.mini_k56_offline_operation WHERE attempt_id=$1 AND section=\'listening\'', [native.a])).rows
        : [...f.receipts.values()].filter(row => row.section === 'listening');
      assert.equal(listening.filter(row => row.kind === 'start').length, 1);
      assert.equal(listening.filter(row => row.kind === 'interrupt').length, 0);
      assert.equal(listening.filter(row => row.kind === 'seal').length, 1);
      assert.equal(f.controls.ackLost, true);
      assert.deepEqual(f.errors, []);
    } finally {
      await f.close();
    }
  });
}

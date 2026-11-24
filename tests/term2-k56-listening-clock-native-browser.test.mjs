import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
import {pathToFileURL} from 'node:url';

process.env.K56_FIXTURE_IMPORT_ONLY = '1';
const {fixture, wait} = await import('./term2-offline-browser.mjs');
const nativeEntry = process.env.TERM2_NATIVE_RECOVERY_FIXTURE;
const demo = process.env.TERM2_TEST_DEMO === '1';

for (const mode of ['read_first', 'lis_first']) {
  test('Term 2 K56 retries real clock events after transport loss and an offline reload (' + mode + ')',
    {skip: !nativeEntry && 'Requires a captured K56 HTTP runtime with an isolated synthetic database', timeout: 160000}, async t => {
      const {createNativeRecoveryFixture} = await import(pathToFileURL(nativeEntry));
      const native = await createNativeRecoveryFixture();
      t.after(() => native.close());
      const exam = await fixture(mode, {demo, native});
      t.after(() => exam.close());
      const {page} = exam;
      const answer = 'synthetic draft saved across outages';
      const input = page.locator('#listeningQuestions input[data-number]').first();
      const resume = page.getByRole('button', {name:'Nghe tiếp', exact:true});
      const state = () => page.evaluate(() => {
        const run = window.K56_TERM2_OFFLINE;
        const checkpoint = run.record.listeningCheckpoint;
        const duration = run.record.prepared.timing.listeningDurationSeconds * 1000;
        return {scope:run.scope, positionMs:checkpoint.positionMs, remainingMs:duration-checkpoint.positionMs,
          resumeCount:checkpoint.resumeCount, interruptionId:checkpoint.interruption?.id,
          pending:run.record.listeningClockSync?.pending.map(row => ({operationId:row.operationId, phase:row.phase,
            positionMs:row.positionMs, remainingMs:row.remainingMs, interruptionId:row.interruptionId, playerId:row.playerId})),
          revision:run.record.listeningClockSync?.revision ?? 0, review:run.record.listeningClockSync?.review,
          paused:run.player.paused, actualPosition:run.player.currentTime, rate:run.player.playbackRate};
      });
      async function offline(value) {
        exam.disconnected = value;
        await exam.context.setOffline(value);
      }
      exam.controls.dropClockAckOnce = new Set(['paused','running']);
      await page.goto(exam.url);
      await page.locator('#bootstrapStudent option[value="' + exam.student + '"]').waitFor({state:'attached'});
      await page.selectOption('#bootstrapStudent', exam.student);
      await page.click('#confirmIdentity');
      await wait(page, () => window.K56_TERM2_OFFLINE?.record?.ready, 'Real K56 prepare and cached shell', 45000);
      assert.equal(await page.evaluate(() => window.K56_TERM2_OFFLINE.listeningRecoveryEnabled),true);
      if (mode === 'read_first') {
        await page.getByRole('button',{name:'Bắt đầu Reading',exact:true}).click();
        await page.locator('#readingQuestions input[data-number]').first().fill('A');
        await page.click('#submitReading');
      }
      await page.click('#bootstrapPreview');
      await page.click('#bootstrapStart',{timeout:45000});
      await wait(page, () => window.K56_TERM2_OFFLINE?.player?.currentTime > 11, 'Normal 1× playback beyond 10 seconds', 25000);
      await wait(page, () => window.K56_TERM2_OFFLINE.pending === 0, 'Accepted start receipt');
      assert.equal(exam.controls.nativeClockRequests?.length ?? 0,0);

      await page.evaluate(() => {
        const run = window.K56_TERM2_OFFLINE;
        const observe = run.observe;
        run.observe = function (action, details) {
          if (action === 'audio_anomaly') window.fixtureListeningAnomaly = details;
          return observe.call(this, action, details);
        };
      });
      await offline(true);
      await input.fill(answer);
      await page.evaluate(() => window.K56_TERM2_OFFLINE.player.pause());
      await resume.waitFor();
      const paused = await state();
      const pause = await page.evaluate(() => window.fixtureListeningAnomaly);
      assert.equal(pause.source, 'unknown');
      const progress = pause.previous.filter(row => row.action === 'audio_progress_sample');
      assert.ok(progress.length >= 6 && progress.length <= 11);
      assert.ok(progress.every(row => row.rate === 1 && row.positionMs <= pause.positionMs));
      assert.equal(paused.pending.length,1);
      assert.equal(paused.pending[0].phase,'paused');
      await page.reload({waitUntil:'domcontentloaded'});
      await resume.waitFor({timeout:30000});
      const reloaded = await state();
      assert.equal(await input.inputValue(),answer);
      assert.deepEqual(reloaded.scope,paused.scope);
      assert.deepEqual(reloaded.pending,paused.pending);
      assert.equal(reloaded.positionMs,paused.positionMs);
      assert.equal(reloaded.remainingMs,paused.remainingMs);
      assert.equal(reloaded.paused,true);
      assert.equal(exam.controls.nativeClockRequests?.length ?? 0,0);

      await resume.click();
      await wait(page, () => {
        const run = window.K56_TERM2_OFFLINE;
        return run.record.listeningCheckpoint?.resumeCount === 1 && !run.player.paused && run.player.playbackRate === 1;
      }, 'Verified recovery while offline');
      const verified = await state();
      assert.equal(verified.revision,0);
      assert.equal(verified.rate,1);
      assert.equal(verified.pending[1].phase,'running');
      assert.equal(verified.pending[1].interruptionId,paused.interruptionId);
      assert.ok(verified.pending[1].positionMs > paused.positionMs);
      assert.ok(verified.pending[1].positionMs - paused.positionMs <= 1500);
      await page.waitForFunction(position => window.K56_TERM2_OFFLINE.record.listeningCheckpoint?.positionMs > position,
        verified.positionMs, {timeout:6000});
      const unfrozen = await state();
      assert.ok(unfrozen.remainingMs < verified.remainingMs);
      assert.equal(exam.controls.nativeClockRequests?.length ?? 0,0);

      await page.reload({waitUntil:'domcontentloaded'});
      await resume.waitFor({timeout:30000});
      const secondHold = await state();
      assert.equal(await input.inputValue(),answer);
      assert.equal(secondHold.resumeCount,1);
      assert.ok(secondHold.positionMs >= unfrozen.positionMs);
      assert.ok(secondHold.remainingMs <= unfrozen.remainingMs);
      assert.deepEqual(secondHold.pending.map(row => row.phase),['paused','running','paused']);
      assert.equal(secondHold.paused,true);

      await offline(false);
      await wait(page, () => window.K56_TERM2_OFFLINE?.record?.listeningClockSync?.pending.length === 0,
        'Real API receipts reach the browser after reconnect', 25000);
      await wait(page, () => window.K56_TERM2_OFFLINE.pending === 0, 'Draft operations acknowledged', 25000);
      const final = await state();
      const stored = await native.read(final.scope);
      assert.equal(final.review,undefined);
      assert.equal(final.revision,3);
      assert.equal(final.positionMs,secondHold.positionMs);
      assert.equal(final.remainingMs,secondHold.remainingMs);
      assert.equal(stored.clock.revision,3);
      assert.equal(stored.clock.snapshot.positionMs,final.positionMs);
      assert.equal(stored.clock.snapshot.remainingMs,final.remainingMs);
      assert.equal(stored.clock.snapshot.resumeCount,1);
      assert.equal(stored.session.listening_submitted_at,null);
      assert.ok(Object.values(stored.session.listening_draft).includes(answer));
      assert.deepEqual(stored.events.map(row=>row.operationId),secondHold.pending.map(row=>row.operationId));
      assert.deepEqual(stored.events.map(row=>row.playerId),secondHold.pending.map(row=>row.playerId));
      assert.notEqual(stored.events[0].playerId,stored.events[1].playerId);
      const requests = exam.controls.nativeClockRequests;
      for (const event of stored.events.slice(0,2)) {
        const sent = requests.filter(row=>row.body.operationId===event.operationId);
        assert.equal(sent.length,2);
        assert.deepEqual(sent[0].body,sent[1].body);
        assert.deepEqual(sent.map(row=>row.receipt),[event,event]);
      }
      assert.equal(requests.length,5);
      assert.deepEqual(exam.errors,[]);
      const evidence = process.env.TERM2_EVIDENCE;
      if (evidence) await writeFile(resolve(evidence,mode+'-native-clock-readback.json'),
        JSON.stringify({mode,demo,normalPlaybackClockRequests:0,paused,pauseHistorySamples:progress,reloaded,verified,unfrozen,secondHold,final,stored,
          HTTPStatuses:requests.map(row=>row.status)},null,2));
    });
}

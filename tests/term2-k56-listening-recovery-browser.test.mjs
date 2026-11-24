import assert from 'node:assert/strict';
import test from 'node:test';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

process.env.K56_FIXTURE_IMPORT_ONLY = '1';
const {fixture, wait} = await import('./term2-offline-browser.mjs');
const term1 = process.env.TERM1_RECOVERY_TEST === '1';
const demo = (term1 ? process.env.TERM1_FIXTURE_DEMO : process.env.TERM2_TEST_DEMO) === '1';
const evidenceDir = term1 ? process.env.TERM1_EVIDENCE : process.env.TERM2_EVIDENCE;
const product = term1 ? 1 : 2;
const stopAtIncidentPosition = !term1 && process.env.TERM2_TEST_INCIDENT_POSITION === '1';

async function clockFixture() {
  const entry = !term1 && process.env.TERM2_CLOCK_MODULE;
  if (!entry) return null;
  const server = await import(pathToFileURL(entry).href);
  const {PGlite} = await import(pathToFileURL(process.env.TERM2_CLOCK_PGLITE_ENTRY).href);
  const db = new PGlite();
  await db.exec('CREATE SCHEMA assessment; CREATE TABLE assessment.term2_offline_run (attempt_id uuid PRIMARY KEY, state jsonb NOT NULL);' + server.clockSchema);
  let run;
  const requests = [];
  return {
    requests,
    async start(attemptId, startedAt) {
      run = {attempt_id: attemptId, generation: 0, state:{listeningRecoveryVersion:1,listening:{startedAt}}};
      await db.query('INSERT INTO assessment.term2_offline_run VALUES ($1,$2::jsonb)',[attemptId,JSON.stringify(run.state)]);
    },
    async commit(body) {
      requests.push(body);
      return db.transaction(async client => {
        await client.query('SELECT * FROM assessment.term2_offline_run WHERE attempt_id=$1 FOR UPDATE',[body.attemptToken]);
        return server.commitListeningClock(client,{run:run||{state:{listeningRecoveryVersion:1}},durationMs:1824000,
          attempt:{attempt_token:body.attemptToken,attempt_mode:'cbt',server_now:new Date().toISOString()},
          operation:server.parseClockOperation(body)});
      });
    },
    async read() {
      const clock=(await db.query('SELECT revision,snapshot FROM assessment.term2_offline_listening_clock WHERE attempt_id=$1',[run.attempt_id])).rows[0];
      const receipts=(await db.query('SELECT receipt FROM assessment.term2_offline_listening_clock_operation WHERE attempt_id=$1 ORDER BY received_at',[run.attempt_id])).rows;
      return {clock,receipts};
    },
    close: () => db.close()
  };
}

async function openListening(exam, mode) {
  exam.controls.r2Audio = true;
  exam.controls.listeningReportsEnabled = true;
  exam.controls.listeningRecoveryEnabled = true;
  exam.controls.preparedOverride = {[term1 ? 'term1ParallelEntry' : 'term2ParallelEntry']: true};
  const {page} = exam;
  await page.goto(exam.url);
  await page.locator('#bootstrapStudent option[value="' + exam.student + '"]').waitFor({state: 'attached'});
  await page.selectOption('#bootstrapStudent', exam.student);
  await page.click('#confirmIdentity');
  await wait(page, () => (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE)?.active, 'Exam prepared');
  if (mode === 'read_first') {
    await page.getByRole('button', {name: 'Bắt đầu Reading', exact: true}).click();
    await page.locator('#readingQuestions input[data-number]').first().fill('Reading checkpoint');
    await page.click('#submitReading');
  }
  await page.click('#bootstrapPreview');
  await page.click('#bootstrapStart', {timeout: 45000});
  await wait(page, () => (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE)?.player?.currentTime > 0.6, 'First verified playback');
}

for (const mode of ['read_first','lis_first']) {
  test('Term ' + product + ' K56 freezes, resumes at the saved checkpoint and opens the existing report (' + mode + ')',
    {timeout: stopAtIncidentPosition ? 200000 : 150000}, async () => {
      const exam = await fixture(mode, {demo, headed: process.env.TERM2_TEST_HEADED === '1', legacyExit: !term1, product});
      const {page} = exam;
      const nativeClock = await clockFixture();
      if (nativeClock) {
        exam.controls.listeningClock = nativeClock;
        exam.controls.dropClockPauseAckOnce = true;
      }
      const milestones = {};
      const answer = 'Giữ đáp án khi dừng';
      const answerInput = page.locator('#listeningQuestions input[data-number]').first();
      const resume = page.getByRole('button', {name: 'Nghe tiếp', exact: true});
      const checkpoint = () => page.evaluate(() => (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).record.listeningCheckpoint);
      try {
        await openListening(exam, mode);
        await answerInput.fill(answer);
        if (stopAtIncidentPosition) {
          milestones.beforeStop = await page.evaluate(async () => {
            const runtime = (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE);
            const audio = runtime.player;
            const source = audio.getAttribute('src');
            await new Promise((resolve,reject) => {
              const until = performance.now() + 66000;
              function sample() {
                if (audio.paused || runtime.record.listeningCheckpoint?.interruption || performance.now() > until) {
                  reject(Error('Audio did not advance without interruption to the reference position.'));
                } else if (audio.currentTime >= 53.122) resolve();
                else requestAnimationFrame(sample);
              }
              sample();
            });
            const proof = {positionMs: Math.round(audio.currentTime * 1000), playbackRate: audio.playbackRate,
              mediaReadyState: audio.readyState, samePlayer: audio === runtime.player && source === audio.getAttribute('src')};
            audio.pause();
            return proof;
          });
          assert.ok(milestones.beforeStop.positionMs >= 53122 && milestones.beforeStop.positionMs <= 53222);
          assert.equal(milestones.beforeStop.playbackRate,1);
          assert.equal(milestones.beforeStop.samePlayer,true);
          assert.equal(milestones.beforeStop.mediaReadyState,4);
        } else await page.evaluate(() => (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).player.pause());
        await resume.waitFor();
        const notice = page.locator('.cbt-listening-recovery-state');
        await notice.getByText(/Âm thanh vừa bị dừng vì vấn đề/).waitFor();
        milestones.paused = await checkpoint();
        if (stopAtIncidentPosition) assert.ok(Math.abs(milestones.paused.positionMs - milestones.beforeStop.positionMs) < 100);
        const heldTime = await notice.innerText();
        await page.waitForTimeout(550);
        assert.equal(await notice.innerText(), heldTime);

        await wait(page, () => !(window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).criticalSaves, 'Draft saved before reload');
        if (term1) await page.evaluate(() => { window.TERM_TEST_ALLOW_NAVIGATION = true; });
        await page.reload({waitUntil: 'domcontentloaded'});
        await resume.waitFor({timeout: 35000});
        assert.equal(await answerInput.inputValue(), answer);
        assert.equal(await page.evaluate(() => (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).player.paused), true);
        assert.equal((await checkpoint()).positionMs, milestones.paused.positionMs);

        await resume.click();
        await wait(page, () => (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).record.listeningCheckpoint?.resumeCount === 1
          && !(window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).player.paused, 'First verified recovery');
        milestones.first = await checkpoint();

        await page.evaluate(() => {
          const audio = (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).player;
          audio.currentTime += 30;
        });
        await resume.waitFor();
        milestones.seek = await checkpoint();
        assert.equal(milestones.seek.interruption.reason, 'unexpected_seek');
        assert.ok(milestones.seek.positionMs < milestones.first.positionMs + 2000);
        await resume.click();
        await wait(page, () => (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).record.listeningCheckpoint?.resumeCount === 2
          && !(window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).player.paused, 'Second verified recovery');

        await page.evaluate(() => { (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).player.playbackRate = 1.75; });
        const report = page.getByRole('dialog', {name: 'Báo lỗi âm thanh'});
        await report.getByText(/Âm thanh gặp sự cố và không thể nghe tiếp/).waitFor();
        await report.getByText(/Bài thi listening cần được nghe liền mạch/).waitFor();
        milestones.unavailable = await checkpoint();
        assert.equal(milestones.unavailable.interruption.reason, 'resume_limit_reached');
        assert.equal(await answerInput.inputValue(), answer);
        assert.equal(await page.evaluate(() => Boolean((window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).record.sections.listening.interrupted)), false);
        if (evidenceDir) await page.screenshot({path: resolve(evidenceDir, mode + '-recovery-report.png')});
        await report.getByRole('button', {name: 'Tôi không nghe thấy âm thanh', exact: true}).click();
        await page.getByRole('button', {name: /Tôi đã hiểu\. Đến phần thi tiếp theo/}).click();
        await (mode === 'read_first' ? page.locator('#startWriting') : page.locator('#k56SectionReady button')).waitFor();
        await wait(page, () => !(window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).pending, 'Interruption receipt stored');
        const listeningReceipts = [...exam.receipts.values()].filter(row => row.section === 'listening');
        assert.equal(listeningReceipts.filter(row => row.kind === 'interrupt').length, 1);
        assert.equal(listeningReceipts.filter(row => row.kind === 'seal').length, 0);
        const final = await page.evaluate(() => {
          const runtime = (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE);
          return {nextSection: runtime.sectionResponse().nextSection,
            playerRetired: !runtime.player && !window.K56_LISTENING_AUDIO,
            diagnostics: runtime.record.submissionDiagnostics || runtime.diagnostics || []};
        });
        assert.equal(final.nextSection, mode === 'read_first' ? 'writing' : 'reading');
        assert.equal(final.playerRetired, true);
        if (nativeClock) {
          await wait(page, () => !(window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).record.listeningClockSync.pending.length, 'Committed clock receipts');
          const native = await nativeClock.read();
          const current = native.clock.snapshot;
          assert.equal(current.phase, 'paused');
          assert.equal(current.positionMs, milestones.unavailable.positionMs);
          assert.equal(current.remainingMs, 1824000 - milestones.unavailable.positionMs);
          assert.equal(current.resumeCount, 2);
          const operationId = exam.controls.clockPauseAckDropped;
          const attempts = nativeClock.requests.filter(row => row.operationId === operationId);
          assert.ok(attempts.length >= 2);
          assert.deepEqual(attempts[0],attempts[1]);
          assert.equal(native.receipts.filter(row => row.receipt.operationId === operationId).length, 1);
          final.nativeClock = {current, revision:native.clock.revision, retriedOperationId:operationId,
            attemptCount:attempts.length, deduplicated:true};
        }
        assert.ok(final.diagnostics.some(row => row.action === 'listening_report_auto_open_requested'));
        assert.deepEqual(exam.errors, []);
        if (evidenceDir) await writeFile(resolve(evidenceDir, mode + '-recovery-result.json'),
          JSON.stringify({mode, demo, milestones, ...final}, null, 2));
      } finally {
        await exam.close();
        await nativeClock?.close();
      }
    });

  test('Term ' + product + ' K56 keeps a failed resume at the saved position and opens the report (' + mode + ')',
    {timeout: 90000}, async () => {
      const exam = await fixture(mode, {demo, product});
      const {page} = exam;
      try {
        await openListening(exam, mode);
        const input = page.locator('#listeningQuestions input[data-number]').first();
        await input.fill('Nháp thử khi Nghe tiếp thất bại');
        const held = await page.evaluate(async () => {
          const runtime = (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE);
          const audio = runtime.player;
          audio.pause();
          await new Promise(done => audio.addEventListener('pause', done, {once:true}));
          audio.play = () => Promise.reject(new DOMException('Fixture audio failed', 'NotSupportedError'));
          return runtime.record.listeningCheckpoint.positionMs;
        });
        await page.getByRole('button',{name:'Nghe tiếp',exact:true}).click();
        const report = page.getByRole('dialog',{name:'Báo lỗi âm thanh'});
        await report.getByText(/Âm thanh gặp sự cố và không thể nghe tiếp/).waitFor();
        const stopped = await page.evaluate(() => {
          const runtime = (window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE);
          const {positionMs, resumeCount, interruption} = runtime.record.listeningCheckpoint;
          return {positionMs,resumeCount,reason:interruption.reason,paused:runtime.player.paused,
            next:runtime.sectionResponse().nextSection};
        });
        assert.deepEqual(stopped, {positionMs:held,resumeCount:0,reason:'resume_media_failed',paused:true,next:'listening'});
        assert.equal(await input.inputValue(),'Nháp thử khi Nghe tiếp thất bại');
        assert.equal([...exam.receipts.values()].filter(row=>row.section==='listening'&&['seal','interrupt'].includes(row.kind)).length,0);
        assert.deepEqual(exam.errors,[]);
      } finally { await exam.close(); }
    });
}

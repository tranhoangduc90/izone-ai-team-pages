import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';

process.env.K56_FIXTURE_IMPORT_ONLY = '1';
const {fixture, wait} = await import('./term2-offline-browser.mjs');
const demo = process.env.TERM2_TEST_DEMO === '1';
const headed = process.env.TERM2_TEST_HEADED === '1';

const guardRequested = page => page.evaluate(() => {
  const event = new Event('beforeunload', {cancelable: true});
  window.dispatchEvent(event);
  return event.defaultPrevented;
});

async function readPlayerJournal(path) {
  const deadline = Date.now() + 15000;
  let batches;
  do {
    const lines = (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean);
    batches = lines.map(line => JSON.parse(line));
    const details = batches.flatMap(batch => batch.rows.map(event => ({
      ...event.data.checkpointState, identityConfirmed: batch.identityConfirmed, bindingId: batch.bindingId, batchId: batch.batchId,
    })));
    if (details.some(row => row.action === 'audio_player_retired') &&
        details.some(row => row.action === 'audio_late_play_blocked')) return details;
    await new Promise(resolve => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  assert.fail(`Player cleanup or blocked callback absent from ${batches.length} sealed Collector fixture batches`);
}

async function startListening(exam, mode, answer, afterStart) {
  const {page} = exam;
  exam.controls.r2Audio = true;
  exam.controls.listeningReportsEnabled = true;
  exam.controls.preparedOverride = {term2ParallelEntry: true};
  exam.controls.beforeUnloadSpies = [];
  await page.goto('about:blank');
  await page.goto(exam.url);
  await page.locator(`#bootstrapStudent option[value="${exam.student}"]`).waitFor({state: 'attached'});
  await page.selectOption('#bootstrapStudent', exam.student);
  await page.click('#confirmIdentity');
  await wait(page, () => window.K56_TERM2_OFFLINE?.active, 'Prepared fixture');
  if (mode === 'read_first') {
    await page.getByRole('button', {name: 'Bắt đầu Reading', exact: true}).click();
    await page.locator('#readingQuestions input[data-number]').first().fill('Reading draft');
    await page.click('#submitReading');
  }
  await page.click('#bootstrapPreview', {timeout: 45000});
  const preview = await page.evaluateHandle(() =>
    [...document.querySelectorAll('audio')].find(audio => audio.getAttribute('src')?.endsWith('#t=0,30')));
  await page.click('#bootstrapStart', {timeout: 45000});
  await afterStart?.(page);
  await wait(page, () => window.K56_TERM2_OFFLINE?.player?.currentTime > 0.5, 'Listening playing');
  const previewReleased = await preview.evaluate(audio => Boolean(audio?.paused && !audio.hasAttribute('src') &&
    !audio.isConnected && audio.readyState === 0));
  await preview.dispose();
  assert.equal(previewReleased, true, 'The player used for hearing the sample must release its source');
  await page.locator('#listeningQuestions input[data-number]').first().fill(answer);
}

async function verifyStayInListening(exam, answer) {
  const {page} = exam;
  exam.controls.beforeUnloadDecision = 'stay';
  const expected = ['close', 'reload', 'back'];
  const observed = [];
  const step = {
    back: () => page.evaluate(() => history.back()),
    reload: () => page.reload({waitUntil: 'commit', timeout: 5000}),
    close: () => page.close({runBeforeUnload: true}),
  };
  for (const action of expected) {
    const guardState = await page.evaluate(() => {
      const event = new Event('beforeunload', {cancelable: true});
      window.dispatchEvent(event);
      return {requested: event.defaultPrevented, active: navigator.userActivation.hasBeenActive,
        appReady: window.TERM_TEST_LEAVE_GUARD_READY, navigationAllowed: Boolean(window.TERM_TEST_ALLOW_NAVIGATION),
        historyLength: history.length};
    });
    const prompt = page.waitForEvent('dialog', {predicate: value => value.type() === 'beforeunload', timeout: 6000});
    const navigation = step[action]().catch(error => {
      if (action === 'close' || !/ERR_ABORTED|Timeout/.test(error.message)) throw error;
    });
    try { await Promise.all([prompt, navigation]); }
    catch (error) { throw new Error(`No native ${action} confirmation: ${JSON.stringify(guardState)}`, {cause: error}); }
    assert.equal(page.isClosed(), false, action);
    await wait(page, () => {
      const audio = window.K56_TERM2_OFFLINE?.player;
      return audio && !audio.paused && !window.K56_TERM2_OFFLINE.record.sections.listening.interrupted;
    }, `Stayed in Listening after ${action}`, 3000);
    assert.equal(await page.locator('#listeningQuestions input[data-number]').first().inputValue(), answer);
    observed.push(action);
  }
  assert.equal(exam.controls.beforeUnloadSpies.length, expected.length);
  return observed;
}

async function verifyListeningSeal(exam, mode, audio, answer) {
  const {page} = exam;
  await wait(page, () => {
    const runtime = window.K56_TERM2_OFFLINE;
    return runtime.record.sections.listening?.sealed && !runtime.pending;
  }, 'Listening seal and receipt', 12000);
  await (mode === 'read_first' ? page.locator('#startWriting') : page.locator('#startReading')).waitFor();
  const result = await page.evaluate(() => {
    const runtime = window.K56_TERM2_OFFLINE;
    const {listening} = runtime.record.sections;
    return {answerValues: Object.values(JSON.parse(listening.content).answers), interrupted: Boolean(listening.interrupted),
      player: {...runtime.record.player}, next: runtime.sectionResponse().nextSection};
  });
  const retired = await audio.evaluate(element => ({paused: element.paused, attached: element.isConnected,
    source: element.hasAttribute('src') || Boolean(element.srcObject || element.querySelector('source')), readyState: element.readyState}));
  assert.deepEqual(retired, {paused: true, attached: false, source: false, readyState: 0});
  assert.ok(result.answerValues.includes(answer));
  assert.equal(result.interrupted, false);
  assert.equal(result.next, mode === 'read_first' ? 'writing' : 'reading');
  const receipts = [...exam.receipts.values()].filter(receipt => receipt.section === 'listening' && receipt.kind === 'seal');
  assert.equal(receipts.length, 1);
  assert.deepEqual(exam.errors, []);
  return {mode, ended: result.player.ended, position: result.player.position, retired, next: result.next, receipt: receipts[0].receiptId};
}

for (const mode of ['read_first', 'lis_first']) {
  test(`Term 2 K56 requires a user retry when autoplay is blocked at zero (${mode})`, {timeout: 90000}, async () => {
    const exam = await fixture(mode, {product: 2, defaultAutoplay: true, demo});
    const {page} = exam;
    try {
      await page.addInitScript(() => {
        const nativePlay = HTMLMediaElement.prototype.play;
        let blocked = false;
        HTMLMediaElement.prototype.play = function (...args) {
          if (!blocked && window.K56_TERM2_OFFLINE?.player === this && this.currentTime === 0) {
            blocked = true;
            return Promise.reject(new DOMException('Browser autoplay policy fixture', 'NotAllowedError'));
          }
          return nativePlay.apply(this, args);
        };
      });
      const answer = `Autoplay retry draft (${mode})`;
      await startListening(exam, mode, answer, async page => {
        const retry = page.getByRole('button', {name: 'Phát audio', exact: true});
        await retry.waitFor();
        const blocked = await page.evaluate(() => {
          const runtime = window.K56_TERM2_OFFLINE;
          return {paused: runtime.player.paused, position: runtime.player.currentTime,
            interrupted: Boolean(runtime.record.sections.listening.interrupted)};
        });
        assert.deepEqual(blocked, {paused: true, position: 0, interrupted: false});
        await retry.click();
        await retry.waitFor({state: 'hidden'});
      });
      const result = await page.evaluate(() => {
        const runtime = window.K56_TERM2_OFFLINE;
        return (runtime.record.submissionDiagnostics || runtime.diagnostics || []).filter(row =>
          row.action === 'audio_command' && row.command === 'play' || row.action === 'audio_command_result' && row.errorCode === 'NotAllowedError');
      });
      const start = result.find(row => row.reason === 'exam_start');
      assert.ok(result.some(row => row.commandId === start?.commandId && row.errorCode === 'NotAllowedError'));
      assert.ok(result.some(row => row.reason === 'retry_initial_play'));
      assert.deepEqual(exam.errors, []);
      if (process.env.TERM2_EVIDENCE) await writeFile(resolve(process.env.TERM2_EVIDENCE, `${mode}-autoplay-retry.json`),
        JSON.stringify({mode, pendingBeforeExplicitClick: true, resumedAtZero: true, result}, null, 2));
    } finally {
      await exam.close();
    }
  });
  test(`Term 2 K56 keeps the same Listening source during network and tab transitions (${mode})`, {timeout: 90000}, async () => {
    const exam = await fixture(mode, {product: 2, defaultAutoplay: true, demo, headed});
    const {page} = exam;
    const answer = `Network and tab Listening draft (${mode})`;
    try {
      await startListening(exam, mode, answer);
      const before = await page.evaluate(() => {
        const runtime = window.K56_TERM2_OFFLINE;
        const player = runtime.player;
        const source = player.getAttribute('src');
        window.verifyListeningPlayer = () => runtime.player === player && source === player.getAttribute('src');
        const rows = runtime.record.submissionDiagnostics || runtime.diagnostics || [];
        const playerId = rows.findLast(row => row.action === 'audio_command' && row.reason === 'exam_start')?.playerId;
        return {position: player.currentTime, playerId,
          lastSequence: rows.filter(row => row.playerId === playerId).at(-1)?.sequence};
      });
      assert.ok(before.playerId);
      assert.ok(Number.isInteger(before.lastSequence));
      await exam.context.setOffline(true);
      await wait(page, () => !navigator.onLine, 'Browser observed network loss');
      const next = await exam.context.newPage();
      await next.bringToFront();
      const visibility = await page.evaluate(() => document.visibilityState);
      await page.evaluate(() => {
        window.K56_TERM2_OFFLINE.player.dispatchEvent(new Event('waiting'));
      });
      await page.waitForFunction(position => window.K56_TERM2_OFFLINE.player.currentTime >= position + 2, before.position);
      await page.bringToFront();
      await next.close();
      await exam.context.setOffline(false);
      await wait(page, () => navigator.onLine, 'Browser observed network return');
      const after = await page.evaluate(({playerId, lastSequence}) => {
        const runtime = window.K56_TERM2_OFFLINE;
        const player = runtime.player;
        const rows = runtime.record.submissionDiagnostics || runtime.diagnostics || [];
        const during = rows.filter(row => row.playerId === playerId && row.sequence > lastSequence);
        return {same: window.verifyListeningPlayer(), position: player.currentTime, rate: player.playbackRate,
          paused: player.paused, events: during.map(({action, command, reason, event}) => ({action, command, reason, event})),
          interrupted: Boolean(runtime.record.sections.listening.interrupted)};
      }, before);
      assert.equal(after.same, true);
      assert.equal(after.rate, 1);
      assert.equal(after.paused, false);
      assert.equal(after.interrupted, false);
      assert.deepEqual(after.events.filter(row => ['audio_command', 'audio_anomaly'].includes(row.action)), []);
      assert.equal(await page.locator('#listeningQuestions input[data-number]').first().inputValue(), answer);
      assert.deepEqual(exam.errors, []);
      if (process.env.TERM2_EVIDENCE) await writeFile(resolve(process.env.TERM2_EVIDENCE, `${mode}-network-tab-listening.json`),
        JSON.stringify({mode, headed, visibilityWhileAway: visibility, before, after, draftKept: true}, null, 2));
    } finally {
      await exam.close();
    }
  });
  test(`Term 2 K56 recovers a failed local interruption write and a lost receipt ACK (${mode})`, {timeout: 120000}, async () => {
    const exam = await fixture(mode, {product: 2, defaultAutoplay: true, demo});
    const {page} = exam;
    const answer = `Preserved during interruption retry (${mode})`;
    try {
      await startListening(exam, mode, answer);
      const report = page.getByRole('button', {name: 'Báo lỗi âm thanh', exact: true});
      const noSound = page.getByRole('button', {name: 'Tôi không nghe thấy âm thanh', exact: true});
      const retry = page.locator('.cbt-audio-status').filter({
        hasText: 'Chưa lưu được trạng thái gián đoạn. Hãy bấm Báo lỗi âm thanh để thử lưu lại.',
      });
      await page.evaluate(() => window.K56_TERM2_OFFLINE.player.pause());
      await report.click();
      await page.getByRole('button', {name: 'Cancel', exact: true}).click();
      assert.equal(await page.evaluate(() => window.K56_TERM2_OFFLINE.player.paused), true);
      assert.equal(await page.locator('#listeningQuestions input[data-number]').first().inputValue(), answer);
      await page.evaluate(() => {
        const runtime = window.K56_TERM2_OFFLINE;
        const persist = runtime.persist.bind(runtime);
        let blocked = false;
        runtime.persist = async function (...args) {
          if (args[0] === true && runtime.pendingInterruptionId && !blocked) {
            blocked = true;
            throw new Error('Fixture local write failure');
          }
          return persist(...args);
        };
      });
      await report.click();
      await noSound.click();
      await retry.waitFor();
      assert.equal(await guardRequested(page), true);
      assert.equal([...exam.receipts.values()].some(row => row.kind === 'interrupt'), false);
      assert.equal(await page.locator('#listeningQuestions input[data-number]').first().inputValue(), answer);
      await report.waitFor();
      const requests = [];
      page.on('request', request => {
        if (!request.url().endsWith('/offline/operation') && !request.url().endsWith('/offline/status')) return;
        const body = request.postDataJSON();
        requests.push({operationId: body?.operationId, kind: body?.kind, path: new URL(request.url()).pathname});
      });
      exam.controls.loseAck = 'interrupt';
      await report.click();
      await page.getByRole('button', {name: /Tôi đã hiểu\. Đến phần thi tiếp theo/}).click();
      await wait(page, () => window.K56_TERM2_OFFLINE.pending === 0, 'Interruption receipt recovered');
      assert.equal(exam.controls.ackLost, true);
      const receipts = [...exam.receipts.values()].filter(row => row.section === 'listening' && row.kind === 'interrupt');
      assert.equal(receipts.length, 1);
      const operation = receipts[0].operationId;
      assert.ok(requests.filter(row => row.operationId === operation).length > 1);
      assert.equal(new Set(requests.filter(row => row.kind === 'interrupt').map(row => row.operationId)).size, 1);
      const next = await page.evaluate(message => {
        const runtime = window.K56_TERM2_OFFLINE;
        return {skill: runtime.sectionResponse().nextSection, draft: Object.values(runtime.record.snapshot.drafts.listening).includes(message),
          sealed: Boolean(runtime.record.sections.listening.sealed), playerRetired: runtime.player === null};
      }, answer);
      assert.deepEqual(next, {skill: mode === 'read_first' ? 'writing' : 'reading', draft: true, sealed: false, playerRetired: true});
      assert.deepEqual(exam.errors, []);
      if (process.env.TERM2_EVIDENCE) await writeFile(resolve(process.env.TERM2_EVIDENCE, `${mode}-interruption-retry.json`),
        JSON.stringify({mode, storageFailureRecovered: true, lostAckRecovered: true, next, operation, matchingRequests: requests.filter(row => row.operationId === operation)}, null, 2));
    } finally {
      await exam.close();
    }
  });
  if (process.env.TERM2_HARDWARE_MODE === mode) {
    test(`Term 2 K56 records the supervised Bluetooth session (${mode})`, {timeout: 260000}, async () => {
      const evidenceDir = process.env.TERM2_EVIDENCE;
      const zoom = process.env.TERM2_HARDWARE_ZOOM;
      assert.ok(evidenceDir, 'Set TERM2_EVIDENCE to the technical evidence folder');
      assert.ok(['off', 'in_call'].includes(zoom), 'Set TERM2_HARDWARE_ZOOM to the observed setup');
      const exam = await fixture(mode, {headed: true, defaultAutoplay: true});
      const {page} = exam;
      try {
        await startListening(exam, mode, 'Bluetooth technical fixture');
        await page.bringToFront();
        const player = await page.evaluateHandle(() => window.K56_TERM2_OFFLINE.player);
        const samples = [];
        process.stdout.write('Listening is playing. Run the physical Pause and disconnect checks during the next two minutes.\n');
        for (let index = 0; index < 120; index++) {
          samples.push(await player.evaluate(audio => ({
            timestamp: new Date().toISOString(), positionMs: Math.round(audio.currentTime * 1000),
            paused: audio.paused, muted: audio.muted, volume: audio.volume, readyState: audio.readyState,
            visibility: document.visibilityState, isExamPlayer: window.K56_TERM2_OFFLINE?.player === audio,
            attached: audio.isConnected, hasSource: Boolean(audio.srcObject || audio.hasAttribute('src')),
          })));
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        const diagnostics = await page.evaluate(() => {
          const runtime = window.K56_TERM2_OFFLINE;
          return (runtime.record.submissionDiagnostics || runtime.diagnostics || []).filter(row => row.playerId);
        });
        const evidence = {mode, zoom, samples, diagnostics, engine: exam.context.browser().version(),
          userAgent: await page.evaluate(() => navigator.userAgent), pageErrors: exam.errors};
        await writeFile(resolve(evidenceDir, `${mode}-zoom-${zoom}-bluetooth-timeline.json`), JSON.stringify(evidence, null, 2));
        assert.deepEqual(exam.errors, []);
      } finally {
        await exam.close();
      }
    });
  }
  if (process.env.TERM2_TEST_ONLINE === '1') {
    test(`Term 2 K56 protects the online compatibility player through submission (${mode})`, {timeout: 120000}, async () => {
      const exam = await fixture(mode, {product: 2, defaultAutoplay: true});
      const {page} = exam;
      exam.controls.onlineTerm2 = true;
      const answer = 'Online compatibility answer';
      try {
        await page.addInitScript(() => {
          const actions = new Map();
          window.fixtureMediaActions = actions;
          navigator.mediaSession.setActionHandler = (name, handler) => handler ? actions.set(name, handler) : actions.delete(name);
        });
        await page.goto(exam.url);
        await page.locator(`#bootstrapStudent option[value="${exam.student}"]`).waitFor({state: 'attached'});
        await page.selectOption('#bootstrapStudent', exam.student);
        await page.click('#confirmIdentity');
        if (mode === 'read_first') {
          await page.getByRole('button', {name: /^Bắt đầu (bài )?Reading$/}).first().click();
          await page.locator('#readingQuestions input[data-number]').first().fill('Online Reading');
          await page.click('#submitReading');
        }
        await page.click('#bootstrapPreview', {timeout: 45000});
        await page.click('#bootstrapStart', {timeout: 45000});
        await wait(page, () => window.K56_LISTENING_AUDIO?.inspect().phase === 'playing' &&
          window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime > 0.5, 'Online Listening playing');
        await page.locator('#listeningQuestions input[data-number]').first().fill(answer);
        const audio = await page.evaluateHandle(() => window.TERM_TEST_BOOTSTRAP.officialAudioElement);
        const media = await page.evaluate(() => {
          const player = window.TERM_TEST_BOOTSTRAP.officialAudioElement;
          const position = player.currentTime;
          window.fixtureLateMediaPlay = fixtureMediaActions.get('play');
          for (const handler of fixtureMediaActions.values()) handler();
          return {actions: [...fixtureMediaActions.keys()], position, after: player.currentTime, paused: player.paused};
        });
        assert.equal(media.actions.length, 6);
        assert.equal(media.paused, false);
        assert.ok(Math.abs(media.after - media.position) < 0.2);
        await page.click('#submitListening');
        await (mode === 'read_first' ? page.locator('#startWriting') : page.locator('#startReading')).waitFor();
        assert.equal(exam.controls.onlineListeningSeals.length, 1);
        assert.ok(Object.values(exam.controls.onlineListeningSeals[0].answers).includes(answer));
        const retired = await audio.evaluate(element => {
          window.fixtureLateMediaPlay();
          return {attached: element.isConnected, paused: element.paused, src: element.hasAttribute('src'),
            readyState: element.readyState, activeMediaHandlers: fixtureMediaActions.size};
        });
        assert.deepEqual(retired, {attached: false, paused: true, src: false, readyState: 0, activeMediaHandlers: 0});
        assert.deepEqual(exam.errors, []);
        if (process.env.TERM2_EVIDENCE) await writeFile(resolve(process.env.TERM2_EVIDENCE, `${mode}-online-protection.json`),
          JSON.stringify({mode, submittedOnce: true, media, retired}, null, 2));
      } catch (error) {
        console.error(mode, await page.locator('.notice:visible, #bootstrapNotice').allTextContents(), exam.calls.slice(-14), exam.errors);
        throw error;
      } finally {
        await exam.close();
      }
    });
  }

  test(`Term 2 K56 cancels then confirms early Listening submission (${mode})`, {timeout: 90000}, async () => {
    const exam = await fixture(mode, {product: 2, defaultAutoplay: true, demo});
    const {page} = exam;
    const answer = 'Kept across cancelled submission';
    try {
      await startListening(exam, mode, answer);
      const audio = await page.evaluateHandle(() => window.K56_TERM2_OFFLINE.player);
      const position = await audio.evaluate(element => element.currentTime);
      exam.controls.dismissNextConfirmation = true;
      await page.click('#submitListening');
      assert.equal(await page.locator('#listeningQuestions input[data-number]').first().inputValue(), answer);
      await wait(page, () => !window.K56_TERM2_OFFLINE.player.paused, 'Continued after cancellation');
      assert.equal(await page.evaluate(() => Boolean(window.K56_TERM2_OFFLINE.record.sections.listening.sealed)), false);
      assert.ok(await audio.evaluate((element, previous) => element.currentTime >= previous, position));
      assert.equal(exam.controls.dismissNextConfirmation, false, 'Cancellation must have received the submit confirmation');
      assert.equal(exam.controls.beforeUnloadSpies.length, 0);
      await page.click('#submitListening');
      const evidence = await verifyListeningSeal(exam, mode, audio, answer);
      assert.equal(exam.controls.beforeUnloadSpies.length, 0);
      assert.equal(Boolean(evidence.ended), false);
      if (process.env.TERM2_EVIDENCE) await writeFile(resolve(process.env.TERM2_EVIDENCE, `${mode}-early-seal.json`), JSON.stringify(evidence, null, 2));
    } finally {
      await exam.close();
    }
  });

  if (process.env.TERM2_NATURAL_EOF === '1') {
    test(`Term 2 K56 completes a full natural Listening EOF (${mode})`, {timeout: 2050000}, async () => {
      const exam = await fixture(mode, {product: 2, defaultAutoplay: true, demo});
      const {page} = exam;
      const answer = 'Kept through the full listening recording';
      try {
        const started = Date.now();
        await startListening(exam, mode, answer);
        const audio = await page.evaluateHandle(() => window.K56_TERM2_OFFLINE.player);
        const setup = await audio.evaluate(element => ({position: element.currentTime, duration: element.duration, playbackRate: element.playbackRate}));
        assert.equal(setup.playbackRate, 1);
        assert.ok(setup.position < 3 && setup.duration > 1800);
        const evidenceDir = process.env.TERM2_EVIDENCE;
        if (evidenceDir) await writeFile(resolve(evidenceDir, `${mode}-eof-start.json`), JSON.stringify({
          ...setup, startedAt: new Date(started).toISOString(), pid: process.pid,
          worker: await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
        }, null, 2));
        await wait(page, () => window.K56_TERM2_OFFLINE.record.sections.listening?.sealed, 'Natural end sealed Listening', 1950000);
        const evidence = await verifyListeningSeal(exam, mode, audio, answer);
        assert.equal(evidence.ended, true);
        assert.ok(evidence.position >= setup.duration - 0.5);
        assert.ok(Date.now() - started >= (setup.duration - setup.position) * 1000);
        if (evidenceDir) await writeFile(resolve(evidenceDir, `${mode}-eof-result.json`), JSON.stringify({
          ...evidence, startPosition: setup.position, duration: setup.duration, playbackRate: setup.playbackRate,
          elapsedMs: Date.now() - started,
        }, null, 2));
      } finally {
        await exam.close();
      }
    });
  }

  test(`Term 2 K56 ignores synthetic ended and seals genuine browser EOF near the end (${mode})`, {timeout: 90000}, async () => {
    const exam = await fixture(mode, {product: 2, defaultAutoplay: true, demo});
    const {page} = exam;
    const answer = 'Kept when genuine EOF seals';
    try {
      await startListening(exam, mode, answer);
      const audio = await page.evaluateHandle(() => window.K56_TERM2_OFFLINE.player);
      await audio.evaluate(element => element.dispatchEvent(new Event('ended')));
      assert.equal(await page.evaluate(() => Boolean(window.K56_TERM2_OFFLINE.record.sections.listening.sealed)), false);
      await audio.evaluate(element => { element.currentTime = element.duration - 0.8; });
      const evidence = await verifyListeningSeal(exam, mode, audio, answer);
      assert.ok(evidence.position > 1820);
      assert.equal(evidence.ended, true);
      if (process.env.TERM2_EVIDENCE) await writeFile(resolve(process.env.TERM2_EVIDENCE, `${mode}-near-eof.json`), JSON.stringify(evidence, null, 2));
    } finally {
      await exam.close();
    }
  });

  test(`Term 2 K56 retains the Listening draft and retires its player (${mode})`, {timeout: 120000}, async () => {
    const exam = await fixture(mode, {product: 2, defaultAutoplay: true, demo, headed});
    const {page} = exam;
    const answer = `Draft retained (${mode})`;
    try {
      const journalFile = process.env.TERM2_FILE_JOURNAL === '1' &&
        resolve(process.env.TERM2_EVIDENCE, `${mode}-collector-acknowledged.jsonl`);
      if (journalFile) {
        await writeFile(journalFile, '');
        exam.controls.journalBatchFile = journalFile;
        exam.controls.failFirstPlayerAnomalyBatch = process.env.TERM2_FAIL_JOURNAL_ONCE === '1';
      }
      await startListening(exam, mode, answer);
      const stayedAfter = await verifyStayInListening(exam, answer);
      const audio = await page.evaluateHandle(() => window.K56_TERM2_OFFLINE.player);
      const queuedPlay = await page.evaluateHandle(() => window.K56_LISTENING_AUDIO.play);
      const interruptionPosition = await audio.evaluate(async element => {
        const sought = new Promise(resolve => element.addEventListener('seeked', resolve, {once: true}));
        element.currentTime = 53.122;
        element.pause();
        await sought;
        return element.currentTime;
      });
      assert.ok(Math.abs(interruptionPosition - 53.122) < 0.5);
      await page.getByRole('button', {name: 'Báo lỗi âm thanh', exact: true}).click();
      await page.getByRole('button', {name: 'Tôi không nghe thấy âm thanh', exact: true}).click();
      await page.getByRole('button', {name: /Tôi đã hiểu\. Đến phần thi tiếp theo/}).click();
      await (mode === 'read_first' ? page.locator('#startWriting') : page.locator('#k56SectionReady button')).waitFor();
      await wait(page, () => window.K56_TERM2_OFFLINE.pending === 0, 'Interruption synchronized');
      const lateCallback = await queuedPlay.evaluate(play => play('fixture_late_start')
        .then(() => 'played', error => error.name));
      assert.equal(lateCallback, 'AbortError');

      const record = await page.evaluate(() => {
        const runtime = window.K56_TERM2_OFFLINE;
        const {sections, snapshot, submissionDiagnostics} = runtime.record;
        const diagnostics = (submissionDiagnostics || runtime.diagnostics || []).filter(row => row.playerId);
        return {draft: snapshot.drafts.listening, listening: sections.listening, diagnostics};
      });
      const player = await audio.evaluate(async element => {
        const before = {
          attached: element.isConnected, paused: element.paused,
          hasSource: Boolean(element.srcObject || element.hasAttribute('src') || element.querySelector('source')),
          position: element.currentTime, readyState: element.readyState,
        };
        const latePlay = await Promise.race([
          element.play().then(() => 'resolved', error => error.name),
          new Promise(resolve => setTimeout(() => resolve('no_media_started'), 1200)),
        ]);
        return {...before, latePlay, latePosition: element.currentTime};
      });
      const diagnostics = journalFile ? await readPlayerJournal(journalFile) : record.diagnostics;
      const receipts = Array.from(exam.receipts.values()).filter(receipt => receipt.section === 'listening');
      const proof = {
        mode, worker: await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL), interruptionPosition,
        draftKept: Object.values(record.draft).includes(answer), interrupted: record.listening.interrupted,
        sealed: Boolean(record.listening.sealed), player, stayedAfter, lateCallback, headed,
        nativePrompts: exam.controls.beforeUnloadSpies, browserLocale: await page.evaluate(() => navigator.language),
        receipts: receipts.map(({operationId, kind, section}) => ({operationId, kind, section})),
        journal: {source: journalFile ? 'sealed-collector-fixture' : 'browser-queue', diagnostics},
        pageErrors: exam.errors,
      };
      if (process.env.TERM2_EVIDENCE) {
        await writeFile(resolve(process.env.TERM2_EVIDENCE, `${mode}-listening-exit.json`), JSON.stringify(proof, null, 2));
      }
      assert.equal(proof.draftKept, true);
      assert.equal(proof.interrupted, true);
      assert.equal(proof.sealed, false);
      assert.equal(receipts.filter(receipt => receipt.kind === 'interrupt').length, 1);
      assert.deepEqual(exam.errors, []);
      assert.equal(player.hasSource, false, 'The retired Listening element kept a source');
      assert.equal(player.attached, false, 'The retired Listening element remained attached');
      assert.equal(player.readyState, 0, 'The retired player kept buffered media');
      assert.notEqual(player.latePlay, 'resolved', 'The retired Listening element started playing');
      assert.equal(player.paused, true);
      assert.equal(player.latePosition, player.position, 'The retired audio timeline advanced');
      const commands = diagnostics.filter(row => row.action === 'audio_command');
      const start = commands.find(row => row.command === 'play' && row.reason === 'exam_start');
      const pause = diagnostics.find(row => row.action === 'audio_anomaly' && row.event === 'pause');
      const disposal = diagnostics.find(row => row.action === 'audio_player_retired');
      const blocked = diagnostics.find(row => row.action === 'audio_late_play_blocked' && row.reason === 'fixture_late_start');
      assert.ok(start && pause && disposal && blocked, 'Expected start, observed pause, cleanup and blocked callback in the fixture journal');
      if (journalFile) {
        assert.ok([start, pause, disposal, blocked].every(row => row.identityConfirmed && row.bindingId === start.bindingId));
        if (exam.controls.failFirstPlayerAnomalyBatch) {
          assert.ok(exam.controls.failedJournalBatch, 'The simulated Collector failure was not exercised');
          assert.equal(pause.batchId, exam.controls.failedJournalBatch, 'Collector retry changed the sealed batch');
        }
      }
      assert.equal(pause.source, 'unknown');
      assert.equal(start.playerId, pause.playerId);
      assert.equal(start.playerId, disposal.playerId);
      assert.ok(start.sequence < pause.sequence && pause.sequence < disposal.sequence);
      assert.ok(disposal.sequence < blocked.sequence);
      assert.equal(blocked.playerId, disposal.playerId);
      assert.equal(blocked.disposalId, disposal.disposalId);
      assert.equal(disposal.operationId, receipts.find(receipt => receipt.kind === 'interrupt').operationId);
      assert.equal(disposal.fromSkill, 'listening');
      assert.equal(disposal.nextSkill, mode === 'read_first' ? 'writing' : 'reading');
      assert.equal(disposal.callbacksAborted, true);
      assert.equal(disposal.handlersRegistered, disposal.handlersReleased);
      assert.equal(disposal.sourceCleared, true);
      const source = commands.find(row => row.command === 'set_source' && row.reason === 'prepare_verified_audio' && row.playerId === start.playerId);
      const preview = commands.find(row => row.command === 'play' && row.reason === 'user_preview');
      assert.ok(source && source.sequence < start.sequence, 'Source assignment must be recorded before official playback');
      assert.equal(preview?.playerRole, 'listening_preview');
      assert.notEqual(preview.playerId, start.playerId, 'The preview and exam must have separate player identifiers');
    } catch (error) {
      const status = await page.locator('.notice:visible, #bootstrapNotice, #securePrepTitle').allTextContents().catch(() => []);
      console.error(mode, {status, calls: exam.calls, pageErrors: exam.errors});
      throw error;
    } finally {
      await exam.close();
    }
  });

  for (const action of ['reload', 'back', 'close']) {
    test(`Term 2 K56 restores the same draft after accepting ${action} (${mode})`, {timeout: 90000}, async () => {
      const exam = await fixture(mode, {product: 2, defaultAutoplay: true});
      const {page} = exam;
      const answer = `Draft before ${action} (${mode})`;
      try {
        await startListening(exam, mode, answer);
        const scope = await page.evaluate(() => window.K56_TERM2_OFFLINE.scope);
        const prompt = page.waitForEvent('dialog', {predicate: value => value.type() === 'beforeunload', timeout: 8000});
        exam.controls.beforeUnloadDecision = 'leave';
        let reopened = page;
        if (action === 'close') {
          await Promise.all([prompt, page.waitForEvent('close'), page.close({runBeforeUnload: true})]);
          reopened = await exam.context.newPage();
          await reopened.goto(exam.url);
        } else if (action === 'back') {
          await Promise.all([prompt, page.waitForURL('about:blank'), page.evaluate(() => history.back())]);
          await reopened.goto(exam.url);
        } else {
          await Promise.all([prompt, page.reload()]);
        }
        await reopened.getByRole('dialog', {name: 'Listening gián đoạn'}).waitFor();
        const restored = await reopened.evaluate(() => {
          const {scope, record} = window.K56_TERM2_OFFLINE;
          return {scope, draft: record.snapshot.drafts.listening, section: record.sections.listening};
        });
        assert.deepEqual(restored.scope, scope);
        assert.ok(Object.values(restored.draft).includes(answer));
        assert.equal(restored.section.interrupted, true);
        assert.equal(Boolean(restored.section.sealed), false);
        assert.equal(exam.controls.beforeUnloadSpies.length, 1);
        assert.equal(exam.controls.beforeUnloadSpies[0].decision, 'leave');
        await wait(reopened, () => window.K56_TERM2_OFFLINE.pending === 0, 'Restored interruption synchronized');
        assert.equal(Array.from(exam.receipts.values()).filter(row => row.kind === 'interrupt').length, 1);
        if (process.env.TERM2_EVIDENCE) {
          await writeFile(resolve(process.env.TERM2_EVIDENCE, `${mode}-${action}-leave.json`), JSON.stringify({
            mode, action, restoredSameScope: true, draftKept: true, interrupted: true,
            acknowledgedByFixture: true, dialog: exam.controls.beforeUnloadSpies[0],
          }, null, 2));
        }
      } finally {
        await exam.close();
      }
    });
  }
}

test('Term 2 K56 scopes the leave guard to active exam skills', {timeout: 90000}, async () => {
  const exam = await fixture('read_first', {product: 2, defaultAutoplay: true});
  const {page} = exam;
  try {
    exam.controls.r2Audio = true;
    exam.controls.preparedOverride = {term2ParallelEntry: true};
    exam.controls.beforeUnloadSpies = [];
    await page.goto(exam.url);
    await page.locator(`#bootstrapStudent option[value="${exam.student}"]`).waitFor({state: 'attached'});
    const states = {studentSelect: await guardRequested(page)};
    await page.selectOption('#bootstrapStudent', exam.student);
    await page.click('#confirmIdentity');
    const reading = page.getByRole('button', {name: 'Bắt đầu Reading', exact: true});
    await reading.waitFor();
    states.readingReady = await guardRequested(page);
    await reading.click();
    await page.locator('#readingQuestions input[data-number]').first().fill('Guard test Reading draft');
    states.readingActive = await guardRequested(page);
    await page.click('#submitReading');
    await page.locator('#bootstrapPreview').waitFor();
    states.listeningReady = await guardRequested(page);
    await page.click('#bootstrapPreview');
    await page.click('#bootstrapStart');
    await wait(page, () => window.K56_TERM2_OFFLINE?.player?.currentTime > 0.5, 'Guard test Listening playing');
    states.listeningActive = await guardRequested(page);
    await page.click('#submitListening');
    await page.locator('#startWriting').waitFor();
    states.writingReady = await guardRequested(page);
    await page.click('#startWriting');
    await page.locator('[data-writing-task="task1"]').waitFor();
    states.writingActive = await guardRequested(page);
    await page.click('#submitWriting');
    await wait(page, () => window.K56_TERM2_OFFLINE.record.sections.writing?.sealed, 'Guard test submitted Writing');
    states.result = await guardRequested(page);
    assert.deepEqual(states, {studentSelect: false, readingReady: false, readingActive: true,
      listeningReady: false, listeningActive: true, writingReady: false, writingActive: true, result: false});
    assert.equal(exam.controls.beforeUnloadSpies.length, 0);
    assert.deepEqual(exam.errors, []);
    if (process.env.TERM2_EVIDENCE) await writeFile(resolve(process.env.TERM2_EVIDENCE, 'read-first-guard-states.json'),
      JSON.stringify(states, null, 2));
  } finally {
    await exam.close();
  }
});

test('Term 2 K56 observes a real browser media decode failure without sealing Listening', {timeout: 90000}, async () => {
  const exam = await fixture('read_first', {product: 2, defaultAutoplay: true});
  const {page} = exam;
  const answer = 'Keep my draft after a media decoder error';
  try {
    await startListening(exam, 'read_first', answer);
    const corrupted = await page.evaluate(() => {
      const player = window.K56_TERM2_OFFLINE.player;
      const url = URL.createObjectURL(new Blob(['Fixture invalid MP3 stream'], {type: 'audio/mpeg'}));
      return new Promise(resolve => {
        player.addEventListener('error', event => {
          URL.revokeObjectURL(url);
          resolve({code: player.error?.code, trusted: event.isTrusted});
        }, {once: true});
        player.src = url;
      });
    });
    assert.ok(corrupted.code > 0);
    assert.equal(corrupted.trusted, true);
    await page.locator('.cbt-audio-status').filter({hasText: 'Audio bị gián đoạn.'}).waitFor();
    assert.equal(await page.locator('#listeningQuestions input[data-number]').first().inputValue(), answer);
    const evidence = await page.evaluate(() => {
      const runtime = window.K56_TERM2_OFFLINE;
      const rows = runtime.record.submissionDiagnostics || runtime.diagnostics || [];
      return {event: rows.findLast(row => row.event === 'error' && row.state?.mediaErrorCode > 0),
        sealed: Boolean(runtime.record.sections.listening.sealed)};
    });
    assert.equal(evidence.event?.state.mediaErrorCode, corrupted.code);
    assert.equal(evidence.sealed, false);
    assert.equal([...exam.receipts.values()].some(row => row.section === 'listening' && row.kind === 'seal'), false);
    assert.deepEqual(exam.errors, []);
    if (process.env.TERM2_EVIDENCE) await writeFile(resolve(process.env.TERM2_EVIDENCE, 'real-decode-failure.json'),
      JSON.stringify({corrupted, event: evidence.event, draftKept: true, listeningSealed: false}, null, 2));
  } finally {
    await exam.close();
  }
});

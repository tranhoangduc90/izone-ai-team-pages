import assert from 'node:assert/strict';
import test from 'node:test';

process.env.K56_FIXTURE_IMPORT_ONLY = '1';
const { fixture, wait } = await import('./term2-offline-browser.mjs');

for (const [product, name, runtimeKey] of [[1, 'Term 1', 'K56_TERM1_OFFLINE'], [2, 'Term 2', 'K56_TERM2_OFFLINE'], ['mini', 'Mini', 'K56_MINI_OFFLINE']]) {
  for (const mode of ['lis_first', 'read_first']) {
    test(`${name} K56 CBT ${mode}: dùng audio nạp trước, khóa gián đoạn offline và chuyển kỹ năng`, { timeout: 150000 }, async () => {
      const f = await fixture(mode, { product, defaultAutoplay: true });
      const p = f.page;
      try {
        await p.goto(f.url);
        await p.locator('#bootstrapStudent option[value="' + f.student + '"]').waitFor({ state: 'attached' });
        await p.selectOption('#bootstrapStudent', f.student);
        await p.click('#confirmIdentity');
        if (mode === 'read_first') {
          await p.getByRole('button', { name: 'Bắt đầu Reading', exact: true }).first().click();
          await p.locator('#readingQuestions input[data-number]').first().fill('A');
          await p.click('#submitReading');
        }
        await wait(p, () => [...document.querySelectorAll('audio')].some(audio => audio.preload === 'auto' && audio.src.startsWith('blob:') && audio.readyState >= 3), 'Audio chính đã nạp trước');
        assert.equal(await p.locator('#bootstrapStart').isDisabled(), true);
        await p.evaluate(key => {
          window.fixtureRuntimeKey = key;
          window.fixturePreloadedAudio = [...document.querySelectorAll('audio')].find(audio => audio.preload === 'auto' && audio.src.startsWith('blob:') && audio.readyState >= 3);
        }, runtimeKey);
        await p.click('#bootstrapPreview');
        const downloads = f.controls.audioCalls.length;
        await p.click('#bootstrapStart');
        await wait(p, () => window[window.fixtureRuntimeKey]?.player?.currentTime > 0, 'Audio thi đã chạy');
        assert.equal(await p.evaluate(key => window[key].player === window.fixturePreloadedAudio, runtimeKey), true);
        assert.equal(f.controls.audioCalls.length, downloads);
        f.disconnected = true;
        await f.context.setOffline(true);
        if (mode === 'read_first') await p.reload({ waitUntil: 'domcontentloaded' });
        else await p.getByRole('button', { name: 'Tôi không nghe được', exact: true }).click();
        const confirm = p.getByRole('button', { name: 'Tôi đã hiểu. Đến phần thi tiếp theo.', exact: true });
        await confirm.waitFor();
        const state = await p.evaluate(key => {
          const runtime = window[key];
          const { listeningSubmitted, listeningInterrupted, nextSection, readingStartedAt, writingStartedAt } = runtime.sectionResponse();
          return { attemptToken: runtime.record.prepared.attemptToken, listeningSubmitted, listeningInterrupted, nextSection, readingStartedAt, writingStartedAt,
            operations: runtime.record.operations.map(({ section, kind }) => ({ section, kind })) };
        }, runtimeKey);
        assert.equal(state.listeningSubmitted, false);
        assert.equal(state.listeningInterrupted, true);
        assert.deepEqual(state.operations.filter(op => op.section === 'listening' && op.kind !== 'start'), [{ section: 'listening', kind: 'interrupt' }]);
        const next = mode === 'lis_first' ? 'reading' : 'writing';
        assert.equal(state.nextSection, next);
        assert.equal(state[next + 'StartedAt'], null);
        await confirm.click();
        await p.getByRole('button', { name: next === 'reading' ? 'Bắt đầu Reading' : 'Bắt đầu Writing', exact: true }).first().waitFor();
        f.disconnected = false;
        await f.context.setOffline(false);
        await p.evaluate(key => { window[key].retryAt = 0; return window[key].flush(); }, runtimeKey);
        await p.waitForFunction(key => window[key]?.pending === 0, runtimeKey);
        assert.equal([...f.receipts.values()].filter(receipt => receipt.kind === 'interrupt').length, 1);
        assert.equal([...f.receipts.values()].filter(receipt => receipt.kind === 'seal' && receipt.section === 'listening').length, 0);
        if (mode === 'lis_first') {
          await p.getByRole('button', { name: 'Bắt đầu Reading', exact: true }).first().click();
          await p.locator('#readingQuestions input[data-number]').first().fill('A');
          await p.click('#submitReading');
        }
        await p.click('#startWriting');
        await p.locator('[data-writing-task="' + (product === 2 ? 'task1' : 'task2') + '"]').fill('Fixture essay');
        await p.click('#submitWriting');
        await p.waitForFunction(key => window[key]?.pending === 0 && window[key]?.record.sections.writing?.sealed, runtimeKey);
        f.controls.resultResponse = { ok: true, attemptToken: state.attemptToken, className: 'FIXTURE', studentName: 'Học viên giả',
          listeningInterrupted: true, portalSyncStatus: 'synced', writing: { started: true, submitted: true },
          result: { testTitle: name, listening: null, reading: { correct: 1, total: 10, details: [], typeStats: [] } } };
        await p.click('#viewResult');
        await p.getByText('Gián đoạn · Cần bài thay thế', { exact: true }).waitFor();
        assert.equal(await p.locator('[data-skill-performance="listening"]').count(), 0);
        assert.equal(await p.locator('[data-skill-performance="reading"]').count(), 1);
        assert.deepEqual(f.errors, []);
      } finally { await f.close(); }
    });
  }
}

for (const [product, name, runtimeKey] of [[2, 'Term 2', 'K56_TERM2_OFFLINE'], ['mini', 'Mini', 'K56_MINI_OFFLINE']]) {
  test(`${name} K56 CBT: hủy nộp sớm, audio tiếp tục khi mất callback và hết tệp thu offline`, { timeout: 150000 }, async () => {
    const f = await fixture('lis_first', { product, defaultAutoplay: true });
    const p = f.page;
    try {
      await p.goto(f.url);
      await p.locator('#bootstrapStudent option[value="' + f.student + '"]').waitFor({ state: 'attached' });
      await p.selectOption('#bootstrapStudent', f.student);
      await p.click('#confirmIdentity');
      await p.click('#bootstrapPreview');
      await p.click('#bootstrapStart');
      await p.waitForFunction(key => window[key]?.player?.currentTime > 0, runtimeKey);
      await p.locator('#listeningQuestions input[data-number]').first().fill('A');
      f.controls.dismissNextConfirmation = true;
      await p.click('#submitListening');
      assert.equal(f.controls.dismissNextConfirmation, false);
      assert.equal(await p.evaluate(key => window[key].player.paused, runtimeKey), false);
      f.disconnected = true;
      await f.context.setOffline(true);
      const source = await p.evaluate(key => {
        const audio = window[key].player;
        audio.addEventListener('timeupdate', event => event.stopImmediatePropagation(), true);
        audio.dispatchEvent(new Event('waiting'));
        window.dispatchEvent(new Event('blur'));
        return { url: audio.currentSrc, position: audio.currentTime };
      }, runtimeKey);
      await p.waitForTimeout(6200);
      assert.deepEqual(await p.evaluate(({ key, source }) => {
        const audio = window[key].player;
        return { paused: audio.paused, sourceStable: audio.currentSrc === source.url, advanced: audio.currentTime > source.position + 5 };
      }, { key: runtimeKey, source }), { paused: false, sourceStable: true, advanced: true });
      // Move only the fixture media to the last segment so Chromium dispatches a trusted ended.
      await p.evaluate(key => { const audio = window[key].player; audio.currentTime = audio.duration - 1; }, runtimeKey);
      await p.waitForFunction(key => window[key]?.record.sections.listening?.sealed, runtimeKey);
      const pending = await p.evaluate(key => window[key].record.operations
        .filter(op => op.section === 'listening' && op.kind === 'seal').map(op => op.payload.reason), runtimeKey);
      assert.deepEqual(pending, ['ended']);
      f.disconnected = false;
      await f.context.setOffline(false);
      await p.evaluate(key => { window[key].retryAt = 0; return window[key].flush(); }, runtimeKey);
      await p.waitForFunction(key => window[key]?.pending === 0, runtimeKey);
      assert.equal([...f.receipts.values()].filter(receipt => receipt.kind === 'seal' && receipt.section === 'listening').length, 1);
      assert.deepEqual(f.errors, []);
    } finally { await f.close(); }
  });
}

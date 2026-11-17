import assert from 'node:assert/strict';
import test from 'node:test';

process.env.K56_FIXTURE_IMPORT_ONLY = '1';
const { fixture, wait } = await import('./term2-offline-browser.mjs');

async function startListening(f) {
  const { page } = f;
  await page.goto(f.url);
  await page.locator('#bootstrapStudent option[value="' + f.student + '"]').waitFor({ state: 'attached' });
  await page.selectOption('#bootstrapStudent', f.student);
  await page.click('#confirmIdentity');
  await wait(page, () => window.K56_TERM2_OFFLINE?.record?.ready, 'Verified offline exam ready');
  await page.locator('#bootstrapPreview').click();
  await page.locator('#bootstrapStart').click();
  await wait(page, () => window.K56_TERM2_OFFLINE?.player?.currentTime > 0.8, 'Verified audio at 1×');
}

test('Term Test 2 K56 keeps Listening active when the learner cancels a report at 24:03.72', { timeout: 85_000 }, async () => {
  const f = await fixture('lis_first', { product: 2 });
  const { page } = f;
  f.controls.r2Audio = true;
  f.controls.listeningReportsEnabled = true;
  const operations = [];
  page.on('request', request => {
    if (request.url().endsWith('/offline/operation')) operations.push(request.postDataJSON());
  });
  try {
    await startListening(f);
    const answer = page.locator('#listeningQuestions input[data-number]').first();
    await answer.fill('Synthetic draft at the Part 4 boundary');
    const click = await page.evaluate(async target => {
      const runtime = window.K56_TERM2_OFFLINE;
      const player = runtime.player;
      const button = document.querySelector('.cbt-audio-incident');
      const seeked = new Promise(resolve => player.addEventListener('seeked', resolve, { once: true }));
      player.currentTime = target;
      await seeked;
      const observed = { position: player.currentTime, rate: player.playbackRate, duration: player.duration };
      button.click();
      return observed;
    }, 1443.72);
    assert.ok(Math.abs(click.position - 1443.72) < 0.15, JSON.stringify(click));
    assert.equal(click.rate, 1);
    assert.ok(click.duration >= 1823 && click.duration < 1824);
    const decisions = page.locator('#k67ListeningReportChoices:visible, dialog[open]');
    await decisions.first().waitFor();
    const control = await page.evaluate(() => ({
      dialog: Boolean(document.getElementById('k67ListeningReportChoices')?.open),
      interrupted: Boolean(window.K56_TERM2_OFFLINE.record.sections.listening?.interrupted),
      phases: [...document.querySelectorAll('dialog[open] h2,dialog[open] h3')].map(el => el.textContent),
    }));
    assert.equal(control.dialog, true, JSON.stringify({ click, control, operations: operations.map(event => event.kind) }));
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await answer.inputValue(), 'Synthetic draft at the Part 4 boundary');
    assert.equal(await page.evaluate(() => window.K56_TERM2_OFFLINE.player.paused), false);
    assert.equal(operations.some(event => event.kind === 'interrupt'), false);
    assert.deepEqual(f.errors, []);
  } finally {
    await f.close();
  }
});

const noSound = 'Tôi không nghe thấy âm thanh';
const distortion = 'Tôi nghe thấy âm thanh nhưng bị rè';
const devices = ['Headphone có dây', 'Headphone không dây', 'Loa ngoài'];

test('Term Test 2 K56 interrupts only after one of the four approved confirmations', {
  timeout: 150_000,
}, async t => {
  await Promise.all([noSound, ...devices].map(choice => t.test(choice, async () => {
    const f = await fixture('lis_first', { product: 2 });
    f.controls.r2Audio = true;
    f.controls.listeningReportsEnabled = true;
    const { page } = f;
    try {
      await startListening(f);
      await page.waitForFunction(() => window.K56_TERM2_OFFLINE.player.currentTime >= 1);
      await page.getByRole('button', { name: 'Báo lỗi âm thanh', exact: true }).click();
      const modal = page.locator('#k67ListeningReportChoices');
      assert.deepEqual(await modal.getByRole('button').allTextContents(), [noSound, distortion, 'Cancel']);
      if (choice !== noSound) {
        await modal.getByRole('button', { name: distortion, exact: true }).click();
        assert.deepEqual(await modal.getByRole('button').allTextContents(), devices);
      }
      assert.equal(await page.evaluate(() => window.K56_TERM2_OFFLINE.player.paused), false);
      assert.equal([...f.receipts.values()].some(receipt => receipt.kind === 'interrupt'), false);
      await modal.getByRole('button', { name: choice, exact: true }).click();
      const interruption = page.getByRole('dialog', { name: 'Listening gián đoạn' });
      await interruption.waitFor();
      await wait(page, () => window.K56_TERM2_OFFLINE.pending === 0, 'Recorded interruption acknowledged');
      const receipts = [...f.receipts.values()].filter(receipt => receipt.kind === 'interrupt');
      assert.equal(receipts.length, 1);
      assert.equal(receipts[0].status, 'accepted');
      assert.match(receipts[0].payloadHash, /^[a-f0-9]{64}$/);
      const continueButton = interruption.getByRole('button', { name: 'Tôi đã hiểu. Đến phần thi tiếp theo.', exact: true });
      const point = await continueButton.evaluate(button => {
        const { x, y, width, height } = button.getBoundingClientRect();
        const center = { x: x + width / 2, y: y + height / 2 };
        return { ...center, hittable: !button.disabled && document.elementFromPoint(center.x, center.y) === button };
      });
      assert.equal(point.hittable, true);
      await page.mouse.click(point.x, point.y);
      await page.getByRole('button', { name: /^Bắt đầu (?:bài )?Reading$/ }).first().waitFor();
      assert.deepEqual(f.errors, []);
    } finally {
      await f.close();
    }
  })));
});

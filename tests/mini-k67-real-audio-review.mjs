import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { ASSETS } from '../shared/audio/catalog.mjs';

// A long media check. This deliberately runs outside the exam UI and never submits a grade.
const asset = ASSETS['mini-test-lesson-5'];
const filename = new URL(asset.url).pathname.split('/').at(-1);
const mp3 = await readFile(new URL('../term-tests/k67-audio-assets/' + filename, import.meta.url));
const eofGate = await readFile(new URL('../term-tests/k67-shared/listening-eof.mjs', import.meta.url));
assert.equal(createHash('sha256').update(mp3).digest('hex'), asset.sha256);
const require = createRequire(resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const html = `<!doctype html><audio></audio><script type="module">
import {createListeningEofGate} from '/eof.mjs';
const audio = document.querySelector('audio');
const gate = createListeningEofGate({audio, reviewSeconds: 120});
const state = window.mediaCheck = {startedAt: null, endedAt: null, error: null};
state.read = () => ({startedAt: state.startedAt, endedAt: state.endedAt, error: state.error,
  position: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : null,
  rate: audio.playbackRate, reviewMs: gate.remainingReviewMs(), eligible: gate.canAutoSubmit()});
audio.addEventListener('ratechange', gate.recordRate);
audio.addEventListener('playing', () => { state.startedAt ??= performance.now(); });
audio.addEventListener('ended', event => {
  if (!gate.confirmEnd(event)) state.error = 'Native EOF did not cover the official file';
  else state.endedAt = performance.now();
});
audio.addEventListener('error', () => { state.error = 'Audio decoding failed'; });
try {
  const response = await fetch('/audio.mp3');
  if (!response.ok) throw new Error('File unavailable');
  audio.src = URL.createObjectURL(await response.blob());
  await audio.play();
} catch (error) { state.error = error.message; }
</script>`;
const server = createServer((request, response) => {
  const files = { '/': ['text/html', html], '/eof.mjs': ['text/javascript', eofGate], '/audio.mp3': ['audio/mpeg', mp3] };
  const file = files[request.url];
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': file[0], 'Content-Length': Buffer.byteLength(file[1]) }).end(file[1]);
});
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.mediaCheck?.startedAt || window.mediaCheck?.error, { timeout: 30_000 });
  const stop = Date.now() + 22 * 60_000;
  while (Date.now() < stop) {
    const state = await page.evaluate(() => window.mediaCheck.read());
    console.log(JSON.stringify({ at: new Date().toISOString(), phase: 'media-review', assetSha256: asset.sha256, ...state }));
    assert.equal(state.error, null);
    assert.equal(state.rate, 1);
    if (state.eligible) {
      assert.ok(state.endedAt - state.startedAt >= (state.duration - 1) * 1000);
      assert.ok(Math.abs(state.duration - 972) < 2);
      console.log(JSON.stringify({ outcome: 'passed', scope: 'actual Mini K67 MP3 and 120-second review only' }));
      process.exitCode = 0;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 15_000));
  }
  assert.ok(Date.now() < stop, 'Media review timed out');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

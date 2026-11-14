import assert from 'node:assert/strict';
import test from 'node:test';
import { observeRetakeMedia } from '../term-tests/shared/retake-media-observation-v1.mjs';

test('retake observation distinguishes progressing media, real pause and resumed position', () => {
  const audio = Object.assign(new EventTarget(), { currentTime: 0, paused: false, ended: false });
  const rows = [];
  let inExam = true;
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  const sample = observeRetakeMedia(audio, {
    snapshot: () => ({ lastAdvanceAgeMs: 6000, paused: audio.paused }),
    emit: (action, data) => rows.push({ action, ...data })
  }, () => inExam);
  sample(0);
  audio.currentTime = 5;
  sample(5000);
  assert.equal(rows[0].reason, 'position_advanced_without_callback');
  assert.equal(rows[0].audioAfter.paused, false);
  audio.paused = true;
  audio.dispatchEvent(new Event('pause'));
  sample(10000);
  assert.deepEqual(rows.slice(1).map(row => row.reason), ['media_pause', 'paused']);
  audio.paused = false;
  audio.currentTime = 6;
  sample(11000);
  assert.equal(rows.at(-1).reason, 'position_resumed');
  inExam = false;
  audio.dispatchEvent(new Event('pause'));
  sample(20000);
  assert.equal(rows.length, 4);
});

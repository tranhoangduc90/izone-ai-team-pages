import test from 'node:test';
import assert from 'node:assert/strict';
import { createListeningEofGate } from '../term-tests/k67-shared/listening-eof.mjs';

function fixture({ anchorSeconds = 0, ranges = [[0, 30]], fields = {} } = {}) {
  let clock = 5000;
  const audio = { ended: true, currentTime: 30, duration: 30, playbackRate: 1, ...fields,
    played: { length: ranges.length, start: index => ranges[index][0], end: index => ranges[index][1] } };
  const gate = createListeningEofGate({ audio, anchorSeconds, now: () => clock });
  const event = { type: 'ended', isTrusted: true, currentTarget: audio };
  return { gate, audio, event, advance: ms => { clock += ms; } };
}

test('clock expiry, early events, a bad decoder and a skipped middle cannot start review', () => {
  for (const sample of [fixture({ fields: { currentTime: 28 } }), fixture({ fields: { ended: false } }),
    fixture({ fields: { error: { code: 3 } } }), fixture({ ranges: [[0, 10], [29, 30]] })]) {
    sample.advance(10_000_000);
    assert.equal(sample.gate.confirmEnd(sample.event), false);
    assert.equal(sample.gate.canAutoSubmit(), false);
  }
  const valid = fixture();
  assert.equal(valid.gate.confirmEnd({ ...valid.event, isTrusted: false }), false);
  assert.equal(valid.gate.confirmEnd({ ...valid.event, currentTarget: {} }), false);
  valid.audio.playbackRate = 2;
  valid.gate.recordRate();
  valid.audio.playbackRate = 1;
  assert.equal(valid.gate.confirmEnd(valid.event), false);
});

test('only the whole remaining recording after a verified resume anchor earns the full review interval', () => {
  const resumed = fixture({ anchorSeconds: 19, ranges: [[19, 22], [22.1, 30]] });
  assert.equal(resumed.gate.confirmEnd(resumed.event), true);
  assert.equal(resumed.gate.remainingReviewMs(), 120_000);
  resumed.advance(119_999);
  assert.equal(resumed.gate.canAutoSubmit(), false);
  assert.equal(resumed.gate.confirmEnd(resumed.event), true);
  resumed.advance(1);
  assert.equal(resumed.gate.canAutoSubmit(), true);
});

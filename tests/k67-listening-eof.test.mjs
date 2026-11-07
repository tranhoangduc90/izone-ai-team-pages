import test from 'node:test';
import assert from 'node:assert/strict';
import { createListeningEofGate, createK67EofObserver } from '../term-tests/k67-shared/listening-eof.mjs';

function fixture({ anchorSeconds = 0, ranges = [[0, 30]], fields = {}, observeDecision } = {}) {
  let clock = 5000;
  const audio = { ended: true, currentTime: 30, duration: 30, playbackRate: 1, ...fields,
    played: { length: ranges.length, start: index => ranges[index][0], end: index => ranges[index][1] } };
  const gate = createListeningEofGate({ audio, anchorSeconds, now: () => clock, observeDecision });
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

test('guard exposes exact rejection reasons without starting review or changing acceptance', () => {
  const rows = [];
  const { gate, event, audio } = fixture({ observeDecision: row => rows.push(row) });
  assert.equal(gate.confirmEnd({ ...event, isTrusted: false }), false);
  audio.currentTime = 12;
  assert.equal(gate.confirmEnd(event), false);
  audio.currentTime = 30;
  assert.equal(gate.confirmEnd(event), true);
  assert.equal(gate.confirmEnd(event), true);
  gate.recordReview('review_server', '2026-11-07T23:00:00Z', '2026-11-07T23:02:00Z');
  assert.deepEqual(rows.map(row => row.phase), ['event_unverified','position_short','eof_accepted','review_server']);
  assert.equal(rows.at(-1).reviewDeadlineAt, '2026-11-07T23:02:00.000Z');
  assert.equal(gate.remainingReviewMs(),120000);
});

test('online and offline observer drops repeats and callbacks from replaced players', () => {
  const saved = globalThis.window;
  try {
    const audio = { duration: 30, currentTime: 30, playbackRate: 1, ended: true };
    const owner = { officialAudioElement: audio, examSessionToken: 'fake' };
    const events = [];
    const win = { location: {href:'https://fixture.invalid'}, TERM_TEST_APP_CONFIG: {
      EXAM_JOURNAL_ENABLED: true, API_BASE_URL:'https://fixture.invalid'
    }, TERM_TEST_CONFIG: {slug:'term-test-1'}, TERM_TEST_BOOTSTRAP:owner };
    const registry = new Map([[JSON.stringify(['https://fixture.invalid/api/term-tests/term-test-1','term-test-1']), {
      recordK67ListeningEof(bound, detail) { assert.equal(bound,owner);events.push(detail);return true; }
    }]]);
    win[Symbol.for('izone.examJournal.connections.v1')]=registry;
    globalThis.window=win;
    for (const mode of ['online','offline']) {
      const observe=createK67EofObserver(audio,{mode,owner,configuredDurationSeconds:60});
      observe({phase:'eof_accepted'});
      observe({phase:'eof_accepted'});
      win.TERM_TEST_BOOTSTRAP={officialAudioElement:{}};
      observe({phase:'event_unverified'});
      win.TERM_TEST_BOOTSTRAP=owner;
    }
    assert.deepEqual(events.map(row=>row.mode),['online','offline']);
    assert.ok(events.every(row=>row.configuredDurationSeconds===60&&row.durationSeconds===30));
  } finally { globalThis.window=saved; }
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

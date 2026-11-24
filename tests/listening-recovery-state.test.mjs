import assert from 'node:assert/strict';
import test from 'node:test';
import {ListeningRecoveryState} from '../term-tests/shared/listening-recovery-state-v1.mjs';

const durationMs = 1824000;
const media = (positionMs, at, details = {}) => ({positionMs, at, rate: 1, paused: false, seeking: false, ...details});

function listening() {
  const state = new ListeningRecoveryState({durationMs});
  assert.equal(state.start(media(0, 10000)), true);
  assert.equal(state.sample(media(53000, 63000)), 'advanced');
  return state;
}

function resume(state, startAt) {
  const request = state.beginResume();
  assert.ok(request);
  assert.equal(state.beginResume(), null);
  assert.equal(state.sample(media(request.positionMs + 100, startAt + 100)), 'pending');
  assert.equal(state.resumePlayback(request, media(request.positionMs, startAt + 100)), true);
  assert.equal(state.sample(media(request.positionMs + 120, startAt + 230)), 'resumed');
  return request;
}

test('native pause retains its real position and freezes time until proven resumption', () => {
  const state = listening();
  assert.equal(state.interrupt('pause', {sample: media(53122, 63122, {paused: true})}), true);
  const held = state.remainingMs;
  assert.equal(held, durationMs - 53122);
  assert.equal(state.sample(media(54000, 70000)), 'inactive');
  assert.equal(state.remainingMs, held);
  resume(state, 100000);
  assert.equal(state.resumeCount, 1);
  assert.equal(state.remainingMs, held - 120);
});

test('seek, overspeed and unexplained jumps use the last verified position', async t => {
  for (const [reason, sample] of [
    ['unexpected_seek', media(83000, 63015, {seeking: true})],
    ['unexpected_rate', media(53040, 63020, {rate: 1.75})],
    ['unexpected_position', media(83000, 63015)],
  ]) {
    await t.test(reason, () => {
      const state = listening();
      assert.equal(state.sample(sample), 'interrupted');
      assert.equal(state.interruption.reason, reason);
      assert.equal(state.positionMs, 53000);
      assert.equal(state.beginResume().positionMs, 53000);
    });
  }
});

test('stable or repeated observations do not move the anchor or invent a fault', () => {
  const state = listening();
  assert.equal(state.sample(media(52987, 63010)), 'pending');
  assert.equal(state.sample(media(53000, 64000)), 'pending');
  assert.equal(state.phase, 'running');
  assert.equal(state.sample(media(55000, 65000)), 'advanced');
  assert.equal(state.remainingMs, durationMs - 55000);
});

test('two verified resumptions exhaust the attempt limit even after reload', () => {
  const state = listening();
  state.interrupt('pause');
  resume(state, 70000);
  state.interrupt('unexpected_seek');
  resume(state, 75000);
  const reopened = new ListeningRecoveryState({durationMs, checkpoint: state.snapshot()});
  assert.equal(reopened.phase, 'paused');
  assert.equal(reopened.resumeCount, 2);
  assert.equal(reopened.canResume, false);
  state.interrupt('pause');
  assert.equal(state.interruption.reason, 'resume_limit_reached');
  assert.equal(state.beginResume(), null);
});

test('late proof cannot renew a failed resumption or take more time', () => {
  const state = listening();
  state.interrupt('pause');
  const first = state.beginResume();
  assert.equal(state.failResume(first, 'play_failed'), true);
  assert.equal(state.resumePlayback(first, media(first.positionMs, 70000)), false);
  assert.equal(state.resumeCount, 0);
  assert.equal(state.canResume, false);
  assert.equal(state.remainingMs, durationMs - 53000);
  const reopened = new ListeningRecoveryState({durationMs, checkpoint: state.snapshot()});
  assert.equal(reopened.interruption.id, state.interruption.id);
  assert.equal(reopened.canResume, false);
});

test('the last valid position is protected even if recovery itself jumps', () => {
  const state = listening();
  state.interrupt('pause');
  const request = state.beginResume();
  assert.equal(state.resumePlayback(request, media(request.positionMs, 70000)), true);
  assert.equal(state.sample(media(59000, 70200)), 'interrupted');
  assert.equal(state.interruption.reason, 'resume_position_mismatch');
  assert.equal(state.positionMs, 53000);
  assert.equal(state.resumeCount, 0);
});

test('genuine EOF must connect to verified running playback', () => {
  const state = listening();
  const realDurationMs = 1823295;
  assert.equal(state.canEnd(media(realDurationMs, 63200, {paused: true}), realDurationMs), false);
  assert.equal(state.sample(media(realDurationMs - 300, 1833000)), 'advanced');
  assert.equal(state.canEnd(media(realDurationMs, 1833300, {paused: true}), realDurationMs), true);
  state.finish();
  assert.equal(state.phase, 'ended');
  assert.equal(state.remainingMs, 0);
  assert.equal(state.beginResume(), null);
});

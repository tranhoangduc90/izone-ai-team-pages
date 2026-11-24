import assert from 'node:assert/strict';
import test from 'node:test';
import {createListeningPlayer} from '../term-tests/shared/listening-player-lifecycle-v2.mjs';

class AudioFixture extends EventTarget {
  source = true;
  isConnected = true;
  currentTime = 53.122;
  duration = 1824;
  paused = true;
  buffered = {length: 1, start: () => 0, end: () => 1824};
  sinkId = '';
  readyState = 4;
  networkState = 1;
  calls = [];

  play() {
    this.calls.push('play');
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  }

  pause() {
    this.calls.push('pause');
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }

  setSinkId(sink) {
    this.calls.push('setSinkId');
    this.sinkId = sink;
    return Promise.resolve();
  }

  load() { this.calls.push('load'); }
  remove() { this.isConnected = false; }
  hasAttribute() { return this.source; }
  removeAttribute() { this.source = false; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

function fixture(audio = new AudioFixture(), clock = performance) {
  const actions = new Map();
  const rows = [];
  const interruptions = [];
  const document = Object.assign(new EventTarget(), {visibilityState: 'visible', hasFocus: () => true});
  const mediaDevices = Object.assign(new EventTarget(), {enumerateDevices: async () => []});
  const player = createListeningPlayer({audio, document, navigator: {mediaDevices, mediaSession: {
    setActionHandler: (action, handler) => handler ? actions.set(action, handler) : actions.delete(action),
  }}, clock, isCurrent: () => true, skill: () => 'listening', emit: (action, data) => rows.push({action, ...data}),
  onInterruption: reason => interruptions.push(reason)});
  return {audio, player, actions, rows, interruptions, mediaDevices, document};
}

test('received Media Session commands neither control the player nor open an interruption', async () => {
  const {player, audio, actions, interruptions, rows} = fixture();
  await player.command('play', 'exam_start', () => audio.play());
  const latePlay = actions.get('play');
  for (const handler of actions.values()) handler();
  audio.dispatchEvent(new Event('waiting'));
  assert.deepEqual(audio.calls, ['play']);
  assert.deepEqual(interruptions, []);
  assert.equal(rows.filter(row => row.action === 'audio_media_action').length, 6);
  assert.ok(rows.filter(row => row.action === 'audio_media_action').every(row => row.inputSource === 'media_session'));
  player.retire('confirmed_interruption', {nextSkill: 'writing'});
  assert.equal(actions.size, 0);
  latePlay();
  await assert.rejects(player.command('play', 'late_callback', () => audio.play()), {name: 'AbortError'});
  assert.deepEqual(audio.calls, ['play', 'pause', 'load']);
  assert.equal(audio.source, false);
  assert.equal(audio.isConnected, false);
  assert.equal(rows.at(-1).action, 'audio_late_play_blocked');
  audio.dispatchEvent(new Event('playing'));
  const retired = rows.find(row => row.action === 'audio_player_retired');
  assert.equal(rows.at(-1).action, 'audio_anomaly');
  assert.equal(rows.at(-1).disposalId, retired.disposalId);
  assert.deepEqual(interruptions, []);
});

test('an observed pause without a web command is reported with unknown source and position', async () => {
  const {player, audio, interruptions, rows} = fixture();
  await player.command('play', 'exam_start', () => audio.play());
  audio.pause();
  assert.deepEqual(interruptions, ['pause']);
  const anomaly = rows.find(row => row.action === 'audio_anomaly');
  assert.equal(anomaly.source, 'unknown');
  assert.equal(anomaly.state.positionMs, 53122);
  assert.equal(anomaly.state.readyState, 4);
  player.retire('confirmed_interruption');
});

test('an unexplained stop retains a short local playback history after the last command ages out', async () => {
  let now = 0;
  const {player, audio, rows, interruptions} = fixture(new AudioFixture(), {now: () => now});
  audio.currentTime = 0;
  audio.playbackRate = 1;
  await player.command('play', 'exam_start', () => audio.play());
  const loggedBefore = rows.length;
  for (let tick = 1; tick <= 52; tick++) {
    now = tick * 250;
    audio.currentTime = now / 1000;
    audio.dispatchEvent(new Event('timeupdate'));
  }
  assert.equal(rows.length, loggedBefore, 'ordinary progress must stay in the local buffer');

  audio.pause();
  const anomaly = rows.find(row => row.action === 'audio_anomaly');
  assert.deepEqual(interruptions, ['pause']);
  assert.equal(anomaly.source, 'unknown');
  assert.equal(anomaly.commandId, null);
  const samples = anomaly.previous.filter(row => row.action === 'audio_progress_sample');
  assert.ok(samples.length >= 8 && samples.length <= 11);
  assert.ok(samples.every(row => row.elapsedPageMs >= 3000 && row.elapsedPageMs <= now));
  assert.ok(samples.every((row, index) => !index || row.positionMs > samples[index - 1].positionMs));
  assert.equal(samples.at(-1).rate, 1);
  assert.equal(samples.at(-1).readyState, 4);
  assert.equal(anomaly.state.positionMs, 13000);
  player.retire('confirmed_interruption');
});

test('media keys skip their default handling while answer input keeps its keys', async () => {
  const {player, audio, document, rows} = fixture();
  await player.command('play', 'exam_start', () => audio.play());
  const press = key => {
    const event = new Event('keydown', {cancelable: true});
    Object.defineProperty(event, 'key', {value: key});
    document.dispatchEvent(event);
    return event.defaultPrevented;
  };
  for (const key of ['MediaPlayPause', 'MediaFastForward', 'MediaRewind', 'MediaTrackNext', 'MediaSkipBackward']) {
    assert.equal(press(key), true);
  }
  for (const key of [' ', 'ArrowLeft', 'p', 'F7']) assert.equal(press(key), false);
  assert.deepEqual(rows.filter(row => row.inputSource === 'keyboard').map(row => row.mediaAction),
    ['toggle', 'fast_forward', 'rewind', 'next_track', 'skip_backward']);
  assert.deepEqual(audio.calls, ['play']);
  player.retire('test_finished');
  assert.equal(press('MediaPlay'), false);
});

test('waiting needs three checks of stalled playback and depleted buffer in a visible tab', async context => {
  context.mock.timers.enable({apis: ['setInterval', 'Date'], now: 10000});
  const {player, audio, interruptions, rows, document} = fixture(new AudioFixture(), Date);
  await player.command('play', 'exam_start', () => audio.play());
  audio.dispatchEvent(new Event('waiting'));
  context.mock.timers.tick(2000);
  assert.deepEqual(interruptions, []);

  audio.readyState = 2;
  audio.buffered = {length: 1, start: () => 0, end: () => 53.2};
  audio.dispatchEvent(new Event('stalled'));
  context.mock.timers.tick(2000);
  audio.currentTime += 0.05;
  context.mock.timers.tick(2000);
  assert.deepEqual(interruptions, []);

  audio.dispatchEvent(new Event('waiting'));
  context.mock.timers.tick(2000);
  document.visibilityState = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  context.mock.timers.tick(6000);
  assert.deepEqual(interruptions, []);

  document.visibilityState = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
  audio.dispatchEvent(new Event('waiting'));
  context.mock.timers.tick(2000);
  context.mock.timers.tick(2000);
  assert.deepEqual(interruptions, []);
  context.mock.timers.tick(2000);
  assert.deepEqual(interruptions, ['confirmed_stall']);
  audio.dispatchEvent(new Event('stalled'));
  context.mock.timers.tick(6000);
  const anomalies = rows.filter(row => row.action === 'audio_anomaly');
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].source, 'unknown');
  assert.equal(anomalies[0].state.samples, 3);
  assert.deepEqual(audio.calls, ['play']);
  player.retire('test_finished');
});

test('a previously visible specific output moving offline falls back once on the same player', async () => {
  const {player, audio, mediaDevices, rows} = fixture();
  audio.sinkId = 'fixture-bluetooth';
  mediaDevices.enumerateDevices = async () => [{kind: 'audiooutput', deviceId: audio.sinkId}];
  mediaDevices.dispatchEvent(new Event('devicechange'));
  await new Promise(resolve => setImmediate(resolve));
  mediaDevices.enumerateDevices = async () => [{kind: 'audiooutput', deviceId: 'default'}];
  mediaDevices.dispatchEvent(new Event('devicechange'));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(audio.calls, []);
  assert.equal(rows.findLast(row => row.action === 'audio_output_result').outcome, 'unobserved');
  mediaDevices.enumerateDevices = async () => [{kind: 'audiooutput', deviceId: 'fixture-speaker'}];
  mediaDevices.dispatchEvent(new Event('devicechange'));
  mediaDevices.dispatchEvent(new Event('devicechange'));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(audio.calls, ['setSinkId']);
  assert.equal(audio.sinkId, '');
  assert.equal(audio.source, true);
  assert.equal(audio.currentTime, 53.122);
  const result = rows.find(row => row.action === 'audio_output_result' && row.outcome === 'resolved');
  assert.equal(result.state.positionMs, 53122);
  assert.ok(rows.some(row => row.action === 'audio_device_change' && row.outputChangeId === result.outputChangeId));
  assert.ok(!JSON.stringify(rows).includes('fixture-bluetooth'));
  player.retire('test_finished');
});

test('default output change keeps playback and only logs the route as unobserved', async () => {
  const {player, audio, mediaDevices, rows, actions} = fixture();
  await player.command('play', 'exam_start', () => audio.play());
  mediaDevices.dispatchEvent(new Event('devicechange'));
  actions.get('pause')();
  assert.deepEqual(audio.calls, ['play']);
  assert.equal(rows.find(row => row.action === 'audio_output_result').outcome, 'default_route_unobserved');
  assert.equal(rows.at(-1).disposition, 'ignored');
  player.retire('test_finished');
});

test('a burst of device changes accounts for superseded observations and switches only once', async () => {
  const {player, audio, mediaDevices, rows} = fixture();
  const notify = () => mediaDevices.dispatchEvent(new Event('devicechange'));
  audio.sinkId = 'fixture-headset';
  mediaDevices.enumerateDevices = async () => [{kind:'audiooutput', deviceId:'fixture-headset'}];
  notify();
  await new Promise(resolve => setImmediate(resolve));

  let completeReading;
  mediaDevices.enumerateDevices = () => new Promise(done => { completeReading = done; });
  const earlier = rows.length;
  notify();
  notify();
  notify();
  const speakers = [{kind:'audiooutput', deviceId:'fixture-speakers'}];
  mediaDevices.enumerateDevices = async () => speakers;
  completeReading(speakers);
  await new Promise(resolve => setImmediate(resolve));

  const changes = rows.slice(earlier).filter(row=>row.action === 'audio_device_change');
  const results = changes.map(change=>rows.filter(row=>row.action === 'audio_output_result' && row.outputChangeId === change.outputChangeId));
  assert.deepEqual(results.map(group=>group.map(row=>row.outcome)), [['resolved'], ['superseded'], ['unobserved']]);
  assert.deepEqual(audio.calls, ['setSinkId']);
  assert.equal(audio.sinkId, '');
  player.retire('test_finished');
});

test('a new route observation still runs after an output enumeration fails', async () => {
  const {player, audio, mediaDevices, rows} = fixture();
  audio.sinkId = 'fixture-headset';
  const notify = () => mediaDevices.dispatchEvent(new Event('devicechange'));
  mediaDevices.enumerateDevices = async () => [{kind:'audiooutput', deviceId:'fixture-headset'}];
  notify();
  await new Promise(resolve => setImmediate(resolve));

  let failReading;
  mediaDevices.enumerateDevices = () => new Promise((_,reject) => { failReading = reject; });
  const earlier = rows.length;
  notify();
  notify();
  mediaDevices.enumerateDevices = async () => [{kind:'audiooutput', deviceId:'fixture-speaker'}];
  failReading(new DOMException('Simulated I/O failure', 'NotReadableError'));
  await new Promise(resolve => setImmediate(resolve));

  const results = rows.slice(earlier).filter(row=>row.action === 'audio_output_result');
  assert.deepEqual(results.map(row=>row.outcome), ['unobserved','resolved']);
  assert.equal(results[0].errorCode,'NotReadableError');
  assert.deepEqual(audio.calls,['setSinkId']);
  player.retire('test_finished');
});

for (const outcome of ['rejected', 'unsupported']) {
  test(`specific output change remains observable when fallback is ${outcome}`, async () => {
    const {player, audio, mediaDevices, rows, actions, interruptions} = fixture();
    audio.sinkId = 'fixture-headset';
    let rejectFallback;
    audio.setSinkId = outcome === 'unsupported' ? undefined : () => {
      audio.calls.push('setSinkId');
      return new Promise((resolve, reject) => { rejectFallback = reject; });
    };
    await player.command('play', 'exam_start', () => audio.play());
    mediaDevices.enumerateDevices = async () => [{kind: 'audiooutput', deviceId: 'fixture-headset'}];
    mediaDevices.dispatchEvent(new Event('devicechange'));
    await new Promise(resolve => setImmediate(resolve));
    mediaDevices.enumerateDevices = async () => [{kind: 'audiooutput', deviceId: 'fixture-speaker'}];
    mediaDevices.dispatchEvent(new Event('devicechange'));
    await new Promise(resolve => setImmediate(resolve));
    actions.get('pause')();
    rejectFallback?.(new DOMException('Output selection declined', 'NotAllowedError'));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(audio.calls, outcome === 'unsupported' ? ['play'] : ['play', 'setSinkId']);
    assert.equal(audio.currentTime, 53.122);
    assert.equal(audio.paused, false);
    assert.equal(audio.source, true);
    assert.deepEqual(interruptions, []);
    assert.equal(rows.findLast(row => row.action === 'audio_output_result').outcome, outcome);
    assert.equal(rows.findLast(row => row.action === 'audio_media_action').disposition, 'ignored');
    assert.ok(!JSON.stringify(rows).includes('fixture-headset'));
    player.retire('test_finished');
  });
}

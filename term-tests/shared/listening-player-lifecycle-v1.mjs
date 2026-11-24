const mediaOwners = new WeakMap();
const playerJournals = new WeakMap();
const mediaActions = ['pause', 'stop', 'play', 'seekbackward', 'seekforward', 'seekto'];
const stallSampleMs = 2000;
const stallSamplesRequired = 3;

function milliseconds(seconds) {
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
}

function mediaState(audio, document) {
  const position = audio.currentTime;
  let bufferAhead = null;
  for (let index = 0; index < audio.buffered.length; index++) {
    if (audio.buffered.start(index) <= position && position <= audio.buffered.end(index)) {
      bufferAhead = milliseconds(audio.buffered.end(index) - position);
      break;
    }
  }
  return {
    positionMs: milliseconds(position), durationMs: milliseconds(audio.duration), bufferAheadMs: bufferAhead,
    paused: audio.paused, ended: audio.ended, seeking: audio.seeking, muted: audio.muted, volume: audio.volume,
    readyState: audio.readyState, networkState: audio.networkState, visibility: document.visibilityState,
    focused: document.hasFocus(), mediaErrorCode: audio.error?.code ?? null,
  };
}

function playerJournal(audio, {skill, emit, clock, role = 'listening_official'}) {
  let journal = playerJournals.get(audio);
  if (!journal) {
    journal = {playerId: crypto.randomUUID(), sequence: 0, recent: []};
    playerJournals.set(audio, journal);
  }
  function record(action, details = {}) {
    const row = {version: 1, playerId: journal.playerId, playerRole: role, skill: skill(), sequence: ++journal.sequence,
      elapsedPageMs: Math.round(clock.now()), positionMs: milliseconds(audio.currentTime), ...details};
    journal.recent.push({action, ...row});
    if (journal.recent.length > 20) journal.recent.shift();
    try { emit(action, row); } catch { /* The journal must not interrupt the exam. */ }
    return row;
  }
  return {playerId: journal.playerId, recent: journal.recent, record};
}

function runJournalCommand(record, command, reason, run, onIssued) {
  const commandId = crypto.randomUUID();
  const issued = record('audio_command', {commandId, command, reason});
  onIssued?.(issued);
  try {
    const result = run();
    if (command !== 'play') return result;
    return Promise.resolve(result).then(value => {
      record('audio_command_result', {commandId, outcome: 'resolved'});
      return value;
    }, error => {
      record('audio_command_result', {commandId, outcome: 'rejected', errorCode: error?.name || 'Error'});
      throw error;
    });
  } catch (error) {
    record('audio_command_result', {commandId, outcome: 'threw', errorCode: error?.name || 'Error'});
    throw error;
  }
}

export function recordListeningPreparationCommand(audio, command, reason, run, journal) {
  const {record} = playerJournal(audio, {clock: performance, ...journal});
  return runJournalCommand(record, command, reason, run);
}

// Owns one official audio element. The exam adapter owns its attempt, transitions and answer store.
export function createListeningPlayer({audio, isCurrent, skill, emit, onInterruption,
  document = globalThis.document, navigator = globalThis.navigator, clock = globalThis.performance}) {
  const {playerId, recent, record} = playerJournal(audio, {skill, emit, clock});
  const listeners = new AbortController();
  const issued = new Map();
  const actions = [];
  const session = navigator.mediaSession;
  const devices = navigator.mediaDevices;
  let retired = false;
  let started = false;
  let disposalId;
  let visibleOutputs = null;
  let readingDevices = false;
  let pendingDeviceChange;
  let stallProbe;
  let interruption;

  const active = () => !retired && isCurrent();
  function command(name, reason, run) {
    if (name === 'play' && !active()) {
      record('audio_late_play_blocked', {commandId: crypto.randomUUID(), reason, disposalId});
      return Promise.reject(new DOMException('Lượt Listening đã thay đổi.', 'AbortError'));
    }
    return runJournalCommand(record, name, reason, run, row => {
      const commands = (issued.get(name) || []).filter(item => row.elapsedPageMs - item.elapsedPageMs <= 1500);
      commands.push(row);
      issued.set(name, commands);
    });
  }

  function anomaly(event, state, commandId = null) {
    const previous = recent.filter(row => clock.now() - row.elapsedPageMs <= 10000)
      .map(({action, sequence, elapsedPageMs, positionMs, command, reason}) =>
        ({action, sequence, elapsedPageMs, positionMs, command, reason}));
    record('audio_anomaly', {event, commandId, source: commandId ? 'app' : 'unknown', disposalId, state, previous});
  }

  function confirmInterruption(event, state) {
    if (interruption || !active()) return;
    interruption = event;
    anomaly(event, state);
    onInterruption(event);
  }

  function cancelProbe() {
    if (stallProbe) clearInterval(stallProbe.timer);
    stallProbe = null;
  }

  function checkStall(signal) {
    if (stallProbe || !started || interruption || !active() || document.visibilityState !== 'visible') return;
    const position = audio.currentTime;
    const probe = {samples: 0, checkedAt: clock.now()};
    probe.timer = setInterval(() => {
      const state = mediaState(audio, document);
      const elapsed = clock.now() - probe.checkedAt;
      if (!active() || state.visibility !== 'visible' || state.paused || state.ended || state.seeking ||
          state.readyState >= 3 || state.bufferAheadMs > 250 || !Number.isFinite(position) ||
          Math.abs(audio.currentTime - position) >= 0.025 || elapsed >= 2 * stallSampleMs) {
        cancelProbe();
        return;
      }
      // Count separate checks of depleted buffer and stalled progress in a visible tab.
      probe.checkedAt = clock.now();
      if (++probe.samples < stallSamplesRequired) return;
      cancelProbe();
      confirmInterruption('confirmed_stall', {...state, signal, samples: probe.samples});
    }, stallSampleMs);
    stallProbe = probe;
  }

  function observe(event) {
    const name = event.type;
    const commandName = name === 'pause' ? 'pause' : name === 'play' ? 'play' : null;
    const matching = commandName ? (issued.get(commandName) || [])
      .filter(row => clock.now() - row.elapsedPageMs <= 1500) : [];
    if (commandName) issued.delete(commandName);
    const commandId = matching.length === 1 ? matching[0].commandId : null;
    const outside = (name === 'play' || name === 'playing') && !active();
    const unexplainedPause = name === 'pause' && !commandId && started && audio.paused && !audio.ended;
    const state = mediaState(audio, document);
    if (outside) {
      anomaly(name, state, commandId);
    } else if (!interruption && active() && (unexplainedPause || name === 'error' && audio.error)) {
      confirmInterruption(name, state);
    } else {
      record('audio_observed', {event: name, commandId, state});
    }
    if (name === 'playing' && active()) {
      started = true;
      interruption = null;
    }
    if (name === 'waiting' || name === 'stalled') checkStall(name);
    else cancelProbe();
  }

  for (const name of ['play', 'playing', 'pause', 'ended', 'waiting', 'stalled', 'error']) {
    audio.addEventListener(name, observe, {signal: listeners.signal});
  }
  document.addEventListener('visibilitychange', () => {
    cancelProbe();
    record('audio_tab_state', mediaState(audio, document));
  }, {signal: listeners.signal});

  function blockMediaAction(action, inputSource) {
    record('audio_media_action', {mediaAction: action, inputSource, disposition: active() ? 'ignored' : 'inactive'});
  }
  if (session?.setActionHandler) {
    mediaOwners.set(session, playerId);
    for (const action of mediaActions) {
      try {
        session.setActionHandler(action, () => blockMediaAction(action, 'media_session'));
        actions.push(action);
      } catch { /* Support varies by browser and action. */ }
    }
  }
  const keyActions = {
    MediaPlay: 'play', MediaPause: 'pause', MediaStop: 'stop', MediaPlayPause: 'toggle',
    MediaFastForward: 'fast_forward', MediaRewind: 'rewind',
    MediaTrackNext: 'next_track', MediaTrackPrevious: 'previous_track',
    MediaSkipForward: 'skip_forward', MediaSkipBackward: 'skip_backward',
    MediaStepForward: 'step_forward', MediaStepBackward: 'step_backward',
  };
  document.addEventListener('keydown', event => {
    if (!active() || !Object.hasOwn(keyActions, event.key)) return;
    event.preventDefault();
    blockMediaAction(keyActions[event.key], 'keyboard');
  }, {capture: true, signal: listeners.signal});

  async function readOutputs() {
    if (readingDevices || !devices?.enumerateDevices || !active()) return;
    readingDevices = true;
    try {
      do {
        const outputChangeId = pendingDeviceChange;
        pendingDeviceChange = null;
        let outputs;
        try {
          const listed = await devices.enumerateDevices();
          outputs = new Set(listed.filter(item => item.kind === 'audiooutput' && item.deviceId).map(item => item.deviceId));
        } catch (error) {
          record('audio_output_result', {outputChangeId, outcome: 'unobserved', errorCode: error?.name || 'Error'});
          continue;
        }
        if (!active()) {
          if (outputChangeId) record('audio_output_result', {outputChangeId, outcome: 'cancelled'});
          return;
        }
        const sink = audio.sinkId;
        const specificOutputsVisible = [...outputs].some(id => id !== 'default' && id !== 'communications');
        const missing = Boolean(sink && sink !== 'default' && specificOutputsVisible && visibleOutputs?.has(sink) && !outputs.has(sink));
        if (specificOutputsVisible) visibleOutputs = outputs;
        if (outputChangeId && !missing) {
          record('audio_output_result', {outputChangeId, outcome: outputs.has(sink) ? 'selected_sink_still_listed' : 'unobserved'});
        } else if (outputChangeId && !audio.setSinkId) {
          record('audio_output_result', {outputChangeId, outcome: 'unsupported'});
        } else if (outputChangeId) {
          const before = mediaState(audio, document);
          record('audio_output_fallback', {outputChangeId, reason: 'selected_sink_disappeared', before});
          try {
            await audio.setSinkId('');
            record('audio_output_result', {outputChangeId, outcome: 'resolved', active: active(), state: mediaState(audio, document)});
          } catch (error) {
            record('audio_output_result', {outputChangeId, outcome: 'rejected', errorCode: error?.name || 'Error',
              active: active(), state: mediaState(audio, document)});
          }
        }
      } while (pendingDeviceChange && active());
    } finally {
      readingDevices = false;
    }
  }

  devices?.addEventListener?.('devicechange', () => {
    if (!active()) return;
    const outputChangeId = crypto.randomUUID();
    const isDefault = !audio.sinkId || audio.sinkId === 'default';
    record('audio_device_change', {outputChangeId, sink: isDefault ? 'default' : 'specific', state: mediaState(audio, document)});
    if (isDefault || !devices.enumerateDevices) {
      record('audio_output_result', {outputChangeId, outcome: isDefault ? 'default_route_unobserved' : 'unsupported'});
    } else {
      if (pendingDeviceChange) record('audio_output_result', {outputChangeId: pendingDeviceChange, outcome: 'superseded'});
      pendingDeviceChange = outputChangeId;
      void readOutputs();
    }
  }, {signal: listeners.signal});
  if (audio.sinkId && audio.sinkId !== 'default') void readOutputs();

  function retire(reason, {releaseSource, nextSkill, operationId} = {}) {
    if (retired) return;
    retired = true;
    cancelProbe();
    if (pendingDeviceChange) {
      record('audio_output_result', {outputChangeId: pendingDeviceChange, outcome: 'cancelled'});
      pendingDeviceChange = null;
    }
    disposalId = crypto.randomUUID();
    const before = mediaState(audio, document);
    // Abort pending play through the element's resource selection algorithm, including when already paused.
    try {
      if (!audio.paused) command('pause', reason, () => audio.pause());
      command('clear_source', reason, () => {
        audio.removeAttribute('src');
        if (audio.srcObject) audio.srcObject = null;
        for (const source of audio.querySelectorAll('source')) source.remove();
      });
      command('load', reason, () => audio.load());
      audio.remove();
    } finally {
      listeners.abort();
      const tail = new AbortController();
      for (const name of ['pause', 'play', 'playing']) audio.addEventListener(name, observe, {signal: tail.signal});
      // Keep a diagnostic witness for media events already queued by the browser.
      const tailTimer = setTimeout(() => tail.abort(), 5000);
      tailTimer.unref?.();
      let handlersReleased = 0;
      if (session && mediaOwners.get(session) === playerId) {
        for (const action of actions) {
          try {
            session.setActionHandler(action, null);
            handlersReleased++;
          } catch { /* Per-action support can change. */ }
        }
        mediaOwners.delete(session);
      }
      releaseSource?.();
      record('audio_player_retired', {disposalId, reason, fromSkill: 'listening', nextSkill, operationId, before,
        callbacksAborted: listeners.signal.aborted, handlersRegistered: actions.length, handlersReleased, paused: audio.paused,
        sourceCleared: !audio.hasAttribute('src') && !audio.srcObject && !audio.querySelector('source'),
        attached: audio.isConnected});
    }
  }

  return {playerId, command, retire, active};
}

import {createListeningPlayer as createPlayer} from './listening-player-lifecycle-v1.mjs';

export {recordListeningPreparationCommand} from './listening-player-lifecycle-v1.mjs';

const historyMs = 10_000;
const sampleIntervalMs = 1000;

export function createListeningPlayer(options) {
  const {audio, emit, clock = globalThis.performance} = options;
  const samples = [];
  const sampling = new AbortController();
  const player = createPlayer({...options, emit(action, row) {
    if (action !== 'audio_anomaly') {
      emit(action, row);
      return;
    }
    const progress = samples.filter(sample => row.elapsedPageMs - sample.elapsedPageMs <= historyMs);
    const previous = [...row.previous, ...progress].sort((left, right) => left.elapsedPageMs - right.elapsedPageMs);
    emit(action, {...row, previous});
  }});

  audio.addEventListener('timeupdate', () => {
    const elapsedPageMs = Math.round(clock.now());
    const previous = samples.at(-1);
    if (!player.active() || audio.paused || audio.ended || audio.seeking || !Number.isFinite(audio.currentTime) ||
      (previous && elapsedPageMs - previous.elapsedPageMs < sampleIntervalMs)) return;
    samples.push({action: 'audio_progress_sample', elapsedPageMs, positionMs: Math.round(audio.currentTime * 1000),
      rate: audio.playbackRate, readyState: audio.readyState});
    while (samples.length && elapsedPageMs - samples[0].elapsedPageMs > historyMs) samples.shift();
  }, {signal: sampling.signal});

  return {...player, retire(reason, details) {
    sampling.abort();
    return player.retire(reason, details);
  }};
}

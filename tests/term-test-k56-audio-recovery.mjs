import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const roots = [
  'term-test-1-k56-computer-based',
  'term-test-2-k56-computer-based',
  'mini-test-k56-computer-based'
];
const sources = roots.map(root => fs.readFileSync(
  new URL(`../term-tests/${root}/enhance.js`, import.meta.url),
  'utf8'
));

test('cả ba bài K56 gửi checkpoint thật và hiện nút Tiếp tục audio', () => {
  for (const source of sources) {
    assert.match(source, /session\/audio-progress/);
    assert.match(source, /heardSeconds/);
    assert.match(source, /reportAudioProgress\('pagehide', true\)/);
    assert.match(source, /Audio chưa tự phát lại · nhấn Tiếp tục audio/);
  }
});

const source = sources[0];
const start = source.indexOf('    function rememberActualHeardPosition(');
const end = source.indexOf("    audio.addEventListener('loadedmetadata'", start);
assert(start >= 0 && end > start);

function harness({ blocked = false, offline = false } = {}) {
  const calls = [];
  const events = [];
  const audio = {
    currentTime: 72.5,
    duration: 1800,
    paused: true,
    ended: false,
    pause() { this.paused = true; },
    async play() {
      calls.push('play');
      if (blocked) throw new Error('Autoplay bị chặn');
      this.paused = false;
    }
  };
  const context = vm.createContext({
    audio,
    uiState: { audio: { time: 60 } },
    examStarted: true,
    ready: true,
    allowPause: false,
    examCard: { hidden: false },
    recoveryInFlight: false,
    lastRecoveryAttemptAt: 0,
    lastSavedSecond: 0,
    lastProgressReportedSecond: 0,
    audioProgressQueue: Promise.resolve(),
    protectedBootstrap: { examSessionToken: '00000000-0000-4000-8000-000000000091' },
    appConfig: { API_BASE_URL: 'https://synthetic.invalid' },
    testConfig: { slug: 'term-test-1-k56' },
    resumeButton: { hidden: true },
    examRetryButton: { hidden: true },
    saveUiState() {},
    updateExamStatus(value) { calls.push(value); },
    lastObservedAudioTime: 0,
    lastAudioAdvanceAt: 0,
    performance,
    AbortSignal,
    CustomEvent: class {
      constructor(type, options) { this.type = type; this.detail = options.detail; }
    },
    window: { dispatchEvent(event) { events.push(event); } },
    async fetch(_url, options) {
      calls.push(JSON.parse(options.body));
      if (offline) throw new Error('Mất mạng giả');
      return { ok: true, json: async () => ({ listeningDeadlineAt: '2099-01-01T00:00:00.000Z' }) };
    }
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, audio, calls, events };
}

for (const trigger of ['pause', 'waiting', 'stalled']) {
  test(`K56 ${trigger}: phát tiếp đúng mốc đã nghe`, async () => {
    const h = harness();
    await h.context.recoverInterruptedAudio(trigger, true);
    assert.equal(h.audio.currentTime, 72.5);
    assert.equal(h.audio.paused, false);
    assert.deepEqual(
      h.calls.filter(value => typeof value === 'object').map(value => [value.state, value.heardSeconds]),
      [[trigger, 72.5], ['recovered', 72.5]]
    );
    assert.equal(h.events.length, 2);
  });
}

test('K56 autoplay bị chặn hiện nút Tiếp tục audio và giữ nguyên mốc', async () => {
  const h = harness({ blocked: true });
  await h.context.recoverInterruptedAudio('pause', true);
  assert.equal(h.context.resumeButton.hidden, false);
  assert.equal(h.audio.currentTime, 72.5);
});

test('K56 mất mạng khi checkpoint không làm audio đang phát bị dừng', async () => {
  const h = harness({ offline: true });
  await h.context.recoverInterruptedAudio('waiting', true);
  assert.equal(h.audio.paused, false);
  assert.equal(h.context.resumeButton.hidden, true);
});

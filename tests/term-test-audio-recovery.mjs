import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../term-tests/term-test-2-computer-based/enhance.js', import.meta.url), 'utf8');
const start = source.indexOf('    function rememberActualHeardPosition(');
const end = source.indexOf("    audio.addEventListener('loadedmetadata'", start);
assert(start >= 0 && end > start);
// Chạy đúng hàm phục hồi đang phát hành, với phần tử audio/API giả; không phát âm thanh hoặc gọi hệ thống ngoài.
function harness({ blocked = false, offline = false, slug = 'term-test-2' } = {}) {
  const calls = [], events = [];
  const audio = { currentTime: 72.5, duration: 1800, paused: true, ended: false,
    pause() { this.paused = true; },
    async play() { calls.push('play'); if (blocked) throw new Error('Autoplay bị chặn'); this.paused = false; } };
  const context = vm.createContext({
    audio, uiState: { audio: { time: 60 } }, examStarted: true, ready: true, allowPause: false,
    examCard: { hidden: false }, recoveryInFlight: false, lastRecoveryAttemptAt: 0,
    lastSavedSecond: 0, lastProgressReportedSecond: 0, audioProgressQueue: Promise.resolve(),
    protectedBootstrap: { examSessionToken: '00000000-0000-4000-8000-000000000091' },
    appConfig: { API_BASE_URL: 'https://synthetic.invalid' }, testConfig: { slug },
    resumeButton: { hidden: true }, examRetryButton: { hidden: true },
    saveUiState() {}, updateExamStatus(value) { calls.push(value); },
    lastObservedAudioTime: 0, lastAudioAdvanceAt: 0, performance, AbortSignal,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    window: { dispatchEvent(event) { events.push(event); } },
    async fetch(url, options) { calls.push(JSON.parse(options.body)); if (offline) throw new Error('Mất mạng giả'); return { ok: true, json: async () => ({ listeningDeadlineAt: '2099-01-01T00:00:00.000Z' }) }; }
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, audio, calls, events };
}
for (const slug of ['term-test-1', 'term-test-2', 'mini-test-lesson-5']) for (const trigger of ['pause', 'waiting', 'stalled']) test(`${slug} audio ${trigger}: phát tiếp đúng mốc đã nghe, không nhảy theo đồng hồ`, async () => {
  const h = harness({ slug });
  await h.context.recoverInterruptedAudio(trigger, true);
  assert.equal(h.audio.currentTime, 72.5);
  assert.equal(h.audio.paused, false);
  assert.equal(h.context.resumeButton.hidden, true);
  assert.deepEqual(h.calls.filter(x => typeof x === 'object').map(x => [x.state, x.heardSeconds]), [[trigger, 72.5], ['recovered', 72.5]]);
  assert.equal(h.events.length, 2);
});
test('autoplay bị chặn hiện nút tiếp tục và vẫn giữ mốc nghe', async () => {
  const h = harness({ blocked: true }); await h.context.recoverInterruptedAudio('pause', true);
  assert.equal(h.context.resumeButton.hidden, false); assert.equal(h.audio.currentTime, 72.5);
  assert(h.calls.some(x => typeof x === 'string' && x.includes('nhấn Tiếp tục')));
});
test('lỗi mạng checkpoint không báo nhầm audio chưa phát', async () => {
  const h = harness({ offline: true }); await h.context.recoverInterruptedAudio('waiting', true);
  assert.equal(h.audio.paused, false); assert.equal(h.context.resumeButton.hidden, true);
  assert(!h.calls.some(x => typeof x === 'string' && x.includes('chưa tự phát')));
});
test('audio đã kết thúc hoặc rời phần Listening không tự phát lại', async () => {
  const h = harness(); h.audio.ended = true; await h.context.recoverInterruptedAudio('pause', true);
  h.audio.ended = false; h.context.examCard.hidden = true; await h.context.recoverInterruptedAudio('stalled', true);
  assert.equal(h.calls.length, 0);
});
test('nhiều tín hiệu gián đoạn đồng thời chỉ tạo một lần khôi phục', async () => {
  const h = harness(); await Promise.all([h.context.recoverInterruptedAudio('pause', true), h.context.recoverInterruptedAudio('stalled', true)]);
  assert.equal(h.calls.filter(x => x === 'play').length, 1);
});

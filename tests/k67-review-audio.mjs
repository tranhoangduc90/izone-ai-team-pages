// Player thật với phần tử âm thanh giả: kiểm mốc, tự dừng và phản hồi bất đồng bộ.
// Không đọc audio Cambridge hoặc tạo export/cờ chỉ dành cho test trong sản phẩm.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../term-tests/k67-shared/review-audio.js', import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture(prepare = async () => {}) {
  const doc = new EventTarget(), win = new EventTarget(); doc.hidden = false;
  const context = vm.createContext({ window: win, document: doc, DOMException, AbortController, setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
  vm.runInContext(source, context);
  class Audio extends EventTarget {
    duration = 1843.2; readyState = 1; paused = true; playCount = 0; playbackRate = 2; time = 0;
    set currentTime(v) { this.time = v; queueMicrotask(() => this.dispatchEvent(new Event('seeked'))); }
    get currentTime() { return this.time; }
    async play() { this.playCount++; if (this.pending) await this.pending; this.paused = false; }
    pause() { this.paused = true; }
  }
  const audio = new Audio(), states = [];
  const player = new win.K67ReviewAudio(audio, { durationMs: 1843200, prepare, onState: s => states.push(s) });
  return { player, audio, doc, states };
}
const clip = { id: 'q31', startMs: 1200000, endMs: 1210000 };
test('đoạn ở phút 20 phát đúng mốc 1× và tự dừng tại cuối đoạn', async t => {
  const f = fixture(); t.after(() => f.player.stop()); await f.player.play(clip);
  assert.equal(f.audio.currentTime, 1200); assert.equal(f.audio.playbackRate, 1); assert.equal(f.audio.paused, false);
  f.audio.time = 1209.99; f.audio.dispatchEvent(new Event('timeupdate')); assert.equal(f.audio.paused, false);
  f.audio.time = 1210; f.audio.dispatchEvent(new Event('timeupdate')); assert.equal(f.audio.paused, true);
});
test('mốc sai không tải hoặc phát audio', async () => {
  let loads = 0; const f = fixture(async () => { loads++; });
  for (const bad of [{ startMs: -1 }, { endMs: 1843201 }, { endMs: 10 }, { startMs: NaN }]) await f.player.play({ ...clip, ...bad });
  assert.equal(loads, 0); assert.equal(f.audio.playCount, 0); assert.equal(f.player.state, 'error');
});
test('đóng/chuyển câu khi đang tải không tự phát lúc tải xong', async () => {
  const gate = deferred(); let signal;
  const f = fixture(async s => { signal = s; await gate.promise; });
  const playing = f.player.play(clip); f.player.stop(); gate.resolve(); await playing;
  assert.equal(signal.aborted, true); assert.equal(f.audio.playCount, 0); assert.equal(f.audio.paused, true);
});
test('phản hồi play tới sau đóng vẫn dừng; tới sau đoạn mới không dừng nhầm đoạn mới', async t => {
  const f = fixture(), a = deferred(); t.after(() => f.player.stop()); f.audio.pending = a.promise;
  const first = f.player.play(clip); await new Promise(r => setImmediate(r)); f.player.stop(); a.resolve(); await first;
  assert.equal(f.audio.paused, true);
  const b = deferred(); f.audio.pending = b.promise;
  const old = f.player.play(clip); await new Promise(r => setImmediate(r)); f.audio.pending = null;
  await f.player.play({ ...clip, id: 'q32', startMs: 1220000, endMs: 1230000 });
  b.resolve(); await old; assert.equal(f.audio.paused, false); assert.equal(f.player.active.id, 'q32');
});
test('lỗi tải có thể thử lại, bấm lại để dừng và ẩn trang phải dừng', async t => {
  let fail = true; const f = fixture(async () => { if (fail) throw Error('offline'); }); t.after(() => f.player.stop());
  await f.player.play(clip); assert.equal(f.player.state, 'error'); fail = false;
  await f.player.play(clip); assert.equal(f.audio.paused, false);
  await f.player.play(clip); assert.equal(f.audio.paused, true);
  await f.player.play(clip); f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.audio.paused, true);
});
test('đổi người xóa bộ phát và hủy listener cũ', async () => {
  const f = fixture(); await f.player.play(clip); f.player.dispose();
  const count = f.states.length; f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange'));
  f.audio.dispatchEvent(new Event('ended')); assert.equal(f.states.length, count); assert.equal(f.audio.paused, true);
});
test('chuẩn bị decoder không phát tiếng và hết hạn nếu metadata không tới', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const f=fixture();f.audio.readyState=0;f.audio.load=()=>{};
  const pending=f.player.prime(new AbortController().signal);
  assert.equal(f.audio.playCount,0);assert.equal(f.audio.paused,true);
  t.mock.timers.tick(10001);await assert.rejects(pending,/AUDIO_READY_TIMEOUT/);
});

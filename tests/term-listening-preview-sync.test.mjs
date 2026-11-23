import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = new URL('../term-tests/', import.meta.url);
const helper = 'shared/cbt-audio-preview-sync-v1.js';
const text = async url => (await readFile(url, 'utf8')).replace(/\r\n/g, '\n');
const sha = data => createHash('sha256').update(data).digest('hex');
const source = await text(new URL(helper, root));

function setup({ready = true} = {}) {
  let ms = 0;
  let confirmations = 0;
  const button = {
    disabled: true,
    querySelector: () => null,
    before(hint) { this.previousElementSibling = hint; },
    replaceChildren(...children) { this.children = children; }
  };
  const document = {
    createElement(tag) {
      return {
        tag, dataset: {}, style: {},
        matches: () => tag === 'p',
        remove: () => { button.previousElementSibling = undefined; }
      };
    }
  };
  const window = {};
  runInNewContext(source, {window, document, performance: {now: () => ms}});
  const audio = Object.assign(new EventTarget(), {
    paused: false, seeking: false, ended: false, currentTime: 0, playbackRate: 1, readyState: 4
  });
  const fire = name => audio.dispatchEvent(new Event(name));
  const advance = (seconds, position) => {
    ms += seconds * 1000;
    audio.currentTime = position;
    fire('timeupdate');
  };
  const begin = () => window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW(audio, button, () => {
    confirmations++;
    if (ready) activate();
  });
  const activate = () => {
    button.disabled = false;
    window.IZONE_CBT_AUDIO_START_LABEL(button, true);
  };
  begin();
  return {audio, button, fire, advance, begin, activate,
    seconds: () => button.previousElementSibling?.textContent,
    startCount: () => confirmations,
    cancel: () => window.IZONE_CBT_AUDIO_CANCEL_PREVIEW_WAIT(audio)};
}

test('keeps zero and the button in the same transition after ten seconds played', () => {
  const f = setup();
  f.advance(10, 0);
  assert.match(f.seconds(), /10 giây/);
  f.advance(9.9, 9.9);
  assert.match(f.seconds(), /1 giây/);
  assert.equal(f.button.disabled, true);
  f.advance(0.1, 10);
  assert.equal(f.seconds(), undefined);
  assert.equal(f.button.disabled, false);
  assert.equal(f.button.children[0], 'Đã nghe rõ');
  f.advance(1, 11);
  assert.equal(f.startCount(), 1);
});

test('rearms on native playback after a pause and preserves only the audio heard', () => {
  const f = setup();
  f.advance(4, 4);
  f.audio.paused = true;
  f.fire('pause');
  assert.match(f.seconds(), /tạm dừng/);
  f.advance(20, 4);
  f.audio.paused = false;
  f.fire('playing');
  f.advance(5.9, 9.9);
  assert.equal(f.button.disabled, true);
  f.advance(0.1, 10);
  assert.equal(f.button.disabled, false);
});

test('does not credit seeking and allows a reliable elapsed position on replay', () => {
  const f = setup();
  f.advance(3, 3);
  f.audio.seeking = true;
  f.fire('seeking');
  f.advance(0.1, 25);
  f.audio.seeking = false;
  f.fire('seeked');
  f.advance(1, 26);
  assert.equal(f.button.disabled, true);
  assert.match(f.seconds(), /6 giây/);
  f.cancel();
  f.audio.currentTime = 0;
  f.begin();
  f.advance(6, 6);
  assert.equal(f.button.disabled, true);
  f.advance(4, 10);
  assert.equal(f.button.disabled, false);
});

test('credits the final played fraction at natural end and explains a short clip', () => {
  const exact = setup();
  exact.advance(9.9, 9.9);
  exact.audio.paused = exact.audio.ended = true;
  exact.advance(0.1, 10);
  exact.fire('pause');
  assert.equal(exact.button.disabled, false);

  const short = setup();
  short.advance(8, 8);
  short.audio.paused = short.audio.ended = true;
  short.fire('ended');
  assert.match(short.seconds(), /Chưa nghe đủ/);
  assert.equal(short.button.disabled, true);
});

test('shows the remaining prerequisite when playback is confirmed before exam preparation finishes', () => {
  const f = setup({ready: false});
  f.advance(10, 10);
  assert.equal(f.startCount(), 1);
  assert.equal(f.button.disabled, true);
  assert.match(f.seconds(), /Đã nghe đủ 10 giây/);
  f.activate();
  assert.equal(f.seconds(), undefined);
});

const targets = [
  ['term-test-1-k56-computer-based', 'student-cache-v1'],
  ['term-test-2-k56-computer-based', 'student-cache-v2'],
  ['term-test-1-computer-based', 'student-cache-v2'],
  ['term-test-2-computer-based', 'student-cache-v2'],
  ['term-test-1-k56-computer-based', 'demo-journal-v1'],
  ['term-test-2-k56-computer-based', 'demo-journal-v1']
];
for (const [route, kind] of targets) {
  test(route + ' / ' + kind + ' loads the same build online and offline', async () => {
    const base = new URL(route + '/', root);
    const demo = kind === 'demo-journal-v1';
    const entry = demo ? kind + '/index' : 'index-' + kind;
    const manifest = demo ? kind + '/offline-assets' : 'offline-assets-' + kind;
    const published = new URL(demo ? kind + '/index.html' : 'index.html', base);
    const pinned = entry + '-preview-sync-v1.html';
    const html = await text(published);
    assert.equal(html, await text(new URL(pinned, base)));
    assert.match(html, /src="\.\.\/shared\/cbt-audio-preview-sync-v1\.js"/);
    const { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } = await import(new URL(manifest + '-preview-sync-v1.mjs', base));
    assert.deepEqual(new Set(ASSETS), new Set(Object.keys(ASSET_HASHES)));
    assert.equal(ASSET_BUILD_ID, sha(JSON.stringify(ASSET_HASHES)));
    for (const name of ASSETS) {
      const file = new URL(name, base);
      const bytes = /\.(html|js|mjs|css|svg)$/.test(file.pathname) ? await text(file) : await readFile(file);
      assert.equal(sha(bytes), ASSET_HASHES[name], name);
    }
    assert.ok(ASSETS.includes('../' + helper));
    assert.ok(ASSETS.includes(pinned));
  });
}

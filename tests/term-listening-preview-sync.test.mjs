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
  ['term-test-1-k56-computer-based', 'student-cache-v1', 'verified', '-confirmed-departure-v1'],
  ['term-test-2-k56-computer-based', 'student-cache-v2', 'verified', '-confirmed-departure-v2'],
  ['term-test-1-computer-based', 'student-cache-v2'],
  ['term-test-2-computer-based', 'student-cache-v2'],
  ['term-test-1-k56-computer-based', 'demo-journal-v1', 'verified', '-confirmed-departure-v1'],
  ['term-test-2-k56-computer-based', 'demo-journal-v1', 'verified', '-confirmed-departure-v2'],
  ['mini-test-k56-computer-based', 'mini-student-cache-v2'],
  ['mini-test-lesson-5-computer-based', 'mini-student-cache-v3']
];
for (const [route, kind, pinnedRelease, variant = ''] of targets) {
  const release = pinnedRelease || (kind === 'demo-journal-v1' ? 'ready' : 'verified');
  test(route + ' / ' + kind + ' loads the same build online and offline', async () => {
    const base = new URL(route + '/', root);
    const demo = kind === 'demo-journal-v1';
    const entry = demo ? kind + '/index' : 'index-' + kind;
    const manifest = demo ? kind + '/offline-assets' : 'offline-assets-' + kind;
    const published = new URL(demo ? kind + '/index.html' : 'index.html', base);
    const pinned = entry + '-preview-' + release + '-v1' + variant + '.html';
    const html = await text(published);
    assert.equal(html, await text(new URL(pinned, base)));
    const previewHelper = release === 'verified' ? 'shared/cbt-audio-preview-fast-pilot-v1.js' : helper;
    assert.ok(html.includes('src="../' + previewHelper + '"'));
    const { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } = await import(new URL(manifest + '-preview-' + release + '-v1' + variant + '.mjs', base));
    assert.deepEqual(new Set(ASSETS), new Set(Object.keys(ASSET_HASHES)));
    assert.equal(ASSET_BUILD_ID, sha(JSON.stringify(ASSET_HASHES)));
    for (const name of ASSETS) {
      const file = new URL(name, base);
      const bytes = /\.(html|js|mjs|css|svg)$/.test(file.pathname) ? await text(file) : await readFile(file);
      assert.equal(sha(bytes), ASSET_HASHES[name], name);
    }
    assert.ok(ASSETS.includes('../' + previewHelper));
    if (release === 'verified' && demo) assert.ok(ASSETS.includes(kind + '/offline-worker-preview-verified-v1' + variant + '.js'));
    assert.ok(ASSETS.includes(pinned));
    if (route === 'term-test-1-computer-based' || route === 'term-test-2-computer-based') {
      const app = ASSETS.find(asset => asset.startsWith('../shared/app-term') && asset.endsWith('-preview-' + release + '-v1.js'));
      assert.ok(app, 'Include the app used after Reading');
      const appScript = await text(new URL(app, base));
      assert.ok(appScript.includes("{mountContinuityStart}=await import('../k67-shared/offline-journey-ui-term2-audio-v2-preview-" + release + "-v1.mjs"));
    }
  });
}

for (const [route, kind, pinnedRelease] of targets) {
  const release = pinnedRelease || (kind === 'demo-journal-v1' ? 'ready' : 'verified');
  test(route + ' / ' + kind + ' enforces preview and exam readiness', async () => {
    const base = new URL(route + '/', root);
    const html = await text(new URL(kind === 'demo-journal-v1' ? kind + '/index.html' : 'index.html', base));
    const boot = html.match(/(?:src|data-bootstrap)="([^"?]*bootstrap-[^"?]*-preview-(?:ready|verified)-v1(?:-protected-listening-v[12]|-confirmed-departure-v[12])?\.js)\?/)[1];
    const script = await text(new URL(boot, base));
    const availability = script.match(/  function setStartAvailability\(\) \{[\s\S]*?\n  \}/)[0];
    const offline = { record: { prepared: { offline: true } }, active: false };
    const isK56 = route.includes('-k56-');
    const player = { ready: false, canPlay: false };
    const elements = {
      bootstrapPreview: {}, bootstrapPreviewStep: {dataset: {state: 'active'}},
      bootstrapVolume: {}, bootstrapPreviewStatus: {}, bootstrapStart: {removeAttribute() {}, setAttribute() {}}, bootstrapStartStep: {dataset: {}},
      bootstrapStartStatus: {}, bootstrapRetry: {hidden: true}
    };
    const scope = {
      elements, preparing: true, previewObjectUrl: 'blob:preview', previewHeard: false,
      sampleReady: false, sampleFailed: false, previewAudio: {paused: true, readyState: 0}, pendingListeningPreview: false,
      state: {}, timerOnly: false, legacyListeningResume: false, encryptedAudio: {}, preparedPlayer: player,
      term1Offline: offline, term2Offline: offline, miniOffline: offline,
      miniJourney: {needsAudio: () => true, continuationConfirmation: () => null,
        view: () => ({nextSection: 'listening', examMode: 'lis_first'}), continuity: () => true},
      journeyPlayer: player, window: {}
    };
    const update = runInNewContext(availability + '\nsetStartAvailability', scope);
    const buttons = () => [elements.bootstrapPreview.disabled, elements.bootstrapStart.disabled];
    update();
    assert.deepEqual(buttons(), [true, true]);

    const previewNeedsExam = release === 'ready';
    scope.sampleReady = true;
    scope.previewAudio.readyState = 3;
    if (release === 'verified' && isK56) {
      scope.encryptedAudio = null;
      update();
      assert.deepEqual(buttons(), [true, true], 'Preview requires the full verified audio');
      scope.encryptedAudio = {};
    }
    update();
    assert.deepEqual(buttons(), [previewNeedsExam, true]);

    scope.preparing = false;
    update();
    assert.deepEqual(buttons(), [previewNeedsExam, true]);

    player.ready = player.canPlay = true;
    if (isK56) {
      if (!previewNeedsExam) scope.previewHeard = true;
      update();
      assert.deepEqual(buttons(), [previewNeedsExam, true], 'The offline package is still being prepared');
      if (release === 'verified') assert.match(elements.bootstrapStartStatus.textContent, /Đã nghe đủ 10 giây/);
      scope.previewHeard = false;
      offline.active = true;
    }
    update();
    assert.deepEqual(buttons(), [false, true]);
    scope.previewHeard = true;
    update();
    assert.deepEqual(buttons(), [false, false]);
  });
}

test('K67 Reading-first inline preview waits for its player and can retry preparation', async () => {
  const ui = await text(new URL('k67-shared/offline-journey-ui-term2-audio-v2-preview-ready-v1.mjs', root));
  const definition = ui.match(/export async function mountContinuityStart[\s\S]*?\n\}/)[0].replace('export ', '');
  const node = () => ({
    events: {}, setAttribute() {}, addEventListener(event, fn) { this.events[event] = fn; }
  });
  const preview = {...node(), paused: true, async play() { this.paused = false; }, pause() { this.paused = true; }};
  const sample = node();
  const status = node();
  const start = node();
  const controls = {audio: preview, button: sample, p: status};
  const window = {IZONE_CBT_AUDIO_START_LABEL() {}};
  let confirmPreview;
  window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW = (_preview, _start, confirm) => { confirmPreview = confirm; };
  const mount = runInNewContext(definition + '\nmountContinuityStart', {
    window, document: {createElement: type => controls[type]}
  });
  let attempts = 0;
  let allowRetry;
  const readyAfterRetry = new Promise(resolve => { allowRetry = resolve; });
  const journey = {
    async preparePlayer() {
      attempts++;
      return {url: 'blob:test', canPlay: true, ready: attempts === 1
        ? Promise.reject(new Error('Audio decoder failed')) : readyAfterRetry};
    }
  };
  await mount({host: {append() {}}, start, journey, volume: 1});
  assert.equal(sample.textContent, 'Thử tải lại audio');
  assert.equal(start.disabled, true);
  const retrying = sample.events.click();
  assert.equal(sample.disabled, true);
  assert.equal(start.disabled, true);
  allowRetry();
  await retrying;
  assert.equal(sample.textContent, 'Nghe thử');
  assert.equal(sample.disabled, false);
  assert.equal(start.disabled, true);

  await sample.events.click();
  assert.equal(start.disabled, true);
  confirmPreview();
  assert.equal(start.disabled, false);
  assert.equal(preview.paused, true);
});

import { SkillOffline } from './reading-offline.mjs?v=20261109-v4';

const form = document.getElementById('skillIdentity');
const dialog = document.getElementById('identityConfirm');
const codeField = document.getElementById('activationCode');
const notice = document.getElementById('bootstrapNotice');
const confirm = document.getElementById('confirmIdentity');
const classCode = (new URLSearchParams(location.search).get('class') || '').trim().toUpperCase();
const grant = new URLSearchParams(location.hash.slice(1)).get('g') || '';
const validGrant = /^([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\.[A-Za-z0-9_-]{43}$/i.exec(grant);
const skill = ['listening', 'writing'].includes(document.body.dataset.term1Skill) ? document.body.dataset.term1Skill : 'reading';
const listening = skill === 'listening';
const transport = listening ? { audioTransport: 'r2-direct-v1' } : {};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(Error('Chưa tải được giao diện bài làm. Hãy mở lại link.')), { once: true });
    document.body.append(script);
  });
}

async function enter(runtime, audio) {
  const { prepared, snapshot } = runtime.record;
  window.K56_TERM1_OFFLINE = runtime;
  window.TERM_TEST_STORAGE_SCOPE = ':' + skill + '-fallback:' + runtime.grantId;
  window.TERM_TEST_CONTENT = prepared.content;
  window.TERM_TEST_BOOTSTRAP = Object.freeze({ sessionState: snapshot, skipListeningAudio: !audio, officialAudioElement: audio, audioVolume: audio?.volume,
    examSessionToken: prepared.examSessionToken, generation: prepared.generation,
    annotationRunId: runtime.grantId, serverNow: prepared.serverNow });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Giao diện chưa sẵn sàng. Hãy mở lại link.')), 15000);
    window.addEventListener('term1:app-ready', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
  await Promise.all([ready, loadScript('../k56-shared/app.js?v=20261109-term1-skill-review-v1')]);
  if (prepared.content[skill]) {
    await loadScript('../term-test-1-k56-computer-based/enhance.js?v=20261108-term1-skill-fallback-v3');
    await loadScript('../term-test-1-k56-computer-based/annotations.js?v=20261018-identity-v1');
  }
  void runtime.flush();
}

async function finishPreparation(runtime, opened) {
  if (!listening || runtime.record.sections.listening?.sealed) return runtime.finishReadingPreparation();
  const { AUDIO, downloadWhole } = await import('../term-test-1-k56-computer-based/audio-whole.mjs?v=20261107-k56-r2-v1');
  const refresh = async () => {
    const response = await runtime.post('/skill-fallback/open', {
      classCode, ownerId: runtime.scope.ownerId, studentRef: runtime.record.studentRef, section: skill, ...transport
    }, false);
    if (response.grantId !== runtime.grantId || response.section !== skill || response.submitted) throw Error('Quyền tải audio đã thay đổi.');
    return { manifest: { envelopeVersion: 'MP3', url: AUDIO.pagesUrl, sha256: AUDIO.sha256, byteLength: AUDIO.bytes }, download: response.audioDownload };
  };
  const blob = await downloadWhole({ audioDownload: opened ? opened.audioDownload : (await refresh()).download, refresh,
    onProgress: ({ loaded, total }) => { notice.textContent = `Đang tải và kiểm tra audio · ${Math.floor(loaded * 100 / total)}%`; } });
  const probe = await makeAudio(blob);
  URL.revokeObjectURL(probe.src);
  probe.removeAttribute('src');
  await runtime.finishPreparation(blob);
}

async function makeAudio(blob) {
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  audio.hidden = true;
  audio.src = URL.createObjectURL(blob);
  audio.addEventListener('ratechange', () => { if (audio.playbackRate !== 1) audio.playbackRate = 1; });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Chưa đọc được audio. Hãy mở lại link để thử lại.')), 8000);
      audio.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve(); }, { once: true });
      audio.addEventListener('error', () => { clearTimeout(timer); reject(Error('Không phát được audio đã tải.')); }, { once: true });
    });
    if (!Number.isFinite(audio.duration) || Math.abs(audio.duration - 1848) > 2) throw Error('Thời lượng audio chưa khớp Term Test 1.');
    return audio;
  } catch (error) { URL.revokeObjectURL(audio.src); throw error; }
}

async function showListening(runtime) {
  if (!listening || runtime.record.sections.listening?.sealed) return enter(runtime);
  const blob = await runtime.audio();
  async function begin(resuming = false, volume = 1) {
    const audio = await makeAudio(blob);
    audio.volume = volume;
    document.body.append(audio);
    if (!resuming) await runtime.start('listening');
    await enter(runtime, audio);
    if (runtime.record.player.ended) {
      const form = document.getElementById('listeningView');
      const submit = document.createElement('button');
      submit.type = 'submit'; submit.hidden = true; submit.dataset.autoSubmit = 'true';
      form.append(submit); form.requestSubmit(submit);
      return;
    }
    if (!runtime.record.player.held) {
      try { await audio.play(); } catch { window.K56_LISTENING_AUDIO?.playBlocked(); }
    }
  }
  if (runtime.record.sections.listening?.startedAt) return begin(true);
  const panel = document.getElementById('skillAudioLobby');
  const previewButton = document.getElementById('skillPreview');
  const previewStatus = document.getElementById('skillPreviewStatus');
  const start = document.getElementById('skillStart');
  const volume = document.getElementById('skillVolume');
  const preview = await makeAudio(blob);
  form.hidden = true;
  notice.hidden = true;
  document.querySelector('.cbt-lobby-badge').textContent = 'Phòng chờ Listening';
  document.getElementById('securePrepTitle').textContent = 'Kiểm tra âm thanh trước khi bắt đầu';
  document.querySelector('.cbt-lobby-header > p').textContent = 'Audio được tải đủ và kiểm tra trước khi bạn bấm Bắt đầu.';
  panel.hidden = false;
  let playbackStarted = 0;
  volume.addEventListener('input', () => { preview.volume = Number(volume.value); });
  previewButton.addEventListener('click', async () => {
    if (!preview.paused) { preview.pause(); return; }
    preview.currentTime = 0;
    playbackStarted = performance.now();
    try { await preview.play(); } catch (error) { showError(error); }
  });
  preview.addEventListener('play', () => { previewButton.textContent = 'Dừng nghe thử'; });
  preview.addEventListener('pause', () => {
    previewButton.textContent = 'Nghe lại 30 giây đầu';
    previewStatus.textContent = preview.currentTime >= 30 ? 'Đã nghe đủ 30 giây. Bạn có thể bắt đầu thi.' : 'Đã dừng nghe thử.';
  });
  preview.addEventListener('timeupdate', () => {
    if (!preview.paused && preview.currentTime < 30) {
      previewStatus.textContent = 'Đang nghe thử · 00:' + String(Math.floor(preview.currentTime)).padStart(2, '0') + ' / 00:30';
    }
    if (preview.currentTime >= 30) preview.pause();
    if (preview.currentTime >= 10 && performance.now() - playbackStarted >= 10000) {
      start.disabled = false;
      previewButton.closest('.cbt-lobby-step').dataset.state = 'complete';
      start.closest('.cbt-lobby-step').dataset.state = 'active';
    }
  });
  start.addEventListener('click', async () => {
    start.disabled = true;
    preview.pause();
    try { await begin(false, Number(volume.value)); URL.revokeObjectURL(preview.src); }
    catch (error) { start.disabled = false; showError(error); }
  });
}

async function initialize() {
  if (!validGrant || !/^[A-Z0-9._-]{2,32}$/.test(classCode)) throw Error('Link dự phòng chưa đầy đủ. Hãy dùng link giảng viên đã gửi.');
  document.getElementById('bootstrapClass').textContent = 'Lớp ' + classCode;
  const runtime = await new SkillOffline({ apiBase: window.TERM_TEST_APP_CONFIG.API_BASE_URL, classCode, grant, grantId: validGrant[1], skill }).open();
  if (runtime.active) return showListening(runtime);
  if (runtime.record) {
    notice.textContent = 'Đang hoàn tất lưu trang để mở lại khi mất mạng…';
    await finishPreparation(runtime);
    return showListening(runtime);
  }
  const ownerKey = 'owner:' + runtime.grantId;
  const remembered = await runtime.store.get(ownerKey);
  const ownerId = remembered?.ownerId || crypto.randomUUID();
  if (!remembered) await runtime.store.put(ownerKey, { ownerId });
  const base = { classCode, ownerId, section: skill };
  let identity, activationCode;
  form.hidden = false;
  notice.hidden = true;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    event.submitter.disabled = true;
    try {
      const code = codeField.value.trim();
      identity = await runtime.post('/skill-fallback/identify', { ...base, activationCode: code }, false);
      activationCode = code;
      codeField.value = '';
      notice.hidden = true;
      document.getElementById('confirmStudentName').textContent = identity.studentName;
      document.getElementById('confirmClassName').textContent = identity.classCode;
      dialog.showModal();
    } catch (error) { showError(error); }
    finally { event.submitter.disabled = false; }
  });
  document.getElementById('cancelIdentity').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { activationCode = ''; identity = null; });
  confirm.addEventListener('click', async () => {
    if (!identity) return;
    confirm.disabled = true;
    try {
      const opened = await runtime.post('/skill-fallback/open', { ...base, ...transport, activationCode, studentRef: identity.studentRef }, false);
      const selected = identity;
      dialog.close();
      notice.hidden = false;
      notice.textContent = 'Đang lưu trang để có thể mở lại khi mất mạng…';
      await runtime.prepareSkill(opened, selected, ownerId);
      await finishPreparation(runtime, opened);
      await showListening(runtime);
    } catch (error) { dialog.close(); showError(error); }
    finally { confirm.disabled = false; }
  });
}

function showError(error) {
  if (!notice.isConnected) {
    const target = document.getElementById('notice');
    if (target) { target.textContent = error.message; target.hidden = false; }
    return;
  }
  notice.textContent = error.message;
  notice.hidden = false;
}

initialize().catch(showError);

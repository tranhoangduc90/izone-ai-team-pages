import { ExamStore, SkillOffline } from './reading-offline.mjs?v=20261110-continuity-v1';
import { isK56ClassCode, renderK56ClassEntry } from '../k56-offline-shared/class-entry.mjs';

const form = document.getElementById('skillIdentity');
const notice = document.getElementById('bootstrapNotice');
const query = new URLSearchParams(location.search);
let classCode = (query.get('class') || '').trim().toUpperCase();
const grant = new URLSearchParams(location.hash.slice(1)).get('g') || '';
const validGrant = /^([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\.[A-Za-z0-9_-]{43}$/i.exec(grant);
const skill = ['listening', 'writing'].includes(document.body.dataset.term1Skill) ? document.body.dataset.term1Skill : 'reading';
const listening = skill === 'listening';
const transport = listening ? { audioTransport: 'r2-direct-v1' } : {};
const volumeKey = 'term1-k56-skill-fallback:audio-volume';

function savedVolume() {
  try { return Math.min(1, Math.max(0.1, Number(localStorage.getItem(volumeKey)) || 1)); }
  catch { return 1; }
}

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
  if (!listening || runtime.record.sections.listening?.sealed || runtime.record.sections.listening?.interrupted)
    return runtime.finishReadingPreparation();
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
  if (!runtime.listeningContinuity) {
    const probe = await makeAudio(blob);
    URL.revokeObjectURL(probe.src);
    probe.removeAttribute('src');
  }
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
  const continuity = runtime.listeningContinuity;
  if (continuity && runtime.record.sections.listening?.startedAt && !runtime.record.player.ended) {
    if (!runtime.record.sections.listening.interrupted) await runtime.interruptListening('page_interrupted');
    runtime.showListeningInterruption();
    return;
  }
  const blob = await runtime.audio();
  let preparedPlayer;
  async function begin(resuming = false, volume = savedVolume()) {
    const audio = preparedPlayer?.audio ?? await makeAudio(blob);
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
  const previewStep = document.getElementById('skillPreviewStep');
  const start = document.getElementById('skillStart');
  const startStep = document.getElementById('skillStartStep');
  const volume = document.getElementById('skillVolume');
  let previewHeard = false;
  const unlock = () => {
    if (previewHeard && (!continuity || preparedPlayer?.ready)) {
      start.disabled = false;
      startStep.dataset.state = 'active';
      window.IZONE_CBT_AUDIO_START_LABEL(start, true);
    }
  };
  if (continuity) {
    preparedPlayer = runtime.preloadListening(blob, unlock, () => showError(Error('Trình phát chính chưa đọc được audio.')));
    preparedPlayer.audio.controls = false;
  }
  const preview = await makeAudio(blob);
  volume.value = preview.volume = savedVolume();
  form.hidden = true;
  notice.hidden = true;
  document.querySelector('.cbt-lobby-badge').textContent = 'Phòng chờ Listening';
  document.getElementById('securePrepTitle').textContent = 'Kiểm tra âm thanh trước khi bắt đầu';
  document.querySelector('.cbt-lobby-header > p').textContent = 'Audio được tải đủ và kiểm tra trước khi bạn bấm Bắt đầu.';
  panel.hidden = false;
  volume.addEventListener('input', () => {
    preview.volume = Number(volume.value);
    try { localStorage.setItem(volumeKey, volume.value); } catch {}
  });
  previewButton.addEventListener('click', async () => {
    if (!preview.paused) { preview.pause(); return; }
    preview.currentTime = 0;
    try {
      await preview.play();
      previewButton.textContent = 'Dừng nghe thử';
      previewStep.dataset.state = 'active';
      if (!previewHeard) {
        window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW(preview, start, () => {
          previewHeard = true;
          previewStep.dataset.state = 'complete';
          unlock();
        });
      }
      previewStatus.textContent = 'Đang nghe thử · ' + (continuity ? 10 : 30) + ' giây.';
      runtime.observe('listening_preview_playing', { playbackRate: preview.playbackRate, volume: preview.volume });
    } catch (error) {
      previewStatus.textContent = 'Trình duyệt chưa cho phát. Hãy nhấn lại nút nghe thử.';
      runtime.observe('listening_preview_failed', { errorCode: error.name });
    }
  });
  preview.addEventListener('pause', () => {
    previewButton.textContent = 'Nghe lại ' + (continuity ? 10 : 30) + ' giây đầu';
    previewStatus.textContent = previewHeard ? 'Đã nghe đủ đoạn thử.' : 'Đã dừng nghe thử.';
  });
  preview.addEventListener('timeupdate', () => {
    const seconds = continuity ? 10 : 30;
    if (!preview.paused && preview.currentTime < seconds) {
      previewStatus.textContent = 'Đang nghe thử · 00:' + String(Math.floor(preview.currentTime)).padStart(2, '0') + ' / 00:' + seconds;
    }
    if (preview.currentTime >= seconds && (!continuity || previewHeard)) preview.pause();
  });
  start.addEventListener('click', async () => {
    if (continuity && (!preparedPlayer?.ready || !previewHeard)) return;
    runtime.listeningStartIntent = performance.now();
    start.disabled = true;
    start.textContent = 'Đang mở đề và audio...';
    preview.pause();
    try { await begin(false, Number(volume.value)); URL.revokeObjectURL(preview.src); }
    catch (error) {
      start.disabled = false;
      window.IZONE_CBT_AUDIO_START_LABEL(start, true);
      showError(error);
    }
  });
}

async function initialize() {
  if (!validGrant) return initializeRoster();
  if (!/^[A-Z0-9._-]{2,32}$/.test(classCode)) return initializeRoster();
  document.getElementById('bootstrapClass').textContent = 'Lớp ' + classCode;
  const runtime = await new SkillOffline({ apiBase: window.TERM_TEST_APP_CONFIG.API_BASE_URL, classCode, grant, grantId: validGrant[1], skill }).open({ existingOnly: true });
  if (runtime.active) return showListening(runtime);
  if (runtime.record) {
    notice.textContent = 'Đang hoàn tất lưu trang để mở lại khi mất mạng…';
    await finishPreparation(runtime);
    return showListening(runtime);
  }
  return initializeRoster();
}

async function initializeRoster() {
  const apiBase = window.TERM_TEST_APP_CONFIG.API_BASE_URL;
  const store = new ExamStore();
  await store.open();
  const lastKey = 'roster-last:' + skill;
  const remembered = await store.get(lastKey);
  const sharedLastKey = 'roster-last';
  const sharedRemembered = await store.get(sharedLastKey);
  const helper = document.querySelector('.cbt-lobby-header > p');
  helper.textContent = 'Chọn lớp và họ tên để vào bài.';
  if (!classCode) classCode = remembered?.classCode || sharedRemembered?.classCode || '';
  const candidate = remembered?.classCode === classCode ? remembered : sharedRemembered;
  const chooseClass = code => {
    query.set('class', code);
    location.assign(location.pathname + '?' + query);
  };
  const classPicker = renderK56ClassEntry(document.querySelector('.cbt-lobby-header'), chooseClass);
  const classInput = classPicker.querySelector('input');
  classInput.value = classCode;
  if (!isK56ClassCode(classCode)) {
    notice.hidden = true;
    return;
  }
  const studentSelect = form.querySelector('select');
  document.getElementById('bootstrapClass').textContent = 'Lớp ' + classCode;
  let activeRuntime;
  let activeToken;
  const identityKey = ref => 'roster-owner:' + skill + ':' + classCode + ':' + ref;
  const resume = async entry => {
    if (!activeRuntime || activeToken !== entry.token) {
      activeRuntime = await new SkillOffline({ apiBase, classCode, skill, grant: entry.token,
        grantId: entry.token.split('.')[0] }).open();
      activeToken = entry.token;
    }
    if (activeRuntime.active) return showListening(activeRuntime);
    if (activeRuntime.record) {
      await finishPreparation(activeRuntime);
      return showListening(activeRuntime);
    }
    const identity = await activeRuntime.post('/skill-fallback/enroll', {
      classCode, studentRef: entry.studentRef, ownerId: entry.ownerId, section: skill,
      examMode: query.get('mode') === 'read_first' ? 'read_first' : 'lis_first'
    }, false);
    const opened = await activeRuntime.post('/skill-fallback/open', {
      classCode, studentRef: entry.studentRef, ownerId: entry.ownerId, section: skill, ...transport
    }, false);
    await activeRuntime.prepareSkill(opened, identity, entry.ownerId);
    await finishPreparation(activeRuntime, opened);
    return showListening(activeRuntime);
  };
  if (remembered?.classCode === classCode && remembered.studentRef) {
    const entry = await store.get(identityKey(remembered.studentRef));
    const existing = entry && await store.get('run:' + entry.token.split('.')[0]);
    if (existing) {
      classPicker.hidden = true;
      return resume(entry);
    }
  }
  notice.hidden = false;
  notice.textContent = 'Đang tải danh sách học viên…';
  const roster = await fetch(apiBase + '/api/term-tests/roster?' + new URLSearchParams({
    class: classCode, test: 'term-test-1-k56'
  }), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  const body = await roster.json();
  if (!roster.ok) throw Error(body.message || 'Chưa tải được danh sách. Kiểm tra mã lớp rồi thử lại.');
  const students = Array.isArray(body.students) ? body.students : [];
  studentSelect.required = true;
  studentSelect.replaceChildren(new Option('Chọn họ và tên', ''), ...students.map(student => new Option(student.name, student.ref)));
  if (candidate?.classCode === classCode && students.some(student => student.ref === candidate.studentRef))
    studentSelect.value = candidate.studentRef;
  if (!students.length) throw Error('Lớp chưa có danh sách học viên cho bài này.');
  form.hidden = false;
  notice.hidden = true;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const studentRef = studentSelect.value;
    if (!students.some(student => student.ref === studentRef)) return;
    const button = event.submitter;
    button.disabled = true;
    try {
      const key = identityKey(studentRef);
      const getEntry = async () => {
        const current = await store.get(key);
        if (current) return current;
        const secret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
          .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
        const created = { studentRef, ownerId: crypto.randomUUID(), token: crypto.randomUUID() + '.' + secret };
        await store.put(key, created);
        return created;
      };
      const entry = navigator.locks ? await navigator.locks.request(key, getEntry) : await getEntry();
      const selection = { classCode, studentRef };
      await store.put(lastKey, selection);
      await store.put(sharedLastKey, selection).catch(() => {});
      classPicker.hidden = true;
      form.hidden = true;
      notice.hidden = false;
      notice.textContent = 'Đang chuẩn bị bài để có thể làm tiếp khi mất mạng…';
      await resume(entry);
    } catch (error) {
      if (form.isConnected) {
        classPicker.hidden = false;
        form.hidden = false;
      }
      showError(error);
    } finally { button.disabled = false; }
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

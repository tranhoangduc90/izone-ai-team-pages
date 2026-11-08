import { ReadingOffline } from './reading-offline.mjs?v=20261108-v1';

const form = document.getElementById('skillIdentity');
const dialog = document.getElementById('identityConfirm');
const codeField = document.getElementById('activationCode');
const notice = document.getElementById('bootstrapNotice');
const confirm = document.getElementById('confirmIdentity');
const classCode = (new URLSearchParams(location.search).get('class') || '').trim().toUpperCase();
const grant = new URLSearchParams(location.hash.slice(1)).get('g') || '';
const validGrant = /^([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\.[A-Za-z0-9_-]{43}$/i.exec(grant);

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(Error('Chưa tải được giao diện bài làm. Hãy mở lại link.')), { once: true });
    document.body.append(script);
  });
}

async function enter(runtime) {
  const { prepared, snapshot } = runtime.record;
  window.K56_TERM1_OFFLINE = runtime;
  window.TERM_TEST_STORAGE_SCOPE = ':reading-fallback:' + runtime.grantId;
  window.TERM_TEST_CONTENT = prepared.content;
  window.TERM_TEST_BOOTSTRAP = Object.freeze({ sessionState: snapshot, skipListeningAudio: true,
    examSessionToken: prepared.examSessionToken, generation: prepared.generation,
    annotationRunId: runtime.grantId, serverNow: prepared.serverNow });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Giao diện chưa sẵn sàng. Hãy mở lại link.')), 15000);
    window.addEventListener('term1:app-ready', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
  await Promise.all([ready, loadScript('../k56-shared/app.js?v=20261108-term1-reading-fallback-v1')]);
  if (prepared.content.reading) {
    await loadScript('../term-test-1-k56-computer-based/enhance.js?v=20261108-term1-reading-fallback-v1');
    await loadScript('../term-test-1-k56-computer-based/annotations.js?v=20261018-identity-v1');
  }
  void runtime.flush();
}

async function initialize() {
  if (!validGrant || !/^[A-Z0-9._-]{2,32}$/.test(classCode)) throw Error('Link dự phòng chưa đầy đủ. Hãy dùng link giảng viên đã gửi.');
  document.getElementById('bootstrapClass').textContent = 'Lớp ' + classCode;
  const runtime = await new ReadingOffline({ apiBase: window.TERM_TEST_APP_CONFIG.API_BASE_URL, classCode, grant, grantId: validGrant[1] }).open();
  if (runtime.active) return enter(runtime);
  if (runtime.record) {
    notice.textContent = 'Đang hoàn tất lưu trang để mở lại khi mất mạng…';
    await runtime.finishReadingPreparation();
    return enter(runtime);
  }
  const ownerKey = 'owner:' + runtime.grantId;
  const remembered = await runtime.store.get(ownerKey);
  const ownerId = remembered?.ownerId || crypto.randomUUID();
  if (!remembered) await runtime.store.put(ownerKey, { ownerId });
  const base = { classCode, ownerId, section: 'reading' };
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
      const opened = await runtime.post('/skill-fallback/open', { ...base, activationCode, studentRef: identity.studentRef }, false);
      const selected = identity;
      dialog.close();
      notice.hidden = false;
      notice.textContent = 'Đang lưu trang để có thể mở lại khi mất mạng…';
      await runtime.prepareReading(opened, selected, ownerId);
      await enter(runtime);
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

(async function () {
  'use strict';

  const testConfig = window.TERM_TEST_CONFIG;
  const appConfig = window.TERM_TEST_APP_CONFIG;
  const audioLoader = window.TERM_TEST_AUDIO_LOADER;
  const root = document.getElementById('app');
  const scriptAssetBase = new URL('.', document.currentScript?.src || window.location.href).toString().replace(/\/$/, '');
  const query = new URLSearchParams(window.location.search);
  let classCode = (query.get('class') || '').trim().toUpperCase();
  const retakeConfig = window.TERM_TEST_RETAKE_CONFIG || {};
  const listeningOnly = retakeConfig.mode === 'listening-only';
  const configuredRetakeGrant = String(retakeConfig.grant || '').trim();
  const retakeGrant = listeningOnly && /^[A-Za-z0-9_-]{40,1800}\.[A-Za-z0-9_-]{43}$/.test(configuredRetakeGrant)
    ? configuredRetakeGrant
    : '';
  const launchStudentRef = listeningOnly ? (query.get('student') || '').trim() : '';
  const demoStudentRef = classCode === 'CODEXDEMO806' ? (query.get('demoStudent') || '').trim() : '';
  const demoAttemptToken = classCode === 'CODEXDEMO806' ? (query.get('demoAttempt') || '').trim() : '';
  const demoJourneyEntry = classCode === 'CODEXDEMO806' && !demoStudentRef && !demoAttemptToken;
  if (!testConfig || !appConfig || !audioLoader || !root) return;
  if(!window.IZONE_EXAM_DEVICE_CHECKED)await loadScript('../shared/desktop-exam-guard.js?v=20261027-v1&resilience=20261027-v1');
  if(window.IZONE_EXAM_DEVICE_BLOCKED)return;
  const {beginAudioDownloadStatus} = await import('../shared/cbt-audio-download-status.mjs?v=20261111-audio-status-v1');
  if(!window.IZONE_AUDIO_SOURCE_CHOICE)await loadScript('../shared/audio-source-choice.js?v=20261027-v1&audio=20261028-part-rescue-v1&status=20261111-audio-status-v1');
  if(!window.IZONE_EXAM_CLOCK)await loadScript('../shared/exam-clock.js?v=20261026-v1&resilience=20261027-v1');
  document.body.classList.add('cbt-mode');

  let shortcutNoticeTimer = 0;

  function showBlockedShortcutNotice() {
    let notice = document.getElementById('cbtBlockedShortcutNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'cbtBlockedShortcutNotice';
      notice.className = 'cbt-blocked-shortcut-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      document.body.append(notice);
    }
    notice.textContent = 'Tính năng tìm kiếm trong trang đã bị tắt trong bài thi.';
    notice.hidden = false;
    window.clearTimeout(shortcutNoticeTimer);
    shortcutNoticeTimer = window.setTimeout(() => {
      notice.hidden = true;
    }, 2600);
  }

  function blockInPageSearchShortcuts(event) {
    const key = String(event.key || '').toLowerCase();
    const code = String(event.code || '');
    const modifierPressed = event.ctrlKey || event.metaKey;
    const opensFindBar = modifierPressed && (key === 'f' || code === 'KeyF');
    const repeatsFind = modifierPressed && (key === 'g' || code === 'KeyG');
    const repeatsFindWithFunctionKey = key === 'f3' || code === 'F3';
    if (!opensFindBar && !repeatsFind && !repeatsFindWithFunctionKey) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    showBlockedShortcutNotice();
  }

  document.addEventListener('keydown', blockInPageSearchShortcuts, { capture: true });

  const baseStorageScope = listeningOnly ? String(retakeConfig.storageScope || ':listening-retake:missing') : '';
  let storageScope = baseStorageScope;
  let storageKey = `izone-test:${testConfig.slug}:${classCode}${storageScope}`;
  let uiStorageKey = `izone-test-ui:${testConfig.slug}:${classCode}${storageScope}`;
  let sharedIdentity = null, entryIdentity = null, rememberedClasses = [];
  if (classCode !== 'CODEXDEMO806') {
    try {
      const module = await import('../../shared/test-student-identity.js?v=20261018-identity-v1');
      const createIdentity = () => module.createTestStudentIdentity({ product: testConfig.slug, classCode,
        suffix: baseStorageScope, getStorages: availableStorages,
        requestIdentity: input => apiRequest(`/api/term-tests/${testConfig.slug}/student-identity`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
        }) });
      sharedIdentity = createIdentity();
      await sharedIdentity.migrateLegacy();
      if (!classCode && sharedIdentity.read().status === 'ok') {
        root.innerHTML = '<main class="page-shell"><section class="panel" role="status">Đang tìm lớp của bạn trong bài test...</section></main>';
        entryIdentity = await sharedIdentity.resolveRemembered();
        if (entryIdentity.status === 'unique') {
          classCode = entryIdentity.resolution.aliases[0].classCode;
          query.set('class', classCode);
          try{history.replaceState(history.state, '', `${location.pathname}?${query.toString()}${location.hash}`);}catch{/* URL không được chặn xử lý bài hoặc màn đang xem. */}
          sharedIdentity = createIdentity();
        } else if (entryIdentity.status === 'ambiguous') {
          rememberedClasses = [...new Set(entryIdentity.resolution.aliases.map(alias => alias.classCode))];
        }
      }
      applyStorageBinding(sharedIdentity.current());
    } catch {
      root.textContent = 'Chưa tải đủ phần mở bài. Hãy tải lại; nháp và lượt thi đã lưu vẫn được giữ.';
      return;
    }
  }
  function applyStorageBinding(binding) {
    window.TERM_TEST_STORAGE_SCOPE = binding.scope;
    window.TERM_TEST_SHARED_IDENTITY_ENABLED = true;
    storageScope = baseStorageScope + binding.scope;
    storageKey = binding.keys?.state || ''; uiStorageKey = binding.keys?.ui || '';
  }
  let state = sharedIdentity ? sharedIdentity.current().state : readState();
  let legacyUiState = readLegacyUiState();
  let legacyListeningResume = Boolean(state.studentRef && !state.attemptToken && legacyUiState.audioStarted);
  let roster = [];
  let activeClassName = classCode;
  let encryptedAudio = null;
  let audioAccess = null, audioScope = null, audioFromCache = false, audioCacheStatus = '';
  let previewObjectUrl = '';
  let officialObjectUrl = '';
  let miniJourney = null;
  let previewHeard = false;
  let journeyPlayer = null;
  let preparing = false;
  let bootstrapSelectionBusy = false;
  let restoredIdentity = null;
  let downloadController = null;
  const studentMemoryForAllClasses = classCode !== 'CODEXDEMO806';
  const studentMemory = { api: null, storage: null, key: '', checkbox: null, status: null, confirm: null, change: null, candidateRef: '', preferred: true };

  root.innerHTML = `
    <header class="topbar cbt-bootstrap-topbar">
      <h1>${escapeText(testConfig.title)}</h1>
    </header>
    <main class="page-shell cbt-bootstrap-shell">
      <section class="panel cbt-bootstrap-card" aria-labelledby="securePrepTitle">
        <header class="cbt-lobby-header">
          <span class="cbt-lobby-badge">Phòng chờ Listening</span>
          <h2 id="securePrepTitle">Kiểm tra âm thanh trước khi bắt đầu</h2>
          <p>Đề thi đang được khóa. Hãy tải đủ audio và nghe thử trước khi bấm Bắt đầu.</p>
        </header>
        <div class="cbt-bootstrap-identity">
          <strong id="bootstrapClass">Lớp ${escapeText(classCode)}</strong>
          <label>Họ và tên
            <select id="bootstrapStudent" required>
              <option value="">Nhấn để chọn</option>
            </select>
          </label>
          <button class="button cbt-demo-reset" id="bootstrapDemoReset" type="button" hidden>Reset dữ liệu học viên</button>
          ${testConfig.allowTemporaryStudents ? `
            <form class="cbt-temporary-student-form" id="bootstrapTemporaryStudentForm" hidden>
              <p>Chỉ dùng khi tên của bạn chưa có trong danh sách. Nhập đúng mã tạm giáo viên đã cấp.</p>
              <label>Họ và tên đầy đủ
                <input id="bootstrapTemporaryStudentName" type="text" minlength="2" maxlength="80" autocomplete="name" required>
              </label>
              <label>Mã tạm
                <input id="bootstrapTemporaryStudentCode" type="text" minlength="2" maxlength="16" pattern="[A-Za-z0-9_\\-]{2,16}" autocomplete="off" autocapitalize="characters" required>
              </label>
              <button class="button button-secondary" id="bootstrapRegisterTemporaryStudent" type="submit">Xác nhận và tải bài thi</button>
            </form>` : ''}
        </div>
        <div class="cbt-lobby-steps">
          <section class="cbt-lobby-step" id="bootstrapDownloadStep" data-state="locked">
            <span class="cbt-lobby-step-number">1</span>
            <div class="cbt-lobby-step-body">
              <h3>Tải đủ audio</h3>
              <p>Chọn họ tên rồi chờ thanh tải đạt 100%.</p>
              <strong class="cbt-audio-status cbt-lobby-download-status" id="bootstrapDownloadStatus" role="status">Đang tải danh sách lớp...</strong>
              <progress class="cbt-audio-progress" id="bootstrapDownloadProgress" max="1" value="0"></progress>
              <button class="button button-secondary" id="bootstrapRetry" type="button" hidden>Thử tải lại</button>
            </div>
          </section>
          <section class="cbt-lobby-step" id="bootstrapPreviewStep" data-state="locked">
            <span class="cbt-lobby-step-number">2</span>
            <div class="cbt-lobby-step-body">
              <h3>Nghe thử 30 giây</h3>
              <p>Bản nghe thử chỉ có 30 giây đầu. Âm lượng này được giữ cho bài thi chính.</p>
              <div class="cbt-lobby-preview-controls">
                <button class="button button-secondary" id="bootstrapPreview" type="button" disabled>Nghe thử 30 giây đầu</button>
                <label class="cbt-volume cbt-lobby-volume"><span>Âm lượng</span><input id="bootstrapVolume" type="range" min="0.1" max="1" step="0.1" value="${Number(state.audioVolume) || legacyUiState.audioVolume || 1}" disabled></label>
              </div>
              <span class="cbt-preview-status" id="bootstrapPreviewStatus" role="status">Chờ tải audio xong.</span>
            </div>
          </section>
          <section class="cbt-lobby-step" id="bootstrapStartStep" data-state="locked">
            <span class="cbt-lobby-step-number">3</span>
            <div class="cbt-lobby-step-body">
              <h3>Bắt đầu thi</h3>
              <p id="bootstrapStartStatus">Đề và audio chính chỉ mở sau nút này.</p>
              <button class="button button-primary" id="bootstrapStart" type="button" disabled>Bắt đầu thi Listening</button>
            </div>
          </section>
        </div>
        <div class="notice" id="bootstrapNotice" role="status" hidden></div>
      </section>
    </main>`;

  const elements = Object.fromEntries([
    'bootstrapStudent', 'bootstrapClass', 'bootstrapDemoReset', 'bootstrapDownloadStep', 'bootstrapDownloadStatus',
    'bootstrapTemporaryStudentForm', 'bootstrapTemporaryStudentName', 'bootstrapTemporaryStudentCode',
    'bootstrapRegisterTemporaryStudent',
    'bootstrapDownloadProgress', 'bootstrapRetry', 'bootstrapPreviewStep', 'bootstrapPreview',
    'bootstrapVolume', 'bootstrapPreviewStatus', 'bootstrapStartStep', 'bootstrapStartStatus',
    'bootstrapStart', 'bootstrapNotice'
  ].map(id => [id, document.getElementById(id)]));
  const previewAudio = document.createElement('audio');
  previewAudio.hidden = true;
  document.body.append(previewAudio);
  const cacheStatus = document.createElement('p');
  cacheStatus.id = 'bootstrapAudioCacheStatus'; cacheStatus.setAttribute('role', 'status');
  // Giữ nguyên phòng chờ thật; trạng thái cache được dùng nội bộ, không thêm hàng UI.

  function memoryEnabled() {
    return studentMemoryForAllClasses && Boolean(studentMemory.api && studentMemory.storage && studentMemory.key);
  }

  function officialStudent(student) {
    return Boolean(studentMemory.api?.officialStudent({ ...student, studentRef: student?.ref }));
  }

  function activeIdentityLocked() {
    return Boolean(state.attemptToken || state.examSessionToken || state.listeningStartedAt || state.listeningDeadlineAt || state.readingStartedAt || state.writingStartedAt);
  }

  function setMemoryStatus(message) {
    if (studentMemory.status) studentMemory.status.textContent = message;
  }

  function refreshRememberedBootstrapStudent() {
    if (!memoryEnabled() || activeIdentityLocked() || bootstrapSelectionBusy) return;
    if (state.studentIdentitySource === 'temporary') {
      studentMemory.api.writeMemory(studentMemory.storage, studentMemory.key, '');
      studentMemory.checkbox.checked = false;
      studentMemory.checkbox.disabled = true;
      studentMemory.confirm.hidden = true;
      setMemoryStatus('Hồ sơ tạm không được ghi nhớ; hãy dùng mã tạm giáo viên đã cấp.');
      return;
    }
    const remembered = studentMemory.api.readMemory(studentMemory.storage, studentMemory.key);
    const matches = roster.filter(student => officialStudent(student) && student.ref === remembered.studentRef);
    const candidate = matches.length === 1 ? matches[0] : null;
    studentMemory.candidateRef = candidate?.ref || '';
    state.studentRef = '';
    state.studentName = '';
    state.studentIdentitySource = '';
    elements.bootstrapStudent.value = candidate?.ref || '';
    studentMemory.confirm.hidden = !candidate;
    setMemoryStatus(candidate
      ? 'Đã chọn sẵn tên của bạn. Hãy xác nhận trước khi tải bài thi.'
      : 'Chỉ ghi nhớ trên thiết bị cá nhân. Bạn vẫn cần xác nhận trước khi tải bài thi.');
  }

  async function initializeStudentMemory() {
    if (sharedIdentity) {
      if (studentMemory.change) return;
      const label = elements.bootstrapStudent.closest('label');
      const remember = document.createElement('label'); remember.className = 'checkbox-row';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = true;
      checkbox.id = 'bootstrap-remember-student'; checkbox.disabled = sharedIdentity.read().status === 'unavailable';
      checkbox.addEventListener('change', () => { studentMemory.preferred = checkbox.checked; });
      remember.append(checkbox, document.createTextNode(' Ghi nhớ tôi trên thiết bị này'));
      const status = document.createElement('p'); status.className = 'muted'; status.id = 'bootstrap-remember-student-status';
      const change = document.createElement('button'); change.type = 'button';
      change.id = 'bootstrap-change-remembered-student'; change.className = 'button button-secondary'; change.textContent = 'Đổi người học';
      label.after(remember, status, change);
      Object.assign(studentMemory, { checkbox, status, change });
      const changeStudent = async () => {
        if ((await sharedIdentity.forget()).status !== 'empty') return false;
        window.TERM_TEST_ALLOW_NAVIGATION = true; location.reload(); return true;
      };
      change.addEventListener('click', async () => {
        if (preparing || bootstrapSelectionBusy) { setMemoryStatus('Đang kiểm phiên. Hãy chờ xong trước khi đổi người học.'); return; }
        if (!await changeStudent()) setMemoryStatus('Chưa đổi được lựa chọn chung. Bài và nháp vẫn được giữ.');
      });
      window.TERM_TEST_CHANGE_STUDENT = changeStudent;
      sharedIdentity.subscribe(() => {
        if (state.studentRef) showNotice('Lựa chọn chung trên trình duyệt đã đổi. Tab này vẫn giữ lượt của người đã chọn.');
      });
      return;
    }
    if (!studentMemoryForAllClasses) return;
    try {
      const api = await import('../../shared/student-memory.js?v=20260905-memory-v3');
      const storage = window.localStorage;
      const label = elements.bootstrapStudent.closest('label');
      if (!label) return;
      const remember = document.createElement('label');
      remember.className = 'checkbox-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'bootstrap-remember-student';
      checkbox.checked = true;
      checkbox.addEventListener('change', () => { studentMemory.preferred = checkbox.checked; });
      remember.append(checkbox, document.createTextNode(' Ghi nhớ tôi trên thiết bị này'));
      const status = document.createElement('p');
      status.id = 'bootstrap-remember-student-status';
      status.className = 'muted';
      const confirm = document.createElement('button');
      confirm.type = 'button'; confirm.id = 'bootstrap-confirm-remembered-student';
      confirm.className = 'button button-primary'; confirm.textContent = 'Xác nhận và tải bài thi'; confirm.hidden = true;
      const change = document.createElement('button');
      change.type = 'button'; change.id = 'bootstrap-change-remembered-student';
      change.className = 'button button-secondary'; change.textContent = 'Đổi người học';
      label.after(remember, status, confirm, change);
      Object.assign(studentMemory, { api, storage, key: api.memoryKey(appConfig.API_BASE_URL, location.href), checkbox, status, confirm, change });
      confirm.addEventListener('click', () => {
        if (elements.bootstrapStudent.value !== studentMemory.candidateRef || activeIdentityLocked()) return;
        elements.bootstrapStudent.dispatchEvent(new Event('change'));
      });
      change.addEventListener('click', async () => {
        if (activeIdentityLocked() || preparing) { showNotice('Bài đang gắn với danh tính hiện tại; không thể đổi người học lúc này.', true); return; }
        if (!studentMemory.api.writeMemory(storage, studentMemory.key, '')) {
          setMemoryStatus('Không thể xóa ghi nhớ trong trình duyệt.');
          return;
        }
        elements.bootstrapStudent.value = '';
        state.studentRef = ''; state.studentName = ''; state.studentIdentitySource = '';
        if (elements.bootstrapTemporaryStudentForm) elements.bootstrapTemporaryStudentForm.hidden = true;
        if (elements.bootstrapTemporaryStudentName) elements.bootstrapTemporaryStudentName.value = '';
        if (elements.bootstrapTemporaryStudentCode) elements.bootstrapTemporaryStudentCode.value = '';
        studentMemory.candidateRef = '';
        studentMemory.confirm.hidden = true;
        studentMemory.checkbox.disabled = false;
        saveState(); setMemoryStatus('Đã quên lựa chọn. Hãy chọn đúng tên trước khi tải bài thi.');
      });
      window.addEventListener('storage', event => {
        if (event.storageArea !== storage || (event.key !== null && event.key !== studentMemory.key)) return;
        if (activeIdentityLocked()) { showNotice('Lựa chọn ghi nhớ đã đổi ở tab khác. Bài hiện tại vẫn giữ đúng danh tính.', false); return; }
        if (bootstrapSelectionBusy) return;
        refreshRememberedBootstrapStudent();
      });
    } catch {
      // Storage/module unavailable: giữ nguyên picker và luồng thi hiện có.
    }
  }

  function escapeText(value) {
    return String(value || '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function classConfirmationLabel() {
    const readableName = String(activeClassName || classCode).trim();
    return readableName.toUpperCase().includes(classCode)
      ? readableName
      : `${readableName} (${classCode})`;
  }

  function confirmStudentIdentity(student) {
    // Dữ liệu vào: hồ sơ vừa được chọn và lớp đã tải từ máy chủ.
    // Việc chính: khóa màn hình bằng popup, cho học viên đọc lại họ tên và lớp.
    // Kết quả: chỉ trả true khi học viên bấm “Xác nhận, tiếp tục”.
    // Khi quay lại hoặc nhấn Escape: trả false, không lưu danh tính và không chuẩn bị bài thi.
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'cbt-identity-confirmation-dialog';
      dialog.setAttribute('aria-labelledby', 'cbtIdentityConfirmationTitle');
      dialog.setAttribute('aria-describedby', 'cbtIdentityConfirmationIntro');

      const card = document.createElement('section');
      card.className = 'cbt-identity-confirmation-card';

      const eyebrow = document.createElement('span');
      eyebrow.className = 'cbt-identity-confirmation-eyebrow';
      eyebrow.textContent = 'Kiểm tra trước khi vào bài';

      const title = document.createElement('h2');
      title.id = 'cbtIdentityConfirmationTitle';
      title.textContent = 'Xác nhận thông tin học viên';

      const intro = document.createElement('p');
      intro.id = 'cbtIdentityConfirmationIntro';
      intro.textContent = 'Vui lòng kiểm tra đúng họ tên và lớp của bạn trước khi tiếp tục.';

      const details = document.createElement('dl');
      details.className = 'cbt-identity-confirmation-details';
      for (const [label, value] of [
        ['Họ và tên', student.name],
        ['Lớp', classConfirmationLabel()]
      ]) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        description.textContent = value;
        row.append(term, description);
        details.append(row);
      }

      const reminder = document.createElement('p');
      reminder.className = 'cbt-identity-confirmation-reminder';
      reminder.textContent = 'Nếu thông tin chưa đúng, hãy quay lại và chọn lại tên.';

      const actions = document.createElement('div');
      actions.className = 'cbt-identity-confirmation-actions';
      const backButton = document.createElement('button');
      backButton.type = 'button';
      backButton.className = 'button button-secondary';
      backButton.textContent = 'Quay lại chọn tên';
      const confirmButton = document.createElement('button');
      confirmButton.type = 'button';
      confirmButton.className = 'button button-primary';
      confirmButton.textContent = 'Xác nhận, tiếp tục';
      actions.append(backButton, confirmButton);

      card.append(eyebrow, title, intro, details, reminder, actions);
      dialog.append(card);
      backButton.addEventListener('click', () => dialog.close('back'));
      confirmButton.addEventListener('click', () => dialog.close('confirmed'));
      dialog.addEventListener('cancel', event => {
        event.preventDefault();
        dialog.close('back');
      });
      dialog.addEventListener('close', () => {
        const confirmed = dialog.returnValue === 'confirmed';
        dialog.remove();
        resolve(confirmed);
      }, { once: true });
      document.body.append(dialog);
      dialog.showModal();
      confirmButton.focus();
    });
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  // Trình duyệt chặn một kho lưu vẫn cho chọn tên và dùng kho còn lại.
  function availableStorages() {
    return ['sessionStorage', 'localStorage'].flatMap(name => {
      try { return window[name] ? [window[name]] : []; } catch { return []; }
    });
  }

  function readState() {
    if (!storageKey) return {};
    for (const storage of availableStorages()) {
      try {
        const parsed = JSON.parse(storage.getItem(storageKey) || '{}');
        if (Object.keys(parsed).length) return parsed;
      } catch {
        // Tiếp tục với nguồn bộ nhớ còn lại.
      }
    }
    return {};
  }

  function readLegacyUiState() {
    if (!uiStorageKey) return { audioStarted: false, audioTime: 0, audioVolume: 1 };
    for (const storage of availableStorages()) {
      try {
        const parsed = JSON.parse(storage.getItem(uiStorageKey) || '{}');
        if (Object.keys(parsed).length) {
          return {
            audioStarted: Boolean(parsed.audio?.started),
            audioTime: Math.min(7200, Math.max(0, Number(parsed.audio?.time) || 0)),
            audioVolume: Math.min(1, Math.max(0.1, Number(parsed.audio?.volume) || 1))
          };
        }
      } catch {
        // Dữ liệu giao diện cũ lỗi thì bắt đầu theo phòng chờ mới.
      }
    }
    return { audioStarted: false, audioTime: 0, audioVolume: 1 };
  }

  function saveState(patch = {}) {
    state = { ...state, ...patch };
    if (!storageKey) return;
    const serialized = JSON.stringify(state);
    for (const storage of availableStorages()) {
      try {
        storage.setItem(storageKey, serialized);
      } catch {
        // Phiên thi chính vẫn nằm trên máy chủ nếu bộ nhớ trình duyệt bị chặn.
      }
    }
  }

  function clearAttemptUiState() {
    for (const storage of availableStorages()) {
      try {
        storage.removeItem(uiStorageKey);
      } catch {
        // Nếu trình duyệt chặn bộ nhớ, trạng thái phiên trên máy chủ vẫn là nguồn chính.
      }
    }
  }

  function clearAllLocalAttemptData() {
    const interactionPrefix = `izone-test-interactions:${testConfig.slug}:${classCode}${storageScope}:`;
    for (const storage of availableStorages()) {
      try {
        storage.removeItem(storageKey);
        storage.removeItem(uiStorageKey);
        for (let index = storage.length - 1; index >= 0; index -= 1) {
          const key = storage.key(index);
          if (key?.startsWith(interactionPrefix)) storage.removeItem(key);
        }
      } catch {
        // Database đã được reset; tải lại trang vẫn cho phép bắt đầu lượt mới.
      }
    }
  }

  function recoverFromServerReset(error, student) {
    if (error?.status !== 404 || !['ATTEMPT_NOT_FOUND', 'EXAM_SESSION_NOT_FOUND'].includes(error?.code)) return false;
    const audioVolume = Number(state.audioVolume) || 1;
    clearAllLocalAttemptData();
    state = { audioVolume };
    legacyListeningResume = false;
    saveState({
      studentRef: student.ref,
      studentName: student.name,
      studentIdentitySource: student.temporary ? 'temporary' : 'roster'
    });
    return true;
  }

  function showNotice(message, error = false) {
    elements.bootstrapNotice.hidden = false;
    elements.bootstrapNotice.className = `notice${error ? ' error' : ''}`;
    elements.bootstrapNotice.textContent = message;
  }

  function hideNotice() {
    elements.bootstrapNotice.hidden = true;
    elements.bootstrapNotice.className = 'notice';
    elements.bootstrapNotice.textContent = '';
  }

  function requestAudioAccess(examSessionToken = state.examSessionToken, generation = Number(state.generation) || 0) {
    return apiRequest(`/api/term-tests/${testConfig.slug}/session/audio-access`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({examSessionToken, generation, publicAudioVersion: 1,
        ...(testConfig.slug === 'mini-test-lesson-5' ? { audioTransport: 'r2-direct-v1', listeningEofVersion: 1 } : {}),
        ...(['term-test-1','term-test-2'].includes(testConfig.slug) ? { listeningEofVersion: 1 } : {})})
    });
  }

  async function apiRequest(path, options = {}, timeoutMs = 30_000) {
    // Quy đổi danh tính chỉ đọc không nhận các trường dành cho lượt thi/audio.
    if (!path.endsWith('/student-identity')) {
      options = window.K67_EXAM_ORDER?.request(options) || options;
      options = window.K67_AUDIO_OWNER?.request(options) || options;
    }
    let initializationRequest, initializationStatus;
    try { initializationRequest = window.EXAM_JOURNAL_STARTUP?.startRequest(path, options); } catch {}
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(appConfig.API_BASE_URL + path, { ...options, signal: controller.signal });
      initializationStatus = response.status;
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const requestError = new Error(data.message || `Lỗi HTTP ${response.status}`);
        requestError.status = response.status;
        requestError.code = data.error || '';
        if ((data.held||data.reasonCode==='SERVER_BEFORE_DEADLINE') && /\/cbt-journey\/(seal|reading-review)$/.test(path)) {
          requestError.held = data.held;
          requestError.reasonCode = data.reasonCode;
          requestError.retryAfterMs = data.retryAfterMs;
        }
        throw requestError;
      }
      try { initializationRequest?.done(data, undefined, initializationStatus); } catch {}
      return data;
    } catch (error) {
      try { initializationRequest?.done(undefined, error, initializationStatus); } catch {}
      if (error.name === 'AbortError') throw new Error('Máy chủ phản hồi quá chậm. Hãy thử lại.');
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function formatBytes(bytes) {
    return `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)} MB`;
  }

  function setStartAvailability() {
    if (miniJourney) {
      const listeningFirst = miniJourney.view().examMode !== 'read_first';
      elements.bootstrapStart.disabled = preparing || (listeningFirst && (!previewHeard || (miniJourney.continuity() && !journeyPlayer?.canPlay)));
      if (listeningFirst && !elements.bootstrapStart.disabled) {
        window.IZONE_CBT_AUDIO_START_LABEL?.(elements.bootstrapStart, true);
      }
      return;
    }
    const resumed = Boolean(state.listeningStartedAt || legacyListeningResume);
    const ready = Boolean(encryptedAudio && (previewHeard || resumed));
    elements.bootstrapStart.disabled = !ready || preparing;
    elements.bootstrapStart.textContent = resumed ? 'Tiếp tục bài thi Listening' : 'Bắt đầu thi Listening';
    window.IZONE_CBT_AUDIO_START_LABEL?.(elements.bootstrapStart, previewHeard && !resumed);
    elements.bootstrapStartStatus.textContent = resumed
      ? 'Đồng hồ máy chủ vẫn đang chạy. Tiếp tục ngay sau khi audio tải đủ.'
      : 'Sau khi bấm, đồng hồ máy chủ bắt đầu và đề mới được mở.';
  }

  function revokePreview() {
    window.IZONE_CBT_AUDIO_CANCEL_PREVIEW_WAIT?.(previewAudio);
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = '';
  }

  async function verifyPreviewDuration(expectedSeconds, signal) {
    await new Promise((resolve, reject) => {
      const rejectDecode = () => finish(new Error('Trình duyệt chưa đọc được file audio của bài thi.'));
      const abort = () => finish(signal.reason);
      const ready = () => {
        const actual = previewAudio.duration;
        finish(Number.isFinite(actual) && Math.abs(actual - expectedSeconds) <= 1 ? null
          : new Error('Thời lượng audio không khớp bản đề. Hãy thử tải lại.'));
      };
      const timeout = setTimeout(rejectDecode, 10000);
      function finish(error) {
        clearTimeout(timeout);
        previewAudio.removeEventListener('loadedmetadata', ready);
        previewAudio.removeEventListener('error', rejectDecode);
        signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve();
      }
      if (signal.aborted) { abort(); return; }
      if (previewAudio.error) { rejectDecode(); return; }
      if (previewAudio.readyState >= HTMLMediaElement.HAVE_METADATA) { ready(); return; }
      previewAudio.addEventListener('loadedmetadata', ready, { once: true });
      previewAudio.addEventListener('error', rejectDecode, { once: true });
      signal.addEventListener('abort', abort, { once: true });
      previewAudio.load();
    });
  }

  async function downloadForSession(session, retry = false) {
    hideNotice();
    downloadController?.abort();
    downloadController = new AbortController();
    const signal = downloadController.signal;
    encryptedAudio = null;
    audioAccess = null; audioScope = null; audioFromCache = false; audioCacheStatus = '';
    cacheStatus.textContent = 'Đang xác thực quyền tải hoặc khôi phục audio...';
    const resuming = Boolean(session.listeningStartedAt || legacyListeningResume);
    window.IZONE_CBT_AUDIO_CANCEL_PREVIEW_WAIT?.(previewAudio);
    previewHeard = resuming;
    elements.bootstrapDownloadStep.dataset.state = 'active';
    elements.bootstrapPreviewStep.dataset.state = 'locked';
    elements.bootstrapStartStep.dataset.state = 'locked';
    elements.bootstrapRetry.hidden = true;
    elements.bootstrapPreview.disabled = true;
    elements.bootstrapVolume.disabled = true;
    const audioStatus = beginAudioDownloadStatus(elements.bootstrapDownloadStatus,
      elements.bootstrapDownloadProgress, {signal, formatBytes, retry, preparing: true});
    try {
      // Quyền phải đến từ server ở lượt trang này; không lấy khóa/metadata từ storage để tự mở offline.
      if(session.audioOwnerSupported&&!window.K67_CREATE_AUDIO_OWNER)await loadScript('../k67-shared/audio-owner.js?rev=20261015-owner-v1&resilience=20261027-v1');
      if(session.audioOwnerSupported&&window.K67_AUDIO_OWNER?.token!==state.examSessionToken){
        if(window.K67_AUDIO_OWNER){await window.K67_AUDIO_OWNER.release();window.K67_AUDIO_OWNER.stop();}
        const expectedOwnerEpoch=requestedPreparationRecovery;requestedPreparationRecovery=undefined;
        window.K67_AUDIO_OWNER=await window.K67_CREATE_AUDIO_OWNER({apiBase:appConfig.API_BASE_URL,slug:testConfig.slug,
          token:state.examSessionToken,generation:Number(state.generation)||0,recoverPreparationEpoch:expectedOwnerEpoch});
      }
      if (resuming && await replayMiniListeningSeal()) return;
      try {
        const access = await requestAudioAccess();
        signal.throwIfAborted();
        audioAccess = access;
      } catch (error) {
        if (error.status !== 404 || error.code) throw error; // Backend cũ chưa có endpoint: vẫn phải online start.
      }
      if (audioAccess?.audioCacheSupported) {
        const publicAudio = audioAccess.audioManifest?.envelopeVersion === 'MP3';
        if (publicAudio && !window.K67_PUBLIC_AUDIO) await loadScript('../k67-shared/public-audio.js?audioStatus=20261111-audio-status-v1&rev=20261026-term1-replay1&journal=20261024-startup-v2&resilience=20261027-v1&audio=20261028-part-rescue-v1&diagnostics=20261105-v2');
        if (publicAudio && !window.K67_PUBLIC_AUDIO.validManifest(audioAccess.audioManifest)) throw new Error('Định danh audio từ máy chủ không hợp lệ.');
        if (!publicAudio && !window.K67_AUDIO_STORE) {
          try { await loadScript('../k67-shared/audio-store.js?rev=20261015-cache-v1'); }
          catch { audioCacheStatus = 'Audio chưa được lưu để khôi phục qua tải lại. Giữ trang này trong khi làm bài.'; }
        }
        if (!publicAudio && window.K67_AUDIO_STORE && !window.K67_AUDIO_STORE.validManifest(audioAccess.audioManifest)) throw new Error('Định danh audio từ máy chủ không hợp lệ.');
        audioScope = {apiBase: appConfig.API_BASE_URL, slug: testConfig.slug,
          examSessionToken: audioAccess.examSessionToken, generation: audioAccess.generation};
        if (resuming && audioAccess.audioProtocolVersion === 1) {
          // Reload không được chạy đồng hồ âm thầm trong lúc tải/xác thực lại.
          // Dùng journal cùng controller để retry nguyên sự cố và giữ nháp hiện có.
          const journalKey = `izone-k67-audio-incident:v1:${testConfig.slug}:${state.examSessionToken}:${audioAccess.generation}`;
          let journal = null;
          try { journal = JSON.parse(localStorage.getItem(journalKey) || 'null'); } catch {}
          const duration = Number(audioAccess.listeningDurationSeconds);
          const eofRequired = audioAccess.listeningEofVersion === 1;
          let reviewOnly = !audioAccess.activeIncident && (eofRequired ? Boolean(audioAccess.listeningEofAt)
            : Number(audioAccess.listeningResumeAtSeconds) >= duration);
          if (!eofRequired && !reviewOnly && !audioAccess.activeIncident && Number(legacyUiState.audioTime) >= duration - 0.5) {
            const progress = await apiRequest(`/api/term-tests/${testConfig.slug}/session/audio-progress`, {
              method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({
                examSessionToken: state.examSessionToken, generation: audioAccess.generation, heardSeconds: duration, state: 'playing'})
            });
            reviewOnly = !progress.activeIncident && Number(progress.listeningResumeAtSeconds) >= duration;
          }
          if ((!audioAccess.activeIncident && !reviewOnly) || journal?.pending) {
            const id = crypto.randomUUID();
            const pending = journal?.pending || {eventId: id, incidentId: id, reason: 'reload',
              heardSeconds: Math.max(Number(audioAccess.listeningResumeAtSeconds) || 0, Number(legacyUiState.audioTime) || 0),
              answers: {...(state.drafts?.listening || {})}, draftRevision: Number(state.draftRevisions?.listening) || 0};
            try { localStorage.setItem(journalKey, JSON.stringify({...journal, pending})); } catch {}
            await apiRequest(`/api/term-tests/${testConfig.slug}/session/audio-incident`, {
              method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({examSessionToken: state.examSessionToken, generation: audioAccess.generation, ...pending})
            });
            try { localStorage.setItem(journalKey, JSON.stringify({...journal, pending: null})); } catch {}
          }
        }
      }
      const audioUrl = appConfig.API_BASE_URL + session.encryptedAudioUrl;
      const previewUrl = appConfig.API_BASE_URL + session.previewAudioUrl;
      const [encrypted, previewResponse] = await Promise.all([
        loadEncryptedAudio(audioUrl, {
          signal,
          onProgress: audioStatus.progress,
          onPhase: audioStatus.phase
        }),
        resuming || audioAccess?.audioManifest?.envelopeVersion === 'MP3' ? null : fetch(previewUrl, { cache: 'no-store', signal })
      ]);
      signal.throwIfAborted();
      if (previewResponse && !previewResponse.ok) throw new Error('Không tải được bản nghe thử.');
      signal.throwIfAborted();
      audioStatus.phase('Đang chuẩn bị trình phát…');
      revokePreview();
      if (previewResponse || (!resuming && audioAccess?.audioManifest?.envelopeVersion === 'MP3')) {
        const previewBlob = previewResponse ? await previewResponse.blob() : encrypted;
        signal.throwIfAborted();
        previewObjectUrl = URL.createObjectURL(previewBlob);
        previewAudio.src = previewObjectUrl;
        if (audioAccess?.audioTransport === 'r2-direct-v1') {
          await verifyPreviewDuration(Number(audioAccess.listeningDurationSeconds), signal);
        }
      }
      encryptedAudio = encrypted;
      previewAudio.volume = Number(elements.bootstrapVolume.value) || 1;
      signal.throwIfAborted();
      audioStatus.finish(`Đã tải đủ audio · 100% · ${formatBytes(encrypted.size)}`, {ready:true});
      cacheStatus.textContent = audioCacheStatus;
      elements.bootstrapDownloadStep.dataset.state = 'complete';
      elements.bootstrapVolume.disabled = false;
      if (resuming) {
        elements.bootstrapPreviewStep.dataset.state = 'skipped';
        elements.bootstrapPreview.hidden = true;
        elements.bootstrapPreviewStatus.textContent = 'Bài thi đã bắt đầu nên chế độ nghe thử đã đóng.';
        elements.bootstrapStartStep.dataset.state = 'active';
      } else {
        elements.bootstrapPreviewStep.dataset.state = 'active';
        elements.bootstrapPreview.disabled = false;
        elements.bootstrapPreviewStatus.textContent = 'Bấm nút để nghe thử và chỉnh âm lượng.';
      }
      setStartAvailability();
    } catch (error) {
      if (signal.aborted) return;
      elements.bootstrapDownloadStep.dataset.state = 'error';
      audioStatus.finish('Chưa tải đủ audio. Bài thi vẫn đang khóa.');
      elements.bootstrapRetry.textContent = 'Thử tải lại audio';
      recoverablePreparation=Number.isSafeInteger(error.recoveryEpoch)?error.recoveryEpoch:undefined;
      if(recoverablePreparation!==undefined)elements.bootstrapRetry.textContent='Chuẩn bị trên tab này';
      elements.bootstrapRetry.hidden = false;
      showNotice(error.userMessage || error.message, true);
      cacheStatus.textContent = 'Chưa xác thực hoặc tải đủ audio. Giữ trang này; kiểm tra mạng rồi thử lại.';
    }
  }

  async function loadEncryptedAudio(url, options, skipCache = false) {
    if (audioAccess?.audioManifest?.envelopeVersion === 'MP3') {
      const manifest = audioAccess.audioManifest;
      let blob;
      if (testConfig.slug === 'mini-test-lesson-5' && audioAccess.audioTransport === 'r2-direct-v1') {
        const { examSessionToken, generation } = audioAccess;
        const { downloadTermAudio } = await import('../k56-offline-shared/whole-audio-audio-status-v1.mjs?v=20261111-audio-status-v1');
        const refresh = async ({ signal }) => {
          let updated;
          try { updated = await requestAudioAccess(examSessionToken, generation); }
          catch (error) {
            if (!error.status || error.status >= 500) error.audioRefreshUnavailable = true;
            throw error;
          }
          signal.throwIfAborted();
          return { manifest: updated.audioManifest, download: updated.audioDownload };
        };
        blob = await downloadTermAudio(testConfig.slug,
          { pagesUrl: manifest.url, sha256: manifest.sha256, bytes: manifest.byteLength },
          { ...options, audioDownload: audioAccess.audioDownload, refresh });
      } else {
        blob = await window.K67_PUBLIC_AUDIO.download(manifest, options);
      }
      audioCacheStatus = 'Đã kiểm đúng phiên bản và tải đủ audio. Khi vào lại vẫn cần mạng để xác thực phiên thi.';
      return blob;
    }
    const store = window.K67_AUDIO_STORE;
    if (audioScope && store && !skipCache) {
      try {
        const cached = await store.get(audioScope, audioAccess.audioManifest, audioAccess.serverNow);
        if (cached) { audioFromCache = true; audioCacheStatus = 'Đã xác thực online và khôi phục audio từ bản lưu.'; return cached; }
      } catch { audioCacheStatus = 'Audio chưa được lưu để khôi phục qua tải lại. Giữ trang này trong khi làm bài.'; }
    }
    const blob = await audioLoader.downloadAudio(url, options);
    if (audioScope) {
      if (blob.size !== audioAccess.audioManifest.encryptedByteLength) throw new Error('File audio tải chưa đủ theo định danh máy chủ.');
      try {
        if (!store) throw new Error('AUDIO_STORE_UNAVAILABLE');
        await store.put(audioScope, audioAccess.audioManifest, blob, audioAccess.cacheExpiresAt, audioAccess.serverNow);
        audioCacheStatus = 'Đã lưu audio để khôi phục sau tải lại. Khi vào lại vẫn cần mạng để xác thực.';
      } catch { audioCacheStatus = 'Audio chưa được lưu để khôi phục qua tải lại. Giữ trang này trong khi làm bài.'; }
    }
    return blob;
  }

  async function prepareSelectedStudent(retry = false) {
    const studentRef = elements.bootstrapStudent.value;
    const student = roster.find(item => item.ref === studentRef);
    if (!student || preparing) return;
    preparing = true;
    if (retry || !elements.bootstrapRetry.hidden) {
      elements.bootstrapRetry.hidden = true;
      if (elements.bootstrapNotice.classList.contains('error')) {
        elements.bootstrapNotice.hidden = true;
        elements.bootstrapNotice.textContent = '';
        elements.bootstrapNotice.classList.remove('error');
      }
    }
    const preparationStatus = beginAudioDownloadStatus(elements.bootstrapDownloadStatus,
      elements.bootstrapDownloadProgress, {formatBytes, retry, preparing:true});
    saveState({
      studentRef,
      studentName: student.name,
      studentIdentitySource: student.temporary ? 'temporary' : 'roster'
    });
    elements.bootstrapStudent.disabled = true;
    try {
      // Chọn lại đúng học viên sau khi đi qua link cứu hộ vẫn ưu tiên lượt đã giữ trên thiết bị.
      if (await openJourneyLobby(false, false, preparationStatus)) return;
      if (state.attemptToken) {
        try {
          await resumeAfterListening();
          return;
        } catch (error) {
          if (!recoverFromServerReset(error, student)) throw error;
        }
      }
      const prepareSession = () => apiRequest(`/api/term-tests/${testConfig.slug}/session/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode,
          studentRef,
          retakeGrant: retakeGrant || undefined,
          examSessionToken: state.examSessionToken || undefined,
          legacyElapsedSeconds: legacyListeningResume ? Math.floor(legacyUiState.audioTime) : 0
        })
      });
      let prepared;
      try {
        prepared = await prepareSession();
      } catch (error) {
        if (!recoverFromServerReset(error, student)) throw error;
        prepared = await prepareSession();
      }
      if ((sharedIdentity || demoJourneyEntry) && (!isUuid(prepared.examSessionToken)
          || (prepared.attemptToken && !isUuid(prepared.attemptToken))
          || (prepared.studentRef && prepared.studentRef !== studentRef)
          || (state.examSessionToken && state.examSessionToken !== prepared.examSessionToken)))
        throw new Error('Phiên trả về chưa khớp người học. Nháp cũ được giữ nguyên.');
      rememberPreparedStudent(studentRef);
      const localListeningNewer = Number(state.draftRevisions?.listening || 0) > Number(prepared.listeningDraftRevision || 0);
      saveState({
        examSessionToken: prepared.examSessionToken,
        generation: Number(prepared.generation) || 0,
        listeningStartedAt: prepared.listeningStartedAt,
        listeningDeadlineAt: prepared.listeningDeadlineAt,
        attemptToken: prepared.attemptToken || state.attemptToken || '',
        examMode: prepared.examMode || 'lis_first',
        readingSubmitted: Boolean(prepared.readingSubmitted),
        nextSection: prepared.nextSection,
        listeningSubmitted: prepared.examMode ? Boolean(prepared.listeningSubmitted) : Boolean(prepared.listeningSubmitted || prepared.attemptToken),
        drafts: {
          ...(state.drafts || {}),
          listening: { ...((localListeningNewer ? state.drafts?.listening : prepared.listeningDraft) || state.drafts?.listening || {}) },
          reading: { ...(prepared.readingDraft || state.drafts?.reading || {}) }
        },
        draftRevisions: {
          ...(state.draftRevisions || {}),
          listening: localListeningNewer ? Number(state.draftRevisions.listening) : Number(prepared.listeningDraftRevision) || Number(state.draftRevisions?.listening) || 0,
          reading: Number(prepared.readingDraftRevision) || Number(state.draftRevisions?.reading) || 0
        },
        draftAckRevisions: {
          ...(state.draftAckRevisions || {}),
          listening: Number(prepared.listeningDraftRevision) || Number(state.draftAckRevisions?.listening) || 0,
          reading: Number(prepared.readingDraftRevision) || Number(state.draftAckRevisions?.reading) || 0
        }
      });
      window.K67_EXAM_ORDER?.apply(state, prepared);
      if(await openJourneyLobby(true,false,preparationStatus))return;
      if (state.pendingSubmissions?.listening && !prepared.listeningSubmitted && !state.attemptToken) {
        await enterListeningReadback(prepared);
        return;
      }
      if (state.attemptToken || prepared.listeningSubmitted) {
        await resumeAfterListening();
        return;
      }
      await downloadForSession(prepared,retry);
    } catch (error) {
      elements.bootstrapStudent.disabled = false;
      showNotice(`Chưa chuẩn bị được bài thi: ${error.message}`, true);
      elements.bootstrapRetry.textContent = 'Thử chuẩn bị lại';
      elements.bootstrapRetry.hidden = false;
    } finally {
      preparationStatus.restore();
      preparing = false;
      elements.bootstrapStudent.disabled = Boolean(state.listeningStartedAt);
      setStartAvailability();
    }
  }

  function base64Bytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }

  async function decryptOfficialAudio(blob, response) {
    if (audioScope && (!response.audioManifest || !['assetVersion','sha256','byteLength','encryptedByteLength','envelopeVersion']
      .every(field => response.audioManifest[field] === audioAccess.audioManifest[field]))) throw new Error('Phiên bản audio không khớp phiên đã xác thực.');
    if (response.audioManifest?.envelopeVersion === 'MP3') {
      await window.K67_PUBLIC_AUDIO.verify(blob, response.audioManifest);
      return blob.arrayBuffer();
    }
    const envelope = new Uint8Array(await blob.arrayBuffer());
    const magic = new TextDecoder().decode(envelope.subarray(0, 5));
    if (magic !== response.audioEnvelope.magic) throw new Error('Gói audio không hợp lệ.');
    const ivStart = 5;
    const ivEnd = ivStart + response.audioEnvelope.ivBytes;
    const key = await crypto.subtle.importKey('raw', base64Bytes(response.audioKey), 'AES-GCM', false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.subarray(ivStart, ivEnd) }, key, envelope.subarray(ivEnd));
    if (response.audioManifest) {
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', plaintext)), byte => byte.toString(16).padStart(2, '0')).join('');
      if (plaintext.byteLength !== response.audioManifest.byteLength || hash !== response.audioManifest.sha256) throw new Error('Nội dung audio không khớp bản được máy chủ cấp.');
    }
    return plaintext;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src + (src.includes('?') ? '&' : '?') + 'k67rev=20261017-pages-v1';
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error(`Không nạp được ${src}.`)), { once: true });
      document.body.append(script);
    });
  }

  function bindSharedStudent(student, resolution = null) {
    const binding = sharedIdentity.select(student, { resolution, remember: !student.temporary && studentMemory.preferred });
    const volume = state.audioVolume;
    applyStorageBinding(binding);
    state = { audioVolume: volume, drafts: { listening: {}, reading: {}, writing: { task1: '', task2: '' } }, ...binding.state };
    legacyUiState = readLegacyUiState();
    saveState({ studentRef: student.ref, studentName: student.name,
      studentIdentitySource: student.temporary ? 'temporary' : 'roster' });
    if (student.temporary && studentMemory.checkbox) {
      studentMemory.checkbox.checked = false; studentMemory.checkbox.disabled = true;
      setMemoryStatus('Hồ sơ tạm không được ghi nhớ sang sản phẩm khác.');
    }
    elements.bootstrapStudent.value = student.ref;
  }
  function rememberPreparedStudent(studentRef) {
    sharedIdentity?.prepared(studentRef).then(result => {
      if (['ok', 'empty', 'not_selected'].includes(result.status)) return;
      let notice = document.getElementById('termIdentityMemoryNotice');
      if (!notice) { notice = document.createElement('p'); notice.id = 'termIdentityMemoryNotice';
        notice.className = 'notice'; notice.setAttribute('role', 'status'); root.before(notice); }
      notice.textContent = 'Lượt thi vẫn giữ đúng người. Trình duyệt chưa ghi nhớ được cho bài khác; lần sau bạn có thể cần chọn lại tên.';
    }).catch(() => {});
  }

  function cbtAssetUrl(fileName, revision) {
    const base = String(window.TERM_TEST_CBT_ASSET_BASE || scriptAssetBase).replace(/\/$/, '');
    return `${base}/${fileName}?rev=${revision}`;
  }

  async function enterExam(started, audioElement = null, offlineSection = '', journey = null, playNewListening = false) {
    let appReady;
    const listeningScriptsReady=journey ? Promise.withResolvers() : null;
    if (audioElement) {
      appReady = Promise.withResolvers();
      // The app can fail while the next assets load. Await the failure after assets settle.
      void appReady.promise.catch(() => {});
    }
    window.TERM_TEST_CONTENT = Object.freeze(started.content);
    const boundIdentity = (sharedIdentity || (demoJourneyEntry && journey)) && started.examSessionToken === state.examSessionToken
      && isUuid(state.examSessionToken) && isUuid(state.studentRef) && started.studentName
      ? Object.freeze({ testSlug: testConfig.slug, classCode, studentRef: state.studentRef,
        studentName: started.studentName, examSessionToken: state.examSessionToken, attemptToken: state.attemptToken || '' }) : null;
    window.TERM_TEST_BOOTSTRAP = Object.freeze({
      restoredIdentity,
      verifiedIdentity: offlineSection ? null : boundIdentity,
      offlineSectionIdentity: offlineSection && boundIdentity ? { ...boundIdentity, section: offlineSection } : null,
      miniJourney:journey,
      playNewListening,
      reconcileListening: Boolean(state.pendingSubmissions?.listening && !started.listeningSubmitted),
      audioAppReady: appReady,
      listeningScriptsReady: listeningScriptsReady?.promise,
      sessionState: (sharedIdentity || (demoJourneyEntry && journey)) ? structuredClone(state) : null,
      examSessionToken: state.examSessionToken,
      listeningDeadlineAt: started.listeningDeadlineAt,
      serverNow: started.serverNow,
      audioVolume: Number(state.audioVolume) || 1,
      officialAudioElement: audioElement,
      officialAudioUrl: officialObjectUrl,
      skipListeningAudio: Boolean(offlineSection||journey||state.pendingSubmissions?.listening) || (started.examMode === 'read_first' ? started.nextSection !== 'listening' || Boolean(started.listeningSubmitted) : Boolean(state.attemptToken || started.listeningSubmitted))
    });
    previewAudio.remove();
    revokePreview();
    await loadScript('../shared/attempt-review.js?rev=20260909-k67-update-v1');
    await loadScript('../shared/writing-planning.js?rev=20260909-k67-update-v1');
    const journeyVersion=journey?'&offlineJourney=20261107-term1-v1':'';
    await loadScript('../shared/app-term2-k67-audio-v2.js?v=20261107-terms-cbt-v1&termEof=20261108-v1&uiRestore=20261108-v9&continuity=20261110-v1'+journeyVersion);
    await loadScript(cbtAssetUrl('enhance-term2-k67-audio-v2.js?v=20261107-terms-cbt-v1&uiRestore=20261108-v6&previewWait=20261109-preview-10s-v1', '20260912-load-guard-v1-20261014-order-v1-20261014-audio-recovery-v1-20261015-incident-v1-20261016-review-label-v1')+journeyVersion);
    if (appReady) await appReady.promise;
    await loadScript(cbtAssetUrl('interaction-tools.js?v=20261018-identity-v1', '20260824-writing-note-fix-v1-20260911-listening-retake-v2'));
    listeningScriptsReady?.resolve();
  }

  function miniCbtScope() {
    return { classCode, studentRef: state.studentRef, examSessionToken: state.examSessionToken,
      attemptToken: state.attemptToken, generation: Number(state.generation) || 0 };
  }

  function showListeningLoadError(error) {
    if (elements.bootstrapNotice.isConnected) {
      showNotice(`Chưa mở được đề: ${error.message}. Hãy tải lại để tiếp tục đúng lượt.`, true);
    } else {
      const notice = document.createElement('p');
      notice.className = 'notice error';
      notice.setAttribute('role', 'alert');
      notice.textContent = 'Chưa mở được đề. Hãy tải lại để tiếp tục đúng lượt.';
      root.prepend(notice);
    }
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'button button-secondary';
    reload.textContent = 'Tải lại bài';
    reload.addEventListener('click', () => location.reload());
    (elements.bootstrapNotice.isConnected ? elements.bootstrapNotice : root.firstElementChild).append(reload);
  }

  async function enterJourney(playNewListening = false){
    const view=miniJourney.view();
    saveState({...view,drafts:{...state.drafts,...miniJourney.drafts()},draftRevisions:miniJourney.revisions()});
    revokePreview();
    await enterExam({...view,content:miniJourney.content},null,'',miniJourney,playNewListening);
  }

  async function openJourneyLobby(prepare=false,recover=false,preparationStatus){
    const slug=testConfig.slug;
    if(!['mini-test-lesson-5','term-test-1','term-test-2'].includes(slug)||listeningOnly||!(sharedIdentity||demoJourneyEntry)||!isUuid(state.studentRef)||!isUuid(state.examSessionToken))return false;
    if(demoJourneyEntry&&!prepare&&!recover){
      // A fresh online visit keeps the roster picker. Reload can reopen this tab's exact demo run.
      if(navigator.onLine!==false&&performance.getEntriesByType('navigation')[0]?.type!=='reload')return false;
      let saved;
      try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{return false;}
      if(saved?.studentRef!==state.studentRef||saved?.examSessionToken!==state.examSessionToken)return false;
    }
    const {findMiniJourney,openMiniJourney}=await import('../mini-test-lesson-5-computer-based/journey-term1-k67-audio-v2.mjs?v=20261107-terms-cbt-v1&termEof=20261108-v1&uiRestore=20261108-v7&continuity=20261110-v1&demoJourney=20261110-v1&audioStatus=20261111-audio-status-v1');
    const scope=miniCbtScope();
    const existing=await findMiniJourney(scope,slug);
    if(!existing&&(!prepare||state.completed))return false;
    const audioStatus=preparationStatus || beginAudioDownloadStatus(elements.bootstrapDownloadStatus,
      elements.bootstrapDownloadProgress,{formatBytes,preparing:true});
    try{
      miniJourney=await openMiniJourney({scope,request:apiRequest,existing,prepare,slug,
        pagesOnly:window.K67_RESCUE_AUDIO_SOURCE==='pages',
        onProgress:audioStatus.progress,onPhase:audioStatus.phase});
      if(!miniJourney){audioStatus.restore();return false;}
      if(miniJourney.activated()){audioStatus.restore();await enterJourney();return true;}
      audioStatus.phase('Đang chuẩn bị trình phát…');
      revokePreview();
      if(miniJourney.continuity()){
        journeyPlayer=await miniJourney.preparePlayer();
        void journeyPlayer.ready.then(setStartAvailability,error=>{
          elements.bootstrapStartStatus.textContent=error.message;
        });
      }
      previewObjectUrl=URL.createObjectURL(await miniJourney.verifiedAudio());
      previewAudio.src=previewObjectUrl;
      previewAudio.volume=Number(elements.bootstrapVolume.value)||1;
      elements.bootstrapPreview.disabled=false;
      elements.bootstrapVolume.disabled=false;
      elements.bootstrapPreviewStep.dataset.state='active';
      elements.bootstrapPreviewStatus.textContent='Bấm nghe thử để chỉnh âm lượng.';
      elements.bootstrapDownloadStep.dataset.state='complete';
      audioStatus.finish(slug.startsWith('term-test-')?'Đã chuẩn bị ba phần và lưu audio trên thiết bị.':'Đã chuẩn bị hai phần và lưu audio trên thiết bị.',{ready:true});
    }catch(error){
      audioStatus.finish('Chưa chuẩn bị được audio. Hãy thử chuẩn bị lại.');
      throw error;
    }
    elements.bootstrapStartStep.dataset.state='active';
    elements.bootstrapStart.textContent=slug.startsWith('term-test-')?'Bắt đầu Term Test '+slug.at(-1):'Bắt đầu bài Mini K67';
    elements.bootstrapStartStatus.textContent='Hãy có mạng khi bấm bắt đầu. Sau đó có thể làm tiếp khi mất mạng.';
    return true;
  }

  async function offerMiniJourneyRecovery(){
    const slug=testConfig.slug;
    if(!['mini-test-lesson-5','term-test-1','term-test-2'].includes(slug)||!(sharedIdentity||demoJourneyEntry)||listeningOnly||(state.studentRef&&!demoJourneyEntry))return false;
    if(document.getElementById('miniJourneyRecovery'))return true;
    const mode=query.get('mode');
    const {miniJourneyRecovery}=await import('../mini-test-lesson-5-computer-based/journey-term1-k67-audio-v2.mjs?v=20261107-terms-cbt-v1&termEof=20261108-v1&uiRestore=20261108-v7&continuity=20261110-v1&demoJourney=20261110-v1&audioStatus=20261111-audio-status-v1');
    const match=await miniJourneyRecovery(classCode,['lis_first','read_first'].includes(mode)?mode:'',slug);
    if(!match)return false;
    const form=document.createElement('form');form.id='miniJourneyRecovery';form.className='cbt-bootstrap-identity';
    const label=document.createElement('label');label.textContent='Họ và tên dùng khi vào thi';
    const input=document.createElement('input');input.required=true;input.maxLength=180;input.autocomplete='off';label.append(input);
    const button=document.createElement('button');button.className='button button-primary';button.textContent='Mở bài đã lưu';
    const status=document.createElement('p');status.setAttribute('role','status');
    status.textContent=slug.startsWith('term-test-')?'Có bài Term Test '+slug.at(-1)+' lưu trên trình duyệt này. Nhập đúng họ tên đã chọn để tiếp tục.'
      :'Có bài Mini K67 lưu trên trình duyệt này. Nhập đúng họ tên đã chọn để tiếp tục.';
    form.append(status,label,button);
    elements.bootstrapDownloadStep.parentElement.before(form);
    elements.bootstrapDownloadStatus.textContent='Chưa tải được danh sách lớp. Bạn có thể mở bài đã lưu ở trên.';
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const bundle=match(input.value);
      if(!bundle){status.textContent='Chưa xác định được bài đúng họ tên và lớp. Khi có mạng, hãy mở lại từ danh sách lớp.';return;}
      button.disabled=true;
      try{
        if(sharedIdentity)bindSharedStudent({ref:bundle.studentRef,name:bundle.studentName});
        else saveState({studentRef:bundle.studentRef,studentName:bundle.studentName});
        saveState({examSessionToken:bundle.examSessionToken,generation:bundle.generation});
        if(!await openJourneyLobby(false,true))throw new Error('Chưa mở được bản đã lưu.');
      }catch(error){button.disabled=false;status.textContent=error.message;}
    });
    return true;
  }

  async function replayMiniListeningSeal() {
    if (testConfig.slug !== 'mini-test-lesson-5' || navigator.onLine === false || !state.studentRef || !state.examSessionToken) return false;
    const scope = miniCbtScope();
    const current = () => scope.examSessionToken === state.examSessionToken && scope.studentRef === state.studentRef && scope.classCode === classCode;
    const { openCbtResilience } = await import('../mini-test-lesson-5-computer-based/resilience-audio-status-v2.mjs?v=20261107-cbt-sync-v1');
    const runtime = await openCbtResilience({ scope, current, request: apiRequest, clock: Date.now, notify: () => {} }).catch(() => null);
    if (!runtime) return false;
    let receipt;
    try {
      receipt = await runtime.syncPending('listening').catch(() => null);
      if (!receipt || !current()) return false;
      saveState({ attemptToken: receipt.attemptToken, listeningSubmitted: true, completed: receipt.completed, nextSection: receipt.nextSection });
      await runtime.applied('listening');
    } finally { runtime.close(); }
    await resumeAfterListening();
    return true;
  }

  async function resumeMiniOffline(transportUnavailable = false) {
    if (testConfig.slug !== 'mini-test-lesson-5' || (!transportUnavailable && navigator.onLine !== false) || !sharedIdentity
        || !isUuid(state.studentRef) || !isUuid(state.examSessionToken) || state.completed) return false;
    const section = state.readingDeadlineAt && !state.readingSubmitted ? 'reading' : 'listening';
    if (state[section + 'Submitted']) return false;
    const { restoreOfflineSection } = await import('../mini-test-lesson-5-computer-based/resilience-audio-status-v2.mjs?v=20261107-cbt-sync-v1');
    const saved = await restoreOfflineSection(miniCbtScope(), section);
    if (!saved) return false;
    const { entry, content } = saved;
    saveState({ examMode: entry.examMode, nextSection: section, listeningSubmitted: entry.listeningSubmitted, readingSubmitted: entry.readingSubmitted,
      [section + 'StartedAt']: entry[section + 'StartedAt'], [section + 'DeadlineAt']: entry[section + 'DeadlineAt'] });
    await enterExam({ ...entry, content, nextSection: section }, null, section);
    return true;
  }

  async function enterListeningReadback(started) {
    if (started.audioOwnerSupported && !window.K67_AUDIO_OWNER) {
      if (!window.K67_CREATE_AUDIO_OWNER) {
        await loadScript('../k67-shared/audio-owner.js?rev=20261015-owner-v1&resilience=20261027-v1');
      }
      window.K67_AUDIO_OWNER = await window.K67_CREATE_AUDIO_OWNER({apiBase:appConfig.API_BASE_URL,slug:testConfig.slug,
        token:state.examSessionToken,generation:Number(state.generation)||0});
    }
    await enterExam(started);
  }

  async function resumeAfterListening() {
    const started = await apiRequest(`/api/term-tests/${testConfig.slug}/session/resume-attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classCode,
        studentRef: state.studentRef,
        attemptToken: state.attemptToken
      })
    });
    // Chỉ bỏ tải danh sách sau khi máy chủ trả đúng mã lượt vừa yêu cầu.
    if(started.attemptToken!==state.attemptToken)throw new Error('Mã lượt trả về không khớp bài đang lưu.');
    rememberPreparedStudent(state.studentRef);
    const orderDrafts=window.K67_EXAM_ORDER?.restoreDrafts(state,started);
    saveState({
      studentName: started.studentName || state.studentName,
      examSessionToken: started.examSessionToken || state.examSessionToken || '',
      generation: Number.isSafeInteger(started.generation) ? started.generation : state.generation,
      listeningStartedAt: started.listeningStartedAt || state.listeningStartedAt || '',
      listeningDeadlineAt: started.listeningDeadlineAt || state.listeningDeadlineAt || '',
      readingStartedAt: started.readingStartedAt || state.readingStartedAt || '',
      readingDeadlineAt: started.readingDeadlineAt || state.readingDeadlineAt || '',
      writingStartedAt: started.writingStartedAt || state.writingStartedAt || '',
      writingDeadlineAt: started.writingDeadlineAt || state.writingDeadlineAt || '',
      serverTimeOffsetMs: (window.IZONE_EXAM_CLOCK?.offset(started.serverNow) ?? (Date.parse(started.serverNow) - Date.now())),
      attemptToken: started.attemptToken || state.attemptToken || '',
      examMode: started.examMode || 'lis_first',
      nextSection: started.nextSection,
      readingSubmitted: Boolean(started.readingSubmitted),
      completed: Boolean(started.completed || started.completedAt),
      listeningSubmitted: started.examMode ? Boolean(started.listeningSubmitted) : true,
      drafts: {
        ...(state.drafts || {}),
        reading: { ...(started.readingDraft || state.drafts?.reading || {}) }
      },
      draftRevisions: {
        ...(state.draftRevisions || {}),
        reading: Number(started.readingDraftRevision) || Number(state.draftRevisions?.reading) || 0
      },
      draftAckRevisions: {
        ...(state.draftAckRevisions || {}),
        reading: Number(started.readingDraftRevision) || Number(state.draftAckRevisions?.reading) || 0
      }
    });
    window.K67_EXAM_ORDER?.apply(state, started);
    if(orderDrafts)saveState(orderDrafts);
    if (await openJourneyLobby()) return;
    if(classCode!=='CODEXDEMO806'&&!listeningOnly) {
      restoredIdentity=Object.freeze({testSlug:testConfig.slug,classCode,className:activeClassName,
        studentRef:state.studentRef,studentName:state.studentName,attemptToken:state.attemptToken});
    }
    if (state.pendingSubmissions?.listening && started.nextSection === 'listening') {
      await enterListeningReadback(started);
      return;
    }
    if (started.examMode === 'read_first' && started.nextSection === 'listening') {
      if(restoredIdentity) {
        roster=[{ref:restoredIdentity.studentRef,name:restoredIdentity.studentName}];
        renderRosterOptions();
        elements.bootstrapStudent.value=restoredIdentity.studentRef;
        elements.bootstrapStudent.disabled=true;
        elements.bootstrapStudent.closest('.cbt-bootstrap-identity').hidden=false;
      }
      await downloadForSession({...started, encryptedAudioUrl:`/api/term-tests/${testConfig.slug}/session/${state.examSessionToken}/audio`,previewAudioUrl:`/api/term-tests/${testConfig.slug}/session/${state.examSessionToken}/preview`});
      return;
    }
    await enterExam(started);
  }

  elements.bootstrapPreview.addEventListener('click', async () => {
    if (!previewObjectUrl || state.listeningStartedAt || legacyListeningResume) return;
    if (!previewAudio.paused) {
      previewAudio.pause();
      elements.bootstrapPreview.textContent = 'Nghe lại 30 giây đầu';
      return;
    }
    previewAudio.currentTime = 0;
    try {
      await previewAudio.play();
      elements.bootstrapPreview.textContent = 'Dừng nghe thử';
      elements.bootstrapPreviewStep.dataset.state = 'complete';
      elements.bootstrapStartStep.dataset.state = 'active';
      elements.bootstrapPreviewStatus.textContent = 'Đang nghe thử · tối đa 30 giây.';
      setStartAvailability();
      if (!previewHeard) {
        window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW(previewAudio, elements.bootstrapStart, () => {
          previewHeard = true;
          setStartAvailability();
        });
      }
    } catch {
      elements.bootstrapPreviewStatus.textContent = 'Trình duyệt chưa cho phát. Hãy nhấn lại nút nghe thử.';
    }
  });
  previewAudio.addEventListener('ended', () => {
    elements.bootstrapPreview.textContent = 'Nghe lại 30 giây đầu';
    elements.bootstrapPreviewStatus.textContent = 'Đã nghe hết bản thử. Bạn có thể bắt đầu thi.';
  });
  // Bản nghe thử dùng chính file đã kiểm, dừng ở 30 giây và không bắt đầu đồng hồ thi.
  previewAudio.addEventListener('timeupdate', () => {
    if ((miniJourney||audioAccess?.audioManifest?.envelopeVersion === 'MP3') && previewAudio.currentTime >= 30 && !previewAudio.paused) {
      previewAudio.pause();
      elements.bootstrapPreview.textContent = 'Nghe lại 30 giây đầu';
      elements.bootstrapPreviewStatus.textContent = 'Đã nghe hết bản thử. Bạn có thể bắt đầu thi.';
    }
  });
  elements.bootstrapVolume.addEventListener('input', () => {
    const volume = Number(elements.bootstrapVolume.value) || 1;
    previewAudio.volume = volume;
    saveState({ audioVolume: volume });
  });
  elements.bootstrapStart.addEventListener('click', async () => {
    if(miniJourney){
      if(preparing||elements.bootstrapStart.disabled)return;
      preparing=true;setStartAvailability();
      previewAudio.pause();
      if(miniJourney.continuity()&&miniJourney.view().examMode!=='read_first')miniJourney.markListeningStart();
      try{await miniJourney.begin();await enterJourney(true);}
      catch(error){
        if (miniJourney.activated()) showListeningLoadError(error);
        else showNotice(error.message,true);
      }
      finally{preparing=false;setStartAvailability();}
      return;
    }
    if (!encryptedAudio || preparing) return;
    preparing = true;
    elements.bootstrapStart.disabled = true;
    elements.bootstrapStart.textContent = 'Đang mở đề và audio...';
    previewAudio.pause();
    let started = null, officialAudio = null, openingApp = false;
    const startToken = state.examSessionToken;
    const startOwner = window.K67_AUDIO_OWNER;
    const startGeneration = Number(state.generation)||0;
    try {
      if (!window.K67_LISTENING_PROTECTION) await loadScript('../k67-shared/listening-controller-term2-audio-v2.js?rev=20261016-reading-recovery-v1&termEof=20261108-v1'+(testConfig.slug==='mini-test-lesson-5'?'&miniEof=20261107-v1':'&termsEof=20261107-v1'));
      const savedHeardSeconds = state.listeningStartedAt && legacyUiState.audioStarted
        ? legacyUiState.audioTime
        : undefined;
      const ownerStart=await window.K67_AUDIO_OWNER?.beforeStart()||{};
      started = await apiRequest(`/api/term-tests/${testConfig.slug}/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examSessionToken: state.examSessionToken,
          ...ownerStart,
          audioProtocolVersion: 1,
          audioStartGuardVersion: 1,
          generation: Number(state.generation) || 0,
          heardSeconds: savedHeardSeconds,
          audioEventId: crypto.randomUUID()
        })
      });
      window.K67_AUDIO_OWNER?.acceptStart(started);
      saveState({listeningStartedAt: started.listeningStartedAt, listeningDeadlineAt: started.listeningDeadlineAt});
      officialAudio = document.createElement('audio');
      officialAudio.hidden = true;
      document.body.append(officialAudio);
      window.K67_AUDIO_OWNER?.bindAudio(officialAudio);
      if(!window.K67_AUDIO_ENVIRONMENT)await loadScript('../k67-shared/audio-environment.js?rev=20261015-owner-v1');
      window.K67_ACTIVE_LISTENING?.stop();
      window.K67_ACTIVE_LISTENING = window.K67_LISTENING_PROTECTION({audio: officialAudio,
        session: started, slug: testConfig.slug, apiBase: appConfig.API_BASE_URL, generation: Number(started.generation) || 0});
      let decrypted;
      try { decrypted = await decryptOfficialAudio(encryptedAudio, started); }
      catch (error) {
        if (!audioScope) throw error;
        if (window.K67_AUDIO_STORE) await window.K67_AUDIO_STORE.remove(audioScope).catch(() => {});
        // Bản lưu sai/hỏng chỉ tải lại một lần với quyền vừa được xác thực, không đổi phiên bản đề.
        if (!audioFromCache) throw error;
        audioFromCache = false;
        encryptedAudio = await loadEncryptedAudio(appConfig.API_BASE_URL + `/api/term-tests/${testConfig.slug}/session/${state.examSessionToken}/audio`, {}, true);
        decrypted = await decryptOfficialAudio(encryptedAudio, started);
      }
      officialObjectUrl = URL.createObjectURL(new Blob([decrypted], { type: 'audio/mpeg' }));
      officialAudio.src = officialObjectUrl;
      officialAudio.volume = Number(elements.bootstrapVolume.value) || 1;
      const serverElapsed = Math.max(0, (Date.parse(started.serverNow) - Date.parse(started.listeningStartedAt)) / 1000);
      const serverResumeAt = Number(started.listeningResumeAtSeconds);
      let resumeAt = Number.isFinite(serverResumeAt)
        ? Math.min(serverElapsed, Math.max(0, serverResumeAt))
        : serverElapsed;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Audio chưa sẵn sàng sau 10 giây.')), 10000);
        officialAudio.addEventListener('loadedmetadata', () => {clearTimeout(timeout);resolve();}, { once: true });
        officialAudio.addEventListener('error', () => {clearTimeout(timeout);reject(new Error('Trình duyệt không đọc được audio chính.'));}, { once: true });
        officialAudio.load();
      });
      const eofRequired = audioAccess?.listeningEofVersion === 1;
      const reviewOnly = eofRequired && Boolean(started.listeningEofAt || audioAccess.listeningEofAt);
      if (eofRequired && !reviewOnly) {
        resumeAt = Math.min(resumeAt, Math.max(0, officialAudio.duration - 1));
        const { createListeningEofGate, createK67EofObserver } = await import('../k67-shared/listening-eof.mjs?v=20261108-journal-v1');
        const observeDecision = createK67EofObserver(officialAudio, { mode: 'online',
          configuredDurationSeconds: Number(audioAccess.listeningDurationSeconds) });
        window.K67_ACTIVE_LISTENING?.requireEof(createListeningEofGate({ audio: officialAudio, anchorSeconds: resumeAt, observeDecision }));
      }
      officialAudio.currentTime = Math.min(resumeAt, Math.max(0, officialAudio.duration - 0.05));
      saveState({
        listeningStartedAt: started.listeningStartedAt,
        listeningDeadlineAt: started.listeningDeadlineAt,
        listeningRecoverySeconds: Number(started.listeningRecoverySeconds) || 0,
        serverTimeOffsetMs: (window.IZONE_EXAM_CLOCK?.offset(started.serverNow) ?? (Date.parse(started.serverNow) - Date.now())),
        audioVolume: officialAudio.volume
      });
      if(started.examMode==='read_first')saveState(window.K67_EXAM_ORDER.restoreDrafts(state,started));
      legacyListeningResume = false;
      openingApp = true;
      await enterExam(started, officialAudio);
      const view = document.getElementById('listeningView');
      const stillOwnsListening = () => state.examSessionToken === startToken
        && (Number(state.generation)||0) === startGeneration && startOwner === window.K67_AUDIO_OWNER
        && startOwner?.canPlay() !== false && view?.isConnected && !view.hidden;
      const protection = window.K67_ACTIVE_LISTENING;
      if (reviewOnly) {
        view?.dispatchEvent(new Event('term-test:listening-audio-ready'));
      } else if (stillOwnsListening() && resumeAt < officialAudio.duration) {
        const play = async () => {
          if (!stillOwnsListening() || view.dataset.listeningSubmitting === 'true') return;
          if (protection?.isHeld()) await protection.start();
          else await officialAudio.play();
          if (!stillOwnsListening()) { officialAudio.pause(); return; }
          if (protection?.isHeld() || officialAudio.paused) return;
          protection?.arm();
          view.dispatchEvent(new Event('term-test:listening-audio-ready'));
        };
        try { await play(); }
        catch {
          const status = view.querySelector('.cbt-audio-status');
          const button = view.querySelector('.cbt-audio-play');
          if (status) status.textContent = 'Trình duyệt chưa cho phát. Hãy bấm Phát audio.';
          if (button) {
            button.textContent = 'Phát audio';
            button.hidden = false;
            button.addEventListener('click', async () => {
              if (button.disabled || !stillOwnsListening()) return;
              button.disabled = true;
              try { await play(); if (!officialAudio.paused) button.hidden = true; }
              catch { if (status) status.textContent = 'Chưa phát được audio. Hãy thử lại hoặc báo giáo viên.'; }
              finally { button.disabled = false; }
            });
          }
        }
      }
      if (audioScope) {
        const status = document.createElement('p'); status.id = 'k67AudioCacheStatus'; status.textContent = audioCacheStatus;
        status.className='k67-cache-status';status.title=audioCacheStatus;
        document.querySelector('#listeningView .k67-inline-audio')?.append(status);
      }
    } catch (error) {
      if (openingApp) {
        window.K67_ACTIVE_LISTENING?.stop();
        officialAudio?.pause();
        showListeningLoadError(error);
        return;
      }
      if (started && officialAudio && window.K67_ACTIVE_LISTENING) {
        await window.K67_ACTIVE_LISTENING.report('startup_failed');
      }
      window.K67_AUDIO_OWNER?.cancelStart();
      showNotice(`Chưa thể bắt đầu: ${error.userMessage || error.message}. Đề vẫn đang khóa.`, true);
      elements.bootstrapStart.textContent = state.listeningStartedAt ? 'Tiếp tục bài thi Listening' : 'Bắt đầu thi Listening';
      elements.bootstrapStart.disabled = false;
      window.IZONE_CBT_AUDIO_START_LABEL?.(elements.bootstrapStart,
        previewHeard && !state.listeningStartedAt && !legacyListeningResume);
    } finally {
      preparing = false;
    }
  });
  let recoverablePreparation,requestedPreparationRecovery;
  elements.bootstrapRetry.addEventListener('click', () => {
    if(recoverablePreparation!==undefined){
      if(!window.confirm('Listening chưa bắt đầu. Chuyển quyền chuẩn bị sang tab này? Phiên, nháp và phần Reading đã làm sẽ được giữ nguyên.'))return;
      requestedPreparationRecovery=recoverablePreparation;recoverablePreparation=undefined;
    }
    if (!roster.length) initialize();
    else prepareSelectedStudent(true);
  });
  window.addEventListener('online', () => { if (document.getElementById('bootstrapStart') && !preparing && elements.bootstrapRetry.hidden === false) { if (!roster.length) initialize(); else prepareSelectedStudent(); } });
  window.addEventListener('term-test:listening-submitted', () => { if (audioScope) window.K67_AUDIO_STORE?.remove(audioScope).catch(() => {}); }, true);
  window.addEventListener('term-test:listening-submitted', () => window.K67_AUDIO_OWNER?.stop(), true);
  elements.bootstrapDemoReset.addEventListener('click', async () => {
    const studentRef = elements.bootstrapStudent.value;
    const student = roster.find(item => item.ref === studentRef);
    if (classCode !== 'CODEXDEMO806' || !student) return;
    if (!window.confirm(`Xóa toàn bộ dữ liệu làm bài của ${student.name} để thử lại từ đầu?`)) return;

    const normalText = elements.bootstrapDemoReset.textContent;
    elements.bootstrapDemoReset.disabled = true;
    elements.bootstrapDemoReset.textContent = 'Đang reset...';
    try {
      await apiRequest('/api/term-tests/demo/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode,
          testSlug: testConfig.slug,
          studentRef,
          confirmation: 'RESET_DEMO_STUDENT'
        })
      });
      try { localStorage.setItem(`izone-demo-reset:student:${classCode}:${studentRef}:${testConfig.slug}`,crypto.randomUUID()); }
      catch { /* The server already invalidated the scoped demo run. */ }
      clearAllLocalAttemptData();
      window.location.reload();
    } catch (error) {
      showNotice(`Không thể reset dữ liệu: ${error.message}`, true);
      elements.bootstrapDemoReset.disabled = false;
      elements.bootstrapDemoReset.textContent = normalText;
    }
  });
  elements.bootstrapStudent.addEventListener('change', async () => {
    if (bootstrapSelectionBusy) return;
    bootstrapSelectionBusy = true;
    elements.bootstrapStudent.closest('.cbt-bootstrap-identity').inert = true;
    try {
    const selectedValue = elements.bootstrapStudent.value;
    sharedIdentity?.invalidate();
    if (activeIdentityLocked() && selectedValue !== state.studentRef) {
      elements.bootstrapStudent.value = state.studentRef;
      showNotice('Bài đang gắn với danh tính hiện tại; không thể đổi người học lúc này.', true);
      return;
    }
    const selectingTemporary = selectedValue === '__temporary__';
    const selectedRef = selectingTemporary ? '' : selectedValue;
    if (selectedRef) {
      const selectedStudent = roster.find(item => item.ref === selectedRef);
      const confirmed = selectedStudent ? await confirmStudentIdentity(selectedStudent) : false;
      if (!confirmed) {
        elements.bootstrapStudent.value = roster.some(item => item.ref === state.studentRef)
          ? state.studentRef
          : '';
        elements.bootstrapDemoReset.hidden = classCode !== 'CODEXDEMO806' || !elements.bootstrapStudent.value;
        if (elements.bootstrapTemporaryStudentForm) elements.bootstrapTemporaryStudentForm.hidden = true;
        return;
      }
      if (sharedIdentity && selectedStudent) bindSharedStudent(selectedStudent);
      if (memoryEnabled() && officialStudent(selectedStudent)) {
        studentMemory.api.writeMemory(studentMemory.storage, studentMemory.key, studentMemory.preferred ? selectedStudent.ref : '');
      }
    }
    const sameStudent = selectedRef === state.studentRef;
    if (!sameStudent) clearAttemptUiState();
    legacyListeningResume = Boolean(sameStudent && selectedRef && !state.attemptToken && legacyUiState.audioStarted);
    saveState({
      studentRef: selectedRef,
      studentName: roster.find(item => item.ref === selectedRef)?.name || '',
      studentIdentitySource: roster.find(item => item.ref === selectedRef)?.temporary
        ? 'temporary'
        : (selectedRef ? 'roster' : ''),
      clientSubmissionId: sameStudent ? state.clientSubmissionId : '',
      clientSubmissionStudentRef: sameStudent ? state.clientSubmissionStudentRef : '',
      examSessionToken: sameStudent ? state.examSessionToken : '',
      attemptToken: sameStudent ? state.attemptToken : '',
      listeningStartedAt: sameStudent ? state.listeningStartedAt : '',
      listeningDeadlineAt: sameStudent ? state.listeningDeadlineAt : '',
      readingStartedAt: sameStudent ? state.readingStartedAt : '',
      readingDeadlineAt: sameStudent ? state.readingDeadlineAt : '',
      writingStartedAt: sameStudent ? state.writingStartedAt : '',
      writingDeadlineAt: sameStudent ? state.writingDeadlineAt : '',
      completed: sameStudent ? Boolean(state.completed) : false,
      writingStarted: sameStudent ? Boolean(state.writingStarted) : false,
      writingSubmitted: sameStudent ? Boolean(state.writingSubmitted) : false,
      writingDirty: sameStudent ? Boolean(state.writingDirty) : false,
      drafts: sameStudent
        ? state.drafts
        : { listening: {}, reading: {}, writing: { task1: '', task2: '' } },
      frozenAnswers: sameStudent
        ? state.frozenAnswers
        : { listening: null, reading: null },
      result: sameStudent ? state.result : null,
      attemptReview: sameStudent ? state.attemptReview : null
    });
    elements.bootstrapDemoReset.hidden = classCode !== 'CODEXDEMO806' || !selectedRef;
    if (elements.bootstrapTemporaryStudentForm) {
      elements.bootstrapTemporaryStudentForm.hidden = !selectingTemporary;
      if (selectingTemporary) elements.bootstrapTemporaryStudentName.focus();
      else { elements.bootstrapTemporaryStudentName.value = ''; elements.bootstrapTemporaryStudentCode.value = ''; }
    }
    if (selectingTemporary && sharedIdentity) {
      await sharedIdentity.forget(); applyStorageBinding(sharedIdentity.current());
      state = { audioVolume: state.audioVolume };
      studentMemory.checkbox.checked = false; studentMemory.checkbox.disabled = true;
      setMemoryStatus('Hồ sơ tạm không được ghi nhớ; hãy dùng mã tạm giáo viên đã cấp.');
    } else if (selectingTemporary && memoryEnabled()) {
      studentMemory.api.writeMemory(studentMemory.storage, studentMemory.key, '');
      studentMemory.checkbox.checked = false;
      studentMemory.checkbox.disabled = true;
      studentMemory.confirm.hidden = true;
      setMemoryStatus('Hồ sơ tạm không được ghi nhớ; hãy dùng mã tạm giáo viên đã cấp.');
    } else if (studentMemory.checkbox) {
      studentMemory.checkbox.disabled = false;
      studentMemory.checkbox.checked = studentMemory.preferred;
    }
    if (selectedRef) await prepareSelectedStudent();
    } finally {
      bootstrapSelectionBusy = false;
      elements.bootstrapStudent.closest('.cbt-bootstrap-identity').inert = false;
    }
  });

  function renderRosterOptions() {
    const options = [new Option('Nhấn để chọn', '')];
    for (const student of roster) {
      options.push(new Option(student.temporary ? `${student.name} (mã tạm)` : student.name, student.ref));
    }
    if (testConfig.allowTemporaryStudents) {
      options.push(new Option('Tên chưa có trong danh sách', '__temporary__'));
    }
    elements.bootstrapStudent.replaceChildren(...options);
  }

  elements.bootstrapTemporaryStudentForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!elements.bootstrapTemporaryStudentForm.reportValidity() || preparing || bootstrapSelectionBusy) return;
    bootstrapSelectionBusy = true;
    elements.bootstrapStudent.closest('.cbt-bootstrap-identity').inert = true;
    const studentName = elements.bootstrapTemporaryStudentName.value.trim().replace(/\s+/gu, ' ');
    const temporaryCode = elements.bootstrapTemporaryStudentCode.value.trim().toUpperCase();
    const normalText = elements.bootstrapRegisterTemporaryStudent.textContent;
    elements.bootstrapRegisterTemporaryStudent.disabled = true;
    elements.bootstrapRegisterTemporaryStudent.textContent = 'Đang xác nhận...';
    try {
      const response = await apiRequest(`/api/term-tests/${testConfig.slug}/temporary-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classCode, studentName, temporaryCode })
      });
      const student = response.student;
      if (!student?.ref || !student?.name || student.temporary !== true) {
        throw new Error('Hệ thống không trả về hồ sơ học viên tạm hợp lệ.');
      }
      if (sharedIdentity) bindSharedStudent(student);
      roster = roster.filter(item => item.ref !== student.ref);
      roster.push(student);
      renderRosterOptions();
      elements.bootstrapStudent.value = student.ref;
      elements.bootstrapTemporaryStudentName.value = '';
      elements.bootstrapTemporaryStudentCode.value = '';
      elements.bootstrapTemporaryStudentForm.hidden = true;
      saveState({
        studentRef: student.ref,
        studentName: student.name,
        studentIdentitySource: 'temporary'
      });
      if (memoryEnabled()) {
        studentMemory.api.writeMemory(studentMemory.storage, studentMemory.key, '');
        studentMemory.checkbox.checked = false;
        studentMemory.checkbox.disabled = true;
        studentMemory.confirm.hidden = true;
        setMemoryStatus('Hồ sơ tạm không được ghi nhớ; hãy dùng mã tạm giáo viên đã cấp.');
      }
      showNotice(`Đã xác nhận ${student.name}. Hệ thống đang chuẩn bị bài thi.`);
      await prepareSelectedStudent();
    } catch (error) {
      showNotice(`Chưa xác nhận được học viên: ${error.message}`, true);
    } finally {
      elements.bootstrapRegisterTemporaryStudent.disabled = false;
      bootstrapSelectionBusy = false;
      elements.bootstrapStudent.closest('.cbt-bootstrap-identity').inert = false;
      elements.bootstrapRegisterTemporaryStudent.textContent = normalText;
    }
  });

  async function initialize() {
    await initializeStudentMemory();
    if (!/^[A-Z0-9._-]{2,32}$/.test(classCode)) {
      if (rememberedClasses.length > 1) {
        elements.bootstrapClass.textContent = 'Chọn lớp của bài muốn mở';
        const picker = document.createElement('select'); picker.id = 'bootstrapRememberedClass';
        picker.setAttribute('aria-label', 'Lớp của bài muốn mở');
        picker.replaceChildren(new Option('Nhấn để chọn lớp', ''), ...rememberedClasses.map(code => new Option(code, code)));
        picker.addEventListener('change', () => {
          if (!rememberedClasses.includes(picker.value)) return;
          query.set('class', picker.value); location.assign(`${location.pathname}?${query.toString()}${location.hash}`);
        });
        elements.bootstrapClass.after(picker); elements.bootstrapStudent.disabled = true;
        showNotice('Trình duyệt đã nhớ bạn. Hãy chọn lớp của bài muốn mở; không cần chọn lại tên.');
      } else showNotice('Link chưa có mã lớp hợp lệ. Hãy mở link bài của lớp được giao.', true);
      return;
    }
    if (listeningOnly && !retakeGrant) {
      elements.bootstrapDownloadStep.dataset.state = 'error';
      elements.bootstrapDownloadStatus.textContent = 'Liên kết thi bù chưa có vé hợp lệ. Hãy dùng đúng liên kết giáo viên đã gửi.';
      showNotice('Không thể mở lượt thi bù bằng liên kết này.', true);
      return;
    }
    try {if(await openJourneyLobby()) {setStartAvailability();return;}}
    catch(error){showNotice(error.message,true);return;}
    if(navigator.onLine===false){try{if(await offerMiniJourneyRecovery())return;}catch{/* Keep the standard retry control. */}}
    try { if (await resumeMiniOffline()) return; } catch { /* Standard lobby retains the local draft. */ }
    let restoreError=null;
    // Có mã lượt: xác minh trực tiếp, không dựng lại danh sách cả lớp để mở lại bài.
    // Lỗi giữ nguyên token/nháp và không tự tạo lượt mới hoặc bắt đầu đồng hồ.
    if(classCode!=='CODEXDEMO806'&&!listeningOnly
      &&isUuid(state.studentRef)&&isUuid(state.attemptToken)) {
      const identity=elements.bootstrapStudent.closest('.cbt-bootstrap-identity');
      identity.hidden=true;
      elements.bootstrapDownloadStatus.textContent='Đang tiếp tục bài đã lưu...';
      try {await resumeAfterListening();return;}
      catch(error) {
        if (!error.status || error.status >= 500) {
          try { if (await resumeMiniOffline(true)) return; } catch { /* Keep the native error and local draft. */ }
        }
        restoreError=error;
        identity.hidden=false;
        if(![400,404,409].includes(error.status)) {
          showNotice(`Chưa xác nhận được lượt đã lưu: ${error.message}. Bài trên máy vẫn được giữ.`,true);
          elements.bootstrapDownloadStatus.textContent='Chưa mở được bài đã lưu. Hãy thử lại.';
          elements.bootstrapRetry.textContent='Thử mở lại bài';
          elements.bootstrapRetry.hidden=false;
          return;
        }
      }
    }
    await initializeStudentMemory();
    elements.bootstrapDownloadStep.dataset.state = 'active';
    elements.bootstrapDownloadStatus.textContent = 'Đang tải danh sách lớp...';
    elements.bootstrapRetry.hidden = true;
    elements.bootstrapDemoReset.hidden = true;
    hideNotice();
    try {
      if (sharedIdentity && !state.studentRef) {
        try {
          const selected = entryIdentity || await sharedIdentity.resolveRemembered(); entryIdentity = null;
          if (selected.status === 'unique') {
            if (listeningOnly && launchStudentRef && selected.student.ref !== launchStudentRef) {
              showNotice('Link thi bù thuộc người khác với người trình duyệt đã nhớ. Hãy kiểm tra link hoặc dùng Đổi người học.', true);
              return;
            }
            roster = [selected.student]; activeClassName = classCode; renderRosterOptions();
            bindSharedStudent(selected.student, selected.resolution);
            await prepareSelectedStudent(); return;
          }
          if (sharedIdentity.read().status === 'ok' && ['missing', 'ambiguous'].includes(selected.status))
            showNotice('Chưa tìm được duy nhất hồ sơ có quyền làm bài này. Danh tính đã nhớ vẫn được giữ; hãy kiểm tra link hoặc dùng Đổi người học.', true);
        } catch { showNotice('Chưa kiểm được người đã nhớ. Bạn có thể chọn tên; danh tính cũ vẫn được giữ.'); }
      }
      const data = await apiRequest(`/api/term-tests/roster?class=${encodeURIComponent(classCode)}&test=${encodeURIComponent(testConfig.slug)}`, {}, 12_000);
      roster = data.students || [];
      if (classCode === 'CODEXDEMO806' && !listeningOnly && !demoStudentRef && !demoAttemptToken) {
        // Link demo chung nhận bộ nhớ của lượt trước: bỏ khóa cục bộ để chọn lại người.
        // Bài/phiên trên máy chủ vẫn được giữ và tìm lại theo học viên vừa xác nhận.
        // Link kết quả có mã lượt và lượt thi bù tiếp tục giữ cơ chế khôi phục riêng.
        const audioVolume = Number(state.audioVolume) || 1;
        clearAllLocalAttemptData();
        state = { audioVolume };
        legacyListeningResume = false;
      }
      if (testConfig.allowTemporaryStudents
        && state.studentIdentitySource === 'temporary'
        && state.studentRef
        && state.studentName
        && !roster.some(student => student.ref === state.studentRef)) {
        roster.push({ ref: state.studentRef, name: state.studentName, temporary: true });
      }
      activeClassName = data.class.name || classCode;
      elements.bootstrapClass.textContent = /^lớp\s/iu.test(activeClassName)
        ? activeClassName
        : `Lớp ${activeClassName}`;
      renderRosterOptions();
      refreshRememberedBootstrapStudent();
      if(restoreError) {
        elements.bootstrapStudent.value=roster.some(s=>s.ref===state.studentRef)?state.studentRef:'';
        showNotice(`Chưa xác nhận được lượt đã lưu: ${restoreError.message}. Giữ nguyên nháp và nhờ giáo viên kiểm tra nếu lỗi tiếp diễn.`,true);
        elements.bootstrapDownloadStatus.textContent='Lượt đã lưu cần được kiểm tra trước khi tiếp tục.';
        elements.bootstrapRetry.textContent='Thử mở lại bài';
        elements.bootstrapRetry.hidden=false;
        return;
      }
      if (demoStudentRef || demoAttemptToken) {
        const demoStudent = roster.find(student => student.ref === demoStudentRef);
        if (!demoStudent || !isUuid(demoStudentRef) || !isUuid(demoAttemptToken)) {
          showNotice('Liên kết kết quả demo không hợp lệ.', true);
          return;
        }
        saveState({
          studentRef: demoStudent.ref,
          studentName: demoStudent.name,
          attemptToken: demoAttemptToken,
          examSessionToken: '',
          listeningStartedAt: '',
          listeningDeadlineAt: '',
          readingStartedAt: '',
          readingDeadlineAt: '',
          writingStartedAt: '',
          writingDeadlineAt: ''
        });
        elements.bootstrapStudent.value = demoStudent.ref;
        elements.bootstrapDemoReset.hidden = false;
        await prepareSelectedStudent();
        return;
      }
      // Lớp demo luôn quay về danh sách chọn tên khi mở đường dẫn chung.
      // Người kiểm thử vẫn có thể chọn lại đúng tên cũ để tiếp tục phiên đang dở;
      // các liên kết kết quả có demoStudent + demoAttempt vẫn mở thẳng như trước.
      const shouldRestoreSelectedStudent = classCode !== 'CODEXDEMO806'
        && state.studentRef
        && (!launchStudentRef || state.studentRef === launchStudentRef)
        && roster.some(student => student.ref === state.studentRef);
      if (shouldRestoreSelectedStudent) {
        elements.bootstrapStudent.value = state.studentRef;
        elements.bootstrapDemoReset.hidden = classCode !== 'CODEXDEMO806';
        await prepareSelectedStudent();
      } else if (launchStudentRef) {
        const launchMatches = roster.filter(student => !student.temporary && student.ref === launchStudentRef);
        if (!isUuid(launchStudentRef) || launchMatches.length !== 1) {
          showNotice('Liên kết thi bù không khớp duy nhất một học viên trong lớp này.', true);
          return;
        }
        elements.bootstrapStudent.value = launchMatches[0].ref;
        elements.bootstrapDownloadStatus.textContent = 'Đã điền sẵn họ tên. Hãy xác nhận trước khi tải audio.';
        elements.bootstrapStudent.dispatchEvent(new Event('change'));
      } else {
        elements.bootstrapDownloadStatus.textContent = 'Hãy chọn họ và tên để bắt đầu tải audio.';
        elements.bootstrapDownloadStep.dataset.state = 'active';
      }
    } catch (error) {
      roster = [];
      try{if(await offerMiniJourneyRecovery())return;}catch{/* Keep the standard retry control. */}
      elements.bootstrapDownloadStep.dataset.state = 'error';
      elements.bootstrapDownloadStatus.textContent = 'Không kết nối được máy chủ. Hãy kiểm tra mạng hoặc thử lại.';
      elements.bootstrapRetry.textContent = 'Thử tải danh sách lại';
      elements.bootstrapRetry.hidden = false;
      showNotice(`Không thể mở phòng chờ: ${error.message}`, true);
    }
  }

  window.addEventListener('pagehide', event => {
    if(!event.persisted)void miniJourney?.close();
    document.removeEventListener('keydown', blockInPageSearchShortcuts, { capture: true });
    window.clearTimeout(shortcutNoticeTimer);
    downloadController?.abort();
    previewAudio.pause();
    revokePreview();
  });
  // Vào lại bài đang chạy: cảnh báo ngay cả khi còn ở phòng tải audio, trước khi shared/app.js mở đề.
  window.addEventListener('beforeunload',event=>{
    if(!document.getElementById('bootstrapStart'))return;
    const current=readState();
    const active=Boolean((current.listeningStartedAt&&!current.listeningSubmitted)
      ||(current.readingStartedAt&&!current.readingSubmitted&&!current.completed)
      ||(current.writingStarted&&!current.writingSubmitted));
    if(active){event.preventDefault();event.returnValue=true;}
  });
  initialize();
}());

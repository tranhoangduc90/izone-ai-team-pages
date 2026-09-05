(function () {
  'use strict';

  const testConfig = window.TERM_TEST_CONFIG;
  const appConfig = window.TERM_TEST_APP_CONFIG;
  const audioLoader = window.TERM_TEST_AUDIO_LOADER;
  const root = document.getElementById('app');
  const scriptAssetBase = new URL('.', document.currentScript?.src || window.location.href).toString().replace(/\/$/, '');
  const query = new URLSearchParams(window.location.search);
  const classCode = (query.get('class') || '').trim().toUpperCase();
  const demoStudentRef = classCode === 'CODEXDEMO806' ? (query.get('demoStudent') || '').trim() : '';
  const demoAttemptToken = classCode === 'CODEXDEMO806' ? (query.get('demoAttempt') || '').trim() : '';
  if (!testConfig || !appConfig || !audioLoader || !root) return;
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

  const storageKey = `izone-test:${testConfig.slug}:${classCode}`;
  const uiStorageKey = `izone-test-ui:${testConfig.slug}:${classCode}`;
  let state = readState();
  const legacyUiState = readLegacyUiState();
  let legacyListeningResume = Boolean(state.studentRef && !state.attemptToken && legacyUiState.audioStarted);
  let roster = [];
  let activeClassName = classCode;
  let encryptedAudio = null;
  let previewObjectUrl = '';
  let officialObjectUrl = '';
  let previewHeard = false;
  let preparing = false;
  let bootstrapSelectionBusy = false;
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
          <p>Đề thi đang được khóa. Audio chính được tải dưới dạng mã hóa và chỉ mở khi bạn bấm Bắt đầu.</p>
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
              <h3>Tải đủ audio đã mã hóa</h3>
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
      change.addEventListener('click', () => {
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
    for (const storage of availableStorages()) {
      try {
        const parsed = JSON.parse(storage.getItem(uiStorageKey) || '{}');
        if (Object.keys(parsed).length) {
          return {
            audioStarted: Boolean(parsed.audio?.started),
            audioTime: Math.min(1844, Math.max(0, Math.floor(Number(parsed.audio?.time) || 0))),
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
    const interactionPrefix = `izone-test-interactions:${testConfig.slug}:${classCode}:`;
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

  async function apiRequest(path, options = {}, timeoutMs = 30_000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(appConfig.API_BASE_URL + path, { ...options, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Lỗi HTTP ${response.status}`);
      return data;
    } catch (error) {
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
    const resumed = Boolean(state.listeningStartedAt || legacyListeningResume);
    const ready = Boolean(encryptedAudio && (previewHeard || resumed));
    elements.bootstrapStart.disabled = !ready || preparing;
    elements.bootstrapStart.textContent = resumed ? 'Tiếp tục bài thi Listening' : 'Bắt đầu thi Listening';
    elements.bootstrapStartStatus.textContent = resumed
      ? 'Đồng hồ máy chủ vẫn đang chạy. Tiếp tục ngay sau khi audio tải đủ.'
      : 'Sau khi bấm, đồng hồ máy chủ bắt đầu và đề mới được mở.';
  }

  function revokePreview() {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = '';
  }

  async function downloadForSession(session) {
    hideNotice();
    downloadController?.abort();
    downloadController = new AbortController();
    encryptedAudio = null;
    const resuming = Boolean(session.listeningStartedAt || legacyListeningResume);
    previewHeard = resuming;
    elements.bootstrapDownloadStep.dataset.state = 'active';
    elements.bootstrapPreviewStep.dataset.state = 'locked';
    elements.bootstrapStartStep.dataset.state = 'locked';
    elements.bootstrapRetry.hidden = true;
    elements.bootstrapPreview.disabled = true;
    elements.bootstrapVolume.disabled = true;
    elements.bootstrapDownloadStatus.textContent = 'Đang tải audio đã mã hóa...';
    elements.bootstrapDownloadProgress.max = 1;
    elements.bootstrapDownloadProgress.value = 0;
    try {
      const audioUrl = appConfig.API_BASE_URL + session.encryptedAudioUrl;
      const previewUrl = appConfig.API_BASE_URL + session.previewAudioUrl;
      const [encrypted, previewResponse] = await Promise.all([
        audioLoader.downloadAudio(audioUrl, {
          signal: downloadController.signal,
          onProgress: ({ loaded, total, complete }) => {
            if (total > 0) {
              elements.bootstrapDownloadProgress.max = total;
              elements.bootstrapDownloadProgress.value = loaded;
              const percent = Math.min(100, Math.round(loaded * 100 / total));
              elements.bootstrapDownloadStatus.textContent = `${complete ? 'Đã tải đủ audio mã hóa' : 'Đang tải audio mã hóa'} · ${percent}% · ${formatBytes(loaded)} / ${formatBytes(total)}`;
            } else {
              elements.bootstrapDownloadProgress.removeAttribute('value');
              elements.bootstrapDownloadStatus.textContent = `Đang tải audio mã hóa · ${formatBytes(loaded)}`;
            }
          }
        }),
        fetch(previewUrl, { cache: 'no-store', signal: downloadController.signal })
      ]);
      if (!previewResponse.ok) throw new Error('Không tải được bản nghe thử.');
      encryptedAudio = encrypted;
      const previewBlob = await previewResponse.blob();
      revokePreview();
      previewObjectUrl = URL.createObjectURL(previewBlob);
      previewAudio.src = previewObjectUrl;
      previewAudio.volume = Number(elements.bootstrapVolume.value) || 1;
      elements.bootstrapDownloadProgress.max = 1;
      elements.bootstrapDownloadProgress.value = 1;
      elements.bootstrapDownloadStatus.textContent = `Đã tải đủ audio mã hóa · 100% · ${formatBytes(encrypted.size)}`;
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
      if (error.name === 'AbortError') return;
      elements.bootstrapDownloadStep.dataset.state = 'error';
      elements.bootstrapDownloadStatus.textContent = 'Chưa tải đủ audio. Bài thi vẫn đang khóa.';
      elements.bootstrapRetry.textContent = 'Thử tải lại audio';
      elements.bootstrapRetry.hidden = false;
      showNotice(error.message, true);
    }
  }

  async function prepareSelectedStudent() {
    const studentRef = elements.bootstrapStudent.value;
    const student = roster.find(item => item.ref === studentRef);
    if (!student || preparing) return;
    preparing = true;
    saveState({
      studentRef,
      studentName: student.name,
      studentIdentitySource: student.temporary ? 'temporary' : 'roster'
    });
    elements.bootstrapStudent.disabled = true;
    try {
      if (state.attemptToken) {
        await resumeAfterListening();
        return;
      }
      const prepared = await apiRequest(`/api/term-tests/${testConfig.slug}/session/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode,
          studentRef,
          examSessionToken: state.examSessionToken || undefined,
          legacyElapsedSeconds: legacyListeningResume ? legacyUiState.audioTime : 0
        })
      });
      saveState({
        examSessionToken: prepared.examSessionToken,
        listeningStartedAt: prepared.listeningStartedAt,
        listeningDeadlineAt: prepared.listeningDeadlineAt,
        attemptToken: prepared.attemptToken || state.attemptToken || '',
        listeningSubmitted: Boolean(prepared.listeningSubmitted || prepared.attemptToken),
        drafts: {
          ...(state.drafts || {}),
          listening: { ...(prepared.listeningDraft || state.drafts?.listening || {}) },
          reading: { ...(prepared.readingDraft || state.drafts?.reading || {}) }
        },
        draftRevisions: {
          ...(state.draftRevisions || {}),
          listening: Number(prepared.listeningDraftRevision) || Number(state.draftRevisions?.listening) || 0,
          reading: Number(prepared.readingDraftRevision) || Number(state.draftRevisions?.reading) || 0
        },
        draftAckRevisions: {
          ...(state.draftAckRevisions || {}),
          listening: Number(prepared.listeningDraftRevision) || Number(state.draftAckRevisions?.listening) || 0,
          reading: Number(prepared.readingDraftRevision) || Number(state.draftAckRevisions?.reading) || 0
        }
      });
      if (state.attemptToken || prepared.listeningSubmitted) {
        await resumeAfterListening();
        return;
      }
      await downloadForSession(prepared);
    } catch (error) {
      elements.bootstrapStudent.disabled = false;
      showNotice(`Chưa chuẩn bị được bài thi: ${error.message}`, true);
    } finally {
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
    const envelope = new Uint8Array(await blob.arrayBuffer());
    const magic = new TextDecoder().decode(envelope.subarray(0, 5));
    if (magic !== response.audioEnvelope.magic) throw new Error('Gói audio mã hóa không hợp lệ.');
    const ivStart = 5;
    const ivEnd = ivStart + response.audioEnvelope.ivBytes;
    const key = await crypto.subtle.importKey('raw', base64Bytes(response.audioKey), 'AES-GCM', false, ['decrypt']);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.subarray(ivStart, ivEnd) }, key, envelope.subarray(ivEnd));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error(`Không nạp được ${src}.`)), { once: true });
      document.body.append(script);
    });
  }

  function cbtAssetUrl(fileName, revision) {
    const base = String(window.TERM_TEST_CBT_ASSET_BASE || scriptAssetBase).replace(/\/$/, '');
    return `${base}/${fileName}?rev=${revision}`;
  }

  async function enterExam(started, audioElement = null) {
    window.TERM_TEST_CONTENT = Object.freeze(started.content);
    window.TERM_TEST_BOOTSTRAP = Object.freeze({
      examSessionToken: state.examSessionToken,
      listeningDeadlineAt: started.listeningDeadlineAt,
      serverNow: started.serverNow,
      audioVolume: Number(state.audioVolume) || 1,
      officialAudioElement: audioElement,
      officialAudioUrl: officialObjectUrl,
      skipListeningAudio: Boolean(state.attemptToken || started.listeningSubmitted)
    });
    previewAudio.remove();
    revokePreview();
    await loadScript('../shared/attempt-review.js?rev=20260821-attempt-review-v1');
    await loadScript('../shared/app.js?rev=20260829-all-student-confirmation-v2-20260905-memory-v3');
    await loadScript(cbtAssetUrl('enhance.js', '20260904-compact-layout-v7'));
    await loadScript(cbtAssetUrl('interaction-tools.js', '20260824-writing-note-fix-v1'));
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
    saveState({
      examSessionToken: started.examSessionToken || state.examSessionToken || '',
      listeningStartedAt: started.listeningStartedAt || state.listeningStartedAt || '',
      listeningDeadlineAt: started.listeningDeadlineAt || state.listeningDeadlineAt || '',
      readingStartedAt: started.readingStartedAt || state.readingStartedAt || '',
      readingDeadlineAt: started.readingDeadlineAt || state.readingDeadlineAt || '',
      writingStartedAt: started.writingStartedAt || state.writingStartedAt || '',
      writingDeadlineAt: started.writingDeadlineAt || state.writingDeadlineAt || '',
      serverTimeOffsetMs: Date.parse(started.serverNow) - Date.now(),
      attemptToken: started.attemptToken || state.attemptToken || '',
      listeningSubmitted: true,
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
      previewHeard = true;
      elements.bootstrapPreview.textContent = 'Dừng nghe thử';
      elements.bootstrapPreviewStep.dataset.state = 'complete';
      elements.bootstrapStartStep.dataset.state = 'active';
      elements.bootstrapPreviewStatus.textContent = 'Đang nghe thử · tối đa 30 giây.';
      setStartAvailability();
    } catch {
      elements.bootstrapPreviewStatus.textContent = 'Trình duyệt chưa cho phát. Hãy nhấn lại nút nghe thử.';
    }
  });
  previewAudio.addEventListener('ended', () => {
    elements.bootstrapPreview.textContent = 'Nghe lại 30 giây đầu';
    elements.bootstrapPreviewStatus.textContent = 'Đã nghe hết bản thử. Bạn có thể bắt đầu thi.';
  });
  elements.bootstrapVolume.addEventListener('input', () => {
    const volume = Number(elements.bootstrapVolume.value) || 1;
    previewAudio.volume = volume;
    saveState({ audioVolume: volume });
  });
  elements.bootstrapStart.addEventListener('click', async () => {
    if (!encryptedAudio || preparing) return;
    preparing = true;
    elements.bootstrapStart.disabled = true;
    elements.bootstrapStart.textContent = 'Đang mở đề và audio...';
    previewAudio.pause();
    try {
      const started = await apiRequest(`/api/term-tests/${testConfig.slug}/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examSessionToken: state.examSessionToken })
      });
      const decrypted = await decryptOfficialAudio(encryptedAudio, started);
      officialObjectUrl = URL.createObjectURL(new Blob([decrypted], { type: 'audio/mpeg' }));
      const officialAudio = document.createElement('audio');
      officialAudio.hidden = true;
      officialAudio.src = officialObjectUrl;
      officialAudio.volume = Number(elements.bootstrapVolume.value) || 1;
      document.body.append(officialAudio);
      const serverElapsed = Math.max(0, (Date.parse(started.serverNow) - Date.parse(started.listeningStartedAt)) / 1000);
      await new Promise((resolve, reject) => {
        officialAudio.addEventListener('loadedmetadata', resolve, { once: true });
        officialAudio.addEventListener('error', () => reject(new Error('Trình duyệt không đọc được audio chính.')), { once: true });
        officialAudio.load();
      });
      officialAudio.currentTime = Math.min(serverElapsed, Math.max(0, officialAudio.duration - 0.05));
      if (serverElapsed < officialAudio.duration) await officialAudio.play();
      saveState({
        listeningStartedAt: started.listeningStartedAt,
        listeningDeadlineAt: started.listeningDeadlineAt,
        serverTimeOffsetMs: Date.parse(started.serverNow) - Date.now(),
        audioVolume: officialAudio.volume
      });
      legacyListeningResume = false;
      await enterExam(started, officialAudio);
    } catch (error) {
      showNotice(`Chưa thể bắt đầu: ${error.message}. Đề vẫn đang khóa.`, true);
      elements.bootstrapStart.textContent = state.listeningStartedAt ? 'Tiếp tục bài thi Listening' : 'Bắt đầu thi Listening';
      elements.bootstrapStart.disabled = false;
    } finally {
      preparing = false;
    }
  });
  elements.bootstrapRetry.addEventListener('click', () => {
    if (!roster.length) initialize();
    else prepareSelectedStudent();
  });
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
    if (selectingTemporary && memoryEnabled()) {
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
    if (!/^[A-Z0-9._-]{2,32}$/.test(classCode)) {
      showNotice('Link chưa có mã lớp hợp lệ.', true);
      return;
    }
    await initializeStudentMemory();
    elements.bootstrapDownloadStep.dataset.state = 'active';
    elements.bootstrapDownloadStatus.textContent = 'Đang tải danh sách lớp...';
    elements.bootstrapRetry.hidden = true;
    elements.bootstrapDemoReset.hidden = true;
    hideNotice();
    try {
      const data = await apiRequest(`/api/term-tests/roster?class=${encodeURIComponent(classCode)}&test=${encodeURIComponent(testConfig.slug)}`, {}, 12_000);
      roster = data.students || [];
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
        && roster.some(student => student.ref === state.studentRef);
      if (shouldRestoreSelectedStudent) {
        elements.bootstrapStudent.value = state.studentRef;
        elements.bootstrapDemoReset.hidden = classCode !== 'CODEXDEMO806';
        await prepareSelectedStudent();
      } else {
        elements.bootstrapDownloadStatus.textContent = 'Hãy chọn họ và tên để bắt đầu tải audio.';
        elements.bootstrapDownloadStep.dataset.state = 'active';
      }
    } catch (error) {
      roster = [];
      elements.bootstrapDownloadStep.dataset.state = 'error';
      elements.bootstrapDownloadStatus.textContent = 'Không kết nối được máy chủ. Hãy kiểm tra mạng hoặc thử lại.';
      elements.bootstrapRetry.textContent = 'Thử tải danh sách lại';
      elements.bootstrapRetry.hidden = false;
      showNotice(`Không thể mở phòng chờ: ${error.message}`, true);
    }
  }

  window.addEventListener('pagehide', () => {
    document.removeEventListener('keydown', blockInPageSearchShortcuts, { capture: true });
    window.clearTimeout(shortcutNoticeTimer);
    downloadController?.abort();
    previewAudio.pause();
    revokePreview();
  });
  initialize();
}());

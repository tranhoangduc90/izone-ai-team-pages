(function () {
  'use strict';

  const testConfig = window.TERM_TEST_CONFIG;
  const appConfig = window.TERM_TEST_APP_CONFIG;
  const root = document.getElementById('app');
  const clientBuild = '20260829-all-student-confirmation-v2';
  const query = new URLSearchParams(window.location.search);
  const classCode = (query.get('class') || '').trim().toUpperCase();
  const requestedDemo = query.get('demo') || '';
  const writingConfig = window.TERM_TEST_CONTENT?.writing || null;
  const deferResultsUntilComplete = Boolean(window.TERM_TEST_CONTENT?.deferResultsUntilComplete);
  const readingMinutes = Math.max(1, Number(window.TERM_TEST_CONTENT?.timing?.readingMinutes) || 60);
  const writingMinutes = Math.max(1, Number(window.TERM_TEST_CONTENT?.timing?.writingMinutes) || 60);
  const writingTasks = Array.from(writingConfig?.tasks || []);
  const writingTaskLabels = writingTasks.map(task => task.label || task.id).join(' và ');
  const demoMode = window.TERM_TEST_CONTENT?.variant === 'semantic-html'
    && ['complete', 'listening-only', 'writing-prep', 'writing'].includes(requestedDemo)
    ? requestedDemo
    : '';

  if (!testConfig || !appConfig || !root) return;

  const storageKey = `izone-test:${testConfig.slug}:${classCode}`;
  const restoredSession = readSession();
  const state = {
    stage: 'loading',
    roster: [],
    className: classCode,
    studentRef: '',
    studentName: '',
    studentIdentitySource: '',
    clientSubmissionId: '',
    clientSubmissionStudentRef: '',
    examSessionToken: '',
    attemptToken: '',
    listeningDeadlineAt: '',
    readingDeadlineAt: '',
    writingDeadlineAt: '',
    serverTimeOffsetMs: 0,
    audioVolume: 1,
    listeningSubmitted: false,
    completed: false,
    writingStarted: false,
    writingSubmitted: false,
    writingDirty: false,
    drafts: { listening: {}, reading: {}, writing: { task1: '', task2: '' } },
    draftRevisions: { listening: 0, reading: 0 },
    draftAckRevisions: { listening: 0, reading: 0 },
    writingLayout: { activeTask: 'task1', splits: {} },
    frozenAnswers: { listening: null, reading: null },
    result: null,
    attemptReview: null,
    ...restoredSession,
    drafts: {
      listening: { ...(restoredSession.drafts?.listening || {}) },
      reading: { ...(restoredSession.drafts?.reading || {}) },
      writing: {
        task1: String(restoredSession.drafts?.writing?.task1 || ''),
        task2: String(restoredSession.drafts?.writing?.task2 || '')
      }
    },
    writingLayout: {
      activeTask: String(restoredSession.writingLayout?.activeTask || 'task1'),
      splits: { ...(restoredSession.writingLayout?.splits || {}) }
    },
    frozenAnswers: {
      listening: restoredSession.frozenAnswers?.listening || null,
      reading: restoredSession.frozenAnswers?.reading || null
    },
    draftRevisions: {
      listening: Number(restoredSession.draftRevisions?.listening) || 0,
      reading: Number(restoredSession.draftRevisions?.reading) || 0
    },
    draftAckRevisions: {
      listening: Number(restoredSession.draftAckRevisions?.listening) || 0,
      reading: Number(restoredSession.draftAckRevisions?.reading) || 0
    }
  };

  // Trình duyệt chặn một kho lưu vẫn cho chọn tên và dùng kho còn lại.
  function availableStorages() {
    return ['sessionStorage', 'localStorage'].flatMap(name => {
      try { return window[name] ? [window[name]] : []; } catch { return []; }
    });
  }

  function readSession() {
    for (const storage of availableStorages()) {
      try {
        const restored = JSON.parse(storage.getItem(storageKey) || '{}');
        if (Object.keys(restored).length) return restored;
      } catch {
        // Bộ nhớ trình duyệt có thể bị chặn; tiếp tục với nguồn còn lại.
      }
    }
    return {};
  }

  function saveSession() {
    const serialized = JSON.stringify({
      studentRef: state.studentRef,
      studentName: state.studentName,
      studentIdentitySource: state.studentIdentitySource,
      clientSubmissionId: state.clientSubmissionId,
      clientSubmissionStudentRef: state.clientSubmissionStudentRef,
      examSessionToken: state.examSessionToken,
      attemptToken: state.attemptToken,
      listeningDeadlineAt: state.listeningDeadlineAt,
      readingDeadlineAt: state.readingDeadlineAt,
      writingDeadlineAt: state.writingDeadlineAt,
      serverTimeOffsetMs: state.serverTimeOffsetMs,
      audioVolume: state.audioVolume,
      listeningSubmitted: state.listeningSubmitted,
      completed: state.completed,
      writingStarted: state.writingStarted,
      writingSubmitted: state.writingSubmitted,
      writingDirty: state.writingDirty,
      drafts: state.drafts,
      draftRevisions: state.draftRevisions,
      draftAckRevisions: state.draftAckRevisions,
      writingLayout: state.writingLayout,
      frozenAnswers: state.frozenAnswers
    });
    for (const storage of availableStorages()) {
      try {
        storage.setItem(storageKey, serialized);
      } catch {
        // Bản Writing vẫn được lưu qua API; không làm gián đoạn bài thi nếu bộ nhớ máy đầy.
      }
    }
  }

  function clearAllLocalAttemptData() {
    const uiStorageKey = `izone-test-ui:${testConfig.slug}:${classCode}`;
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

  const progressMarkup = writingConfig
    ? `<div class="progress-step" data-progress="listening">1. Listening</div>
        <div class="progress-step" data-progress="reading">2. Reading</div>
        <div class="progress-step" data-progress="writing">3. Writing</div>
        <div class="progress-step" data-progress="result">4. Kết quả</div>`
    : `<div class="progress-step" data-progress="listening">1. Listening</div>
        <div class="progress-step" data-progress="reading">2. Reading</div>
        <div class="progress-step" data-progress="result">3. Kết quả</div>`;

  const writingMarkup = writingConfig ? `
      <section class="panel transition-card writing-prep-card" id="writingPrepView" hidden>
        <div class="transition-icon">✓</div>
        <p class="eyebrow">Reading đã được ghi nhận</p>
        <h2>Chuẩn bị phần Writing</h2>
        <p>Kết quả Listening và Reading đang được giữ kín. Khi sẵn sàng, hãy bắt đầu Writing và hoàn thành ${writingTaskLabels || 'bài viết'}.</p>
        <ul class="writing-prep-list">
          <li>Tổng thời gian: ${writingMinutes} phút. Còn 10 phút đồng hồ sẽ chuyển đỏ; hết giờ hệ thống tự thu bài và mở kết quả.</li>
          ${writingTasks.map(task => `<li>${task.label}: nên dành khoảng ${task.recommendedMinutes} phút và viết ít nhất ${task.minimumWords} từ.</li>`).join('')}
          <li>Bài viết được tự lưu trên hệ thống; đóng tab rồi mở lại vẫn có thể tiếp tục.</li>
        </ul>
        <button class="button button-primary" id="startWriting" type="button">Bắt đầu Writing</button>
      </section>

      <form class="panel writing-exam-view" id="writingView" hidden>
        <header class="writing-exam-header">
          <div>
            <p class="eyebrow">Phần 3 · Academic Writing</p>
            <h2>${writingTaskLabels || 'Academic Writing'}</h2>
          </div>
          <nav class="writing-task-tabs" id="writingTaskTabs" aria-label="Chọn Writing Task"></nav>
          <button class="button button-primary writing-submit" id="submitWriting" type="submit">Nộp bài Writing</button>
        </header>
        <div class="writing-workspace" id="writingWorkspace"></div>
        <footer class="writing-task-footer">
          <button class="button button-secondary" id="previousWritingTask" type="button">← Previous Task</button>
          <span id="writingTaskPosition">${writingTasks.length === 1 ? (writingTasks[0]?.label || 'Writing') : `Task 1 · 1/${writingTasks.length}`}</span>
          <button class="button button-primary" id="nextWritingTask" type="button">Next Task →</button>
        </footer>
      </form>
  ` : '';

  const listeningSavedMarkup = (writingConfig || deferResultsUntilComplete) ? `
      <section class="panel transition-card" id="listeningSavedView" hidden>
        <div class="transition-icon">✓</div>
        <p class="eyebrow">Listening đã được ghi nhận</p>
        <h2>Chuẩn bị phần Reading</h2>
        <p>Kết quả Listening đang được giữ kín. Điểm và phân tích chỉ mở sau khi bạn hoàn thành ${writingConfig ? 'Reading và nộp Writing' : 'Reading'}.</p>
        <div class="form-actions transition-actions">
          <button class="button button-primary" id="startReading" type="button">Bắt đầu bài Reading</button>
        </div>
      </section>
  ` : `
      <section class="panel transition-card" id="listeningSavedView" hidden>
        <div class="transition-icon">✓</div>
        <p class="eyebrow">Đã chấm bài Listening</p>
        <h2>Điểm Listening đã được ghi độc lập</h2>
        <p>Reading chưa cần nộp ngay. Bạn có thể xem đầy đủ điểm và phân tích Listening, hoặc tiếp tục làm Reading.</p>
        <div class="form-actions transition-actions">
          <button class="button button-secondary" id="viewListeningResult" type="button">Xem kết quả Listening</button>
          <button class="button button-primary" id="startReading" type="button">Bắt đầu bài Reading</button>
        </div>
      </section>
  `;

  root.innerHTML = `
    <header class="topbar">
      <p class="eyebrow">IZONE · IELTS 6–7</p>
      <h1>${testConfig.title}</h1>
      <p>${testConfig.intro || 'Nhập đáp án từ answer sheet giấy. Listening được lưu trước, sau đó hệ thống mở Reading và chấm toàn bộ khi hoàn tất.'}</p>
    </header>
    <main class="page-shell">
      <div class="progress" aria-label="Tiến độ bài test">
        ${progressMarkup}
      </div>
      <div class="notice" id="notice" role="status">Đang tải danh sách lớp...</div>

      <section class="panel loading-card" id="loadingView">
        <div class="spinner" aria-hidden="true"></div>
        <strong>Đang chuẩn bị answer sheet...</strong>
      </section>

      <section class="panel identity-panel" id="identityView" hidden>
        <div class="identity-copy">
          <p class="eyebrow">Thông tin học viên</p>
          <h2 id="identityTitle">Chọn họ và tên</h2>
          <p id="classLabel"></p>
        </div>
        <label>
          Họ và tên
          <select id="studentSelect" required>
            <option value="">Nhấn để chọn</option>
          </select>
        </label>
        ${testConfig.allowTemporaryStudents ? `
          <form class="temporary-student-form" id="temporaryStudentForm" hidden>
            <p>Chỉ dùng mục này khi tên của bạn chưa có trong danh sách. Nhập đúng mã tạm giáo viên đã cấp.</p>
            <label>Họ và tên đầy đủ
              <input id="temporaryStudentName" type="text" minlength="2" maxlength="80" autocomplete="name" required>
            </label>
            <label>Mã tạm
              <input id="temporaryStudentCode" type="text" minlength="2" maxlength="16" pattern="[A-Za-z0-9_\\-]{2,16}" autocomplete="off" autocapitalize="characters" required>
            </label>
            <button class="button button-secondary" id="registerTemporaryStudent" type="submit">Xác nhận và làm bài</button>
          </form>` : ''}
        ${classCode === 'CODEXDEMO806'
          ? '<button class="button cbt-demo-reset" id="resetDemoData" type="button" disabled>Reset dữ liệu học viên</button>'
          : ''}
      </section>

      <form class="panel test-panel" id="listeningView" hidden>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Phần 1</p>
            <h2 id="listeningTitle"></h2>
            <ul class="instructions" id="listeningInstructions"></ul>
          </div>
          <div class="answer-save-meta">
            <span class="answer-count" id="listeningCount">0/${testConfig.listening.controls.length} đã nhập</span>
            <span class="autosave-status" id="listeningSaveStatus" role="status">Đã lưu trên máy</span>
          </div>
        </div>
        <div class="questions-grid" id="listeningQuestions"></div>
        <div class="form-actions">
          <button class="button button-primary" id="submitListening" type="submit">Nộp bài Listening</button>
        </div>
      </form>

      ${listeningSavedMarkup}

      <form class="panel test-panel" id="readingView" hidden>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Phần 2 · <span id="readingStudentName"></span></p>
            <h2 id="readingTitle"></h2>
            <ul class="instructions" id="readingInstructions"></ul>
          </div>
          <div class="answer-save-meta">
            <span class="answer-count" id="readingCount">0/${testConfig.reading.controls.length} đã nhập</span>
            <span class="autosave-status" id="readingSaveStatus" role="status">Đã lưu trên máy</span>
          </div>
        </div>
        <div class="questions-grid" id="readingQuestions"></div>
        <div class="form-actions">
          <button class="button button-primary" id="submitReading" type="submit">Nộp bài Reading</button>
        </div>
      </form>

      ${writingMarkup}

      <section class="panel transition-card" id="resultReadyView" hidden>
        <div class="transition-icon">✓</div>
        <p class="eyebrow">${writingConfig ? 'Đã nộp Writing' : 'Đã chấm xong'}</p>
        <h2>Kết quả của bạn đã sẵn sàng</h2>
        <p>${writingConfig
          ? `Listening và Reading đã được chấm, phân tích. Writing đang được chấm riêng và sẽ hiện điểm khi hoàn tất chấm ${writingTaskLabels || 'bài Writing'}.`
          : 'Cả Listening và Reading đã được lưu, chấm và phân tích theo từng dạng bài.'}</p>
        <button class="button button-primary" id="viewResult" type="button">Xem kết quả</button>
      </section>

      <section class="panel result-panel" id="resultView" hidden>
        <div class="result-heading">
          <div>
            <p class="eyebrow">Kết quả cá nhân</p>
            <h2 id="resultStudentName"></h2>
            <p id="resultMeta"></p>
          </div>
        </div>
        <div class="summary-grid" id="summaryGrid"></div>
        <p class="result-status" id="resultStatus"></p>
        <div class="form-actions result-actions">
          <button class="button button-primary" id="continueReadingFromResult" type="button" hidden>Tiếp tục làm Reading</button>
          <button class="button button-secondary" id="viewFullAttempt" type="button" hidden>Xem lại toàn bộ bài làm</button>
        </div>
        <div id="writingSubmissionResult" hidden></div>
        <div id="questionDetails"></div>
        <div class="skill-performance-list" id="skillPerformanceSections"></div>
      </section>
    </main>
  `;

  const elements = Object.fromEntries([
    'notice', 'loadingView', 'identityView', 'identityTitle', 'classLabel', 'studentSelect', 'resetDemoData',
    'temporaryStudentForm', 'temporaryStudentName', 'temporaryStudentCode', 'registerTemporaryStudent',
    'listeningView', 'listeningTitle', 'listeningInstructions', 'listeningQuestions', 'listeningCount', 'listeningSaveStatus', 'submitListening',
    'listeningSavedView', 'viewListeningResult', 'startReading', 'readingView', 'readingTitle', 'readingInstructions',
    'readingQuestions', 'readingCount', 'readingSaveStatus', 'readingStudentName', 'submitReading', 'resultReadyView',
    'viewResult', 'resultView', 'resultStudentName', 'resultMeta', 'summaryGrid',
    'skillPerformanceSections', 'questionDetails', 'resultStatus', 'continueReadingFromResult',
    'viewFullAttempt',
    'writingPrepView', 'startWriting', 'writingView', 'writingTaskTabs', 'writingWorkspace', 'submitWriting',
    'previousWritingTask', 'nextWritingTask', 'writingTaskPosition', 'writingSubmissionResult'
  ].map(id => [id, document.getElementById(id)]));

  // Bộ nhớ dùng chung chỉ là gợi ý chọn tên cho hai lớp Writing đã mở thử.
  // Nó không chứa tên, lớp, mã lượt làm hay dữ liệu bài thi, và không tự mở lượt làm.
  const rememberedClassCodes = new Set(['CS.070626', 'CS.160826']);
  const studentMemory = {
    api: null,
    storage: null,
    key: '',
    checkbox: null,
    status: null,
    confirm: null,
    change: null,
    candidateRef: '',
    preferred: true
  };
  let identitySelectionBusy = false;
  let identityControlsBefore = [];

  function studentMemoryEnabled() {
    return rememberedClassCodes.has(classCode) && Boolean(studentMemory.api && studentMemory.storage && studentMemory.key);
  }

  function hasBoundAttempt() {
    const hasDraft = value => value && typeof value === 'object'
      && Object.values(value).some(item => String(item || '').trim());
    return Boolean(
      state.attemptToken
      || state.examSessionToken
      || state.listeningDeadlineAt
      || state.listeningSubmitted
      || state.readingDeadlineAt
      || state.writingStarted
      || state.writingSubmitted
      || state.completed
      || hasDraft(state.drafts?.listening)
      || hasDraft(state.drafts?.reading)
      || Object.values(state.drafts?.writing || {}).some(item => String(item || '').trim())
    );
  }

  function setIdentityControlsBusy(busy) {
    const controls = [
      elements.studentSelect,
      studentMemory.checkbox,
      studentMemory.confirm,
      studentMemory.change,
      elements.registerTemporaryStudent,
      elements.temporaryStudentName,
      elements.temporaryStudentCode
    ].filter(Boolean);
    if (busy) {
      identityControlsBefore = controls.map(control => [control, control.disabled]);
      for (const [control] of identityControlsBefore) control.disabled = true;
      return;
    }
    for (const [control, disabled] of identityControlsBefore) control.disabled = disabled;
    identityControlsBefore = [];
  }

  function rememberedOfficialStudent(student) {
    return Boolean(studentMemory.api?.officialStudent({ ...student, studentRef: student?.ref }));
  }

  function setStudentMemoryStatus(message = '') {
    if (studentMemory.status) studentMemory.status.textContent = message;
  }

  function refreshRememberedStudent() {
    if (!studentMemoryEnabled()) return;
    if (state.studentIdentitySource === 'temporary' && state.studentRef) {
      forgetForTemporaryStudent();
      return;
    }
    const remembered = studentMemory.api.readMemory(studentMemory.storage, studentMemory.key);
    const matches = state.roster.filter(student => rememberedOfficialStudent(student) && student.ref === remembered.studentRef);
    const candidate = matches.length === 1 ? matches[0] : null;
    const unboundSetup = !hasBoundAttempt();
    if (unboundSetup) {
      // Selection cached before any attempt is only a convenience, never an identity lock.
      // A newer shared-memory value must be confirmed again before it can target an attempt.
      state.studentRef = '';
      state.studentName = '';
      state.studentIdentitySource = '';
      elements.studentSelect.value = '';
      saveSession();
    }
    studentMemory.candidateRef = candidate?.ref || '';
    studentMemory.confirm.hidden = !candidate || !unboundSetup;
    if (candidate && unboundSetup) {
      // Gán trực tiếp để không phát event change, không resume attempt và không tạo phiên.
      elements.studentSelect.value = candidate.ref;
      setStudentMemoryStatus('Đã chọn sẵn tên của bạn. Hãy xác nhận trước khi tiếp tục.');
    } else if (remembered.studentRef) {
      setStudentMemoryStatus('Không tìm thấy đúng một hồ sơ chính thức trong lớp này. Hãy chọn lại tên.');
    } else if (remembered.status === 'unavailable') {
      setStudentMemoryStatus('Trình duyệt chưa đọc được ghi nhớ. Bạn vẫn có thể chọn tên và làm bài.');
    } else {
      setStudentMemoryStatus('Chỉ ghi nhớ trên thiết bị cá nhân. Bạn vẫn cần xác nhận trước khi làm bài.');
    }
  }

  function rememberConfirmedStudent(student) {
    if (!studentMemoryEnabled() || !rememberedOfficialStudent(student)) return;
    const saved = studentMemory.api.writeMemory(
      studentMemory.storage,
      studentMemory.key,
      studentMemory.preferred ? student.ref : ''
    );
    if (!saved) setStudentMemoryStatus('Đã xác nhận tên, nhưng trình duyệt chưa lưu được lựa chọn.');
  }

  function forgetForTemporaryStudent() {
    if (!studentMemoryEnabled()) return;
    studentMemory.api.writeMemory(studentMemory.storage, studentMemory.key, '');
    studentMemory.candidateRef = '';
    studentMemory.checkbox.checked = false;
    studentMemory.checkbox.disabled = true;
    studentMemory.confirm.hidden = true;
    setStudentMemoryStatus('Hồ sơ tạm không được ghi nhớ; hãy dùng mã tạm giáo viên đã cấp.');
  }

  function clearSetupIdentity() {
    if (hasBoundAttempt() || identitySelectionBusy) {
      showNotice('Bài đang gắn với danh tính hiện tại; không thể đổi người học lúc này.', 'error');
      return;
    }
    if (!studentMemory.api.writeMemory(studentMemory.storage, studentMemory.key, '')) {
      setStudentMemoryStatus('Không thể xóa ghi nhớ trong trình duyệt.');
      return;
    }
    state.studentRef = '';
    state.studentName = '';
    state.studentIdentitySource = '';
    elements.studentSelect.value = '';
    if (elements.temporaryStudentForm) elements.temporaryStudentForm.hidden = true;
    if (elements.temporaryStudentName) elements.temporaryStudentName.value = '';
    if (elements.temporaryStudentCode) elements.temporaryStudentCode.value = '';
    if (elements.resetDemoData) elements.resetDemoData.disabled = true;
    studentMemory.candidateRef = '';
    studentMemory.confirm.hidden = true;
    saveSession();
    setStudentMemoryStatus('Đã quên lựa chọn. Hãy chọn đúng tên trước khi tiếp tục.');
    elements.studentSelect.focus();
  }

  async function initializeStudentMemory() {
    if (!rememberedClassCodes.has(classCode)) return;
    try {
      const api = await import('../../shared/student-memory.js?v=20260905-memory-v2');
      const storage = window.localStorage;
      const selectLabel = elements.studentSelect.closest('label');
      if (!selectLabel) return;
      const label = document.createElement('label');
      label.className = 'checkbox-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'remember-student';
      checkbox.checked = true;
      checkbox.addEventListener('change', () => { studentMemory.preferred = checkbox.checked; });
      label.append(checkbox, document.createTextNode(' Ghi nhớ tôi trên thiết bị này'));
      const status = document.createElement('p');
      status.id = 'remember-student-status';
      status.className = 'muted';
      status.setAttribute('role', 'status');
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.id = 'confirm-remembered-student';
      confirm.className = 'button button-primary';
      confirm.textContent = 'Xác nhận và tiếp tục';
      confirm.hidden = true;
      const change = document.createElement('button');
      change.type = 'button';
      change.id = 'change-remembered-student';
      change.className = 'button button-secondary';
      change.textContent = 'Đổi người học';
      selectLabel.after(label, status, confirm, change);
      studentMemory.api = api;
      studentMemory.storage = storage;
      studentMemory.key = api.memoryKey(appConfig.API_BASE_URL, location.href);
      studentMemory.checkbox = checkbox;
      studentMemory.status = status;
      studentMemory.confirm = confirm;
      studentMemory.change = change;
      confirm.addEventListener('click', () => {
        if (!studentMemory.candidateRef || elements.studentSelect.value !== studentMemory.candidateRef) return;
        void selectStudentIdentity({ requireConfirmation: true });
      });
      change.addEventListener('click', clearSetupIdentity);
      window.addEventListener('storage', event => {
        if (event.storageArea !== studentMemory.storage) return;
        // key null nghĩa là tab khác đã clear toàn bộ localStorage; phải bỏ prefill cũ.
        if (event.key !== null && event.key !== studentMemory.key) return;
        if (hasBoundAttempt()) {
          showNotice('Lựa chọn ghi nhớ đã đổi ở tab khác. Bài hiện tại vẫn giữ đúng danh tính.', 'success');
          return;
        }
        if (!identitySelectionBusy) refreshRememberedStudent();
      });
    } catch {
      // Không có module hoặc trình duyệt chặn localStorage: giữ nguyên luồng chọn tay.
    }
  }

  const progressSteps = [...document.querySelectorAll('[data-progress]')];
  const views = [
    elements.loadingView,
    elements.identityView,
    elements.listeningView,
    elements.listeningSavedView,
    elements.readingView,
    elements.writingPrepView,
    elements.writingView,
    elements.resultReadyView,
    elements.resultView
  ].filter(Boolean);

  function showNotice(message, kind = '') {
    elements.notice.hidden = false;
    elements.notice.textContent = message;
    elements.notice.className = `notice${kind ? ` ${kind}` : ''}`;
  }

  function hideNotice() {
    elements.notice.hidden = true;
    elements.notice.textContent = '';
    elements.notice.className = 'notice';
  }

  function resultsUnlocked() {
    if (writingConfig) return Boolean(state.writingSubmitted);
    return !deferResultsUntilComplete || Boolean(state.completed);
  }

  function stageBeforeResults() {
    if (state.completed) return state.writingStarted ? 'writing' : 'writing-prep';
    if (state.attemptToken) return state.readingDeadlineAt ? 'reading' : 'listening-saved';
    return 'listening';
  }

  function setStage(stage) {
    if (!resultsUnlocked() && (stage === 'result-ready' || stage === 'result')) {
      stage = stageBeforeResults();
    }
    state.stage = stage;
    if (stage !== 'result') stopWritingGradingPolling();
    for (const view of views) view.hidden = true;
    // Khi học viên đang làm Listening, luôn hiện bộ chọn tên để họ xác nhận
    // đúng danh tính trước khi nộp. Ở giao diện thi đầy đủ, tiếp tục hiện tên
    // đã xác nhận ở các bước sau như hành vi hiện có.
    const showIdentity = stage === 'listening'
      || (document.body.classList.contains('cbt-mode')
        && Boolean(state.studentRef)
        && stage !== 'loading');
    if (showIdentity) elements.identityView.hidden = false;
    const activeProgress = stage === 'listening' || stage === 'listening-saved'
      ? 'listening'
      : stage === 'reading' ? 'reading'
        : stage === 'writing-prep' || stage === 'writing' ? 'writing'
          : stage === 'result-ready' || stage === 'result' ? 'result' : '';
    const order = writingConfig ? ['listening', 'reading', 'writing', 'result'] : ['listening', 'reading', 'result'];
    const activeIndex = order.indexOf(activeProgress);
    for (const step of progressSteps) {
      const index = order.indexOf(step.dataset.progress);
      step.classList.toggle('active', index === activeIndex);
      const completed = step.dataset.progress === 'listening'
        ? Boolean(state.attemptToken || state.result?.result?.listening)
        : step.dataset.progress === 'reading'
          ? Boolean(state.completed || state.result?.result?.reading)
          : step.dataset.progress === 'writing'
            ? Boolean(state.writingSubmitted)
            : false;
      step.classList.toggle('done', step.dataset.progress !== activeProgress && completed);
    }

    if (stage === 'loading') elements.loadingView.hidden = false;
    if (stage === 'listening') {
      elements.listeningView.hidden = false;
    }
    if (stage === 'listening-saved') elements.listeningSavedView.hidden = false;
    if (stage === 'reading') elements.readingView.hidden = false;
    if (stage === 'writing-prep' && elements.writingPrepView) elements.writingPrepView.hidden = false;
    if (stage === 'writing' && elements.writingView) elements.writingView.hidden = false;
    if (stage === 'result-ready') elements.resultReadyView.hidden = false;
    if (stage === 'result') elements.resultView.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function appendInstructions(list, instructions) {
    list.replaceChildren(...instructions.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
  }

  function renderQuestionControls(section, container, skill) {
    container.style.setProperty('--question-rows', String(Math.ceil(section.controls.length / 2)));
    const controls = section.controls.map(control => {
      const wrapper = document.createElement('label');
      wrapper.className = 'question';
      const number = document.createElement('span');
      number.className = 'question-number';
      number.textContent = `Câu ${control.number}`;
      let field;
      if (control.kind === 'select') {
        field = document.createElement('select');
        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = 'Nhấn để chọn';
        field.append(blank, ...control.options.map(value => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          return option;
        }));
      } else {
        field = document.createElement('input');
        field.type = 'text';
        field.autocomplete = 'off';
        field.maxLength = 120;
        field.placeholder = 'Câu trả lời của bạn';
      }
      field.name = `question-${control.number}`;
      field.dataset.number = String(control.number);
      field.value = state.drafts?.[skill]?.[String(control.number)] || '';
      field.addEventListener('input', () => {
        state.drafts[skill][String(control.number)] = field.value;
        state.draftRevisions[skill] = Math.max(
          Number(state.draftRevisions[skill]) || 0,
          Number(state.draftAckRevisions[skill]) || 0
        ) + 1;
        saveSession();
        updateAnswerCount(skill);
        const hasServerDraft = skill === 'listening' ? state.examSessionToken : state.attemptToken;
        setSectionSaveStatus(
          skill,
          hasServerDraft ? 'Chưa lưu thay đổi mới' : 'Đã lưu trên máy',
          hasServerDraft ? 'pending' : 'saved'
        );
        scheduleSectionDraft(skill);
      });
      wrapper.append(number, field);
      return wrapper;
    });
    container.replaceChildren(...controls);
  }

  function collectAnswers(container) {
    return Object.fromEntries([...container.querySelectorAll('[data-number]')].map(field => [
      field.dataset.number,
      field.value.trim()
    ]));
  }

  function updateAnswerCount(skill) {
    const container = skill === 'listening' ? elements.listeningQuestions : elements.readingQuestions;
    const counter = skill === 'listening' ? elements.listeningCount : elements.readingCount;
    const answered = Object.values(collectAnswers(container)).filter(Boolean).length;
    const total = skill === 'listening' ? testConfig.listening.controls.length : testConfig.reading.controls.length;
    counter.textContent = `${answered}/${total} đã nhập`;
    return answered;
  }

  async function apiRequest(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`${appConfig.API_BASE_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: { ...(options.headers || {}) }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const requestError = new Error(data.message || `Lỗi HTTP ${response.status}`);
        requestError.code = String(data.error || 'HTTP_ERROR');
        requestError.status = response.status;
        throw requestError;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Máy chủ phản hồi quá chậm. Vui lòng thử lại.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function classConfirmationLabel() {
    const readableName = String(state.className || classCode).trim();
    return readableName.toUpperCase().includes(classCode)
      ? readableName
      : `${readableName} (${classCode})`;
  }

  function confirmStudentIdentity(student) {
    // Dữ liệu vào: hồ sơ vừa được chọn và lớp đã tải từ máy chủ.
    // Việc chính: mở popup để học viên kiểm tra lại họ tên và lớp trước khi lưu hoặc gọi API.
    // Kết quả: chỉ trả true khi học viên bấm “Xác nhận, tiếp tục”.
    // Khi lỗi lựa chọn: Back hoặc Escape trả false; màn hình trở về tên trước và không đổi lượt thi.
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'cbt-identity-confirmation-dialog';
      dialog.setAttribute('aria-labelledby', 'answerSheetIdentityConfirmationTitle');
      dialog.setAttribute('aria-describedby', 'answerSheetIdentityConfirmationIntro');

      const card = document.createElement('section');
      card.className = 'cbt-identity-confirmation-card';

      const eyebrow = document.createElement('span');
      eyebrow.className = 'cbt-identity-confirmation-eyebrow';
      eyebrow.textContent = 'Kiểm tra trước khi vào bài';

      const title = document.createElement('h2');
      title.id = 'answerSheetIdentityConfirmationTitle';
      title.textContent = 'Xác nhận thông tin học viên';

      const intro = document.createElement('p');
      intro.id = 'answerSheetIdentityConfirmationIntro';
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

  function countAnswered(answers) {
    return Object.values(answers || {}).filter(value => String(value || '').trim()).length;
  }

  function sendClientEvent(event, section, details = {}) {
    const token = section === 'listening'
      ? { examSessionToken: state.examSessionToken }
      : { attemptToken: state.attemptToken };
    if (!Object.values(token)[0]) return;
    const payload = {
      ...token,
      event,
      section,
      build: clientBuild,
      online: navigator.onLine,
      occurredAt: new Date().toISOString(),
      ...details
    };
    fetch(`${appConfig.API_BASE_URL}/api/term-tests/${testConfig.slug}/client-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {
      // Telemetry không được làm gián đoạn bài thi khi mạng lỗi.
    });
  }

  function setSectionSaveStatus(skill, message, status = '') {
    const element = skill === 'listening' ? elements.listeningSaveStatus : elements.readingSaveStatus;
    if (!element) return;
    element.textContent = message;
    element.dataset.status = status;
  }

  function applySectionDraft(skill, answers, revision = 0, force = false) {
    const normalizedRevision = Number(revision) || 0;
    const localRevision = Number(state.draftRevisions[skill]) || 0;
    const localHasAnswers = Object.values(state.drafts[skill] || {}).some(Boolean);
    if (!force && localHasAnswers && localRevision > normalizedRevision) return false;
    state.drafts[skill] = { ...(answers || {}) };
    state.draftRevisions[skill] = Math.max(localRevision, normalizedRevision);
    state.draftAckRevisions[skill] = Math.max(Number(state.draftAckRevisions[skill]) || 0, normalizedRevision);
    const container = skill === 'listening' ? elements.listeningQuestions : elements.readingQuestions;
    for (const field of container.querySelectorAll('[data-number]')) {
      field.value = state.drafts[skill][field.dataset.number] || '';
      field.dispatchEvent(new Event('term-test:draft-restored', { bubbles: true }));
    }
    updateAnswerCount(skill);
    setSectionSaveStatus(skill, 'Đã khôi phục bản lưu trên hệ thống', 'saved');
    saveSession();
    return true;
  }

  const sectionDraftFlows = {
    listening: { timer: 0, retryTimer: 0, promise: Promise.resolve() },
    reading: { timer: 0, retryTimer: 0, promise: Promise.resolve() }
  };

  async function saveSectionDraftSnapshot(skill, answers, revision) {
    if (demoMode) return null;
    const path = skill === 'listening'
      ? `/api/term-tests/${testConfig.slug}/listening/draft`
      : `/api/term-tests/${testConfig.slug}/reading/draft`;
    const token = skill === 'listening'
      ? { examSessionToken: state.examSessionToken }
      : { attemptToken: state.attemptToken };
    if (!Object.values(token)[0]) return null;
    const response = await apiRequest(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...token, answers, revision })
    });
    if (response.deadlineAt) {
      if (skill === 'listening') state.listeningDeadlineAt = response.deadlineAt;
      else state.readingDeadlineAt = response.deadlineAt;
    }
    if (response.serverNow) state.serverTimeOffsetMs = Date.parse(response.serverNow) - Date.now();
    return response;
  }

  function queueSectionDraft(skill) {
    if (demoMode) return Promise.resolve(null);
    const flow = sectionDraftFlows[skill];
    const revision = Number(state.draftRevisions[skill]) || 0;
    const answers = { ...(state.drafts[skill] || {}) };
    const operation = flow.promise.catch(() => undefined).then(async () => {
      setSectionSaveStatus(skill, 'Đang lưu trên hệ thống...', 'saving');
      const response = await saveSectionDraftSnapshot(skill, answers, revision);
      const acknowledgedRevision = Number(response?.revision) || revision;
      if (response?.accepted === false) {
        if ((Number(state.draftRevisions[skill]) || 0) <= acknowledgedRevision) {
          applySectionDraft(skill, response.draft, acknowledgedRevision, true);
          setSectionSaveStatus(skill, 'Đã dùng bản mới hơn trên hệ thống', 'saved');
        } else {
          state.draftAckRevisions[skill] = Math.max(Number(state.draftAckRevisions[skill]) || 0, acknowledgedRevision);
          scheduleSectionDraft(skill, 0);
        }
        return response;
      }
      state.draftAckRevisions[skill] = Math.max(Number(state.draftAckRevisions[skill]) || 0, acknowledgedRevision);
      saveSession();
      if ((Number(state.draftRevisions[skill]) || 0) > state.draftAckRevisions[skill]) {
        scheduleSectionDraft(skill, 0);
      } else {
        setSectionSaveStatus(skill, 'Đã lưu trên hệ thống', 'saved');
      }
      return response;
    });
    flow.promise = operation.catch(error => {
      if (error.code === 'LISTENING_LOCKED' || error.code === 'READING_LOCKED') {
        setSectionSaveStatus(skill, 'Đã khóa khi hết giờ', 'locked');
        return null;
      }
      setSectionSaveStatus(skill, 'Chưa lưu được · sẽ tự thử lại', 'error');
      sendClientEvent('draft_retry_scheduled', skill, {
        revision,
        answeredCount: countAnswered(answers)
      });
      window.clearTimeout(flow.retryTimer);
      flow.retryTimer = window.setTimeout(() => scheduleSectionDraft(skill, 0), 5000);
      return null;
    });
    return flow.promise;
  }

  function scheduleSectionDraft(skill, delay = 600) {
    if (demoMode || (skill === 'listening' && !state.examSessionToken) || (skill === 'reading' && !state.attemptToken)) return;
    const flow = sectionDraftFlows[skill];
    window.clearTimeout(flow.timer);
    window.clearTimeout(flow.retryTimer);
    flow.timer = window.setTimeout(() => queueSectionDraft(skill), delay);
  }

  function stopSectionDraftFlow(skill) {
    const flow = sectionDraftFlows[skill];
    window.clearTimeout(flow.timer);
    window.clearTimeout(flow.retryTimer);
  }

  function setAnswerControlsLocked(skill, locked) {
    const form = skill === 'listening' ? elements.listeningView : elements.readingView;
    if (!form) return;
    for (const control of form.querySelectorAll('input, select, textarea')) {
      control.disabled = locked;
    }
    form.classList.toggle('is-answer-locked', locked);
  }

  function isSectionExpired(skill) {
    const deadlineValue = skill === 'listening' ? state.listeningDeadlineAt : state.readingDeadlineAt;
    const deadline = Date.parse(deadlineValue || '');
    return Number.isFinite(deadline) && Date.now() + (Number(state.serverTimeOffsetMs) || 0) >= deadline;
  }

  const sectionDeadlineGuards = {
    listening: { interval: 0, lastSubmitAttempt: 0, reportedDeadline: false },
    reading: { interval: 0, lastSubmitAttempt: 0, reportedDeadline: false }
  };

  function stopSectionDeadlineGuard(skill) {
    const guard = sectionDeadlineGuards[skill];
    if (guard.interval) window.clearInterval(guard.interval);
    guard.interval = 0;
  }

  // Dữ liệu vào: deadline do server cấp, token của đúng lượt thi và snapshot đang nằm trên máy.
  // Việc chính: khóa đáp án đúng lúc hết giờ rồi gọi lại request nộp mỗi 15 giây nếu mạng lỗi.
  // Kết quả: answer sheet và computer-based dùng chung một cơ chế tự nộp, không phụ thuộc lớp giao diện.
  // Khi lỗi: snapshot đã khóa vẫn nằm trong localStorage và retry tiếp tục cho tới khi server xác nhận.
  function startSectionDeadlineGuard(skill) {
    const guard = sectionDeadlineGuards[skill];
    const form = skill === 'listening' ? elements.listeningView : elements.readingView;
    const submitButton = skill === 'listening' ? elements.submitListening : elements.submitReading;
    const deadlineValue = skill === 'listening' ? state.listeningDeadlineAt : state.readingDeadlineAt;
    const token = skill === 'listening' ? state.examSessionToken : state.attemptToken;
    if (!form || !submitButton || !token || !Number.isFinite(Date.parse(deadlineValue || ''))) return;
    if (guard.interval) return;
    sendClientEvent('deadline_guard_started', skill, {
      revision: Number(state.draftRevisions[skill]) || 0,
      answeredCount: countAnswered(state.drafts[skill])
    });
    const tick = () => {
      if (form.hidden || form.dataset[`${skill}Submitting`] === 'true') return;
      if ((skill === 'reading' && state.completed) || (skill === 'listening' && state.listeningSubmitted)) {
        stopSectionDeadlineGuard(skill);
        return;
      }
      if (!isSectionExpired(skill)) return;
      form.dataset[`${skill}TimeExpired`] = 'true';
      if (!state.frozenAnswers[skill]) {
        const container = skill === 'listening' ? elements.listeningQuestions : elements.readingQuestions;
        state.frozenAnswers[skill] = Object.freeze({ ...collectAnswers(container) });
        state.drafts[skill] = { ...state.frozenAnswers[skill] };
        saveSession();
      }
      setAnswerControlsLocked(skill, true);
      stopSectionDraftFlow(skill);
      if (!guard.reportedDeadline) {
        guard.reportedDeadline = true;
        sendClientEvent('deadline_reached', skill, {
          revision: Number(state.draftRevisions[skill]) || 0,
          answeredCount: countAnswered(state.frozenAnswers[skill])
        });
      }
      const now = Date.now();
      if (now - guard.lastSubmitAttempt < 15_000) return;
      guard.lastSubmitAttempt = now;
      form.requestSubmit(submitButton);
    };
    tick();
    guard.interval = window.setInterval(tick, 1000);
  }

  window.TERM_TEST_DEADLINE_GUARD_ACTIVE = true;

  let writingSaveTimer = 0;
  let writingRetryTimer = 0;
  let writingSavePromise = Promise.resolve();
  let writingRevision = 0;
  let writingGradingPollTimer = 0;
  let writingGradingPollStartedAt = 0;
  let writingGradingPollCount = 0;
  let writingGradingPollInFlight = false;

  function stopWritingGradingPolling() {
    window.clearTimeout(writingGradingPollTimer);
    writingGradingPollTimer = 0;
    writingGradingPollStartedAt = 0;
    writingGradingPollCount = 0;
  }

  async function refreshWritingGrading() {
    if (demoMode || !state.attemptToken || writingGradingPollInFlight) return;
    writingGradingPollInFlight = true;
    try {
      const wasReady = Boolean(state.result?.writing?.grading?.ready);
      const payload = await apiRequest('/api/term-tests/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptToken: state.attemptToken })
      });
      applyWritingFromServer(payload.writing, Boolean(payload.writing?.submitted));
      renderResult(payload);
      if (payload.writing?.grading?.ready) {
        stopWritingGradingPolling();
        if (!wasReady) showNotice('Bài Writing đã được chấm xong. Điểm và phân tích chi tiết đã hiển thị bên dưới.', 'success');
      }
    } catch {
      // Việc chấm vẫn nằm trên máy chủ; lần kế tiếp tiếp tục kiểm tra mà không làm mất màn hình kết quả.
    } finally {
      writingGradingPollInFlight = false;
      if (!state.result?.writing?.grading?.ready) scheduleWritingGradingRefresh();
    }
  }

  function scheduleWritingGradingRefresh() {
    const grading = state.result?.writing?.grading;
    if (
      demoMode
      || !state.writingSubmitted
      || grading?.ready
      || grading?.status === 'review_required'
      || writingGradingPollTimer
    ) return;
    if (!writingGradingPollStartedAt) writingGradingPollStartedAt = Date.now();
    if (Date.now() - writingGradingPollStartedAt > 45 * 60 * 1000) return;
    const delay = Math.min(30_000, 8_000 + (writingGradingPollCount * 2_000));
    writingGradingPollCount += 1;
    writingGradingPollTimer = window.setTimeout(() => {
      writingGradingPollTimer = 0;
      refreshWritingGrading();
    }, delay);
  }

  function setWritingSaveStatus(message) {
    for (const label of document.querySelectorAll('.writing-editor-meta > span:first-child')) {
      label.textContent = message;
    }
  }

  function syncWritingEditors() {
    for (const editor of document.querySelectorAll('[data-writing-task]')) {
      const value = state.drafts.writing[editor.dataset.writingTask] || '';
      if (editor.value !== value) editor.value = value;
      const counter = editor.closest('.writing-answer-pane')?.querySelector('.writing-editor-meta strong');
      if (counter) counter.textContent = `${countWords(value)} từ`;
    }
  }

  function applyWritingFromServer(writing, forceDrafts = false) {
    if (!writingConfig || !writing) return;
    const localHasDraft = Boolean(state.drafts.writing.task1 || state.drafts.writing.task2);
    const serverHasDraft = Boolean(
      writing.started || writing.updatedAt || writing.submitted || writing.task1 || writing.task2
    );
    const useServerDraft = forceDrafts
      || writing.submitted
      || (!state.writingDirty && (serverHasDraft || !localHasDraft));
    if (useServerDraft) {
      state.drafts.writing.task1 = String(writing.task1 || '');
      state.drafts.writing.task2 = String(writing.task2 || '');
      state.writingDirty = false;
    } else if (localHasDraft && !serverHasDraft) {
      // Nâng cấp từ bản cũ: giữ bài đang có trên máy rồi đồng bộ lên database ở lần lưu kế tiếp.
      state.writingDirty = true;
    }
    state.writingStarted = Boolean(writing.started || state.writingStarted);
    state.writingSubmitted = Boolean(writing.submitted || state.writingSubmitted);
    state.writingDeadlineAt = writing.deadlineAt || state.writingDeadlineAt;
    if (writing.serverNow) state.serverTimeOffsetMs = Date.parse(writing.serverNow) - Date.now();
    syncWritingEditors();
    saveSession();
  }

  function writingPayload(action) {
    return {
      attemptToken: state.attemptToken,
      action,
      task1: String(state.drafts.writing.task1 || ''),
      task2: String(state.drafts.writing.task2 || '')
    };
  }

  async function saveWritingToServer(action) {
    if (demoMode) return { writing: null };
    if (!state.attemptToken) throw new Error('Chưa có mã lượt làm để lưu Writing.');
    window.clearTimeout(writingSaveTimer);
    window.clearTimeout(writingRetryTimer);
    const revision = writingRevision;
    const payload = writingPayload(action);
    const operation = writingSavePromise.catch(() => undefined).then(() => apiRequest('/api/term-tests/writing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }));
    writingSavePromise = operation;
    const response = await operation;
    if (response.writing?.submitted || revision === writingRevision) {
      state.writingDirty = false;
      applyWritingFromServer(response.writing, true);
    } else {
      state.writingStarted = Boolean(response.writing?.started || state.writingStarted);
      saveSession();
    }
    if (revision < writingRevision && !state.writingSubmitted) scheduleWritingSave(500);
    else setWritingSaveStatus(response.writing?.submitted ? 'Đã nộp và lưu trên hệ thống' : 'Đã lưu trên hệ thống');
    return response;
  }

  function scheduleWritingSave(delay = 900) {
    if (demoMode || !state.writingStarted || state.writingSubmitted) return;
    window.clearTimeout(writingSaveTimer);
    window.clearTimeout(writingRetryTimer);
    setWritingSaveStatus('Đang chờ lưu trên hệ thống...');
    writingSaveTimer = window.setTimeout(() => {
      setWritingSaveStatus('Đang lưu trên hệ thống...');
      saveWritingToServer('draft').catch(() => {
        setWritingSaveStatus('Chưa lưu được · hệ thống sẽ tự thử lại');
        writingRetryTimer = window.setTimeout(() => scheduleWritingSave(0), 5000);
      });
    }, delay);
  }

  async function restoreAttemptFromServer() {
    if (!state.attemptToken) return null;
    const payload = await apiRequest('/api/term-tests/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptToken: state.attemptToken })
    });
    state.studentName = payload.studentName || state.studentName;
    state.className = payload.className || state.className;
    state.completed = Boolean(payload.completed);
    state.examSessionToken = payload.exam?.examSessionToken || state.examSessionToken;
    state.readingDeadlineAt = payload.exam?.readingDeadlineAt || state.readingDeadlineAt;
    if (payload.exam?.serverNow) state.serverTimeOffsetMs = Date.parse(payload.exam.serverNow) - Date.now();
    applyWritingFromServer(payload.writing);
    saveSession();
    return payload;
  }

  async function resumeActiveAttemptForSelectedStudent() {
    if (demoMode || !state.studentRef || state.attemptToken) return false;
    const payload = await apiRequest(`/api/term-tests/${testConfig.slug}/attempt/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classCode, studentRef: state.studentRef })
    });
    if (!payload.active) return false;
    state.attemptToken = payload.attemptToken;
    state.examSessionToken = payload.examSessionToken || state.examSessionToken;
    state.listeningSubmitted = true;
    state.studentName = payload.studentName || state.studentName;
    state.readingDeadlineAt = payload.readingDeadlineAt || '';
    if (payload.serverNow) state.serverTimeOffsetMs = Date.parse(payload.serverNow) - Date.now();
    applySectionDraft('reading', payload.readingDraft, payload.readingDraftRevision, true);
    elements.readingStudentName.textContent = state.studentName;
    saveSession();
    sendClientEvent('attempt_resumed', 'reading', {
      revision: Number(payload.readingDraftRevision) || 0,
      answeredCount: countAnswered(payload.readingDraft)
    });
    if (payload.readingStartedAt) {
      setStage('reading');
      startSectionDeadlineGuard('reading');
      showNotice('Đã nối lại đúng lượt Reading đang dở và khôi phục bản lưu trên hệ thống.', 'success');
    } else {
      setStage('listening-saved');
      showNotice('Đã nối lại lượt đã nộp Listening. Bạn có thể tiếp tục Reading.', 'success');
    }
    return true;
  }

  function renderRosterOptions() {
    const options = [document.createElement('option')];
    options[0].value = '';
    options[0].textContent = 'Nhấn để chọn';
    for (const student of state.roster) {
      const option = document.createElement('option');
      option.value = student.ref;
      option.textContent = student.temporary ? `${student.name} (mã tạm)` : student.name;
      options.push(option);
    }
    if (testConfig.allowTemporaryStudents) {
      const temporaryOption = document.createElement('option');
      temporaryOption.value = '__temporary__';
      temporaryOption.textContent = 'Tên chưa có trong danh sách';
      options.push(temporaryOption);
    }
    elements.studentSelect.replaceChildren(...options);
  }

  function populateRoster(data) {
    state.roster = data.students || [];
    if (testConfig.allowTemporaryStudents
      && state.studentIdentitySource === 'temporary'
      && state.studentRef
      && state.studentName
      && !state.roster.some(student => student.ref === state.studentRef)) {
      state.roster.push({ ref: state.studentRef, name: state.studentName, temporary: true });
    }
    state.className = data.class.name;
    elements.classLabel.textContent = `Lớp ${state.className}`;
    renderRosterOptions();
    if (state.studentRef && state.roster.some(student => student.ref === state.studentRef)) {
      elements.studentSelect.value = state.studentRef;
    } else {
      state.studentRef = '';
      state.studentName = '';
      state.studentIdentitySource = '';
      saveSession();
    }
    if (elements.resetDemoData) elements.resetDemoData.disabled = !elements.studentSelect.value;
    // Chỉ điền dropdown. Không gọi handler change nên không resume/start attempt.
    refreshRememberedStudent();
  }

  function confirmIncomplete(answered, skillLabel) {
    const total = skillLabel === 'Listening' ? testConfig.listening.controls.length : testConfig.reading.controls.length;
    if (answered === total) return true;
    return window.confirm(`${skillLabel} hiện có ${answered}/${total} câu đã nhập. Bạn vẫn muốn nộp bài?`);
  }

  function setBusy(button, busy, busyText, normalText) {
    button.disabled = busy;
    button.textContent = busy ? busyText : normalText;
  }

  function countWords(value) {
    const normalized = String(value || '').trim();
    return normalized ? normalized.split(/\s+/u).length : 0;
  }

  function setupWritingExam() {
    const tasks = Array.from(writingConfig?.tasks || []);
    if (!tasks.length || !elements.writingWorkspace || !elements.writingTaskTabs) return;

    const panels = [];
    const tabs = [];

    function activateTask(index, focusEditor = false) {
      const safeIndex = Math.min(tasks.length - 1, Math.max(0, Number(index) || 0));
      const activeTask = tasks[safeIndex];
      state.writingLayout.activeTask = activeTask.id;
      panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== safeIndex; });
      tabs.forEach((tab, tabIndex) => {
        const active = tabIndex === safeIndex;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-current', active ? 'true' : 'false');
      });
      elements.previousWritingTask.disabled = safeIndex === 0;
      elements.nextWritingTask.disabled = safeIndex === tasks.length - 1;
      elements.writingTaskPosition.textContent = tasks.length === 1
        ? (activeTask.label || 'Writing')
        : `${activeTask.label || `Task ${safeIndex + 1}`} · ${safeIndex + 1}/${tasks.length}`;
      saveSession();
      if (focusEditor) panels[safeIndex].querySelector('textarea')?.focus();
    }

    tasks.forEach((task, index) => {
      const tab = makeWritingTab(task, index);
      const panel = makeWritingPanel(task);
      tab.addEventListener('click', () => activateTask(index, true));
      tabs.push(tab);
      panels.push(panel);
      elements.writingTaskTabs.append(tab);
      elements.writingWorkspace.append(panel);
    });

    function makeWritingTab(task, index) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'writing-task-tab';
      button.textContent = task.label || `Task ${index + 1}`;
      return button;
    }

    function makeWritingPanel(task) {
      const panel = document.createElement('section');
      panel.className = 'writing-task-panel';
      panel.dataset.writingTaskPanel = task.id;

      const split = document.createElement('div');
      split.className = 'writing-split';
      const initialSplit = Number(state.writingLayout.splits[task.id] || task.initialSplit || 50);

      const promptPane = document.createElement('article');
      promptPane.className = 'writing-prompt-pane';
      const promptHeader = document.createElement('header');
      promptHeader.className = 'writing-pane-header';
      const promptLabel = document.createElement('span');
      promptLabel.textContent = task.label;
      const promptTitle = document.createElement('strong');
      promptTitle.textContent = 'Đề bài';
      promptHeader.append(promptLabel, promptTitle);
      const promptBody = document.createElement('div');
      promptBody.className = 'writing-prompt-body';
      const guidance = document.createElement('p');
      guidance.className = 'writing-guidance';
      guidance.textContent = `You should spend about ${task.recommendedMinutes} minutes on this task.`;
      const instruction = document.createElement('p');
      instruction.className = 'writing-instruction';
      instruction.textContent = task.prompt;
      promptBody.append(guidance, instruction);
      if (task.followUp) {
        const followUp = document.createElement('p');
        followUp.className = 'writing-follow-up';
        followUp.textContent = task.followUp;
        promptBody.append(followUp);
      }
      if (task.image) {
        const figure = document.createElement('figure');
        figure.className = 'writing-task-figure';
        const image = document.createElement('img');
        image.src = task.image.src;
        image.alt = task.image.alt;
        figure.append(image);
        promptBody.append(figure);
      }
      const minimum = document.createElement('p');
      minimum.className = 'writing-minimum';
      minimum.textContent = `Write at least ${task.minimumWords} words.`;
      promptBody.append(minimum);
      promptPane.append(promptHeader, promptBody);

      const separator = document.createElement('button');
      separator.type = 'button';
      separator.className = 'writing-separator';
      separator.setAttribute('role', 'separator');
      separator.setAttribute('aria-orientation', 'vertical');
      separator.setAttribute('aria-label', `Kéo để đổi độ rộng đề và bài làm ${task.label}`);
      separator.setAttribute('aria-valuemin', '28');
      separator.setAttribute('aria-valuemax', '70');
      separator.title = 'Kéo ngang để đổi độ rộng hai khung';
      separator.innerHTML = '<span aria-hidden="true">⋮⋮</span>';

      const answerPane = document.createElement('section');
      answerPane.className = 'writing-answer-pane';
      const answerHeader = document.createElement('header');
      answerHeader.className = 'writing-pane-header';
      const answerLabel = document.createElement('span');
      answerLabel.textContent = task.label;
      const answerTitle = document.createElement('strong');
      answerTitle.textContent = 'Bài làm của bạn';
      answerHeader.append(answerLabel, answerTitle);
      const editor = document.createElement('textarea');
      editor.className = 'writing-editor';
      editor.dataset.writingTask = task.id;
      editor.value = state.drafts.writing[task.id] || '';
      editor.spellcheck = false;
      editor.autocomplete = 'off';
      editor.setAttribute('autocapitalize', 'off');
      editor.setAttribute('autocorrect', 'off');
      editor.setAttribute('aria-label', `Bài làm ${task.label}`);
      const editorMeta = document.createElement('footer');
      editorMeta.className = 'writing-editor-meta';
      const autosave = document.createElement('span');
      autosave.textContent = state.writingDirty ? 'Đang chờ lưu trên hệ thống...' : 'Tự lưu trên hệ thống';
      const wordCount = document.createElement('strong');
      wordCount.textContent = `${countWords(editor.value)} từ`;
      editorMeta.append(autosave, wordCount);
      editor.addEventListener('input', () => {
        state.drafts.writing[task.id] = editor.value;
        state.writingDirty = true;
        writingRevision += 1;
        wordCount.textContent = `${countWords(editor.value)} từ`;
        saveSession();
        scheduleWritingSave();
      });
      answerPane.append(answerHeader, editor, editorMeta);
      split.append(promptPane, separator, answerPane);
      panel.append(split);

      function applySplit(value) {
        const percentage = Math.min(70, Math.max(28, Math.round(Number(value) * 10) / 10));
        split.style.setProperty('--writing-left', `${percentage}%`);
        separator.setAttribute('aria-valuenow', String(Math.round(percentage)));
        state.writingLayout.splits[task.id] = percentage;
        saveSession();
      }

      separator.addEventListener('pointerdown', event => {
        separator.setPointerCapture(event.pointerId);
        separator.classList.add('is-dragging');
      });
      separator.addEventListener('pointermove', event => {
        if (!separator.hasPointerCapture(event.pointerId)) return;
        const bounds = split.getBoundingClientRect();
        applySplit((event.clientX - bounds.left) * 100 / bounds.width);
      });
      const stopDragging = event => {
        if (separator.hasPointerCapture(event.pointerId)) separator.releasePointerCapture(event.pointerId);
        separator.classList.remove('is-dragging');
      };
      separator.addEventListener('pointerup', stopDragging);
      separator.addEventListener('pointercancel', stopDragging);
      separator.addEventListener('keydown', event => {
        const current = Number(separator.getAttribute('aria-valuenow')) || initialSplit;
        if (event.key === 'ArrowLeft') applySplit(current - 2);
        else if (event.key === 'ArrowRight') applySplit(current + 2);
        else if (event.key === 'Home') applySplit(28);
        else if (event.key === 'End') applySplit(70);
        else return;
        event.preventDefault();
      });
      applySplit(initialSplit);
      return panel;
    }

    const initialIndex = Math.max(0, tasks.findIndex(task => task.id === state.writingLayout.activeTask));
    activateTask(initialIndex, false);
    elements.previousWritingTask.addEventListener('click', () => {
      const index = tasks.findIndex(task => task.id === state.writingLayout.activeTask);
      activateTask(index - 1, true);
    });
    elements.nextWritingTask.addEventListener('click', () => {
      const index = tasks.findIndex(task => task.id === state.writingLayout.activeTask);
      activateTask(index + 1, true);
    });
  }

  function formatBand(value) {
    const band = Number(value);
    return Number.isFinite(band) ? String(band) : '—';
  }

  function criterionTitle(code, taskNumber) {
    return {
      TA: 'Task Achievement',
      TR: 'Task Response',
      CC: 'Coherence & Cohesion',
      LR: 'Lexical Resource',
      GRA: 'Grammatical Range & Accuracy'
    }[code] || `${taskNumber === 1 ? 'Task 1' : 'Task 2'} · ${code}`;
  }

  function cleanWritingFeedback(value) {
    return String(value || '')
      .replace(/\r/g, '')
      .replace(/^.*\]\(https:\/\/(?:docs|drive)\.google\.com\/[^)]+\).*$/gim, '')
      .replace(/https:\/\/(?:docs|drive)\.google\.com\/\S+/gi, '')
      .replace(/^\s*\(?\s*Xem phân tích chi tiết[^\n]*\)?\s*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function writingReportSummary(value) {
    const cleaned = cleanWritingFeedback(value);
    const markerIndex = cleaned.search(/Nhận xét từng tiêu chí/iu);
    if (markerIndex < 0) return cleaned;
    const separatorIndex = cleaned.lastIndexOf('---', markerIndex);
    const headingIndex = cleaned.lastIndexOf('#', markerIndex);
    const cutIndex = separatorIndex >= 0
      ? separatorIndex
      : headingIndex >= 0
        ? headingIndex
        : markerIndex;
    return cleaned.slice(0, cutIndex).trim();
  }

  function looksLikeWritingHtml(value) {
    return /<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?>/i.test(String(value || ''));
  }

  function appendSanitizedWritingHtml(target, value) {
    const allowedTags = new Set([
      'p', 'div', 'span', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'br',
      'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'
    ]);
    const blockedTags = new Set([
      'script', 'style', 'template', 'iframe', 'object', 'embed', 'svg', 'math',
      'form', 'input', 'button', 'textarea', 'select', 'option', 'link', 'meta'
    ]);
    const parsed = new DOMParser().parseFromString(String(value || ''), 'text/html');

    const cloneSafeNode = node => {
      if (node.nodeType === 3) return document.createTextNode(node.textContent || '');
      if (node.nodeType !== 1) return null;
      const sourceTag = String(node.tagName || '').toLowerCase();
      if (blockedTags.has(sourceTag)) return null;
      const outputTag = /^h[1-6]$/.test(sourceTag)
        ? 'h5'
        : sourceTag === 'b'
          ? 'strong'
          : sourceTag === 'i'
            ? 'em'
            : allowedTags.has(sourceTag)
              ? sourceTag
              : null;
      const output = outputTag ? document.createElement(outputTag) : document.createDocumentFragment();
      for (const child of Array.from(node.childNodes || [])) {
        const safeChild = cloneSafeNode(child);
        if (safeChild) output.append(safeChild);
      }
      return output;
    };

    for (const child of Array.from(parsed.body.childNodes || [])) {
      const safeChild = cloneSafeNode(child);
      if (safeChild) target.append(safeChild);
    }
  }

  function appendSafeWritingFeedback(target, value) {
    const appendInline = (parent, source) => {
      const text = String(source || '');
      const tokenPattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;
      let cursor = 0;
      for (const match of text.matchAll(tokenPattern)) {
        if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
        if (match[1]) {
          const strong = document.createElement('strong');
          strong.textContent = match[1];
          parent.append(strong);
        } else if (match[2]) {
          const emphasis = document.createElement('em');
          emphasis.textContent = match[2];
          parent.append(emphasis);
        } else {
          const link = document.createElement('a');
          link.href = match[4];
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.referrerPolicy = 'no-referrer';
          link.textContent = match[3];
          parent.append(link);
        }
        cursor = match.index + match[0].length;
      }
      if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
    };

    const cleaned = cleanWritingFeedback(value || 'Chưa có nhận xét tổng hợp.');
    if (looksLikeWritingHtml(cleaned)) {
      appendSanitizedWritingHtml(target, cleaned);
      return;
    }

    const normalized = cleaned
      .replace(/[ \t]+(?=#{2,4}\s+\*\*)/g, '\n');
    const lines = normalized.split('\n');
    let index = 0;
    while (index < lines.length) {
      const rawLine = lines[index];
      const line = rawLine.trim();
      if (!line) {
        index += 1;
        continue;
      }
      const heading = line.match(/^(#{1,5})\s+(?:\*\*([^*]+)\*\*|([^#]+?))(?:\s+([\s\S]*))?$/);
      if (heading) {
        const title = document.createElement('h5');
        title.textContent = String(heading[2] || heading[3] || '').trim();
        target.append(title);
        if (heading[4]) {
          const paragraph = document.createElement('p');
          appendInline(paragraph, heading[4]);
          target.append(paragraph);
        }
        index += 1;
        continue;
      }

      const listItem = line.match(/^(?:([-*])|(\d+)\.)\s+(.+)$/);
      if (listItem) {
        const ordered = Boolean(listItem[2]);
        const list = document.createElement(ordered ? 'ol' : 'ul');
        while (index < lines.length) {
          const candidate = lines[index].trim().match(/^(?:([-*])|(\d+)\.)\s+(.+)$/);
          if (!candidate || Boolean(candidate[2]) !== ordered) break;
          const item = document.createElement('li');
          appendInline(item, candidate[3]);
          list.append(item);
          index += 1;
        }
        target.append(list);
        continue;
      }

      const paragraphLines = [line];
      index += 1;
      while (index < lines.length) {
        const candidate = lines[index].trim();
        if (!candidate) break;
        if (/^#{1,5}\s+/.test(candidate) || /^(?:[-*]|\d+\.)\s+/.test(candidate)) break;
        paragraphLines.push(candidate);
        index += 1;
      }
      const paragraph = document.createElement('p');
      appendInline(paragraph, paragraphLines.join(' '));
      target.append(paragraph);
    }
  }

  function writingCriterionSections(value) {
    const text = cleanWritingFeedback(value);
    if (!text) return [];
    const sections = [];
    let current = null;
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      const heading = line.match(/^#{2,5}\s+(?:\*\*)?(.+?)(?:\*\*)?\s*$/);
      const title = String(heading?.[1] || '').replace(/\*\*/g, '').trim();
      if (heading && /^\d+\.\s+/.test(title)) {
        if (current) sections.push({ title: current.title, body: current.body.join('\n').trim() });
        current = { title, body: [] };
        continue;
      }
      if (heading && /KẾT LUẬN/i.test(title)) {
        if (current) sections.push({ title: current.title, body: current.body.join('\n').trim() });
        current = null;
        break;
      }
      if (current) current.body.push(rawLine);
    }
    if (current) sections.push({ title: current.title, body: current.body.join('\n').trim() });
    return sections;
  }

  function writingCriterionFallbackSummary(value) {
    const cleaned = cleanWritingFeedback(value);
    const beforeConclusion = cleaned.split(/^#{2,5}\s+(?:\*\*)?KẾT LUẬN/im)[0];
    return beforeConclusion
      .replace(/^#{1,5}\s+.*$/gm, '')
      .replace(/^\s*\*\*[^\n]*Band[^\n]*\*\*\s*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function appendWritingComponent(parent, component, section, index, criterionCode, taskNumber) {
    const aspect = document.createElement('section');
    aspect.className = 'writing-component';
    const title = document.createElement('h5');
    title.textContent = section?.title || `${index + 1}. ${component?.label || component?.code || 'Khía cạnh'}`;
    aspect.append(title);

    const summaryValue = cleanWritingFeedback(component?.summary || section?.body || '');
    if (summaryValue) {
      const summary = document.createElement('div');
      summary.className = 'writing-component-summary writing-feedback-richtext';
      appendSafeWritingFeedback(summary, summaryValue);
      aspect.append(summary);
    }

    const detailValue = cleanWritingFeedback(component?.feedback || '');
    if (detailValue) {
      const detailId = `writingDetail${taskNumber}${criterionCode}${index}`;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'writing-component-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', detailId);
      toggle.textContent = 'Xem phân tích chi tiết và cách cải thiện';
      const detail = document.createElement('div');
      detail.id = detailId;
      detail.className = 'writing-component-detail writing-feedback-richtext';
      detail.hidden = true;
      appendSafeWritingFeedback(detail, detailValue);
      toggle.addEventListener('click', () => {
        const willOpen = detail.hidden;
        detail.hidden = !willOpen;
        toggle.setAttribute('aria-expanded', String(willOpen));
        toggle.textContent = willOpen
          ? 'Thu gọn phân tích chi tiết'
          : 'Xem phân tích chi tiết và cách cải thiện';
      });
      aspect.append(toggle, detail);
    }
    parent.append(aspect);
  }

  function openWritingFeedback(taskResult) {
    const taskNumber = Number(taskResult?.taskNumber);
    const task = Array.from(writingConfig?.tasks || []).find(item => item.id === `task${taskNumber}`);
    if (!task) return;
    const essayValue = state.drafts.writing[task.id] || '';
    const dialog = document.createElement('dialog');
    dialog.className = 'writing-feedback-dialog';
    dialog.setAttribute('aria-labelledby', `writingFeedbackTitle${taskNumber}`);

    const shell = document.createElement('div');
    shell.className = 'writing-feedback-shell';
    const header = document.createElement('header');
    header.className = 'writing-feedback-header';
    const headerCopy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.textContent = `Kết quả ${task.label}`;
    const title = document.createElement('h2');
    title.id = `writingFeedbackTitle${taskNumber}`;
    title.textContent = `${task.label} · Band ${formatBand(taskResult.taskScore)}`;
    const meta = document.createElement('p');
    meta.textContent = `${Number(taskResult.wordCount || countWords(essayValue))} từ · Chấm theo 4 tiêu chí IELTS`;
    headerCopy.append(eyebrow, title, meta);
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'writing-feedback-close';
    closeButton.setAttribute('aria-label', 'Đóng bài chấm Writing');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => dialog.close());
    header.append(headerCopy, closeButton);

    const layout = document.createElement('div');
    layout.className = 'writing-feedback-layout';
    const sourcePane = document.createElement('section');
    sourcePane.className = 'writing-feedback-source';
    const promptTitle = document.createElement('h3');
    promptTitle.textContent = 'Đề bài';
    const prompt = document.createElement('p');
    prompt.className = 'writing-feedback-prompt';
    prompt.textContent = task.prompt || '';
    sourcePane.append(promptTitle, prompt);
    if (task.followUp) {
      const followUp = document.createElement('p');
      followUp.className = 'writing-feedback-prompt';
      followUp.textContent = task.followUp;
      sourcePane.append(followUp);
    }
    if (task.image) {
      const image = document.createElement('img');
      image.src = typeof task.image === 'object' ? task.image.src : task.image;
      image.alt = typeof task.image === 'object' && task.image.alt
        ? task.image.alt
        : `Hình minh họa ${task.label}`;
      image.className = 'writing-feedback-image';
      sourcePane.append(image);
    }
    const reportSummary = writingReportSummary(taskResult.report);
    if (reportSummary) {
      const reportTitle = document.createElement('h3');
      reportTitle.textContent = 'Nhận xét tổng hợp';
      const report = document.createElement('div');
      report.className = 'writing-feedback-text writing-feedback-richtext';
      appendSafeWritingFeedback(report, reportSummary);
      sourcePane.append(reportTitle, report);
    }
    const essayTitle = document.createElement('h3');
    essayTitle.textContent = 'Bài viết của học viên';
    const essay = document.createElement('div');
    essay.className = `writing-feedback-essay${essayValue.trim() ? '' : ' is-empty'}`;
    essay.lang = 'en';
    essay.textContent = essayValue.trim() || 'Chưa có nội dung bài viết.';
    sourcePane.append(essayTitle, essay);
    const scorePane = document.createElement('section');
    scorePane.className = 'writing-feedback-scores';
    const scoreTitle = document.createElement('h3');
    scoreTitle.textContent = 'Nhận xét theo tiêu chí';
    scorePane.append(scoreTitle);
    for (const criterion of Array.from(taskResult.criteria || [])) {
      const card = document.createElement('article');
      card.className = 'writing-criterion-card';
      const criterionHeader = document.createElement('header');
      const criterionName = document.createElement('h4');
      criterionName.textContent = criterion.name || criterionTitle(criterion.code, taskNumber);
      const criterionScore = document.createElement('strong');
      criterionScore.textContent = `Band ${formatBand(criterion.bandScore)}`;
      criterionHeader.append(criterionName, criterionScore);
      card.append(criterionHeader);
      const components = Array.from(criterion.components || []);
      const sections = writingCriterionSections(criterion.feedback);
      const componentCount = Math.max(components.length, sections.length);
      if (componentCount) {
        const componentList = document.createElement('div');
        componentList.className = 'writing-component-list';
        for (let index = 0; index < componentCount; index += 1) {
          appendWritingComponent(componentList, components[index], sections[index], index, criterion.code, taskNumber);
        }
        card.append(componentList);
      } else {
        const feedback = document.createElement('div');
        feedback.className = 'writing-feedback-text writing-feedback-richtext';
        appendSafeWritingFeedback(feedback, writingCriterionFallbackSummary(criterion.feedback));
        card.append(feedback);
      }
      scorePane.append(card);
    }
    layout.append(sourcePane, scorePane);
    shell.append(header, layout);
    dialog.append(shell);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    document.body.append(dialog);
    dialog.showModal();
  }

  function renderWritingSubmission() {
    if (!writingConfig || !elements.writingSubmissionResult) return;
    elements.writingSubmissionResult.hidden = !state.writingSubmitted;
    if (!state.writingSubmitted) {
      elements.writingSubmissionResult.replaceChildren();
      return;
    }

    const section = document.createElement('section');
    section.className = 'writing-result-section';
    const grading = state.result?.writing?.grading || null;
    const heading = document.createElement('header');
    heading.className = 'writing-result-heading';
    const headingCopy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.textContent = grading?.ready ? 'Kết quả Writing' : 'Bài Writing đã nộp';
    const title = document.createElement('h3');
    title.textContent = grading?.ready
      ? 'Điểm và bài chấm Writing'
      : grading?.status === 'review_required'
        ? 'Bài Writing đang được kiểm tra'
        : 'Bài Writing của bạn đang được chấm';
    headingCopy.append(eyebrow, title);
    const note = document.createElement('p');
    note.textContent = grading?.ready
      ? `Nhấn vào điểm ${writingTaskLabels || 'Writing'} để xem bài chấm chi tiết.`
      : grading?.status === 'review_required'
        ? 'Bài làm đã được giữ an toàn; một phần chấm cần giáo viên kiểm tra trước khi công bố.'
        : 'Kết quả sẽ hiển thị sớm. Bạn có thể tắt trang web và quay lại sau bằng đúng đường dẫn này.';
    heading.append(headingCopy, note);

    const gradingArea = document.createElement('div');
    if (grading?.ready) {
      gradingArea.className = 'writing-score-grid';
      const tasksByNumber = new Map(Array.from(grading.tasks || []).map(task => [Number(task.taskNumber), task]));
      const configuredTaskNumbers = writingTasks
        .map(task => Number(String(task.id || '').replace(/\D/g, '')))
        .filter(Number.isFinite);
      for (const taskNumber of configuredTaskNumbers) {
        const taskResult = tasksByNumber.get(taskNumber);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'writing-score-card is-action';
        const label = document.createElement('span');
        label.textContent = `Writing Task ${taskNumber}`;
        const score = document.createElement('strong');
        score.textContent = `Band ${formatBand(taskResult?.taskScore)}`;
        const action = document.createElement('small');
        action.textContent = 'Xem bài chấm chi tiết →';
        button.append(label, score, action);
        button.addEventListener('click', () => openWritingFeedback(taskResult));
        gradingArea.append(button);
      }
      const overall = document.createElement('article');
      overall.className = 'writing-score-card is-overall';
      const overallLabel = document.createElement('span');
      overallLabel.textContent = 'Writing tổng';
      const overallScore = document.createElement('strong');
      overallScore.textContent = `Band ${formatBand(grading.writingScore)}`;
      const formula = document.createElement('small');
      formula.textContent = configuredTaskNumbers.length === 1 ? 'Điểm của bài Writing' : 'Task 1 × 1 · Task 2 × 2';
      overall.append(overallLabel, overallScore, formula);
      gradingArea.append(overall);
    } else {
      gradingArea.className = `writing-grading-status${grading?.status === 'review_required' ? ' needs-review' : ''}`;
      const statusCopy = document.createElement('div');
      const statusTitle = document.createElement('strong');
      statusTitle.textContent = grading?.status === 'review_required'
        ? 'Bài chấm đang được kiểm tra'
        : `Đang chấm ${writingTaskLabels || 'bài Writing'}`;
      const statusText = document.createElement('p');
      statusText.textContent = grading?.status === 'review_required'
        ? 'Bạn có thể đóng trang; kết quả vẫn được lưu và sẽ hiện khi hoàn chỉnh.'
        : 'Bài làm và tiến độ chấm đã được lưu trên hệ thống. Nếu vẫn mở trang, kết quả sẽ tự cập nhật khi chấm xong.';
      statusCopy.append(statusTitle, statusText);
      const refresh = document.createElement('button');
      refresh.type = 'button';
      refresh.className = 'button button-secondary';
      refresh.textContent = 'Kiểm tra kết quả ngay';
      refresh.addEventListener('click', async () => {
        refresh.disabled = true;
        refresh.textContent = 'Đang kiểm tra...';
        await refreshWritingGrading();
        if (refresh.isConnected) {
          refresh.disabled = false;
          refresh.textContent = 'Kiểm tra kết quả ngay';
        }
      });
      gradingArea.append(statusCopy, refresh);
    }

    section.append(heading, gradingArea);
    elements.writingSubmissionResult.replaceChildren(section);
  }

  function addSummaryCard(label, value) {
    const card = document.createElement('article');
    card.className = 'summary-card';
    const labelNode = document.createElement('span');
    labelNode.textContent = label;
    const valueNode = document.createElement('strong');
    valueNode.textContent = value;
    card.append(labelNode, valueNode);
    return card;
  }

  function renderAnalysisList(container, items, emptyText) {
    const rows = items?.length ? items : [{ type: emptyText, correct: 0, total: 0, percentage: 0 }];
    container.replaceChildren(...rows.map(item => {
      const node = document.createElement('li');
      node.textContent = item.total
        ? `${item.type}: ${item.correct}/${item.total} (${Math.round(item.percentage * 100)}%)`
        : item.type;
      return node;
    }));
  }

  function splitSkillPerformance(stats) {
    const sorted = [...(stats || [])].sort((left, right) =>
      right.percentage - left.percentage || left.type.localeCompare(right.type, 'vi')
    );
    if (!sorted.length) return { best: [], needsImprovement: [] };
    const highest = sorted[0].percentage;
    const lowest = sorted.at(-1).percentage;
    return {
      best: sorted.filter(item => item.percentage === highest),
      needsImprovement: lowest === highest ? [] : sorted.filter(item => item.percentage === lowest)
    };
  }

  function renderSkillPerformance(label, section) {
    const wrapper = document.createElement('section');
    wrapper.className = 'skill-performance-section';
    wrapper.dataset.skillPerformance = label.toLowerCase();

    const heading = document.createElement('header');
    heading.className = 'skill-performance-heading';
    const headingCopy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.textContent = 'Phân tích riêng';
    const title = document.createElement('h3');
    title.textContent = label;
    headingCopy.append(eyebrow, title);
    const score = document.createElement('strong');
    score.textContent = sectionScoreText(section);
    heading.append(headingCopy, score);

    const analysis = splitSkillPerformance(section.typeStats);
    const cards = document.createElement('div');
    cards.className = 'analysis-grid';
    const bestCard = document.createElement('article');
    bestCard.className = 'analysis-card best';
    const bestTitle = document.createElement('h4');
    bestTitle.textContent = 'Dạng làm tốt nhất';
    const bestList = document.createElement('ul');
    bestList.className = 'analysis-list';
    bestCard.append(bestTitle, bestList);
    renderAnalysisList(bestList, analysis.best, 'Chưa có dữ liệu dạng bài.');

    const improveCard = document.createElement('article');
    improveCard.className = 'analysis-card improve';
    const improveTitle = document.createElement('h4');
    improveTitle.textContent = 'Dạng cần cải thiện';
    const improveList = document.createElement('ul');
    improveList.className = 'analysis-list';
    improveCard.append(improveTitle, improveList);
    renderAnalysisList(improveList, analysis.needsImprovement, 'Các dạng đang có kết quả ngang nhau.');
    cards.append(bestCard, improveCard);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'detail-table-wrap';
    const table = document.createElement('table');
    table.className = 'performance-table';
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const value of ['Dạng bài', 'Đúng', 'Tổng', 'Tỷ lệ']) {
      const cell = document.createElement('th');
      cell.textContent = value;
      headerRow.append(cell);
    }
    head.append(headerRow);
    const body = document.createElement('tbody');
    for (const item of section.typeStats || []) {
      const row = document.createElement('tr');
      for (const value of [item.type, item.correct, item.total, `${Math.round(item.percentage * 100)}%`]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      body.append(row);
    }
    table.append(head, body);
    tableWrap.append(table);
    wrapper.append(heading, cards, tableWrap);
    return wrapper;
  }

  function sectionScoreText(section) {
    const base = `${section.correct}/${section.total}`;
    const band = Number(section.band);
    return Number.isFinite(band) ? `${base} · Band ${formatBand(band)}` : base;
  }

  function renderDetailBlock(title, details) {
    const block = document.createElement('details');
    block.className = 'detail-block';
    const summary = document.createElement('summary');
    const detailRows = details || [];
    summary.textContent = detailRows.length
      ? `${title} · xem chi tiết ${detailRows.length} câu`
      : `${title} · chưa có dữ liệu từng câu`;
    const wrap = document.createElement('div');
    wrap.className = 'detail-table-wrap';
    const table = document.createElement('table');
    table.className = 'detail-table';
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const label of ['Câu', 'Bài làm', 'Đáp án đúng', 'Kết quả']) {
      const cell = document.createElement('th');
      cell.textContent = label;
      headerRow.append(cell);
    }
    head.append(headerRow);
    const body = document.createElement('tbody');
    for (const detail of detailRows) {
      const row = document.createElement('tr');
      const resultMeta = {
        correct: { icon: '✓', label: 'Đúng' },
        incorrect: { icon: '✕', label: 'Sai' },
        blank: { icon: '–', label: 'Bỏ trống' }
      }[detail.result] || { icon: '?', label: detail.result || 'Chưa xác định' };
      row.className = `detail-row detail-row-${detail.result || 'unknown'}`;
      const labels = [
        `${String(detail.number).padStart(2, '0')}.`,
        detail.studentAnswer || '—',
        detail.correctAnswer || '—'
      ];
      labels.forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });
      const resultCell = document.createElement('td');
      resultCell.className = `detail-result-cell result-${detail.result}`;
      const resultIcon = document.createElement('span');
      resultIcon.className = 'detail-result-icon';
      resultIcon.setAttribute('aria-hidden', 'true');
      resultIcon.textContent = resultMeta.icon;
      const resultLabel = document.createElement('span');
      resultLabel.textContent = resultMeta.label;
      resultCell.append(resultIcon, resultLabel);
      row.append(resultCell);
      body.append(row);
    }
    table.append(head, body);
    wrap.append(table);
    block.append(summary, wrap);
    return block;
  }

  function renderResult(payload) {
    if (!resultsUnlocked()) return false;
    const result = payload.result;
    const hasReading = Boolean(result.reading);
    state.result = payload;
    elements.resultStudentName.textContent = payload.studentName;
    elements.resultMeta.textContent = `${payload.className} · ${result.testTitle || testConfig.title}`;
    elements.summaryGrid.replaceChildren(
      addSummaryCard('Listening', sectionScoreText(result.listening)),
      addSummaryCard('Reading', hasReading ? sectionScoreText(result.reading) : 'Chưa nộp')
    );
    elements.resultStatus.textContent = hasReading
      ? !writingConfig
        ? 'Listening và Reading được chấm và phân tích riêng.'
        : payload.writing?.grading?.ready
          ? `Listening và Reading được phân tích riêng; điểm Writing đã hoàn tất và có bài chấm chi tiết cho ${writingTaskLabels || 'bài Writing'}.`
          : 'Listening và Reading được phân tích riêng. Writing đang được chấm và chưa hiện điểm thành phần.'
      : 'Listening đã được chấm và lưu riêng. Phân tích dưới đây chỉ dùng bài Listening; Reading chưa bị tính là 0 điểm.';
    elements.continueReadingFromResult.hidden = hasReading || Boolean(demoMode);
    elements.viewFullAttempt.hidden = !(
      state.attemptToken
      && payload.completed
      && (!writingConfig || payload.writing?.submitted)
      && !demoMode
    );
    renderWritingSubmission();
    const detailBlocks = [renderDetailBlock('Listening', result.listening.details)];
    if (hasReading) detailBlocks.push(renderDetailBlock('Reading', result.reading.details));
    elements.questionDetails.replaceChildren(...detailBlocks);
    const performanceSections = [renderSkillPerformance('Listening', result.listening)];
    if (hasReading) performanceSections.push(renderSkillPerformance('Reading', result.reading));
    elements.skillPerformanceSections.replaceChildren(...performanceSections);
    if (payload.writing?.grading?.ready) stopWritingGradingPolling();
    return true;
  }

  function portalNotice(status, completed) {
    if (status === 'not_applicable') {
      return completed
        ? 'Bài đã được chấm và phân tích đầy đủ.'
        : 'Listening đã được chấm và phân tích đầy đủ.';
    }
    if (status === 'pending') {
      return completed
        ? 'Bài đã được chấm. Portal đang bận; hệ thống sẽ tự thử ghi lại khi bạn mở kết quả.'
        : 'Listening đã được chấm. Portal đang bận; hệ thống sẽ tự thử ghi lại khi bạn mở kết quả.';
    }
    return completed
      ? 'Cả Listening và Reading đã được chấm và ghi vào Portal.'
      : 'Listening đã được chấm, phân tích và ghi vào Portal.';
  }

  function writingGradingNotice(grading) {
    if (grading?.status === 'review_required') {
      return 'Bài Writing đã được lưu an toàn và đang chờ giáo viên kiểm tra. Bạn có thể tắt trang web và quay lại sau bằng đúng đường dẫn này.';
    }
    return 'Bài Writing của bạn đang được chấm. Kết quả sẽ hiển thị sớm. Bạn có thể tắt trang web và quay lại sau bằng đúng đường dẫn này.';
  }

  async function loadResult(button) {
    if (!resultsUnlocked()) {
      setStage(stageBeforeResults());
      showNotice('Kết quả Listening và Reading được giữ kín cho tới khi bạn nộp Writing.', 'success');
      return;
    }
    setBusy(button, true, 'Đang tải kết quả...', button.dataset.normalText || button.textContent);
    try {
      const payload = await apiRequest('/api/term-tests/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptToken: state.attemptToken })
      });
      applyWritingFromServer(payload.writing, Boolean(payload.writing?.submitted));
      renderResult(payload);
      const grading = payload.writing?.grading;
      if (payload.writing?.submitted && !grading?.ready) {
        showNotice(writingGradingNotice(grading), 'success');
      } else {
        showNotice(portalNotice(payload.portalSyncStatus, payload.completed), payload.portalSyncStatus === 'pending' ? '' : 'success');
      }
      setStage('result');
      scheduleWritingGradingRefresh();
    } catch (error) {
      showNotice(`Không thể tải kết quả: ${error.message}`, 'error');
    } finally {
      setBusy(button, false, 'Đang tải kết quả...', button.dataset.normalText || 'Xem kết quả');
    }
  }

  async function selectStudentIdentity({ requireConfirmation = false } = {}) {
    if (identitySelectionBusy) return;
    identitySelectionBusy = true;
    setIdentityControlsBusy(true);
    try {
      const previousStudentRef = state.studentRef;
      const selectedValue = elements.studentSelect.value;
      if (hasBoundAttempt() && selectedValue !== previousStudentRef) {
        elements.studentSelect.value = previousStudentRef;
        showNotice('Bài đang gắn với danh tính hiện tại; không thể đổi người học lúc này.', 'error');
        return;
      }
      const selectingTemporary = selectedValue === '__temporary__';
      const student = selectingTemporary ? null : state.roster.find(item => item.ref === selectedValue);
      // Term Test vốn có popup xác nhận. Với tên được điền sẵn, nút Xác nhận cũng
      // đi qua chính popup này; chỉ sau đó mới có thể ghi nhớ hoặc kiểm lượt dở.
      if (student && (testConfig.slug.startsWith('term-test-') || requireConfirmation)) {
        const confirmed = await confirmStudentIdentity(student);
        if (!confirmed) {
          elements.studentSelect.value = state.roster.some(item => item.ref === previousStudentRef)
            ? previousStudentRef
            : '';
          if (elements.temporaryStudentForm) elements.temporaryStudentForm.hidden = true;
          if (elements.resetDemoData) elements.resetDemoData.disabled = !elements.studentSelect.value;
          return;
        }
      }
      state.studentRef = student?.ref || '';
      state.studentName = student?.name || '';
      state.studentIdentitySource = selectingTemporary ? 'temporary' : (student?.temporary ? 'temporary' : (student ? 'roster' : ''));
      if (elements.temporaryStudentForm) {
        elements.temporaryStudentForm.hidden = !selectingTemporary;
        if (!elements.temporaryStudentForm.hidden) elements.temporaryStudentName.focus();
        else { elements.temporaryStudentName.value = ''; elements.temporaryStudentCode.value = ''; }
      }
      if (selectingTemporary) forgetForTemporaryStudent();
      else if (studentMemory.checkbox) {
        studentMemory.checkbox.disabled = false;
        studentMemory.checkbox.checked = studentMemory.preferred;
      }
      if (previousStudentRef && previousStudentRef !== state.studentRef) {
      // Đổi học viên phải tạo một lượt độc lập; không mang mã gửi bài hoặc bài nháp của người trước sang.
      state.clientSubmissionId = '';
      state.clientSubmissionStudentRef = '';
      state.examSessionToken = '';
      state.attemptToken = '';
      state.listeningDeadlineAt = '';
      state.readingDeadlineAt = '';
      state.writingDeadlineAt = '';
      state.serverTimeOffsetMs = 0;
      state.listeningSubmitted = false;
      state.completed = false;
      state.writingStarted = false;
      state.writingSubmitted = false;
      state.writingDirty = false;
      state.drafts = { listening: {}, reading: {}, writing: { task1: '', task2: '' } };
      state.draftRevisions = { listening: 0, reading: 0 };
      state.draftAckRevisions = { listening: 0, reading: 0 };
      state.frozenAnswers = { listening: null, reading: null };
      state.result = null;
      state.attemptReview = null;
      }
      if (student) rememberConfirmedStudent(student);
      studentMemory.candidateRef = '';
      if (studentMemory.confirm) studentMemory.confirm.hidden = true;
      if (elements.resetDemoData) elements.resetDemoData.disabled = !state.studentRef;
      saveSession();
      if (state.studentRef && !state.attemptToken) {
        try {
          await resumeActiveAttemptForSelectedStudent();
        } catch (error) {
          showNotice(`Chưa kiểm tra được lượt đang dở: ${error.message}. Bạn vẫn có thể tiếp tục trên máy này.`, 'error');
        }
      }
    } finally {
      setIdentityControlsBusy(false);
      if (state.studentIdentitySource === 'temporary') forgetForTemporaryStudent();
      else if (studentMemory.checkbox) studentMemory.checkbox.disabled = false;
      identitySelectionBusy = false;
    }
  }

  elements.studentSelect.addEventListener('change', () => {
    void selectStudentIdentity();
  });

  elements.temporaryStudentForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (identitySelectionBusy || !elements.temporaryStudentForm.reportValidity()) return;
    identitySelectionBusy = true;
    setIdentityControlsBusy(true);
    const studentName = elements.temporaryStudentName.value.trim().replace(/\s+/gu, ' ');
    const temporaryCode = elements.temporaryStudentCode.value.trim().toUpperCase();
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
      state.roster = state.roster.filter(item => item.ref !== student.ref);
      state.roster.push(student);
      state.studentRef = student.ref;
      state.studentName = student.name;
      state.studentIdentitySource = 'temporary';
      renderRosterOptions();
      elements.studentSelect.value = student.ref;
      elements.temporaryStudentName.value = '';
      elements.temporaryStudentCode.value = '';
      elements.temporaryStudentForm.hidden = true;
      elements.readingStudentName.textContent = student.name;
      saveSession();
      forgetForTemporaryStudent();
      refreshRememberedStudent();
      showNotice(`Đã xác nhận ${student.name}. Bạn có thể bắt đầu làm bài.`, 'success');
    } catch (error) {
      showNotice(`Chưa xác nhận được học viên: ${error.message}`, 'error');
    } finally {
      setIdentityControlsBusy(false);
      if (state.studentIdentitySource === 'temporary') forgetForTemporaryStudent();
      identitySelectionBusy = false;
    }
  });

  elements.resetDemoData?.addEventListener('click', async () => {
    const student = state.roster.find(item => item.ref === state.studentRef);
    if (classCode !== 'CODEXDEMO806' || !student) return;
    if (!window.confirm(`Xóa toàn bộ dữ liệu làm bài của ${student.name} để thử lại từ đầu?`)) return;

    setBusy(elements.resetDemoData, true, 'Đang reset...', 'Reset dữ liệu học viên');
    try {
      await apiRequest('/api/term-tests/demo/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode,
          testSlug: testConfig.slug,
          studentRef: state.studentRef,
          confirmation: 'RESET_DEMO_STUDENT'
        })
      });
      clearAllLocalAttemptData();
      window.location.reload();
    } catch (error) {
      showNotice(`Không thể reset dữ liệu: ${error.message}`, 'error');
      setBusy(elements.resetDemoData, false, 'Đang reset...', 'Reset dữ liệu học viên');
    }
  });

  elements.listeningView.addEventListener('submit', async event => {
    event.preventDefault();
    if (!state.studentRef) {
      elements.studentSelect.reportValidity();
      showNotice('Hãy chọn đúng họ và tên trước khi nộp Listening.', 'error');
      return;
    }
    const automatic = event.submitter?.dataset.autoSubmit === 'true'
      || elements.listeningView.dataset.listeningTimeExpired === 'true';
    let answers = state.frozenAnswers.listening || collectAnswers(elements.listeningQuestions);
    if (automatic && !state.frozenAnswers.listening) {
      state.frozenAnswers.listening = Object.freeze({ ...answers });
      answers = state.frozenAnswers.listening;
    }
    const answered = Object.values(answers).filter(Boolean).length;
    if (!automatic && !confirmIncomplete(answered, 'Listening')) return;
    if (!state.clientSubmissionId || state.clientSubmissionStudentRef !== state.studentRef) {
      state.clientSubmissionId = crypto.randomUUID();
      state.clientSubmissionStudentRef = state.studentRef;
    }
    state.drafts.listening = answers;
    saveSession();
    stopSectionDraftFlow('listening');
    elements.listeningView.dataset.listeningSubmitting = 'true';
    setAnswerControlsLocked('listening', true);
    setBusy(elements.submitListening, true, 'Đang lưu Listening...', 'Nộp bài Listening');
    if (automatic) showNotice('Đã hết giờ. Hệ thống đang tự thu và chấm bài Listening...');
    let submitted = false;
    sendClientEvent('submit_started', 'listening', {
      revision: Number(state.draftRevisions.listening) || 0,
      answeredCount: countAnswered(answers)
    });
    try {
      const response = await apiRequest(`/api/term-tests/${testConfig.slug}/listening`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode,
          studentRef: state.studentRef,
          clientSubmissionId: state.clientSubmissionId,
          examSessionToken: state.examSessionToken || undefined,
          draftRevision: Number(state.draftRevisions.listening) || 0,
          answers
        })
      });
      state.attemptToken = response.attemptToken;
      state.studentName = response.studentName;
      state.listeningSubmitted = true;
      state.completed = Boolean(response.completed);
      state.readingDeadlineAt = response.readingDeadlineAt || state.readingDeadlineAt;
      applySectionDraft('reading', response.readingDraft, response.readingDraftRevision, Boolean(response.resumedActiveAttempt));
      state.frozenAnswers.listening = null;
      state.draftAckRevisions.listening = Math.max(
        Number(state.draftAckRevisions.listening) || 0,
        Number(state.draftRevisions.listening) || 0
      );
      setSectionSaveStatus('listening', 'Đã nộp bài', 'saved');
      stopSectionDeadlineGuard('listening');
      saveSession();
      submitted = true;
      elements.listeningView.dispatchEvent(new CustomEvent('term-test:listening-submitted'));
      if (writingConfig || deferResultsUntilComplete) {
        showNotice(`Bài Listening đã được ghi nhận. Kết quả sẽ mở sau khi bạn hoàn thành ${writingConfig ? 'Reading và nộp Writing' : 'Reading'}.`, 'success');
      } else {
        showNotice(portalNotice(response.portalSyncStatus, state.completed), response.portalSyncStatus === 'pending' ? '' : 'success');
      }
      if (state.completed && writingConfig && !state.writingSubmitted) {
        setStage(state.writingStarted ? 'writing' : 'writing-prep');
      } else {
        setStage(state.completed ? 'result-ready' : 'listening-saved');
      }
    } catch (error) {
      sendClientEvent('submit_failed', 'listening', {
        revision: Number(state.draftRevisions.listening) || 0,
        answeredCount: countAnswered(answers),
        status: Number(error.status) || 0
      });
      showNotice(automatic
        ? `Hết giờ nhưng chưa thể nộp Listening: ${error.message}. Bài đã khóa và hệ thống sẽ tự thử lại.`
        : `Không thể lưu Listening: ${error.message}`, 'error');
    } finally {
      delete elements.listeningView.dataset.listeningSubmitting;
      if (!submitted && isSectionExpired('listening')) {
        elements.listeningView.dataset.listeningTimeExpired = 'true';
        state.frozenAnswers.listening ||= { ...answers };
        saveSession();
      } else if (!automatic && !submitted) {
        setAnswerControlsLocked('listening', false);
        scheduleSectionDraft('listening', 0);
      }
      if (!submitted && isSectionExpired('listening')) startSectionDeadlineGuard('listening');
      setBusy(elements.submitListening, false, 'Đang lưu Listening...', 'Nộp bài Listening');
    }
  });

  async function startOrResumeReading(button) {
    setBusy(button, true, 'Đang mở Reading...', button.dataset.normalText || button.textContent);
    try {
      const response = await apiRequest(`/api/term-tests/${testConfig.slug}/reading/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptToken: state.attemptToken })
      });
      state.readingDeadlineAt = response.readingDeadlineAt;
      state.serverTimeOffsetMs = Date.parse(response.serverNow) - Date.now();
      applySectionDraft('reading', response.readingDraft, response.readingDraftRevision);
      saveSession();
      elements.readingStudentName.textContent = state.studentName;
      hideNotice();
      setStage('reading');
      startSectionDeadlineGuard('reading');
    } catch (error) {
      showNotice(`Chưa thể mở Reading: ${error.message}`, 'error');
    } finally {
      setBusy(button, false, 'Đang mở Reading...', button.dataset.normalText || 'Bắt đầu bài Reading');
    }
  }

  elements.startReading.dataset.normalText = 'Bắt đầu bài Reading';
  elements.continueReadingFromResult.dataset.normalText = 'Tiếp tục làm Reading';
  elements.startReading.addEventListener('click', () => startOrResumeReading(elements.startReading));
  elements.continueReadingFromResult.addEventListener('click', () => startOrResumeReading(elements.continueReadingFromResult));

  elements.readingView.addEventListener('submit', async event => {
    event.preventDefault();
    const automatic = event.submitter?.dataset.autoSubmit === 'true'
      || elements.readingView.dataset.readingTimeExpired === 'true';
    let answers = state.frozenAnswers.reading || collectAnswers(elements.readingQuestions);
    if (automatic && !state.frozenAnswers.reading) {
      state.frozenAnswers.reading = Object.freeze({ ...answers });
      answers = state.frozenAnswers.reading;
    }
    const answered = Object.values(answers).filter(Boolean).length;
    if (!automatic && !confirmIncomplete(answered, 'Reading')) return;
    elements.readingView.dataset.readingSubmitting = 'true';
    state.drafts.reading = answers;
    saveSession();
    stopSectionDraftFlow('reading');
    setAnswerControlsLocked('reading', true);
    setBusy(elements.submitReading, true, 'Đang lưu và chấm...', 'Nộp bài Reading');
    if (automatic) {
      showNotice(`Đã hết ${readingMinutes} phút. Hệ thống đang tự thu và chấm bài Reading...`);
    }
    let submitted = false;
    sendClientEvent('submit_started', 'reading', {
      revision: Number(state.draftRevisions.reading) || 0,
      answeredCount: countAnswered(answers)
    });
    try {
      const response = await apiRequest(`/api/term-tests/${testConfig.slug}/reading`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptToken: state.attemptToken,
          draftRevision: Number(state.draftRevisions.reading) || 0,
          answers
        })
      });
      state.completed = true;
      state.frozenAnswers.reading = null;
      state.draftAckRevisions.reading = Math.max(
        Number(state.draftAckRevisions.reading) || 0,
        Number(state.draftRevisions.reading) || 0
      );
      setSectionSaveStatus('reading', 'Đã nộp bài', 'saved');
      stopSectionDeadlineGuard('reading');
      saveSession();
      submitted = true;
      elements.readingView.dispatchEvent(new CustomEvent('term-test:reading-submitted'));
      if (writingConfig) {
        setStage('writing-prep');
        const portalMessage = portalNotice(response.portalSyncStatus, true);
        showNotice(`${portalMessage} Kết quả sẽ mở sau khi bạn nộp Writing.`, response.portalSyncStatus === 'pending' ? '' : 'success');
      } else {
        showNotice(portalNotice(response.portalSyncStatus, true), response.portalSyncStatus === 'pending' ? '' : 'success');
        setStage('result-ready');
        if (automatic) await loadResult(elements.viewResult);
      }
    } catch (error) {
      sendClientEvent('submit_failed', 'reading', {
        revision: Number(state.draftRevisions.reading) || 0,
        answeredCount: countAnswered(answers),
        status: Number(error.status) || 0
      });
      showNotice(automatic
        ? `Hết giờ nhưng chưa thể nộp Reading: ${error.message}. Hệ thống sẽ tự thử lại; không làm mới trang.`
        : `Không thể lưu Reading: ${error.message}`, 'error');
    } finally {
      delete elements.readingView.dataset.readingSubmitting;
      if (!submitted && isSectionExpired('reading')) {
        elements.readingView.dataset.readingTimeExpired = 'true';
        state.frozenAnswers.reading ||= { ...answers };
        saveSession();
      } else if (!automatic && !submitted) {
        setAnswerControlsLocked('reading', false);
        scheduleSectionDraft('reading', 0);
      }
      if (!submitted && isSectionExpired('reading')) startSectionDeadlineGuard('reading');
      setBusy(elements.submitReading, false, 'Đang lưu và chấm...', 'Nộp bài Reading');
    }
  });

  if (elements.viewListeningResult) elements.viewListeningResult.dataset.normalText = 'Xem kết quả Listening';
  elements.viewResult.dataset.normalText = 'Xem kết quả';
  elements.viewFullAttempt.dataset.normalText = 'Xem lại toàn bộ bài làm';
  elements.viewListeningResult?.addEventListener('click', () => loadResult(elements.viewListeningResult));
  elements.viewResult.addEventListener('click', () => loadResult(elements.viewResult));
  elements.viewFullAttempt.addEventListener('click', async () => {
    setBusy(elements.viewFullAttempt, true, 'Đang tải bài chi tiết...', 'Xem lại toàn bộ bài làm');
    try {
      if (!state.attemptReview) {
        const payload = await apiRequest('/api/term-tests/result/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attemptToken: state.attemptToken })
        });
        state.attemptReview = payload.review;
      }
      if (!window.TERM_TEST_ATTEMPT_REVIEW?.open) throw new Error('Chưa tải được giao diện xem lại bài làm.');
      window.TERM_TEST_ATTEMPT_REVIEW.open(state.attemptReview);
    } catch (error) {
      showNotice(`Không thể tải bài chi tiết: ${error.message}`, 'error');
    } finally {
      setBusy(elements.viewFullAttempt, false, 'Đang tải bài chi tiết...', 'Xem lại toàn bộ bài làm');
    }
  });

  if (writingConfig) {
    elements.startWriting.addEventListener('click', async () => {
      const wasStarted = state.writingStarted;
      state.writingStarted = true;
      saveSession();
      setBusy(elements.startWriting, true, 'Đang mở Writing...', 'Bắt đầu Writing');
      try {
        await saveWritingToServer('start');
        hideNotice();
        setStage('writing');
      } catch (error) {
        state.writingStarted = wasStarted;
        saveSession();
        showNotice(`Chưa thể bắt đầu Writing: ${error.message}`, 'error');
      } finally {
        setBusy(elements.startWriting, false, 'Đang mở Writing...', 'Bắt đầu Writing');
      }
    });

    elements.writingView.addEventListener('submit', async event => {
      event.preventDefault();
      const automatic = event.submitter?.dataset.autoSubmit === 'true'
        || elements.writingView.dataset.writingTimeExpired === 'true';
      const belowMinimum = Array.from(writingConfig.tasks || []).map(task => ({
        label: task.label,
        words: countWords(state.drafts.writing[task.id]),
        minimum: task.minimumWords
      })).filter(task => task.words < task.minimum);
      if (!automatic && belowMinimum.length) {
        const summary = belowMinimum.map(task => `${task.label}: ${task.words}/${task.minimum} từ`).join('\n');
        if (!window.confirm(`${summary}\n\nBạn vẫn muốn nộp bài Writing?`)) return;
      }

      if (demoMode) {
        state.writingSubmitted = true;
        saveSession();
        renderResult(buildDemoPayload('complete'));
        showNotice('Bản demo: Writing đã nộp; kết quả Listening và Reading đã được mở.', 'success');
        setStage('result');
        return;
      }

      window.clearTimeout(writingSaveTimer);
      window.clearTimeout(writingRetryTimer);
      elements.writingView.dataset.writingSubmitting = 'true';
      setBusy(elements.submitWriting, true, 'Đang lưu và nộp...', 'Nộp bài Writing');
      for (const editor of elements.writingView.querySelectorAll('textarea')) editor.readOnly = true;
      if (automatic) showNotice(`Đã hết ${writingMinutes} phút. Hệ thống đang tự lưu và thu bài Writing...`);
      try {
        const saved = await saveWritingToServer('submit');
        if (!saved.writing?.submitted) throw new Error('Máy chủ chưa xác nhận bài Writing đã được nộp.');
        state.writingSubmitted = true;
        state.writingDirty = false;
        saveSession();
        elements.writingView.dispatchEvent(new CustomEvent('term-test:writing-submitted'));
        setStage('result-ready');
        showNotice(automatic
          ? `Đã hết ${writingMinutes} phút và hệ thống đã thu bài Writing. Bài đang được chấm; bạn có thể tắt trang web và quay lại sau.`
          : 'Đã nộp Writing thành công. Bài đang được chấm; bạn có thể tắt trang web và quay lại sau.', 'success');
        await loadResult(elements.viewResult);
      } catch (error) {
        showNotice(automatic
          ? `Hết giờ nhưng chưa thể nộp Writing: ${error.message}. Bài đã được khóa và hệ thống sẽ tự thử lại; không làm mới trang.`
          : `Không thể nộp Writing: ${error.message}. Bài vẫn được giữ trên máy để bạn thử lại.`, 'error');
        setWritingSaveStatus(automatic
          ? 'Hết giờ · bài đã khóa · hệ thống đang chờ thử nộp lại'
          : 'Chưa nộp được · bài vẫn được giữ trên máy');
      } finally {
        delete elements.writingView.dataset.writingSubmitting;
        const timeExpired = elements.writingView.dataset.writingTimeExpired === 'true';
        for (const editor of elements.writingView.querySelectorAll('textarea')) editor.readOnly = timeExpired;
        setBusy(elements.submitWriting, false, 'Đang lưu và nộp...', 'Nộp bài Writing');
      }
    });
  }

  function makeDemoSection(skill, correct, band) {
    const types = skill === 'Listening'
      ? ['Form completion', 'Multiple choice', 'Map labelling']
      : ['True / False / Not Given', 'Matching headings', 'Multiple choice'];
    return {
      correct,
      total: 40,
      answered: 40,
      band,
      details: Array.from({ length: 40 }, (_, index) => ({
        number: index + 1,
        studentAnswer: index < correct ? 'Đáp án mẫu' : 'Phương án khác',
        correctAnswer: 'Đáp án minh họa',
        result: index < correct ? 'correct' : 'incorrect'
      })),
      typeStats: types.map((type, index) => {
        const total = index === 2 ? 14 : 13;
        const typeCorrect = Math.max(0, Math.min(total, Math.round(correct * total / 40) + (index === 0 ? 1 : index === 2 ? -1 : 0)));
        return { type, correct: typeCorrect, total, percentage: typeCorrect / total };
      })
    };
  }

  function buildDemoPayload(mode) {
    const listening = makeDemoSection('Listening', 31, 7);
    const reading = mode === 'complete' ? makeDemoSection('Reading', 28, 6.5) : null;
    const mergedStats = new Map();
    for (const stat of [...listening.typeStats, ...(reading?.typeStats || [])]) {
      const current = mergedStats.get(stat.type) || { type: stat.type, correct: 0, total: 0 };
      current.correct += stat.correct;
      current.total += stat.total;
      mergedStats.set(stat.type, current);
    }
    const typeStats = [...mergedStats.values()].map(stat => ({
      ...stat,
      percentage: stat.total ? stat.correct / stat.total : 0
    }));
    const sorted = [...typeStats].sort((left, right) => right.percentage - left.percentage);
    const demoWriting = mode === 'complete' ? {
      task1: state.drafts.writing.task1,
      task2: state.drafts.writing.task2,
      started: true,
      submitted: true,
      grading: {
        status: 'ready',
        ready: true,
        task1Score: 6.5,
        task2Score: 7,
        writingScore: 7,
        taskStates: { task1: 'complete', task2: 'complete' },
        tasks: [
          {
            taskNumber: 1,
            taskScore: 6.5,
            wordCount: countWords(state.drafts.writing.task1),
            criteria: ['TA', 'CC', 'LR', 'GRA'].map((code, index) => ({
              code,
              name: criterionTitle(code, 1),
              bandScore: index === 1 || index === 3 ? 7 : 6.5,
              feedback: `Nhận xét minh họa cho tiêu chí ${criterionTitle(code, 1)}.`,
              components: [{
                code: `${code.toLowerCase()}_demo`,
                label: 'Nhận xét theo khía cạnh',
                summary: 'Điểm chính trong bài làm.',
                feedback: 'Gợi ý cụ thể để cải thiện ở lần viết tiếp theo.'
              }]
            }))
          },
          {
            taskNumber: 2,
            taskScore: 7,
            wordCount: countWords(state.drafts.writing.task2),
            criteria: ['TR', 'CC', 'LR', 'GRA'].map(code => ({
              code,
              name: criterionTitle(code, 2),
              bandScore: 7,
              feedback: `Nhận xét minh họa cho tiêu chí ${criterionTitle(code, 2)}.`,
              components: [{
                code: `${code.toLowerCase()}_demo`,
                label: 'Nhận xét theo khía cạnh',
                summary: 'Điểm chính trong bài làm.',
                feedback: 'Gợi ý cụ thể để cải thiện ở lần viết tiếp theo.'
              }]
            }))
          }
        ]
      }
    } : undefined;
    return {
      studentName: 'Học viên demo',
      className: 'IC-DEMO',
      completed: Boolean(reading),
      portalSyncStatus: 'synced',
      writing: demoWriting,
      result: {
        testTitle: 'Term Test 2 · Bản minh họa',
        listening,
        reading,
        summary: {
          totalCorrect: listening.correct + (reading?.correct || 0),
          totalQuestions: listening.total + (reading?.total || 0),
          averageBand: reading ? 6.75 : null
        },
        typeStats: sorted,
        performance: {
          best: sorted.slice(0, 1),
          needsImprovement: sorted.slice(-1),
          other: sorted.slice(1, -1)
        }
      }
    };
  }

  async function initialize() {
    elements.listeningTitle.textContent = testConfig.listening.title;
    elements.readingTitle.textContent = testConfig.reading.title;
    appendInstructions(elements.listeningInstructions, testConfig.listening.description);
    appendInstructions(elements.readingInstructions, testConfig.reading.description);
    renderQuestionControls(testConfig.listening, elements.listeningQuestions, 'listening');
    renderQuestionControls(testConfig.reading, elements.readingQuestions, 'reading');
    updateAnswerCount('listening');
    updateAnswerCount('reading');
    setupWritingExam();
    await initializeStudentMemory();

    if (demoMode) {
      if ((demoMode === 'writing-prep' || demoMode === 'writing') && writingConfig) {
        state.studentName = 'Học viên demo';
        state.completed = true;
        state.writingStarted = demoMode === 'writing';
        state.writingSubmitted = false;
        showNotice(demoMode === 'writing'
          ? 'Bản demo: học viên đang làm Writing; kết quả vẫn được giữ kín.'
          : 'Bản demo: Reading đã được chấm và ghi Portal; học viên chuẩn bị vào Writing.', 'success');
        setStage(demoMode === 'writing' ? 'writing' : 'writing-prep');
        return;
      }
      if (demoMode === 'complete' && writingConfig) {
        state.writingSubmitted = true;
        state.drafts.writing.task1 = 'This is a sample Task 1 response for demonstrating the final copy-ready Writing area.';
        state.drafts.writing.task2 = 'This is a sample Task 2 response. The live page preserves the student essay exactly as typed and provides a separate copy button for each task.';
      }
      if (demoMode === 'listening-only' && writingConfig) {
        state.writingSubmitted = false;
        showNotice('Bản demo: Listening đã được ghi nhận; kết quả vẫn được giữ kín cho tới khi nộp Writing.', 'success');
        setStage('listening-saved');
        return;
      }
      renderResult(buildDemoPayload(demoMode));
      showNotice(demoMode === 'complete'
        ? 'Bản demo: học viên đã hoàn thành Listening, Reading và Writing.'
        : 'Bản demo: học viên mới nộp Listening; Reading chưa bị tính điểm.', 'success');
      setStage('result');
      return;
    }

    if (!/^[A-Z0-9._-]{2,32}$/.test(classCode)) {
      elements.loadingView.hidden = true;
      showNotice('Link chưa có mã lớp hợp lệ. Hãy dùng dạng ?class=IC2139.', 'error');
      return;
    }

    try {
      const roster = await apiRequest(`/api/term-tests/roster?class=${encodeURIComponent(classCode)}&test=${encodeURIComponent(testConfig.slug)}`);
      populateRoster(roster);
      if (!state.roster.length && !testConfig.allowTemporaryStudents) {
        throw new Error('Lớp chưa có học viên trong hệ thống matching.');
      }
      if (state.attemptToken) {
        try {
          const resumed = await restoreAttemptFromServer();
          if (writingConfig && state.completed && state.writingSubmitted && !resumed?.writing?.submitted) {
            await saveWritingToServer('submit');
          }
        } catch (error) {
          showNotice(`Chưa đọc được bản lưu trên hệ thống: ${error.message}. Hệ thống đang dùng bản giữ trên máy.`, 'error');
        }
      }
      elements.readingStudentName.textContent = state.studentName;
      if (state.completed && state.attemptToken) {
        if (writingConfig && !state.writingSubmitted) {
          setStage(state.writingStarted ? 'writing' : 'writing-prep');
          if (state.writingStarted) hideNotice();
          else showNotice('Bài Reading đã được ghi. Bắt đầu Writing khi bạn sẵn sàng.', 'success');
          if (state.writingStarted && state.writingDirty) scheduleWritingSave(0);
        } else {
          setStage('result-ready');
          showNotice('Lượt làm đã hoàn tất. Nhấn “Xem kết quả” để mở lại.', 'success');
          if (writingConfig && state.writingSubmitted) await loadResult(elements.viewResult);
        }
      } else if (state.attemptToken) {
        if (state.readingDeadlineAt) {
          setStage('reading');
          startSectionDeadlineGuard('reading');
          hideNotice();
        } else {
          setStage('listening-saved');
          showNotice('Bài Listening đã được lưu. Bạn có thể tiếp tục Reading.', 'success');
        }
      } else {
        setStage('listening');
        startSectionDeadlineGuard('listening');
        hideNotice();
      }
    } catch (error) {
      elements.loadingView.hidden = true;
      showNotice(`Không thể mở bài test: ${error.message}`, 'error');
    }
  }

  initialize();
})();

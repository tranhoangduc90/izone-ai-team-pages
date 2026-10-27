(async function () {
  'use strict';

  const testConfig = window.TERM_TEST_CONFIG;
  const appConfig = window.TERM_TEST_APP_CONFIG;
  const root = document.getElementById('app');
  const query = new URLSearchParams(window.location.search);
  const classCode = (query.get('class') || '').trim().toUpperCase();
  const requestedDemo = query.get('demo') || '';
  const writingConfig = window.TERM_TEST_CONTENT?.writing || null;
  const demoMode = window.TERM_TEST_CONTENT?.variant === 'semantic-html'
    && ['complete', 'listening-only', 'writing-prep', 'writing', 'exam'].includes(requestedDemo)
    ? requestedDemo
    : '';
  const serverGradingMode = demoMode === 'exam' && query.get('grading') === 'server';

  if (!testConfig || !appConfig || !root) return;
  if(!window.IZONE_EXAM_CLOCK)await import('../shared/exam-clock.js?v=20261026-v1&resilience=20261027-v1');

  if (!classCode && !document.body.classList.contains('cbt-mode') && !demoMode) {
    const { redirectRememberedTestClass } = await import('../../shared/test-student-class.js?v=20261018-identity-v1');
    if (await redirectRememberedTestClass({ root, apiBase: appConfig.API_BASE_URL, testSlug: testConfig.slug })) return;
  }

  let paperIdentity = null;
  if (!document.body.classList.contains('cbt-mode') && !demoMode && classCode !== 'CODEXDEMO56') {
    try {
      const module = await import('../../shared/test-student-identity.js?v=20261018-identity-v1');
      paperIdentity = module.createTestStudentIdentity({ product: testConfig.slug, classCode,
        getStorages: availableStorages,
        requestIdentity: input => apiRequest(`/api/term-tests/${testConfig.slug}/student-identity`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
        }) });
      window.TERM_TEST_STORAGE_SCOPE = paperIdentity.current().scope;
      window.TERM_TEST_CHANGE_STUDENT = async () => {
        if ((await paperIdentity.forget()).status !== 'empty') return false;
        window.TERM_TEST_ALLOW_NAVIGATION = true; location.reload(); return true;
      };
    } catch {
      root.textContent = 'Chưa tải đủ phần mở bài. Hãy tải lại; nháp và lượt thi đã lưu vẫn được giữ.';
      return;
    }
  }
  const studentStorageScope = window.TERM_TEST_STORAGE_SCOPE || '';
  let storageKey = paperIdentity ? paperIdentity.current().keys?.state || ''
    : `izone-test:${testConfig.slug}:${classCode}${serverGradingMode ? ':server-grade' : ''}${studentStorageScope}`;
  if (classCode === 'CODEXDEMO56' && query.get('reset') === '1' && !window.TERM_TEST_BOOTSTRAP) {
    const uiStorageKey = `izone-test-ui:${testConfig.slug}:${classCode}${serverGradingMode ? ':server-grade' : ''}`;
    for (const storage of [sessionStorage, localStorage]) {
      try {
        storage.removeItem(storageKey);
        storage.removeItem(uiStorageKey);
      } catch {
        // Không cản mở lượt test mới nếu trình duyệt chặn storage.
      }
    }
    query.delete('reset');
    const nextQuery = query.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`);
  }
  const persistedSession = readSession();
  const incoming = window.TERM_TEST_BOOTSTRAP?.sessionState;
  const incomingIdentity = window.TERM_TEST_BOOTSTRAP?.restoredIdentity;
  const canUseIncoming = incoming && incomingIdentity?.testSlug === testConfig.slug
    && incomingIdentity.classCode === classCode && incomingIdentity.studentRef === incoming.studentRef
    && incomingIdentity.attemptToken === incoming.attemptToken;
  const restoredSession = canUseIncoming
    ? { ...incoming, ...(persistedSession.studentRef === incoming.studentRef
      && persistedSession.attemptToken === incoming.attemptToken ? persistedSession : {}) }
    : persistedSession;
  const state = {
    stage: 'loading',
    roster: [],
    className: classCode,
    studentRef: '',
    studentName: '',
    clientSubmissionId: '',
    examSessionToken: '',
    attemptToken: '',
    listeningStartedAt: '',
    readingStartedAt: '',
    writingStartedAt: '',
    listeningDeadlineAt: '',
    readingDeadlineAt: '',
    writingDeadlineAt: '',
    serverTimeOffsetMs: 0,
    audioVolume: 1,
    completed: false,
    writingStarted: false,
    writingSubmitted: false,
    writingDirty: false,
    writingServerRevision: null,
    writingConfirmedDraft: null,
    writingConflict: null,
    writingRecovery: [],
    writingRevision: 0,
    writingAckRevision: 0,
    drafts: { listening: {}, reading: {}, writing: { outline: '', task1: '', task2: '' } },
    draftRevisions: { listening: 0, reading: 0 },
    draftAckRevisions: { listening: 0, reading: 0 },
    writingLayout: { activeTask: 'task2', splits: {} },
    frozenAnswers: { listening: null, reading: null },
    testGrades: { listening: null, reading: null, writing: null },
    result: null,
    ...restoredSession,
    drafts: {
      listening: { ...(restoredSession.drafts?.listening || {}) },
      reading: { ...(restoredSession.drafts?.reading || {}) },
      writing: {
        outline: String(restoredSession.drafts?.writing?.outline || ''),
        task1: String(restoredSession.drafts?.writing?.task1 || ''),
        task2: String(restoredSession.drafts?.writing?.task2 || '')
      }
    },
    writingLayout: {
      activeTask: String(restoredSession.writingLayout?.activeTask || 'task2'),
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
    },
    writingRevision: Number(restoredSession.writingRevision) || 0,
    writingAckRevision: Number(restoredSession.writingAckRevision) || 0,
    testGrades: {
      listening: restoredSession.testGrades?.listening || null,
      reading: restoredSession.testGrades?.reading || null,
      writing: restoredSession.testGrades?.writing || null
    },
    writingServerRevision: Number.isSafeInteger(restoredSession.writingServerRevision)
      && restoredSession.writingServerRevision >= 0 ? restoredSession.writingServerRevision : null,
    writingRecovery: Array.isArray(restoredSession.writingRecovery) ? restoredSession.writingRecovery.slice(0, 5) : []
  };
  if(!demoMode || serverGradingMode)window.IZONE_EXAM_CLOCK?.configure(() => apiRequest(`/api/term-tests/${testConfig.slug}/clock`));

  // exam-journal-20261023: mặc định tắt, khởi tạo nền và chỉ đọc state.
  let examJournal = null;
  if (appConfig.EXAM_JOURNAL_ENABLED === true) {
    void import('../shared/exam-journal/bridge.mjs?v=20261023-v1&journal=20261024-startup-v2&resilience=20261027-v1').then(({ connectExamJournal }) => {
      examJournal = connectExamJournal({ enabled: true,
        endpoint: appConfig.EXAM_JOURNAL_BASE_URL || appConfig.API_BASE_URL + '/api/term-tests/' + testConfig.slug,
        testSlug: testConfig.slug, build: appConfig.EXAM_JOURNAL_BUILD || 'unknown',
        getState: () => ({ ...state, classCode,
          generation: typeof miniGeneration === 'number' ? miniGeneration : Number(state.generation || 0),
          clientRunId: window.TERM_TEST_BOOTSTRAP?.clientRunId || '', examSessionId: window.TERM_TEST_BOOTSTRAP?.examSessionId || '', historyEpoch: window.TERM_TEST_BOOTSTRAP?.historyEpoch || '' })
      });
    }).catch(() => {});
  }

  function readSession() {
    if (!storageKey) return {};
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

  function availableStorages() {
    const result = [];
    for (const name of ['sessionStorage', 'localStorage']) {
      try { if (window[name]) result.push(window[name]); } catch { /* Một kho bị chặn không chặn kho còn lại. */ }
    }
    return result;
  }

  function saveSession() {
    try { if (typeof examJournal !== 'undefined') examJournal?.stateChanged('save_requested'); } catch {}
    if (window.K56_DEMO_RESETTING) return;
    if (!storageKey) return false;
    const serialized = JSON.stringify({
      studentRef: state.studentRef,
      studentName: state.studentName,
      clientSubmissionId: state.clientSubmissionId,
      examSessionToken: state.examSessionToken,
      attemptToken: state.attemptToken,
      examMode: state.examMode,
      listeningSubmitted: state.listeningSubmitted,
      readingSubmitted: state.readingSubmitted,
      nextSection: state.nextSection,
      listeningStartedAt: state.listeningStartedAt,
      readingStartedAt: state.readingStartedAt,
      writingStartedAt: state.writingStartedAt,
      listeningDeadlineAt: state.listeningDeadlineAt,
      readingDeadlineAt: state.readingDeadlineAt,
      writingDeadlineAt: state.writingDeadlineAt,
      serverTimeOffsetMs: state.serverTimeOffsetMs,
      audioVolume: state.audioVolume,
      annotationRunId: state.annotationRunId,
      identityConfirmed: state.identityConfirmed,
      completed: state.completed,
      writingStarted: state.writingStarted,
      writingSubmitted: state.writingSubmitted,
      writingDirty: state.writingDirty,
      writingServerRevision: state.writingServerRevision,
      writingConfirmedDraft: state.writingConfirmedDraft,
      writingConflict: state.writingConflict,
      writingRecovery: state.writingRecovery,
      writingRevision: state.writingRevision,
      writingAckRevision: state.writingAckRevision,
      drafts: state.drafts,
      pendingSubmissions: state.pendingSubmissions,
      draftRevisions: state.draftRevisions,
      draftAckRevisions: state.draftAckRevisions,
      writingLayout: state.writingLayout,
      frozenAnswers: state.frozenAnswers,
      testGrades: state.testGrades
    });
    let saved = false;
    for (const storage of availableStorages()) {
      try {
        storage.setItem(storageKey, serialized);
        if (storage.getItem(storageKey) === serialized) saved = true;
      } catch {
        // Bản Writing vẫn được lưu qua API; không làm gián đoạn bài thi nếu bộ nhớ máy đầy.
      }
    }
    let warning = document.getElementById('termLocalDraftWarning');
    if (!saved && !warning) {
      warning = document.createElement('aside');
      warning.id = 'termLocalDraftWarning'; warning.className = 'notice error'; warning.setAttribute('role', 'alert');
      warning.textContent = 'Trình duyệt chưa giữ được bản nháp trên thiết bị. Đừng đóng hoặc tải lại trang khi bài chưa lưu lên máy chủ; hãy sao chép nội dung cần giữ trước khi rời.';
      root.prepend(warning);
    }
    if (warning) warning.hidden = saved;
    return saved;
  }

  // Nhận deadline Listening đã được máy chủ bù sau một sự cố audio hợp lệ.
  let listeningAudioRevision = -1;
  window.addEventListener('term-test:listening-timing-updated', event => {
    const detail = event.detail || {};
    if (window.K56_LISTENING_AUDIO && detail.audioRecoveryVersion !== 2) return;
    if (detail.audioRecoveryVersion === 2) {
      if (!Number.isSafeInteger(detail.audioStateRevision) || detail.audioStateRevision < listeningAudioRevision) return;
    }
    if (detail.audioRecoveryVersion === 2 && (detail.examSessionToken !== state.examSessionToken
        || detail.studentRef !== state.studentRef || detail.classCode !== classCode
        || detail.testSlug !== testConfig.slug || detail.apiBase !== appConfig.API_BASE_URL
        || Number(detail.generation) !== Number(window.TERM_TEST_BOOTSTRAP?.generation || 0))) return;
    const deadlineAt = String(event.detail?.listeningDeadlineAt || '');
    const serverNow = String(event.detail?.serverNow || '');
    if (!Number.isFinite(Date.parse(deadlineAt))) return;
    if (detail.audioRecoveryVersion === 2) listeningAudioRevision = detail.audioStateRevision;
    state.listeningDeadlineAt = deadlineAt;
    if (Number.isFinite(Date.parse(serverNow))) {
      state.serverTimeOffsetMs = (window.IZONE_EXAM_CLOCK?.offset(serverNow) ?? (Date.parse(serverNow) - Date.now()));
    }
    if (detail.audioRecoveryVersion === 2 && !state.listeningSubmitted
        && elements.listeningView.dataset.listeningSubmitting !== 'true'
        && (window.IZONE_EXAM_CLOCK?.now(state.serverTimeOffsetMs) ?? (Date.now() + state.serverTimeOffsetMs)) < Date.parse(state.listeningDeadlineAt)) {
      delete elements.listeningView.dataset.listeningTimeExpired;
      state.frozenAnswers.listening = null;
      setAnswerControlsLocked('listening', false);
    }
    saveSession();
  });

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
        <p>Kết quả Listening và Reading đang được giữ kín. Khi sẵn sàng, hãy bắt đầu Writing Task 2.</p>
        <ul class="writing-prep-list">
          <li>Tổng thời gian: ${writingConfig.totalMinutes || 55} phút, gồm ${writingConfig.planningMinutes || 15} phút lập dàn ý và 40 phút viết bài.</li>
          <li>Task 2: viết ít nhất 250 từ.</li>
          <li>Bài viết được tự lưu trên hệ thống; đóng tab rồi mở lại vẫn có thể tiếp tục.</li>
        </ul>
        <button class="button button-primary" id="startWriting" type="button">Bắt đầu Writing</button>
      </section>

      <form class="panel writing-exam-view" id="writingView" hidden>
        <header class="writing-exam-header">
          <div>
            <p class="eyebrow">Phần 3 · Academic Writing</p>
            <h2>Writing Task 2</h2>
          </div>
          <nav class="writing-task-tabs" id="writingTaskTabs" aria-label="Chọn Writing Task" hidden></nav>
          <button class="button button-primary writing-submit" id="submitWriting" type="submit">Nộp bài</button>
        </header>
        <section class="writing-save-conflict" id="writingConflict" role="status" hidden>
          <h3>Có hai bản bài viết khác nhau</h3>
          <p>Bài đang viết vẫn được giữ trên máy. Hãy đối chiếu bản đã lưu trước khi tiếp tục.</p>
          <div id="writingConflictDrafts"></div>
          <div class="form-actions">
            <button class="button button-secondary" id="writingUseServer" type="button">Dùng bản trên hệ thống</button>
            <button class="button button-primary" id="writingKeepLocal" type="button">Tiếp tục bản đang viết trên máy</button>
          </div>
        </section>
        <div class="writing-workspace" id="writingWorkspace"></div>
        <footer class="writing-task-footer" ${writingConfig.tasks?.length === 1 ? 'hidden' : ''}>
          <button class="button button-secondary" id="previousWritingTask" type="button">← Previous Task</button>
          <span id="writingTaskPosition">Task 2 · 1 / 1</span>
          <button class="button button-primary" id="nextWritingTask" type="button">Next Task →</button>
        </footer>
      </form>
      <details class="panel writing-recovery" id="writingRecovery" hidden>
        <summary>Bản bài viết được giữ để phục hồi</summary>
        <p>Các bản dưới đây được giữ trên thiết bị này. Bạn có thể đọc và sao chép nội dung khi cần.</p>
        <div id="writingRecoveryDrafts"></div>
      </details>
  ` : '';

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
      </section>

      <form class="panel test-panel" id="listeningView" hidden>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Phần 1</p>
            <h2 id="listeningTitle"></h2>
            <ul class="instructions" id="listeningInstructions"></ul>
          </div>
          <span class="answer-count" id="listeningCount">0/${testConfig.listening.controls.length} đã nhập</span>
        </div>
        <div class="questions-grid" id="listeningQuestions"></div>
        <div class="form-actions">
          <button class="button button-primary" id="submitListening" type="submit">Nộp bài Listening</button>
        </div>
      </form>

      <section class="panel transition-card" id="listeningSavedView" hidden>
        <div class="transition-icon">✓</div>
        <p class="eyebrow">Đã chấm bài Listening</p>
        <h2>Điểm Listening đã được ghi độc lập</h2>
        <p>Bài Listening đã được lưu. Khi sẵn sàng, hãy tiếp tục làm Reading.</p>
        <div class="form-actions transition-actions">
          <button class="button button-primary" id="startReading" type="button">Bắt đầu bài Reading</button>
        </div>
      </section>

      <form class="panel test-panel" id="readingView" hidden>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Phần 2 · <span id="readingStudentName"></span></p>
            <h2 id="readingTitle"></h2>
            <ul class="instructions" id="readingInstructions"></ul>
          </div>
          <span class="answer-count" id="readingCount">0/${testConfig.reading.controls.length} đã nhập</span>
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
          ? 'Listening và Reading đã được chấm, phân tích. Writing đang được chấm riêng và sẽ hiện điểm khi đủ cả hai Task.'
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
        </div>
        <div id="writingSubmissionResult" hidden></div>
        <div id="questionDetails"></div>
        <div class="skill-performance-list" id="skillPerformanceSections"></div>
      </section>
    </main>
  `;

  const elements = Object.fromEntries([
    'notice', 'loadingView', 'identityView', 'identityTitle', 'classLabel', 'studentSelect',
    'listeningView', 'listeningTitle', 'listeningInstructions', 'listeningQuestions', 'listeningCount', 'submitListening',
    'listeningSavedView', 'startReading', 'readingView', 'readingTitle', 'readingInstructions',
    'readingQuestions', 'readingCount', 'readingStudentName', 'submitReading', 'resultReadyView',
    'viewResult', 'resultView', 'resultStudentName', 'resultMeta', 'summaryGrid',
    'skillPerformanceSections', 'questionDetails', 'resultStatus', 'continueReadingFromResult',
    'writingPrepView', 'startWriting', 'writingView', 'writingTaskTabs', 'writingWorkspace', 'submitWriting',
    'previousWritingTask', 'nextWritingTask', 'writingTaskPosition', 'writingSubmissionResult',
    'writingConflict', 'writingConflictDrafts', 'writingUseServer', 'writingKeepLocal',
    'writingRecovery', 'writingRecoveryDrafts'
  ].map(id => [id, document.getElementById(id)]));

  if (typeof window.TERM_TEST_CHANGE_STUDENT === 'function') {
    const change = document.createElement('button');
    change.type = 'button'; change.className = 'button button-secondary';
    change.id = 'termTestChangeStudent'; change.textContent = 'Đổi người học';
    change.addEventListener('click', async () => {
      // Giữ bản nháp theo đúng người trước khi rời; đồng hồ trên máy chủ vẫn chạy.
      if (!saveSession()) {
        showNotice('Chưa giữ được nháp trên thiết bị. Hãy giải phóng chỗ lưu hoặc sao chép bài trước khi đổi người.', 'error');
        return;
      }
      if (!await window.TERM_TEST_CHANGE_STUDENT()) showNotice('Chưa đổi được lựa chọn chung. Bài hiện tại vẫn được giữ.', 'error');
    });
    root.querySelector('.topbar').append(change);
  }

  const progressSteps = [...document.querySelectorAll('[data-progress]')];
  paperIdentity?.subscribe(() => {
    if (!state.studentRef) return;
    let notice = document.getElementById('termIdentityOtherTabNotice');
    if (!notice) { notice = document.createElement('p'); notice.id = 'termIdentityOtherTabNotice';
      notice.className = 'notice'; notice.setAttribute('role', 'status'); root.before(notice); }
    notice.textContent = 'Lựa chọn chung đã đổi ở tab khác. Bài tại đây vẫn giữ nguyên người và nháp; dùng Đổi người học nếu cần đổi tab này.';
  });
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

  function bindPaperStudent(student, resolution = null) {
    const binding = paperIdentity.select(student, { resolution });
    storageKey = binding.keys.state;
    Object.assign(state, { pendingSubmissions: {} }, binding.state, { studentRef: student.ref, studentName: student.name, identityConfirmed: true });
    elements.studentSelect.value = student.ref;
    renderQuestionControls(testConfig.listening, elements.listeningQuestions, 'listening');
    renderQuestionControls(testConfig.reading, elements.readingQuestions, 'reading');
    saveSession();
  }

  async function paperEntryRoster() {
    if (!paperIdentity) return null;
    if (state.studentRef && state.attemptToken) {
      const identity = await apiRequest(`/api/term-tests/${testConfig.slug}/attempt/active`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classCode, studentRef: state.studentRef, attemptToken: state.attemptToken,
          ...(state.examSessionToken ? { examSessionToken: state.examSessionToken } : {}), identityOnly: true })
      });
      if (!identity.found || identity.attemptToken !== state.attemptToken || !identity.studentName
          || (state.examSessionToken && identity.examSessionToken !== state.examSessionToken))
        throw new Error('Chưa xác minh được lượt đang làm. Nháp được giữ; hãy thử lại.');
      return { roster: { class: { name: classCode }, students: [{ ref: state.studentRef, name: identity.studentName }] }, selection: null };
    }
    const selected = await paperIdentity.resolveRemembered();
    if (selected.status === 'unique') return { roster: { class: { name: classCode }, students: [selected.student] }, selection: selected };
    if (paperIdentity.read().status === 'ok' && ['missing', 'ambiguous'].includes(selected.status))
      showNotice('Chưa tìm được duy nhất hồ sơ có quyền làm bài này. Danh tính đã nhớ vẫn được giữ; hãy kiểm tra link hoặc dùng Đổi người học.', 'error');
    return null;
  }

  async function prepareK56Attempt() {
    if (!state.studentRef) return;
    // Khóa lựa chọn trong lúc máy chủ gắn token; lỗi mở lượt cho chọn lại khi chưa bind.
    const studentRef = state.studentRef;
    elements.studentSelect.disabled = true;
    try {
      const response = await apiRequest(`/api/term-tests/${testConfig.slug}/attempt/prepare`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classCode, studentRef, mode: window.K56_EXAM_ORDER.requested() })
      });
      if (studentRef !== state.studentRef) throw new Error('Thông tin học viên đã thay đổi; không dùng lượt của người trước.');
      if (paperIdentity) {
        const token = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!token.test(response.attemptToken || '') || !token.test(response.examSessionToken || '')
            || (response.studentRef && response.studentRef !== studentRef)) throw new Error('Phiên trả về chưa khớp người học.');
        paperIdentity.prepared(studentRef).then(result => {
          if (!['ok', 'empty', 'not_selected'].includes(result.status)) showNotice('Lượt thi đã mở đúng người. Trình duyệt chưa ghi nhớ được cho bài khác.');
        }).catch(() => {});
      }
      await showPreparedAttempt(response);
    } finally {
      elements.studentSelect.disabled = isWritingIdentityBound();
    }
  }

  async function showPreparedAttempt(response) {
    const sameAttempt = !state.attemptToken || state.attemptToken === response.attemptToken;
    const modeChanged = window.K56_EXAM_ORDER.apply(state, response);
    for (const skill of ['listening', 'reading']) {
      if (!sameAttempt || Number(response[skill + 'DraftRevision'] || 0) >= Number(state.draftRevisions[skill] || 0)) {
        applySectionDraft(skill, response[skill + 'Draft'], response[skill + 'DraftRevision']);
      }
    }
    saveSession();
    if (response.completed) {
      await restoreAttemptFromServer();
      if (writingConfig && !state.writingSubmitted) setStage(state.writingStarted ? 'writing' : 'writing-prep');
      else { setStage('result-ready'); if (state.writingSubmitted) await loadResult(elements.viewResult); }
    } else if (response.nextSection === 'reading' && response.readingStartedAt) {
      elements.readingStudentName.textContent = state.studentName;
      setStage('reading');
    } else if (response.nextSection === 'listening' && response.listeningStartedAt) {
      setStage('listening');
    } else {
      showSectionReady(response.nextSection);
    }
    if (modeChanged || response.modeMismatch) showNotice('Lượt thi giữ thứ tự đã chọn trước đó. Link đã được cập nhật cho đúng lượt.', 'success');
    else hideNotice();
    // Nháp mới trên máy cần được gửi lại sau khi xác minh lượt, kể cả không gõ thêm.
    const resumedSkill = response.nextSection;
    if (sameAttempt && !response.completed && ['listening', 'reading'].includes(resumedSkill)
      && response[resumedSkill + 'StartedAt'] && !state[resumedSkill + 'Submitted']
      && !isSectionExpired(resumedSkill)
      && Number(state.draftRevisions[resumedSkill] || 0) > Number(state.draftAckRevisions[resumedSkill] || 0)) {
      scheduleSectionDraft(resumedSkill, 0);
    }
    if (sameAttempt && response.completed && writingConfig && state.writingStarted
      && !state.writingSubmitted && state.writingDirty && !state.writingConflict
      && validWritingRevision(state.writingServerRevision) && !writingTimeExpired()) {
      scheduleWritingSave(0);
    }
  }

  function showSectionReady(skill) {
    let panel = document.getElementById('k56SectionReady');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'k56SectionReady';
      panel.className = 'panel transition-card';
      const title = document.createElement('h2');
      const help = document.createElement('p');
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'button button-primary';
      panel.append(title, help, button);
      document.querySelector('.page-shell').append(panel);
    }
    const label = skill === 'reading' ? 'Reading' : 'Listening';
    panel.querySelector('h2').textContent = `Chuẩn bị phần ${label}`;
    panel.querySelector('p').textContent = 'Thông tin học viên đã xác nhận. Đồng hồ chỉ bắt đầu khi bạn bấm bắt đầu phần này.';
    const button = panel.querySelector('button');
    button.textContent = `Bắt đầu ${label}`;
    button.onclick = async () => {
      if (skill === 'reading') return startOrResumeReading(button);
      if (document.body.classList.contains('cbt-mode')) { window.TERM_TEST_ALLOW_NAVIGATION = true; window.location.reload(); return; }
      setBusy(button, true, 'Đang mở Listening...', 'Bắt đầu Listening');
      try {
        const started = await apiRequest(`/api/term-tests/${testConfig.slug}/session/start`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examSessionToken: state.examSessionToken })
        });
        state.listeningStartedAt = started.listeningStartedAt;
        state.listeningDeadlineAt = started.listeningDeadlineAt;
        state.serverTimeOffsetMs = (window.IZONE_EXAM_CLOCK?.offset(started.serverNow) ?? (Date.parse(started.serverNow) - Date.now()));
        saveSession(); hideNotice(); setStage('listening');
      } catch (error) { showNotice(`Chưa thể mở Listening: ${error.message}`, 'error'); }
      finally { setBusy(button, false, '', 'Bắt đầu Listening'); }
    };
    setStage('section-ready'); panel.hidden = false;
  }

  function setStage(stage) {
    elements.studentSelect.disabled = Boolean(state.studentRef && (state.attemptToken || state.examSessionToken
      || state.listeningStartedAt || state.listeningDeadlineAt));
    if (!demoMode) window.K56_EXAM_ORDER.deadlineGuard(state, elements);
    const ready = document.getElementById('k56SectionReady');
    if (ready) ready.hidden = stage !== 'section-ready';
    state.stage = stage;
    if (stage !== 'result') stopWritingGradingPolling();
    for (const view of views) view.hidden = true;
    const showConfirmedIdentity = document.body.classList.contains('cbt-mode')
      && Boolean(state.studentRef)
      && (!demoMode || demoMode === 'exam')
      && !['loading', 'result-ready', 'result'].includes(stage);
    if (showConfirmedIdentity) elements.identityView.hidden = false;
    // Answer Sheet không có phòng chờ CBT: luôn hiện định danh khi đã tải lớp.
    if (!document.body.classList.contains('cbt-mode') && !demoMode) {
      elements.identityView.hidden = stage === 'loading';
      // Lượt đã nộp phải tiếp tục gắn với cùng học viên, không đổi người giữa các kỹ năng.
      elements.studentSelect.disabled = Boolean(state.studentRef && (state.attemptToken || state.examSessionToken
      || state.listeningStartedAt || state.listeningDeadlineAt));
    }
    const activeProgress = stage === 'section-ready' ? state.nextSection : stage === 'listening' || stage === 'listening-saved'
      ? 'listening'
      : stage === 'reading' ? 'reading'
        : stage === 'writing-prep' || stage === 'writing' ? 'writing'
          : stage === 'result-ready' || stage === 'result' ? 'result' : '';
    const order = [...window.K56_EXAM_ORDER.skills(state.examMode || window.K56_EXAM_ORDER.requested()), ...(writingConfig ? ['writing'] : []), 'result'];
    for (const [index, skill] of order.entries()) {
      const step = Array.from(progressSteps).find(item => item.dataset.progress === skill);
      step.textContent = `${index + 1}. ${skill === 'result' ? 'Kết quả' : skill[0].toUpperCase() + skill.slice(1)}`;
      step.parentElement.append(step);
    }
    const activeIndex = order.indexOf(activeProgress);
    for (const step of progressSteps) {
      const index = order.indexOf(step.dataset.progress);
      step.classList.toggle('active', index === activeIndex);
      const completed = step.dataset.progress === 'listening'
        ? Boolean(state.listeningSubmitted || state.result?.result?.listening)
        : step.dataset.progress === 'reading'
          ? Boolean(state.readingSubmitted || state.completed || state.result?.result?.reading)
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
      if (control.kind === 'pair') {
        const pair = document.createElement('div');
        pair.className = 'question-pair';
        for (const [index, key] of control.keys.entries()) {
          const pairField = document.createElement('input');
          pairField.type = 'text';
          pairField.autocomplete = 'off';
          pairField.maxLength = 120;
          pairField.placeholder = `Ô ${index + 1}`;
          pairField.name = `question-${key}`;
          pairField.dataset.number = key;
          pairField.value = state.drafts?.[skill]?.[key] || '';
          pairField.addEventListener('input', () => {
            state.drafts[skill][key] = pairField.value;
            state.draftRevisions[skill] = Math.max(
              Number(state.draftRevisions[skill]) || 0,
              Number(state.draftAckRevisions[skill]) || 0
            ) + 1;
            saveSession();
            updateAnswerCount(skill);
            scheduleSectionDraft(skill);
          });
          pair.append(pairField);
        }
        wrapper.append(number, pair);
        return wrapper;
      }
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
    const controls = skill === 'listening' ? testConfig.listening.controls : testConfig.reading.controls;
    const answers = collectAnswers(container);
    const answered = controls.filter(control => control.kind === 'pair'
      ? control.keys.every(key => Boolean(answers[key]))
      : Boolean(answers[String(control.number)]))
      .length;
    const total = controls.length;
    counter.textContent = `${answered}/${total} đã nhập`;
    return answered;
  }

  async function apiRequest(path, options = {}) {
    let journalRequest;
    try { if (typeof examJournal !== 'undefined') journalRequest = examJournal?.startRequest(path, options); } catch {}
    try { if (!journalRequest) journalRequest = window.EXAM_JOURNAL_STARTUP?.startRequest(path, options); } catch {}
    if (journalRequest?.requestId) { try { const headers = new Headers(options.headers || {}); headers.set('x-exam-journal-request-id', journalRequest.requestId); options = { ...options, headers: Object.fromEntries(headers) }; } catch {} }
    const journalRun = async () => {
    const match = path.match(/^\/api\/term-tests\/([^/]+)\/(listening|reading)$/);
    if (options.method !== 'POST' || !match) {
      const data = await rawApiRequest(path, options);
      // Những thao tác ngoài nộp L/R giữ contract hiện hành.
      return data;
    }
    const section = match[2], testSlug = match[1];
    const getOwner = () => JSON.stringify([storageKey, state.studentRef, state.examSessionToken, state.attemptToken, state.generation || 0]);
    const owner = getOwner();
    const body = { ...JSON.parse(options.body || '{}') };
    const { submitSection } = await import('../shared/section-submission.mjs?v=20261023-v1');
    const data = await submitSection({ state, section, body, testSlug, owner, getOwner, save: saveSession,
      send: value => rawApiRequest(path, { ...options, body: JSON.stringify(value) }),
      read: async value => {
        try { return await rawApiRequest(`/api/term-tests/${testSlug}/submission-status`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...value, section })
        }); } catch (error) {
          if (error.status === 404 && error.code === 'SUBMISSION_NOT_FOUND') return { ok: true, persisted: false };
          throw error;
        }
      }
    });
    // Chỉ trả bản đã được xác nhận; handler mới được chuyển phần.
    return data;

    };
    if (!journalRequest) return journalRun();
    try { const result = await journalRun(); try { journalRequest.done(result); } catch {} return result; }
    catch (error) { try { journalRequest.done(undefined, error); } catch {} throw error; }
  }

  async function rawApiRequest(path, options = {}) {
    if (window.K56_DEMO_RESETTING) throw new Error('Lượt demo đang được reset. Hãy chọn lại học viên sau khi tải trang.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`${appConfig.API_BASE_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: { ...(options.headers || {}) }
      });
      const data = await response.json().catch(() => ({}));
      if (window.K56_DEMO_RESETTING) throw new Error('Phản hồi thuộc lượt demo vừa reset đã được bỏ qua.');
      if (!response.ok) {
        const requestError = new Error(data.message || `Lỗi HTTP ${response.status}`);
        requestError.code = String(data.error || 'HTTP_ERROR'); requestError.status = response.status;
        const retryAfter = response.headers?.get('Retry-After');
        requestError.retryAfterMs = retryAfter == null ? 0 : /^\d+(?:\.\d+)?$/.test(retryAfter)
          ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0;
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

  function randomDelay(minimum, maximum) {
    return Math.floor(minimum + (Math.random() * (maximum - minimum + 1)));
  }

  const sectionDraftFlows = {
    listening: { timer: 0, forceTimer: 0, retryTimer: 0, notBefore: 0, promise: Promise.resolve() },
    reading: { timer: 0, forceTimer: 0, retryTimer: 0, notBefore: 0, promise: Promise.resolve() }
  };

  function currentSectionDraftFlow(skill) {
    const flow = sectionDraftFlows[skill];
    const owner = JSON.stringify([state.studentRef, state.attemptToken]);
    if (flow.owner !== owner) {
      window.clearTimeout(flow.timer); window.clearTimeout(flow.forceTimer); window.clearTimeout(flow.retryTimer);
      flow.owner = owner; flow.epoch = (flow.epoch || 0) + 1;
      flow.notBefore = 0; flow.timer = 0; flow.forceTimer = 0; flow.retryTimer = 0;
    }
    return flow;
  }

  async function saveSectionDraftSnapshot(skill, answers, revision) {
    if (demoMode) return null;
    const path = skill === 'listening'
      ? `/api/term-tests/${testConfig.slug}/listening/draft`
      : `/api/term-tests/${testConfig.slug}/reading/draft`;
    const token = skill === 'listening'
      ? { examSessionToken: state.examSessionToken }
      : { attemptToken: state.attemptToken };
    if (!Object.values(token)[0]) return null;
    const studentRef = state.studentRef, attemptToken = state.attemptToken;
    const response = await apiRequest(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...token, answers, revision })
    });
    if (studentRef !== state.studentRef || attemptToken !== state.attemptToken) return null;
    if (response.deadlineAt) {
      if (skill === 'listening') state.listeningDeadlineAt = response.deadlineAt;
      else state.readingDeadlineAt = response.deadlineAt;
    }
    if (response.serverNow) state.serverTimeOffsetMs = (window.IZONE_EXAM_CLOCK?.offset(response.serverNow) ?? (Date.parse(response.serverNow) - Date.now()));
    saveSession();
    return response;
  }

  function applySectionDraft(skill, answers, revision) {
    const normalizedRevision = Number(revision) || 0;
    state.drafts[skill] = { ...(answers || {}) };
    state.draftRevisions[skill] = normalizedRevision;
    state.draftAckRevisions[skill] = normalizedRevision;
    const container = skill === 'listening' ? elements.listeningQuestions : elements.readingQuestions;
    for (const field of container.querySelectorAll('[data-number]')) {
      field.value = state.drafts[skill][field.dataset.number] || '';
    }
    updateAnswerCount(skill);
    saveSession();
  }

  function queueSectionDraft(skill) {
    if (demoMode) return Promise.resolve(null);
    const flow = currentSectionDraftFlow(skill);
    window.clearTimeout(flow.timer);
    window.clearTimeout(flow.forceTimer);
    flow.timer = 0;
    flow.forceTimer = 0;
    const revision = Number(state.draftRevisions[skill]) || 0;
    const answers = { ...(state.drafts[skill] || {}) };
    const studentRef = state.studentRef, attemptToken = state.attemptToken;
    const epoch = flow.epoch;
    const sameOwner = () => studentRef === state.studentRef && attemptToken === state.attemptToken && epoch === flow.epoch;
    const operation = flow.promise.catch(() => undefined).then(async () => {
      if (!sameOwner()) return null;
      if (flow.notBefore > Date.now()) {
        scheduleSectionDraft(skill, flow.notBefore - Date.now());
        return null;
      }
      const response = await saveSectionDraftSnapshot(skill, answers, revision);
      if (!sameOwner()) return null;
      const acknowledgedRevision = Number(response?.revision) || revision;
      if (response?.accepted === false) {
        if ((Number(state.draftRevisions[skill]) || 0) <= acknowledgedRevision) {
          applySectionDraft(skill, response.draft, acknowledgedRevision);
        } else {
          state.draftAckRevisions[skill] = Math.max(Number(state.draftAckRevisions[skill]) || 0, acknowledgedRevision);
          scheduleSectionDraft(skill, 0);
        }
        return response;
      }
      state.draftAckRevisions[skill] = Math.max(Number(state.draftAckRevisions[skill]) || 0, acknowledgedRevision);
      saveSession();
      if ((Number(state.draftRevisions[skill]) || 0) > state.draftAckRevisions[skill]) scheduleSectionDraft(skill, 0);
      return response;
    });
    flow.promise = operation.catch(error => {
      if (!sameOwner()) return null;
      if (skill === 'reading' && error.code === 'READING_LOCKED') {
        if (studentRef === state.studentRef && attemptToken === state.attemptToken) {
          stopSectionDraftFlow(skill);
          if (!state.readingSubmitted && !state.completed) {
            showNotice('Reading không còn nhận nháp. Thay đổi trên máy chưa được lưu vào bài thi; hãy tải lại trang để kiểm tra trạng thái mới nhất.', 'error');
            elements.notice.scrollIntoView({ block: 'nearest' });
          }
        }
        return null;
      }
      window.clearTimeout(flow.retryTimer);
      const retryDelay = Math.max(4000, Number(error.retryAfterMs) || 0) + randomDelay(0, 4000);
      flow.notBefore = Date.now() + retryDelay;
      flow.retryTimer = window.setTimeout(() => {
        if (sameOwner() && !state.completed && !state[skill + 'Submitted']) scheduleSectionDraft(skill, 0);
      }, retryDelay);
      return null;
    });
    return flow.promise;
  }

  function scheduleSectionDraft(skill, delay = null) {
    if (demoMode || (skill === 'listening' && !state.examSessionToken) || (skill === 'reading' && !state.attemptToken)) return;
    const flow = currentSectionDraftFlow(skill);
    const studentRef = state.studentRef, attemptToken = state.attemptToken;
    const send = () => {
      if (studentRef === state.studentRef && attemptToken === state.attemptToken
        && !state.completed && !state[skill + 'Submitted']) return queueSectionDraft(skill);
    };
    window.clearTimeout(flow.timer);
    window.clearTimeout(flow.retryTimer);
    const idleDelay = Math.max(flow.notBefore - Date.now(), Number.isFinite(delay) ? Math.max(0, delay) : randomDelay(2_000, 5_000));
    flow.timer = window.setTimeout(send, idleDelay);
    if (!flow.forceTimer && idleDelay > 0) {
      flow.forceTimer = window.setTimeout(send, Math.max(idleDelay, randomDelay(10_000, 15_000)));
    }
  }

  function stopSectionDraftFlow(skill) {
    const flow = sectionDraftFlows[skill];
    window.clearTimeout(flow.timer);
    window.clearTimeout(flow.forceTimer);
    window.clearTimeout(flow.retryTimer);
    flow.epoch = (flow.epoch || 0) + 1;
    flow.timer = 0; flow.forceTimer = 0; flow.retryTimer = 0;
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
    return Number.isFinite(deadline) && (window.IZONE_EXAM_CLOCK?.now(state.serverTimeOffsetMs) ?? (Date.now() + (Number(state.serverTimeOffsetMs) || 0))) >= deadline;
  }

  let writingSaveTimer = 0;
  let writingForceSaveTimer = 0;
  let writingRetryTimer = 0;
  let writingSavePromise = Promise.resolve();
  let writingGradingPollTimer = 0;
  let writingGradingPollStartedAt = 0;
  let writingGradingPollCount = 0;
  let writingGradingPollInFlight = false;
  let writingGradingRefreshRequested = false;
  let writingGradingStreamController = null;
  let writingGradingStreamReconnectTimer = 0;
  let writingGradingStreamFailureCount = 0;
  let writingGradingStreamUnsupported = false;

  function shouldWaitForWritingGrading() {
    const grading = state.result?.writing?.grading;
    return Boolean(
      !demoMode
      && state.attemptToken
      && state.writingSubmitted
      && !grading?.ready
      && grading?.status !== 'review_required'
    );
  }

  function stopWritingGradingStream() {
    window.clearTimeout(writingGradingStreamReconnectTimer);
    writingGradingStreamReconnectTimer = 0;
    writingGradingStreamController?.abort();
    writingGradingStreamController = null;
    writingGradingStreamFailureCount = 0;
  }

  function stopWritingGradingPolling() {
    window.clearTimeout(writingGradingPollTimer);
    writingGradingPollTimer = 0;
    writingGradingPollStartedAt = 0;
    writingGradingPollCount = 0;
    writingGradingRefreshRequested = false;
    stopWritingGradingStream();
  }

  function scheduleWritingGradingStreamReconnect() {
    if (!shouldWaitForWritingGrading() || writingGradingStreamUnsupported || writingGradingStreamReconnectTimer) return;
    const delays = [1_000, 2_000, 5_000, 10_000, 30_000];
    const delay = delays[Math.min(writingGradingStreamFailureCount, delays.length - 1)];
    writingGradingStreamFailureCount += 1;
    writingGradingStreamReconnectTimer = window.setTimeout(() => {
      writingGradingStreamReconnectTimer = 0;
      startWritingGradingStream();
    }, delay);
  }

  async function startWritingGradingStream() {
    if (
      !shouldWaitForWritingGrading()
      || writingGradingStreamUnsupported
      || writingGradingStreamController
      || writingGradingStreamReconnectTimer
    ) return;

    const controller = new AbortController();
    writingGradingStreamController = controller;
    try {
      const response = await fetch(`${appConfig.API_BASE_URL}/api/term-tests/result/stream`, {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ attemptToken: state.attemptToken }),
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok || !response.body) {
        if ([404, 405].includes(response.status)) writingGradingStreamUnsupported = true;
        throw new Error(`RESULT_STREAM_HTTP_${response.status}`);
      }

      writingGradingStreamFailureCount = 0;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (shouldWaitForWritingGrading()) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');
        if (buffer.length > 64 * 1024) throw new Error('RESULT_STREAM_TOO_LARGE');
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const eventName = block.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim();
          if (eventName === 'ready') {
            writingGradingRefreshRequested = true;
            controller.abort();
            await refreshWritingGrading();
            return;
          }
          if (eventName === 'close') return;
          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      // Polling vẫn hoạt động; chỉ nối lại kênh tín hiệu khi lỗi mạng có thể là tạm thời.
    } finally {
      if (writingGradingStreamController === controller) writingGradingStreamController = null;
      if (shouldWaitForWritingGrading()) scheduleWritingGradingStreamReconnect();
    }
  }

  async function refreshWritingGrading() {
    if (demoMode || !state.attemptToken) return;
    if (writingGradingPollInFlight) {
      writingGradingRefreshRequested = true;
      return 'checking';
    }
    writingGradingRefreshRequested = false;
    writingGradingPollInFlight = true;
    try {
      const wasReady = Boolean(state.result?.writing?.grading?.ready);
      const payload = await apiRequest('/api/term-tests/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptToken: state.attemptToken })
      });
      applyWritingFromServer(payload.writing, Boolean(payload.writing?.submitted));
      if (payload.writing?.grading?.ready) state.manualPendingWritingAttemptToken = '';
      renderResult(payload);
      if (payload.writing?.grading?.ready) {
        stopWritingGradingPolling();
        if (!wasReady) showNotice('Bài Writing đã được chấm xong. Điểm và phân tích chi tiết đã hiển thị bên dưới.', 'success');
      }
      return payload.writing?.grading?.ready ? 'ready' : 'pending';
    } catch {
      // Việc chấm vẫn nằm trên máy chủ; lần kế tiếp tiếp tục kiểm tra mà không làm mất màn hình kết quả.
      return 'unavailable';
    } finally {
      writingGradingPollInFlight = false;
      if (writingGradingRefreshRequested && !state.result?.writing?.grading?.ready) {
        writingGradingRefreshRequested = false;
        window.queueMicrotask(() => refreshWritingGrading());
      } else if (!state.result?.writing?.grading?.ready) {
        scheduleWritingGradingRefresh();
      }
    }
  }

  function scheduleWritingGradingRefresh() {
    if (writingGradingPollTimer) return;
    const grading = state.result?.writing?.grading;
    if (
      demoMode
      || !state.writingSubmitted
      || grading?.ready
      || grading?.status === 'review_required'
    ) return;
    const availableAt = Date.parse(grading?.availableAt || '');
    const serverNow = (window.IZONE_EXAM_CLOCK?.now(state.serverTimeOffsetMs) ?? (Date.now() + (Number(state.serverTimeOffsetMs) || 0)));
    if (grading?.status === 'awaiting_release' && Number.isFinite(availableAt) && availableAt > serverNow) {
      // Chỉ hẹn tải lại API; không dùng đồng hồ trình duyệt để tự công bố điểm.
      writingGradingPollTimer = window.setTimeout(() => {
        writingGradingPollTimer = 0;
        writingGradingPollStartedAt = Date.now();
        writingGradingPollCount = 0;
        refreshWritingGrading();
      }, Math.min(2_147_483_647, Math.max(1_000, availableAt - serverNow)));
      return;
    }
    if (!writingGradingPollStartedAt) writingGradingPollStartedAt = Date.now();
    if (Date.now() - writingGradingPollStartedAt > 45 * 60 * 1000) return;
    startWritingGradingStream();
    if (writingGradingPollTimer) return;
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
    const outlineEditor = document.querySelector('[data-writing-outline]');
    if (outlineEditor && outlineEditor.value !== state.drafts.writing.outline) {
      outlineEditor.value = state.drafts.writing.outline || '';
    }
    for (const editor of document.querySelectorAll('[data-writing-task]')) {
      const value = state.drafts.writing[editor.dataset.writingTask] || '';
      if (editor.value !== value) editor.value = value;
      const counter = editor.closest('.writing-answer-pane')?.querySelector('.writing-editor-meta strong');
      if (counter) counter.textContent = `${countWords(value)} từ`;
    }
  }

  // Nhận snapshot hai Task; so nguyên văn để xác nhận đúng bài, không suy từ số HTTP.
  function serverWritingOutlineSupported() {
    return typeof testConfig !== 'undefined' && ['term-test-1-k56','term-test-2-k56'].includes(testConfig.slug);
  }

  function writingSnapshot(value = state.drafts.writing) {
    return { task1: String(value?.task1 || ''), task2: String(value?.task2 || ''),
      ...(serverWritingOutlineSupported() ? { outline: String(value?.outline || '') } : {}) };
  }

  function sameWriting(left, right) {
    const a = writingSnapshot(left), b = writingSnapshot(right);
    return a.task1 === b.task1 && a.task2 === b.task2 && (!serverWritingOutlineSupported() || a.outline === b.outline);
  }

  function validWritingRevision(value) {
    return Number.isSafeInteger(value) && value >= 0;
  }

  // Giữ bản trước khi đổi sang bản khác; đầu ra có thể đọc/sao chép ở mục phục hồi.
  function preserveWritingRecovery(reason, value = state.drafts.writing) {
    const draft = writingSnapshot(value);
    const outline = String(value?.outline || '');
    if (!draft.task1 && !draft.task2 && !outline) return;
    if (!state.writingRecovery.some(item => sameWriting(item, draft) && String(item.outline || '') === outline)) {
      state.writingRecovery.unshift({ ...draft, outline, reason, savedAt: new Date().toISOString() });
      state.writingRecovery = state.writingRecovery.slice(0, 5);
    }
    renderWritingRecovery();
  }

  function appendWritingPreview(container, title, draft) {
    const heading = document.createElement('h4'); heading.textContent = title;
    container.append(heading);
    for (const task of (writingConfig.tasks || [])) {
      const label = document.createElement('label'); label.textContent = task.label || task.id;
      const text = document.createElement('textarea');
      text.readOnly = true; text.value = String(draft?.[task.id] || '');
      text.setAttribute('aria-label', `${title} · ${task.label || task.id}`);
      label.append(text); container.append(label);
    }
    if (draft?.outline) {
      const label = document.createElement('label'); label.textContent = 'Dàn ý giữ trên máy';
      const text = document.createElement('textarea'); text.readOnly = true; text.value = String(draft.outline);
      text.setAttribute('aria-label', `${title} · Dàn ý`); label.append(text); container.append(label);
    }
  }

  function renderWritingRecovery() {
    if (!elements.writingRecovery) return;
    elements.writingRecovery.hidden = state.writingRecovery.length === 0;
    elements.writingRecoveryDrafts.replaceChildren();
    state.writingRecovery.forEach((draft, index) => appendWritingPreview(
      elements.writingRecoveryDrafts, `Bản giữ lại ${index + 1}`, draft
    ));
  }

  function writingTimeExpired() {
    return Boolean(state.writingConflict?.timedOut
      || elements.writingView?.dataset.writingTimeExpired === 'true'
      || (state.writingDeadlineAt && (window.IZONE_EXAM_CLOCK?.now(state.serverTimeOffsetMs) ?? (Date.now() + state.serverTimeOffsetMs)) > Date.parse(state.writingDeadlineAt)));
  }

  function renderWritingConflict() {
    if (!elements.writingConflict) return;
    elements.writingConflict.hidden = !state.writingConflict;
    elements.writingConflictDrafts.replaceChildren();
    if (!state.writingConflict) return;
    appendWritingPreview(elements.writingConflictDrafts, 'Bản đang viết trên máy', state.drafts.writing);
    appendWritingPreview(elements.writingConflictDrafts, 'Bản đã lưu trên hệ thống', state.writingConflict);
    elements.writingKeepLocal.disabled = state.writingSubmitted || writingTimeExpired();
  }

  function setWritingConflict(writing) {
    window.clearTimeout(writingSaveTimer); window.clearTimeout(writingForceSaveTimer);
    window.clearTimeout(writingRetryTimer); writingForceSaveTimer = 0;
    state.writingConflict = { ...writing, ...writingSnapshot(writing) };
    state.writingDirty = true;
    renderWritingConflict(); saveSession();
    setWritingSaveStatus('Có hai bản khác nhau · bài trên máy được giữ nguyên');
  }

  function resolveWritingConflict(useServer) {
    const server = state.writingConflict;
    if (!server || !validWritingRevision(server.revision)) return;
    if (!useServer && (state.writingSubmitted || writingTimeExpired())) return;
    preserveWritingRecovery('Trước khi chọn bản bài viết');
    preserveWritingRecovery('Bản hệ thống trước khi chọn', server);
    state.writingConflict = null;
    state.writingServerRevision = server.revision;
    state.writingConfirmedDraft = writingSnapshot(server);
    if (useServer) {
      applyWritingFromServer(server, true);
      setWritingSaveStatus('Đang dùng bản đã lưu trên hệ thống');
    } else {
      // Chỉ người học chọn rõ mới tạo ý định sửa từ phiên bản khác; không tự vượt xung đột.
      state.writingRevision += 1; state.writingDirty = true;
      renderWritingConflict(); saveSession(); scheduleWritingSave(0);
    }
  }

  function applyWritingFromServer(writing, forceDrafts = false) {
    if (!writingConfig || !writing) return;
    const hasRevision = validWritingRevision(writing.revision);
    const knownRevision = state.writingConflict?.revision ?? state.writingServerRevision;
    if (hasRevision && validWritingRevision(knownRevision) && writing.revision < knownRevision) return;
    // Bản cũ chưa có confirmed snapshot vẫn giữ bài local khác canonical để người học chọn rõ.
    if (!state.writingConfirmedDraft && !sameWriting(state.drafts.writing, writing)
      && (state.drafts.writing.task1 || state.drafts.writing.task2
        || (serverWritingOutlineSupported() && state.drafts.writing.outline))) state.writingDirty = true;
    state.writingStarted = Boolean(writing.started || state.writingStarted);
    state.writingDeadlineAt = writing.deadlineAt || state.writingDeadlineAt;
    if (writing.serverNow) state.serverTimeOffsetMs = (window.IZONE_EXAM_CLOCK?.offset(writing.serverNow) ?? (Date.parse(writing.serverNow) - Date.now()));
    if (writing.submitted && !sameWriting(state.drafts.writing, writing)) {
      preserveWritingRecovery('Bài trên máy khác bản đã nộp');
    }
    if (!forceDrafts && !writing.submitted && state.writingDirty && !sameWriting(state.drafts.writing, writing)) {
      const basedOnKnownDraft = hasRevision && state.writingConfirmedDraft
        && sameWriting(state.writingConfirmedDraft, writing)
        && writing.revision === state.writingServerRevision;
      if (!basedOnKnownDraft && hasRevision) setWritingConflict(writing);
      renderWritingRecovery(); saveSession(); return;
    }
    const useServerDraft = forceDrafts || writing.submitted || !state.writingDirty;
    if (useServerDraft) {
      // Term 1/2 khôi phục dàn ý cùng revision; bài khác giữ hành vi hiện có.
      state.drafts.writing = { ...state.drafts.writing, ...writingSnapshot(writing) };
      state.writingDirty = false;
      state.writingConflict = null;
    }
    state.writingSubmitted = Boolean(writing.submitted || state.writingSubmitted);
    if (hasRevision) {
      state.writingServerRevision = writing.revision;
      state.writingAckRevision = writing.revision;
      state.writingConfirmedDraft = writingSnapshot(writing);
    }
    syncWritingEditors(); renderWritingConflict(); renderWritingRecovery(); saveSession();
  }

  function writingPayload(action) {
    return { attemptToken: state.attemptToken, revision: Number(state.writingRevision) || 0,
      ...(validWritingRevision(state.writingServerRevision) ? { baseRevision: state.writingServerRevision } : {}),
      action, outline: String(state.drafts.writing.outline || ''), ...writingSnapshot() };
  }

  async function saveWritingToServer(action) {
    if (demoMode) return { writing: null };
    if (!state.attemptToken) throw new Error('Chưa có mã lượt làm để lưu Writing.');
    window.clearTimeout(writingSaveTimer); window.clearTimeout(writingForceSaveTimer);
    window.clearTimeout(writingRetryTimer); writingForceSaveTimer = 0;
    const editRevision = state.writingRevision;
    const payload = writingPayload(action);
    const studentRef = state.studentRef;
    // Hàng đợi bao gồm xử lý phản hồi; request kế tiếp chỉ lấy base sau khi bản trước đã được xác nhận.
    const operation = writingSavePromise.catch(() => undefined).then(async () => {
      if (studentRef !== state.studentRef || payload.attemptToken !== state.attemptToken) {
        const error = new Error('Đã đổi học viên; không gửi bài của lượt trước.');
        error.code = 'WRITING_IDENTITY_CHANGED'; throw error;
      }
      if (state.writingConflict && !(action === 'submit' && writingTimeExpired())) {
        const error = new Error('Có hai bản bài viết khác nhau. Hãy chọn bản cần tiếp tục.');
        error.code = 'WRITING_REVISION_CONFLICT'; throw error;
      }
      if (action !== 'start' && !validWritingRevision(state.writingServerRevision) && !writingTimeExpired()) {
        const error = new Error('Chưa đọc được bản lưu để xác nhận. Bài vẫn được giữ trên máy; hãy tải lại trang khi kết nối ổn định.');
        error.code = 'WRITING_CLIENT_UPDATE_REQUIRED'; throw error;
      }
      if (validWritingRevision(state.writingServerRevision)) payload.baseRevision = state.writingServerRevision;
      const response = await apiRequest('/api/term-tests/writing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (studentRef !== state.studentRef || payload.attemptToken !== state.attemptToken) {
        const error = new Error('Đã đổi học viên; không dùng phản hồi của lượt trước.');
        error.code = 'WRITING_IDENTITY_CHANGED'; throw error;
      }
      const writing = response.writing;
      if (response.ok !== true || !writing || !validWritingRevision(writing.revision)
        || typeof writing.accepted !== 'boolean'
        || (serverWritingOutlineSupported() && typeof writing.outline !== 'string')) {
        throw new Error('Chưa có xác nhận lưu bài hợp lệ. Bài vẫn được giữ trên máy.');
      }
      const knownRevision = state.writingConflict?.revision ?? state.writingServerRevision;
      if (validWritingRevision(knownRevision) && writing.revision < knownRevision) {
        throw new Error('Phản hồi là bản cũ hơn bản đã biết. Bài trên máy vẫn được giữ nguyên.');
      }
      if (writing.accepted && action !== 'start' && !sameWriting(payload, writing)) {
        throw new Error('Xác nhận không khớp bài vừa gửi. Bài trên máy vẫn được giữ nguyên.');
      }
      if (writing.submitted) {
        applyWritingFromServer(writing, true);
        setWritingSaveStatus(writing.accepted ? 'Đã nộp và lưu trên hệ thống'
          : 'Hệ thống đã chốt bản đã lưu · bản khác trên máy được giữ để phục hồi');
      } else if (!writing.accepted) {
        if (writing.reason === 'deadline_expired') {
          preserveWritingRecovery('Bản chưa được nhận khi hết giờ');
          applyWritingFromServer(writing, true);
          setWritingSaveStatus('Đã hết giờ · hệ thống giữ bản đã lưu đúng hạn');
        } else {
          setWritingConflict(writing);
        }
      } else if (action === 'start') {
        applyWritingFromServer(writing);
      } else {
        if (!sameWriting(payload, writing)) throw new Error('Xác nhận không khớp bài vừa gửi. Bài trên máy vẫn được giữ nguyên.');
        state.writingServerRevision = writing.revision;
        state.writingAckRevision = writing.revision;
        state.writingConfirmedDraft = writingSnapshot(writing);
        if (editRevision === state.writingRevision && sameWriting(state.drafts.writing, payload)) {
          state.writingDirty = false; applyWritingFromServer(writing, true);
        } else {
          state.writingStarted = Boolean(writing.started || state.writingStarted); saveSession();
        }
        if (state.writingDirty) scheduleWritingSave(0);
        else setWritingSaveStatus('Đã lưu trên hệ thống');
      }
      return response;
    });
    writingSavePromise = operation;
    return operation;
  }

  function handleWritingSaveError(error) {
    if (error.code === 'WRITING_IDENTITY_CHANGED') return;
    if (error.code === 'WRITING_REVISION_CONFLICT') {
      setWritingSaveStatus('Có hai bản khác nhau · hãy chọn bản cần tiếp tục'); return;
    }
    if (error.code === 'WRITING_CLIENT_UPDATE_REQUIRED') {
      setWritingSaveStatus('Chưa xác nhận được · bài vẫn giữ trên máy'); showNotice(error.message, 'error'); return;
    }
    setWritingSaveStatus('Chưa lưu được · hệ thống sẽ tự thử lại');
    writingRetryTimer = window.setTimeout(() => scheduleWritingSave(0), randomDelay(5_000, 9_000));
  }

  function scheduleWritingSave(delay = null) {
    if (demoMode || !state.writingStarted || state.writingSubmitted || state.writingConflict) return;
    window.clearTimeout(writingSaveTimer);
    window.clearTimeout(writingRetryTimer);
    setWritingSaveStatus('Đang chờ lưu trên hệ thống...');
    const idleDelay = Number.isFinite(delay) ? Math.max(0, delay) : randomDelay(3_000, 7_000);
    writingSaveTimer = window.setTimeout(() => {
      setWritingSaveStatus('Đang lưu trên hệ thống...');
      saveWritingToServer('draft').catch(handleWritingSaveError);
    }, idleDelay);
    if (!writingForceSaveTimer && idleDelay > 0) {
      writingForceSaveTimer = window.setTimeout(() => {
        setWritingSaveStatus('Đang lưu trên hệ thống...');
        saveWritingToServer('draft').catch(handleWritingSaveError);
      }, randomDelay(10_000, 15_000));
    }
  }

  elements.writingUseServer?.addEventListener('click', () => resolveWritingConflict(true));
  elements.writingKeepLocal?.addEventListener('click', () => resolveWritingConflict(false));

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
    if (payload.exam?.serverNow) state.serverTimeOffsetMs = (window.IZONE_EXAM_CLOCK?.offset(payload.exam.serverNow) ?? (Date.parse(payload.exam.serverNow) - Date.now()));
    applyWritingFromServer(payload.writing);
    saveSession();
    return payload;
  }

  function populateRoster(data) {
    state.roster = data.students || [];
    state.className = data.class.name;
    elements.classLabel.textContent = `Lớp ${state.className}`;
    const options = [document.createElement('option')];
    options[0].value = '';
    options[0].textContent = 'Nhấn để chọn';
    for (const student of state.roster) {
      const option = document.createElement('option');
      option.value = student.ref;
      option.textContent = student.name;
      options.push(option);
    }
    elements.studentSelect.replaceChildren(...options);
    if (state.studentRef && state.roster.some(student => student.ref === state.studentRef)) {
      elements.studentSelect.value = state.studentRef;
    } else {
      state.studentRef = '';
      state.studentName = '';
      saveSession();
    }
  }

  function confirmIncomplete(answered, skillLabel) {
    const total = skillLabel === 'Listening' ? testConfig.listening.controls.length : testConfig.reading.controls.length;
    if (answered === total) return true;
    return ((message) => { try { if (typeof examJournal !== 'undefined') examJournal?.dialog(message, 'opened'); } catch {} const accepted = window.confirm(message); try { if (typeof examJournal !== 'undefined') examJournal?.dialog(message, accepted ? 'confirmed' : 'cancelled'); } catch {} return accepted; })(`${skillLabel} hiện có ${answered}/${total} câu đã nhập. Bạn vẫn muốn nộp bài?`);
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
      elements.writingTaskPosition.textContent = `Task ${safeIndex + 1} / ${tasks.length}`;
      saveSession();
      if (focusEditor) panels[safeIndex].querySelector('[data-writing-task]')?.focus();
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

      const promptTitle = document.createElement('strong');
      promptTitle.textContent = 'Đề bài';
      promptHeader.append(promptTitle);
      const promptBody = document.createElement('div');
      promptBody.className = 'writing-prompt-body';
      const outline = document.createElement('section');
      outline.className = 'writing-outline-card';
      const outlineHeader = document.createElement('header');
      const outlineTitle = document.createElement('strong');
      outlineTitle.textContent = 'Dàn ý';
      outlineHeader.append(outlineTitle);
      const outlineEditor = document.createElement('textarea');
      outlineEditor.className = 'writing-outline-editor';
      outlineEditor.dataset.writingOutline = 'true';
      outlineEditor.value = state.drafts.writing.outline || '';
      outlineEditor.spellcheck = false;
      outlineEditor.setAttribute('aria-label', 'Dàn ý Writing Task 2');
      outlineEditor.addEventListener('input', () => {
        state.drafts.writing.outline = outlineEditor.value;
        state.writingDirty = true;
        state.writingRevision = Math.max(
          Number(state.writingRevision) || 0,
          Number(state.writingAckRevision) || 0
        ) + 1;
        saveSession();
        scheduleWritingSave();
      });
      outline.append(outlineHeader, outlineEditor);
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
      promptBody.append(minimum, outline);
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

      const answerTitle = document.createElement('strong');
      answerTitle.textContent = 'Bài làm của bạn';
      answerHeader.append(answerTitle);
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
        state.writingRevision = Math.max(
          Number(state.writingRevision) || 0,
          Number(state.writingAckRevision) || 0
        ) + 1;
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
    }[code] || `Task 2 · ${code}`;
  }

  function cleanWritingFeedback(value) {
    return String(value || '')
      .replace(/\r/g, '')
      .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
      .replace(/https:\/\/(?:docs|drive)\.google\.com\/\S+/gi, '')
      // Bỏ liên kết điều hướng thừa do bộ chấm sinh; nút chi tiết đã có riêng.
      .replace(/\[\s*\(?\s*Xem phân tích chi tiết[^\]]*\]\(\s*\*?(?:\.\/)?(?:#|%23)[a-z0-9_-]+\*?\s*\)/gi, '')
      .replace(/^\s*\(?\s*Xem phân tích chi tiết[^\n]*\)?\s*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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
    // Giao diện không dùng thuộc tính HTML nguồn: bỏ trước khi parse để không kích hoạt style/tài nguyên.
    // Đây chỉ là tiền xử lý; danh sách node an toàn bên dưới vẫn là cổng lọc cuối cùng.
    const inertHtml = String(value || '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
      .replace(/<([a-z][a-z0-9-]*)(?:\s+(?:[^"'<>]|"[^"]*"|'[^']*')*)?\s*\/?>/gi, '<$1>');
    const parsed = new DOMParser().parseFromString(inertHtml, 'text/html');

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
      const tokenPattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
      let cursor = 0;
      for (const match of text.matchAll(tokenPattern)) {
        if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
        const node = document.createElement(match[1] ? 'strong' : 'em');
        node.textContent = match[1] || match[2];
        parent.append(node);
        cursor = match.index + match[0].length;
      }
      if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
    };
    const cleaned = cleanWritingFeedback(value || 'Chưa có nhận xét.');
    if (looksLikeWritingHtml(cleaned)) {
      appendSanitizedWritingHtml(target, cleaned);
      return;
    }
    const lines = cleaned.split('\n');
    let index = 0;
    while (index < lines.length) {
      const line = lines[index].trim();
      if (!line) {
        index += 1;
        continue;
      }
      const heading = line.match(/^(#{1,5})\s+(?:\*\*([^*]+)\*\*|(.+))$/);
      if (heading) {
        const title = document.createElement('h5');
        title.textContent = String(heading[2] || heading[3] || '').trim();
        target.append(title);
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
      const paragraph = document.createElement('p');
      appendInline(paragraph, line);
      target.append(paragraph);
      index += 1;
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

  function writingCriterionContext(value) {
    const text = cleanWritingFeedback(value);
    const marker = /^[ \t]*#{2,5}\s+(?:\*\*)?KẾT LUẬN(?:\*\*)?\s*$/im.exec(text);
    const overview = (marker ? text.slice(0, marker.index) : text)
      .split(/^[ \t]*#{2,5}\s+(?:\*\*)?\d+\.\s+/m)[0]
      .replace(/^[ \t]*#{1,5}\s+.*$/gm, '')
      .replace(/^\s*\*\*[^\n]*Band[^\n]*\*\*\s*$/gim, '')
      .trim();
    return { overview, conclusion: marker ? text.slice(marker.index + marker[0].length).trim() : '' };
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

  function writingReportSummary(value) {
    const cleaned = cleanWritingFeedback(value);
    const markerIndex = cleaned.search(/Nhận xét từng tiêu chí/iu);
    if (markerIndex < 0) return cleaned;
    const separatorIndex = cleaned.lastIndexOf('---', markerIndex);
    const headingIndex = cleaned.lastIndexOf('#', markerIndex);
    const cutIndex = separatorIndex >= 0 ? separatorIndex : headingIndex >= 0 ? headingIndex : markerIndex;
    return cleaned.slice(0, cutIndex).trim();
  }

  function openWritingFeedback(taskResult) {
    const taskNumber = Number(taskResult?.taskNumber);
    const task = Array.from(writingConfig?.tasks || []).find(item => item.id === `task${taskNumber}`);
    if (!task) return;
    const essayValue = String(state.result?.writing?.[task.id] ?? state.drafts.writing[task.id] ?? '');
    const dialog = document.createElement('dialog');
    dialog.className = 'writing-feedback-dialog';
    dialog.setAttribute('aria-labelledby', `writingFeedbackTitle${taskNumber}`);

    const shell = document.createElement('div');
    shell.className = 'writing-feedback-shell';
    const header = document.createElement('header');
    header.className = 'writing-feedback-header';
    const headerCopy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.textContent = `${state.studentName || 'Học viên'} · Kết quả Writing`;
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
    essay.textContent = essayValue.trim() ? essayValue : 'Chưa có nội dung bài viết.';
    sourcePane.append(essayTitle, essay);

    const scorePane = document.createElement('section');
    scorePane.className = 'writing-feedback-scores';
    const bandSummary = document.createElement('section');
    bandSummary.className = 'writing-band-summary';
    bandSummary.setAttribute('aria-label', 'Điểm từng tiêu chí Writing');
    for (const criterion of Array.from(taskResult.criteria || [])) {
      const item = document.createElement('div');
      item.className = 'writing-band-summary-item';
      const name = document.createElement('span');
      name.textContent = criterion.code || criterion.name || 'Tiêu chí';
      const value = document.createElement('strong');
      value.textContent = `Band ${formatBand(criterion.bandScore)}`;
      item.append(name, value);
      bandSummary.append(item);
    }
    scorePane.append(bandSummary);
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
        // Giữ phản hồi cấp tiêu chí; component không thay thế nhận xét chung hoặc kết luận.
        const context = writingCriterionContext(criterion.feedback);
        if (context.overview) {
          const overview = document.createElement('div');
          overview.className = 'writing-feedback-text writing-feedback-richtext';
          appendSafeWritingFeedback(overview, context.overview);
          card.append(overview);
        }
        const componentList = document.createElement('div');
        componentList.className = 'writing-component-list';
        for (let index = 0; index < componentCount; index += 1) {
          appendWritingComponent(componentList, components[index], sections[index], index, criterion.code, taskNumber);
        }
        card.append(componentList);
        if (context.conclusion) {
          const conclusion = document.createElement('div');
          conclusion.className = 'writing-feedback-text writing-feedback-richtext';
          const heading = document.createElement('h5');
          heading.textContent = 'Kết luận';
          conclusion.append(heading);
          appendSafeWritingFeedback(conclusion, context.conclusion);
          card.append(conclusion);
        }
      } else {
        const feedback = document.createElement('div');
        feedback.className = 'writing-feedback-text writing-feedback-richtext';
        appendSafeWritingFeedback(feedback, criterion.feedback || 'Chưa có nhận xét chi tiết.');
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
    const pendingMessage = 'Phần Writing của bạn đang được giáo viên chấm điểm, kết quả sẽ được hiển thị sau';
    if (!writingConfig || !elements.writingSubmissionResult) return;
    elements.writingSubmissionResult.hidden = !state.writingSubmitted;
    if (!state.writingSubmitted) {
      elements.writingSubmissionResult.replaceChildren();
      return;
    }

    if (!state.result?.writing?.grading?.ready) {
      const section = document.createElement('section');
      section.className = 'writing-result-section';
      const heading = document.createElement('h3');
      heading.textContent = 'Bài Writing đã nộp';
      const status = document.createElement('p');
      status.className = 'writing-grading-status';
      status.textContent = pendingMessage;
      section.append(heading, status);
      elements.writingSubmissionResult.replaceChildren(section);
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
      ? 'Nhấn vào điểm Task 2 để xem bài chấm chi tiết.'
      : grading?.status === 'review_required'
        ? 'Bài làm đã được giữ an toàn; một phần chấm cần giáo viên kiểm tra trước khi công bố.'
        : 'Kết quả sẽ hiển thị sớm. Bạn có thể tắt trang web và quay lại sau bằng đúng đường dẫn này.';
    heading.append(headingCopy, note);

    const gradingArea = document.createElement('div');
    if (grading?.ready) {
      gradingArea.className = 'writing-score-grid';
      const tasksByNumber = new Map(Array.from(grading.tasks || []).map(task => [Number(task.taskNumber), task]));
      for (const taskNumber of [2]) {
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
      formula.textContent = 'Điểm Writing = điểm Task 2';
      overall.append(overallLabel, overallScore, formula);
      gradingArea.append(overall);
    } else {
      gradingArea.className = `writing-grading-status${grading?.status === 'review_required' ? ' needs-review' : ''}`;
      const statusCopy = document.createElement('div');
      const statusTitle = document.createElement('strong');
      statusTitle.textContent = grading?.status === 'review_required'
        ? 'Bài chấm đang được kiểm tra'
        : 'Đang chấm Task 2';
      const statusText = document.createElement('p');
      statusText.textContent = grading?.status === 'review_required'
        ? 'Bạn có thể đóng trang; kết quả vẫn được lưu và sẽ hiện khi hoàn chỉnh.'
        : 'Bài làm và tiến độ chấm đã được lưu trên hệ thống. Nếu vẫn mở trang, kết quả sẽ tự cập nhật khi chấm xong.';
      if (state.manualPendingWritingAttemptToken && state.manualPendingWritingAttemptToken === state.attemptToken) statusText.textContent = pendingMessage;
      statusCopy.append(statusTitle, statusText);
      gradingArea.append(statusCopy);
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
    score.textContent = `${section.correct}/${section.total} câu đúng`;
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
    const result = payload.result;
    const hasReading = Boolean(result.reading);
    state.result = payload;
    elements.resultStudentName.textContent = payload.studentName;
    elements.resultMeta.textContent = `${payload.className} · ${result.testTitle || testConfig.title}`;
    elements.summaryGrid.replaceChildren(
      addSummaryCard('Listening', `${result.listening.correct}/${result.listening.total} câu đúng`),
      addSummaryCard('Reading', hasReading ? `${result.reading.correct}/${result.reading.total} câu đúng` : 'Chưa nộp')
    );
    elements.resultStatus.textContent = hasReading
      ? payload.writing?.grading?.ready
        ? 'Listening và Reading được phân tích riêng; điểm Writing Task 2 đã hoàn tất và có bài chấm chi tiết.'
        : 'Phần Writing của bạn đang được giáo viên chấm điểm, kết quả sẽ được hiển thị sau'
      : 'Listening đã được chấm và lưu riêng. Phân tích dưới đây chỉ dùng bài Listening; Reading chưa bị tính là 0 điểm.';
    elements.continueReadingFromResult.hidden = hasReading || Boolean(demoMode);
    renderWritingSubmission();
    // Polling Writing không làm thay DOM/focus của bảng L/R đang được học viên xem.
    const identity = JSON.stringify([payload.className, payload.studentRef || state.studentRef || payload.studentName, payload.attemptToken || state.attemptToken]);
    const previousBlocks = state.resultDetailsIdentity === identity
      ? Array.from(elements.questionDetails.children) : [];
    const skills = [['Listening', result.listening], ...(hasReading ? [['Reading', result.reading]] : [])];
    const detailBlocks = skills.map(([title, skill]) => {
      const fingerprint = JSON.stringify(skill.details || []);
      const previous = previousBlocks.find(block => block.dataset.skill === title);
      if (previous?.dataset.details === fingerprint) return previous;
      const block = renderDetailBlock(title, skill.details);
      block.dataset.skill = title;
      block.dataset.details = fingerprint;
      block.open = previous?.open || false;
      return block;
    });
    if (detailBlocks.length !== elements.questionDetails.children.length
      || detailBlocks.some((block, index) => block !== elements.questionDetails.children[index])) {
      elements.questionDetails.replaceChildren(...detailBlocks);
    }
    state.resultDetailsIdentity = identity;
    const performanceSections = [renderSkillPerformance('Listening', result.listening)];
    if (hasReading) performanceSections.push(renderSkillPerformance('Reading', result.reading));
    elements.skillPerformanceSections.replaceChildren(...performanceSections);
    if (payload.writing?.grading?.ready) stopWritingGradingPolling();
  }

  function portalNotice(status, completed) {
    if (status === 'not_applicable') {
      return completed
        ? 'Bài đã được chấm và phân tích đầy đủ.'
        : 'Listening đã được chấm và phân tích đầy đủ.';
    }
    if (status === 'queued') {
      return completed
        ? 'Bài đã được chấm. Điểm đang được chuyển lên Portal và hệ thống sẽ tự thử lại nếu Portal đang bận.'
        : 'Listening đã được chấm. Điểm đang được chuyển lên Portal và hệ thống sẽ tự thử lại nếu Portal đang bận.';
    }
    if (status === 'unknown' || status === 'processing' || status === 'pending') {
      return completed
        ? 'Bài đã được chấm. Chưa rõ Portal đã nhận điểm hay chưa; hệ thống không tự gửi lại. Giáo viên cần kiểm tra Portal trước khi retry.'
        : 'Listening đã được chấm. Chưa rõ Portal đã nhận điểm hay chưa; hệ thống không tự gửi lại. Giáo viên cần kiểm tra Portal trước khi retry.';
    }
    if (status === 'failed_response') {
      return 'Bài đã được chấm nhưng webhook trả lỗi. Giáo viên cần kiểm tra lịch sử gửi điểm và Portal trước khi retry.';
    }
    return completed
      ? 'Cả Listening và Reading đã được chấm và ghi vào Portal.'
      : 'Listening đã được chấm, phân tích và ghi vào Portal.';
  }

  function writingGradingNotice() {
    return 'Phần Writing của bạn đang được giáo viên chấm điểm, kết quả sẽ được hiển thị sau';
  }

  async function loadResult(button) {
    setBusy(button, true, 'Đang tải kết quả...', button.dataset.normalText || button.textContent);
    if (demoMode) {
      const mode = state.completed ? 'complete' : 'listening-only';
      renderResult(buildDemoPayload(mode));
      showNotice(serverGradingMode
        ? mode === 'complete'
          ? 'Backend test: đây là điểm Listening và Reading chấm từ bài vừa nộp.'
          : 'Backend test: đây là điểm Listening chấm từ bài vừa nộp.'
        : mode === 'complete'
          ? 'Bản demo: đã hoàn thành toàn bộ bài thi.'
          : 'Bản demo: mới hoàn thành Listening.', 'success');
      setStage('result');
      setBusy(button, false, 'Đang tải kết quả...', button.dataset.normalText || 'Xem kết quả');
      return;
    }
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
        showNotice(portalNotice(payload.portalSyncStatus, payload.completed), ['unknown', 'processing', 'pending', 'queued', 'failed_response'].includes(payload.portalSyncStatus) ? '' : 'success');
      }
      setStage('result');
      scheduleWritingGradingRefresh();
    } catch (error) {
      showNotice(`Không thể tải kết quả: ${error.message}`, 'error');
    } finally {
      setBusy(button, false, 'Đang tải kết quả...', button.dataset.normalText || 'Xem kết quả');
    }
  }

  function isWritingIdentityBound() {
    return Boolean(state.studentRef && (state.attemptToken || state.examSessionToken
      || state.listeningStartedAt || state.listeningDeadlineAt));
  }

  // Đổi tên khi chưa mở lượt: xóa riêng trạng thái Writing của người trước, không mang bài sang tên mới.
  function resetUnboundWritingIdentity() {
    window.clearTimeout(writingSaveTimer); window.clearTimeout(writingForceSaveTimer);
    window.clearTimeout(writingRetryTimer); writingForceSaveTimer = 0;
    state.writingServerRevision = null; state.writingConfirmedDraft = null;
    state.writingConflict = null; state.writingRecovery = [];
    state.writingRevision = 0; state.writingAckRevision = 0;
    state.writingDirty = false; state.writingStarted = false; state.writingSubmitted = false;
    state.writingDeadlineAt = ''; state.writingStartedAt = '';
    state.drafts.writing = { outline: '', task1: '', task2: '' };
    syncWritingEditors(); renderWritingConflict(); renderWritingRecovery();
  }

  elements.studentSelect.addEventListener('change', async () => {
    const previousStudentRef = state.studentRef;
    if (elements.studentSelect.value !== previousStudentRef
      && (isWritingIdentityBound() || (previousStudentRef && elements.studentSelect.disabled))) {
      // Token/đồng hồ đã gắn với học viên: giữ nguyên bài và khôi phục đúng lựa chọn đang thi.
      elements.studentSelect.value = previousStudentRef; elements.studentSelect.disabled = true;
      showNotice('Lượt thi đang gắn với học viên đã chọn. Bài và các bản phục hồi được giữ nguyên; không đổi tên giữa lượt.', 'error');
      return;
    }
    const student = state.roster.find(item => item.ref === elements.studentSelect.value);
    if (paperIdentity) {
      if (!student) return;
      if (!((message) => { try { if (typeof examJournal !== 'undefined') examJournal?.dialog(message, 'opened'); } catch {} const accepted = window.confirm(message); try { if (typeof examJournal !== 'undefined') examJournal?.dialog(message, accepted ? 'confirmed' : 'cancelled'); } catch {} return accepted; })(`Xác nhận học viên ${student.name} · lớp ${classCode}?`)) { elements.studentSelect.value = previousStudentRef; return; }
      bindPaperStudent(student);
      try { await prepareK56Attempt(); } catch (error) { showNotice(`Chưa chuẩn bị được bài thi: ${error.message}`, 'error'); }
      return;
    }
    state.studentRef = student?.ref || '';
    state.studentName = student?.name || '';
    if (previousStudentRef !== state.studentRef) resetUnboundWritingIdentity();
    saveSession();
    if (!demoMode && state.studentRef && !document.body.classList.contains('cbt-mode')) {
      if (!((message) => { try { if (typeof examJournal !== 'undefined') examJournal?.dialog(message, 'opened'); } catch {} const accepted = window.confirm(message); try { if (typeof examJournal !== 'undefined') examJournal?.dialog(message, accepted ? 'confirmed' : 'cancelled'); } catch {} return accepted; })(`Xác nhận học viên ${state.studentName} · lớp ${classCode}?`)) return;
      prepareK56Attempt().catch(error => showNotice(`Chưa chuẩn bị được bài thi: ${error.message}`, 'error'));
    }
  });

  elements.listeningView.addEventListener('submit', async event => {
    event.preventDefault();
    if (state.listeningSubmitted || elements.listeningView.dataset.listeningSubmitting === 'true') return;
    if (!state.studentRef) {
      elements.studentSelect.reportValidity();
      showNotice('Hãy chọn đúng họ và tên trước khi nộp Listening.', 'error');
      return;
    }
    const automatic = event.submitter?.dataset.autoSubmit === 'true'
      || elements.listeningView.dataset.listeningTimeExpired === 'true';
    if (automatic && window.K56_LISTENING_AUDIO) {
      const decision = await window.K56_LISTENING_AUDIO.beforeAutoSubmit();
      if (state.listeningSubmitted || elements.listeningView.dataset.listeningSubmitting === 'true') return;
      if (!decision.submit) {
        if (decision.deadlineChanged) {
          delete elements.listeningView.dataset.listeningTimeExpired;
          state.frozenAnswers.listening = null;
          setAnswerControlsLocked('listening', false);
        }
        return;
      }
    }
    let answers = state.pendingSubmissions?.listening?.answers || state.frozenAnswers.listening || collectAnswers(elements.listeningQuestions);
    if (automatic && !state.frozenAnswers.listening) {
      state.frozenAnswers.listening = Object.freeze({ ...answers });
      answers = state.frozenAnswers.listening;
    }
    const answered = updateAnswerCount('listening');
    if (!automatic && !confirmIncomplete(answered, 'Listening')) return;
    state.clientSubmissionId ||= crypto.randomUUID();
    state.drafts.listening = answers;
    saveSession();
    stopSectionDraftFlow('listening');
    elements.listeningView.dataset.listeningSubmitting = 'true';
    window.K56_LISTENING_AUDIO?.submitting();
    setAnswerControlsLocked('listening', true);
    setBusy(elements.submitListening, true, 'Đang lưu Listening...', 'Nộp bài Listening');
    if (automatic) showNotice('Đã hết giờ. Hệ thống đang tự thu và chấm bài Listening...');
    let submitted = false;
    try {
      if (demoMode === 'exam') {
        if (serverGradingMode) {
          const grade = await apiRequest('/api/test/grade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examId: 'listening', answers })
          });
          state.testGrades.listening = grade.section;
        }
        state.attemptToken = 'demo-attempt';
        state.studentName = state.studentName || 'Học viên Demo';
        state.completed = false;
        state.frozenAnswers.listening = null;
        saveSession();
        submitted = true;
        elements.listeningView.dispatchEvent(new CustomEvent('term-test:listening-submitted'));
        showNotice(serverGradingMode
          ? `Backend test đã chấm Listening: ${state.testGrades.listening.correct}/40 câu đúng.`
          : 'Bản demo: Listening đã được lưu. Bạn có thể tiếp tục Reading.', 'success');
        setStage('listening-saved');
        return;
      }
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
      state.completed = Boolean(response.completed);
      state.listeningSubmitted = true;
      state.frozenAnswers.listening = null;
      state.draftAckRevisions.listening = Math.max(
        Number(state.draftAckRevisions.listening) || 0,
        Number(state.draftRevisions.listening) || 0
      );
      saveSession();
      submitted = true;
      elements.listeningView.dispatchEvent(new CustomEvent('term-test:listening-submitted'));
      showNotice(portalNotice(response.portalSyncStatus, state.completed), ['unknown', 'processing', 'pending', 'queued', 'failed_response'].includes(response.portalSyncStatus) ? '' : 'success');
      if (state.completed && writingConfig && !state.writingSubmitted) {
        setStage(state.writingStarted ? 'writing' : 'writing-prep');
      } else {
        setStage(state.completed ? 'result-ready' : 'listening-saved');
      }
    } catch (error) {
      showNotice(automatic
        ? `Hết giờ nhưng chưa thể nộp Listening: ${error.message}. Bài đã khóa và hệ thống sẽ tự thử lại.`
        : `Không thể lưu Listening: ${error.message}`, 'error');
    } finally {
      delete elements.listeningView.dataset.listeningSubmitting;
      if (!submitted) window.K56_LISTENING_AUDIO?.submitFailed();
      if (!submitted && isSectionExpired('listening')) {
        elements.listeningView.dataset.listeningTimeExpired = 'true';
        state.frozenAnswers.listening ||= { ...answers };
        saveSession();
      } else if (!automatic && !submitted) {
        setAnswerControlsLocked('listening', false);
        scheduleSectionDraft('listening', 0);
      }
      setBusy(elements.submitListening, false, 'Đang lưu Listening...', 'Nộp bài Listening');
      if (state.pendingSubmissions?.listening) setAnswerControlsLocked('listening', true);
    }
  });

  async function startOrResumeReading(button) {
    setBusy(button, true, 'Đang mở Reading...', button.dataset.normalText || button.textContent);
    try {
      if (demoMode === 'exam') {
        state.readingDeadlineAt = new Date((window.IZONE_EXAM_CLOCK?.now() ?? Date.now()) + (Number(testConfig.reading.durationMinutes) || 40) * 60_000).toISOString();
        state.serverTimeOffsetMs = 0;
        saveSession();
        elements.readingStudentName.textContent = state.studentName;
        hideNotice();
        setStage('reading');
        return;
      }
      const response = await apiRequest(`/api/term-tests/${testConfig.slug}/reading/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptToken: state.attemptToken })
      });
      state.readingStartedAt = response.readingStartedAt;
      state.readingDeadlineAt = response.readingDeadlineAt;
      state.serverTimeOffsetMs = (window.IZONE_EXAM_CLOCK?.offset(response.serverNow) ?? (Date.parse(response.serverNow) - Date.now()));
      if (response.readingDraft || response.readingDraftRevision) {
        applySectionDraft('reading', response.readingDraft, response.readingDraftRevision);
      }
      saveSession();
      elements.readingStudentName.textContent = state.studentName;
      hideNotice();
      setStage('reading');
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
    if (state.readingSubmitted || elements.readingView.dataset.readingSubmitting === 'true') return;
    const automatic = event.submitter?.dataset.autoSubmit === 'true'
      || elements.readingView.dataset.readingTimeExpired === 'true';
    let answers = state.pendingSubmissions?.reading?.answers || state.frozenAnswers.reading || collectAnswers(elements.readingQuestions);
    if (automatic && !state.frozenAnswers.reading) {
      state.frozenAnswers.reading = Object.freeze({ ...answers });
      answers = state.frozenAnswers.reading;
    }
    const answered = updateAnswerCount('reading');
    if (!automatic && !confirmIncomplete(answered, 'Reading')) return;
    elements.readingView.dataset.readingSubmitting = 'true';
    state.drafts.reading = answers;
    saveSession();
    stopSectionDraftFlow('reading');
    setAnswerControlsLocked('reading', true);
    setBusy(elements.submitReading, true, 'Đang lưu và chấm...', 'Nộp bài Reading');
    if (automatic) {
      showNotice(`Đã hết ${Number(testConfig.reading.durationMinutes) || 40} phút. Hệ thống đang tự thu và chấm bài Reading...`);
    }
    let submitted = false;
    try {
      if (demoMode === 'exam') {
        if (serverGradingMode) {
          const grade = await apiRequest('/api/test/grade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examId: 'reading', answers })
          });
          state.testGrades.reading = grade.section;
        }
        state.completed = true;
        state.frozenAnswers.reading = null;
        saveSession();
        submitted = true;
        elements.readingView.dispatchEvent(new CustomEvent('term-test:reading-submitted'));
        showNotice(serverGradingMode
          ? `Backend test đã chấm Reading: ${state.testGrades.reading.correct}/26 câu đúng. Kết quả sẽ mở sau Writing.`
          : 'Bản demo: Reading đã được lưu. Kết quả sẽ mở sau Writing.', 'success');
        setStage('writing-prep');
        return;
      }
      const response = await apiRequest(`/api/term-tests/${testConfig.slug}/reading`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptToken: state.attemptToken,
          draftRevision: Number(state.draftRevisions.reading) || 0,
          answers
        })
      });
      state.completed = Boolean(response.completed);
      state.readingSubmitted = true;
      state.nextSection = response.nextSection;
      state.frozenAnswers.reading = null;
      state.draftAckRevisions.reading = Math.max(
        Number(state.draftAckRevisions.reading) || 0,
        Number(state.draftRevisions.reading) || 0
      );
      saveSession();
      submitted = true;
      elements.readingView.dispatchEvent(new CustomEvent('term-test:reading-submitted'));
      if (!state.completed) {
        showNotice('Reading đã được lưu và khóa. Tiếp theo là Listening.', 'success');
        if (document.body.classList.contains('cbt-mode')) { window.TERM_TEST_ALLOW_NAVIGATION = true; window.location.reload(); }
        else showSectionReady('listening');
        return;
      }
      if (writingConfig) {
        setStage('writing-prep');
        const portalMessage = portalNotice(response.portalSyncStatus, true);
        showNotice(`${portalMessage} Kết quả sẽ mở sau khi bạn nộp Writing.`, ['unknown', 'processing', 'pending', 'queued', 'failed_response'].includes(response.portalSyncStatus) ? '' : 'success');
      } else {
        showNotice(portalNotice(response.portalSyncStatus, true), ['unknown', 'processing', 'pending', 'queued', 'failed_response'].includes(response.portalSyncStatus) ? '' : 'success');
        setStage('result-ready');
        if (automatic) await loadResult(elements.viewResult);
      }
    } catch (error) {
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
      setBusy(elements.submitReading, false, 'Đang lưu và chấm...', 'Nộp bài Reading');
      if (state.pendingSubmissions?.reading) setAnswerControlsLocked('reading', true);
    }
  });

  elements.viewResult.dataset.normalText = 'Xem kết quả';
  elements.viewResult.addEventListener('click', () => loadResult(elements.viewResult));

  if (writingConfig) {
    elements.startWriting.addEventListener('click', async () => {
      const wasStarted = state.writingStarted;
      state.writingStarted = true;
      if (demoMode === 'exam') {
        state.writingDeadlineAt = new Date((window.IZONE_EXAM_CLOCK?.now() ?? Date.now()) + (Number(testConfig.writing?.durationMinutes) || 55) * 60_000).toISOString();
        state.serverTimeOffsetMs = 0;
      }
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
      const emptyTasks = belowMinimum.filter(task => task.words === 0);
      if (!automatic && emptyTasks.length) {
        showNotice(`${emptyTasks.map(task => task.label).join(', ')} chưa có nội dung. Hãy viết bài trước khi nộp để hệ thống có thể chấm điểm.`, 'error');
        return;
      }
      if (!automatic && belowMinimum.length) {
        const summary = belowMinimum.map(task => `${task.label}: ${task.words}/${task.minimum} từ`).join('\n');
        if (!((message) => { try { if (typeof examJournal !== 'undefined') examJournal?.dialog(message, 'opened'); } catch {} const accepted = window.confirm(message); try { if (typeof examJournal !== 'undefined') examJournal?.dialog(message, accepted ? 'confirmed' : 'cancelled'); } catch {} return accepted; })(`${summary}\n\nBạn vẫn muốn nộp bài Writing?`)) return;
      }

      if (demoMode) {
        if (serverGradingMode) {
          try {
            state.testGrades.writing = await apiRequest('/api/test/writing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                outline: state.drafts.writing.outline,
                task2: state.drafts.writing.task2
              })
            });
          } catch (error) {
            showNotice(`Backend test chưa nhận được Writing: ${error.message}`, 'error');
            return;
          }
        }
        state.writingSubmitted = true;
        saveSession();
        renderResult(buildDemoPayload('complete'));
        showNotice(serverGradingMode
          ? 'Backend test đã nhận Writing. Listening và Reading bên dưới là điểm chấm thật; chế độ kiểm thử cục bộ này không gọi workflow chấm K56.'
          : 'Bản demo: Writing đã nộp; kết quả Listening và Reading đã được mở.', 'success');
        setStage('result');
        return;
      }

      window.clearTimeout(writingSaveTimer);
      window.clearTimeout(writingForceSaveTimer);
      window.clearTimeout(writingRetryTimer);
      elements.writingView.dataset.writingSubmitting = 'true';
      setBusy(elements.submitWriting, true, 'Đang lưu và nộp...', 'Nộp bài');
      for (const editor of elements.writingView.querySelectorAll('textarea[data-writing-task], textarea[data-writing-outline]')) editor.readOnly = true;
      if (automatic) showNotice('Đã hết 55 phút. Hệ thống đang tự lưu và thu bài Writing...');
      try {
        const saved = await saveWritingToServer('submit');
        if (!saved.writing?.submitted) throw new Error('Máy chủ chưa xác nhận bài Writing đã được nộp.');
        state.writingSubmitted = true;
        state.writingDirty = false;
        saveSession();
        elements.writingView.dispatchEvent(new CustomEvent('term-test:writing-submitted'));
        setStage('result-ready');
        showNotice(saved.writing?.accepted === false
          ? 'Hệ thống đã chốt bản lưu đúng hạn. Bản khác trên máy được giữ trong mục phục hồi.'
          : automatic
          ? 'Đã hết 55 phút và hệ thống đã thu bài Writing. Bài đang được chấm; bạn có thể tắt trang web và quay lại sau.'
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
        for (const editor of elements.writingView.querySelectorAll('textarea[data-writing-task], textarea[data-writing-outline]')) editor.readOnly = timeExpired;
        setBusy(elements.submitWriting, false, 'Đang lưu và nộp...', 'Nộp bài');
      }
    });
  }

  function makeDemoSection(skill, correct, total) {
    const types = skill === 'Listening'
      ? ['Form completion', 'Sentence completion', 'Multiple choice', 'Map labelling']
      : ['True / False / Not Given', 'Short answer', 'Matching headings', 'Yes / No / Not Given'];
    return {
      correct,
      total,
      answered: total,
      details: Array.from({ length: total }, (_, index) => ({
        number: index + 1,
        studentAnswer: index < correct ? 'Đáp án mẫu' : 'Phương án khác',
        correctAnswer: 'Đáp án minh họa',
        result: index < correct ? 'correct' : 'incorrect'
      })),
      typeStats: types.map((type, index) => {
        const base = Math.floor(total / types.length);
        const typeTotal = base + (index < total % types.length ? 1 : 0);
        const typeCorrect = Math.max(0, Math.min(typeTotal, Math.round(correct * typeTotal / total)));
        return { type, correct: typeCorrect, total: typeTotal, percentage: typeCorrect / typeTotal };
      })
    };
  }

  function buildDemoPayload(mode) {
    const listening = serverGradingMode
      ? state.testGrades.listening || makeDemoSection('Listening', 0, 40)
      : makeDemoSection('Listening', 31, 40);
    const reading = mode === 'complete'
      ? serverGradingMode
        ? state.testGrades.reading || makeDemoSection('Reading', 0, 26)
        : makeDemoSection('Reading', 20, 26)
      : null;
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
    const demoWriting = mode === 'complete' && serverGradingMode ? {
      task2: state.drafts.writing.task2,
      started: true,
      submitted: true,
      grading: {
        status: 'review_required',
        ready: false,
        taskStates: { task2: 'pending_test_integration' }
      }
    } : mode === 'complete' ? {
      task2: state.drafts.writing.task2,
      started: true,
      submitted: true,
      grading: {
        status: 'ready',
        ready: true,
        task2Score: 7,
        writingScore: 7,
        taskStates: { task2: 'complete' },
        tasks: [
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
      studentName: state.studentName || 'Học viên Demo',
      className: state.className || classCode || 'CODEXDEMO56',
      completed: Boolean(reading),
      portalSyncStatus: serverGradingMode ? 'not_applicable' : 'synced',
      writing: demoWriting,
      result: {
        testTitle: serverGradingMode
          ? 'Term Test 1 · Khóa 56 · Backend test'
          : 'Term Test 1 · Khóa 56 · Bản minh họa',
        listening,
        reading,
        summary: {
          totalCorrect: listening.correct + (reading?.correct || 0),
          totalQuestions: listening.total + (reading?.total || 0),
          averageBand: null
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
    // Khôi phục cả cảnh báo và bản sao khi đọc server lỗi hoặc trả bản cũ.
    renderWritingConflict(); renderWritingRecovery();

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
        state.drafts.writing.task2 = 'This is a sample Task 2 response. The live page preserves the student essay exactly as typed and provides a separate copy button for each task.';
      }
      if (demoMode === 'exam') {
        const bootstrappedIdentity = Boolean(window.TERM_TEST_BOOTSTRAP && state.studentRef);
        if (bootstrappedIdentity) {
          state.studentName = state.studentName || 'Học viên Demo';
          state.className = classCode || 'CODEXDEMO56';
          state.examSessionToken = state.examSessionToken || 'local-demo-session';
          state.roster = [{ ref: state.studentRef, name: state.studentName }];
          elements.studentSelect.replaceChildren(new Option(state.studentName, state.studentRef));
          elements.studentSelect.value = state.studentRef;
        } else {
          state.roster = [{ ref: 'demo-student', name: 'Học viên Demo' }];
          state.studentRef = 'demo-student';
          state.studentName = 'Học viên Demo';
          state.className = classCode || 'CODEXDEMO56';
          state.examSessionToken = 'demo-session';
          elements.studentSelect.replaceChildren(new Option(state.studentName, state.studentRef));
          elements.studentSelect.value = state.studentRef;
        }
        if (serverGradingMode && state.writingSubmitted && state.testGrades.listening && state.testGrades.reading) {
          renderResult(buildDemoPayload('complete'));
          showNotice('Backend test: đây là điểm Listening và Reading chấm từ bài bạn đã nộp; không ghi Portal.', 'success');
          setStage('result');
          return;
        }
        if (serverGradingMode && state.completed && state.testGrades.reading) {
          showNotice('Backend test đã khôi phục bài Reading. Tiếp tục hoặc nộp Writing khi sẵn sàng.', 'success');
          setStage(state.writingStarted ? 'writing' : 'writing-prep');
          return;
        }
        if (serverGradingMode && state.testGrades.listening) {
          elements.readingStudentName.textContent = state.studentName;
          showNotice('Backend test đã khôi phục điểm Listening đã nộp.', 'success');
          setStage(state.readingDeadlineAt ? 'reading' : 'listening-saved');
          return;
        }
        if (!state.listeningDeadlineAt) {
          state.listeningDeadlineAt = new Date((window.IZONE_EXAM_CLOCK?.now() ?? Date.now()) + (Number(testConfig.listening.durationSeconds) || 1848) * 1000).toISOString();
        }
        saveSession();
        if (serverGradingMode) {
          showNotice('Backend test đang bật: Listening và Reading sẽ chấm đúng đáp án bạn nộp; không ghi Portal.', 'success');
        } else {
          hideNotice();
        }
        setStage('listening');
        return;
      }
      if (demoMode === 'listening-only') state.writingSubmitted = false;
      renderResult(buildDemoPayload(demoMode));
      showNotice(demoMode === 'complete'
        ? 'Bản demo: học viên đã hoàn thành Listening, Reading và Writing.'
        : 'Bản demo: học viên mới nộp Listening; Reading chưa bị tính điểm.', 'success');
      setStage('result');
      return;
    }

    if (!/^[A-Z0-9_-]{2,32}$/.test(classCode)) {
      elements.loadingView.hidden = true;
      showNotice('Link chưa có mã lớp hợp lệ. Hãy dùng dạng ?class=IC2139.', 'error');
      return;
    }

    try {
      // Dùng lại danh tính vừa được máy chủ xác nhận trong lần mở trang này.
      const restored = window.TERM_TEST_BOOTSTRAP?.restoredIdentity;
      const canReuseIdentity = restored?.testSlug === testConfig.slug && restored.classCode === classCode
        && restored.studentRef === state.studentRef && restored.attemptToken === state.attemptToken
        && Boolean(state.attemptToken);
      let paperEntry = null;
      try { paperEntry = await paperEntryRoster(); }
      catch (error) {
        if (state.studentRef) throw error;
        showNotice('Chưa kiểm được người đã nhớ. Bạn có thể chọn tên; danh tính cũ vẫn được giữ.');
      }
      const roster = paperEntry?.roster || (canReuseIdentity
        ? {class:{name:classCode},students:[{ref:restored.studentRef,name:restored.studentName}]}
        : await apiRequest(`/api/term-tests/roster?class=${encodeURIComponent(classCode)}&test=${encodeURIComponent(testConfig.slug)}`));
      populateRoster(roster);
      if (paperEntry?.selection) bindPaperStudent(paperEntry.selection.student, paperEntry.selection.resolution);
      if (!demoMode) {
        if (window.TERM_TEST_BOOTSTRAP?.preparedAttempt) {
          await showPreparedAttempt(window.TERM_TEST_BOOTSTRAP.preparedAttempt);
          return;
        }
        if (!document.body.classList.contains('cbt-mode')) {
          if (state.studentRef) await prepareK56Attempt();
          else { setStage('identity-ready'); hideNotice(); }
          return;
        }
      }
      if (!state.roster.length) throw new Error('Lớp chưa có học viên trong hệ thống matching.');
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
          hideNotice();
        } else {
          setStage('listening-saved');
          showNotice('Bài Listening đã được lưu. Bạn có thể tiếp tục Reading.', 'success');
        }
      } else {
        setStage('listening');
        hideNotice();
      }
    } catch (error) {
      elements.loadingView.hidden = true;
      showNotice(`Không thể mở bài test: ${error.message}`, 'error');
    }
  }

  // Gửi snapshot cuối bằng keepalive khi tab đóng; localStorage vẫn là đường phục hồi nếu mạng lỗi.
  function flushDraftsOnPageHide() {
    const post = (path, payload) => fetch(`${appConfig.API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => null);
    if (state.examSessionToken && state.draftRevisions.listening > state.draftAckRevisions.listening) {
      post(`/api/term-tests/${testConfig.slug}/listening/draft`, {
        examSessionToken: state.examSessionToken,
        revision: Number(state.draftRevisions.listening) || 0,
        answers: state.drafts.listening || {}
      });
    }
    if (state.attemptToken && state.draftRevisions.reading > state.draftAckRevisions.reading && !state.completed) {
      post(`/api/term-tests/${testConfig.slug}/reading/draft`, {
        attemptToken: state.attemptToken,
        revision: Number(state.draftRevisions.reading) || 0,
        answers: state.drafts.reading || {}
      });
    }
    if (state.attemptToken && state.writingDirty && !state.writingSubmitted && !state.writingConflict
      && validWritingRevision(state.writingServerRevision)) {
      post('/api/term-tests/writing', writingPayload('draft'));
    }
  }

  window.addEventListener('pagehide', () => {
    stopWritingGradingPolling();
    flushDraftsOnPageHide();
  });

  // Cảnh báo chỉ bảo vệ thao tác rời trang; việc lưu nháp và khóa bài vẫn do luồng hiện hành xử lý.
  window.addEventListener('beforeunload', event => {
    if (window.TERM_TEST_ALLOW_NAVIGATION || (demoMode && !serverGradingMode)) return;
    const listeningActive = !state.completed && !state.listeningSubmitted && !state.testGrades?.listening
      && Boolean((state.examSessionToken && state.listeningDeadlineAt) || (serverGradingMode && state.listeningStartedAt));
    const readingActive = !state.completed && !state.readingSubmitted && !state.testGrades?.reading
      && Boolean(state.readingStartedAt || (state.attemptToken && state.readingDeadlineAt));
    const writingActive = Boolean(state.writingStarted && !state.writingSubmitted);
    const paperActive = !window.TERM_TEST_CONTENT && state.studentRef && !state.completed
      && ['listening', 'reading'].includes(state.stage);
    if (!(listeningActive || readingActive || writingActive || paperActive)) return;
    event.preventDefault(); event.returnValue = true;
  });
  window.TERM_TEST_LEAVE_GUARD_READY = true;

  initialize();
})();

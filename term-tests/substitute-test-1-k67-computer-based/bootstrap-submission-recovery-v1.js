(async function () {
  'use strict';

  const {beginAudioDownloadStatus} = await import('../shared/cbt-audio-download-status.mjs?v=20261111-audio-status-v1');

  const testConfig = window.TERM_TEST_CONFIG;
  const appConfig = window.TERM_TEST_APP_CONFIG;
  const audioLoader = window.TERM_TEST_AUDIO_LOADER;
  const root = document.getElementById('app');
  const query = new URLSearchParams(window.location.search);
  let classCode = (query.get('class') || '').trim().toUpperCase();
  const demoMode = query.get('demo') || '';
  const localDemo = demoMode === 'exam' && query.get('grading') === 'server';
  let startAtFirstSection = false;
  const storageSuffix = localDemo && query.get('grading') === 'server' ? ':server-grade' : '';
  const demoStudentRef = localDemo ? (query.get('demoStudent') || '').trim() : '';
  const demoAttemptToken = localDemo ? (query.get('demoAttempt') || '').trim() : '';
  if (!testConfig || !appConfig || !audioLoader || !root) return;
  if(!window.IZONE_EXAM_DEVICE_CHECKED)await loadScript('../shared/desktop-exam-guard.js?v=20261027-v1&resilience=20261027-v1');
  if(window.IZONE_EXAM_DEVICE_BLOCKED)return;
  if(!window.IZONE_AUDIO_SOURCE_CHOICE)await loadScript('../shared/audio-source-choice-audio-status-v1.js?v=20261027-v1&audio=20261028-part-rescue-v1&status=20261111-audio-status-v1');
  if(!window.IZONE_EXAM_CLOCK)await loadScript('../shared/exam-clock.js?v=20261026-v1&resilience=20261027-v1');
  document.body.classList.add('cbt-mode');

  // Demo phải hoạt động không cần mã lớp hoặc backend. Đây cũng là đường QA
  // an toàn cho đồng nghiệp trước khi kết nối môi trường Portal thật.
  if (['complete', 'listening-only', 'writing-prep', 'writing'].includes(demoMode)) {
    if (!window.K67_SUBSTITUTE_TEST_1_CONTENT) {
      root.innerHTML = '<main class="page-shell"><section class="panel"><h1>Không tải được nội dung demo K67.</h1></section></main>';
      return;
    }
    window.TERM_TEST_CONTENT = Object.freeze(window.K67_SUBSTITUTE_TEST_1_CONTENT);
    Promise.resolve()
      .then(() => loadScript('../substitute-k67-shared/app-submission-recovery-v1.js?v=20261022-listening-recovery-v1&journal=20261024-startup-v2&ej=20261024-production-r1&recovery=20261026-v1&resilience=20261027-v1&status=20261103-t5r1&diagnostics=20261105-v2&sub_trace=20261105-v1&writingSubmit=20261105-v1&order=20261107-v1&offline=20261107-v2&eofLog=20261108-v1&uiRestore=20261108-v2&handoff=20261108-v1&resultAnchor=20261108-v1&readingHandoff=20261108-v1&continuity=20261110-listening-observations-v1&submission=20261113-capacity-v1&startTrace=20261114-v1'))
      .then(() => loadScript('enhance-submission-recovery-v1.js?v=20261022-listening-recovery-v1&recovery=20261026-v1&resilience=20261027-v1&examGuard=20261028-v1&workspace=20261031-v1&eof=20261107-v1&order=20261107-v1&offlineUi=20261107-v1&eofLog=20261108-v1&playLabel=20261108-v1&readingHandoff=20261108-v1&continuity=20261110-listening-observations-v1&previewWait=20261109-preview-10s-v1&submission=20261113-capacity-v1&startGuard=20261113-v1&startTrace=20261114-v1'))
      .then(() => loadScript('annotations.js?v=20261018-identity-v1&recovery=20261026-v1'))
      .catch(error => {
        root.innerHTML = `<main class="page-shell"><section class="panel"><h1>Không mở được demo.</h1><p>${escapeText(error.message)}</p></section></main>`;
      });
    return;
  }

  if(!localDemo){query.set('demo','exam');query.set('grading','server');location.replace(location.pathname+'?'+query.toString());return;}
  const offline=await import('./offline-submission-recovery-v1.mjs?v=20261112-submission-recovery-v1').catch(()=>null);
  try {
    if(query.get('reset')==='1'){
      if(query.get('resetOwner')!=='done'&&window.SUBSTITUTE_STATE.canReset(testConfig.slug))window.SUBSTITUTE_STATE.clear(testConfig.slug);
      query.delete('reset');query.delete('resetOwner');
      location.replace(location.pathname+'?'+query.toString());return;
    }
    await window.SUBSTITUTE_STATE.initialize(testConfig,appConfig,offline?{
      readOfflineMeta:offline.loadMeta,writeOfflineMeta:offline.saveMeta}:undefined);
  } catch(error) {
    root.textContent=error.message||'Không mở được phiên thi. Hãy tải lại trang.';return;
  }
  function prepareShellCache(){
    if(!offline||!('serviceWorker' in navigator)||!('caches' in window))return;
    navigator.serviceWorker.addEventListener('message',event=>{
      if(event.data?.type==='PRECACHE_RESULT')window.SUBSTITUTE_OFFLINE_SHELL_STATUS=event.data.ok?'ready':'partial';
    });
    void navigator.serviceWorker.register('./offline-sw.js?v=20261110-listening-observations-v1').then(async()=>{
      const registration=await navigator.serviceWorker.ready;
      const urls=[...document.querySelectorAll('script[src],link[href],img[src]')]
        .map(element=>element.src||element.href).filter(url=>url&&!new URL(url).pathname.includes('/exam-journal/'));
      for(const path of ['./offline-submission-recovery-v1.mjs?v=20261112-submission-recovery-v1','../substitute-shared/backup-export-submission-recovery-v1.mjs?v=20261112-submission-recovery-v1','../substitute-shared/listening-outbox-submission-recovery-v1.mjs?v=20261112-submission-recovery-v1','../substitute-shared/submission-recovery-v1.mjs?v=20261113-capacity-v1','../substitute-k67-shared/app-submission-recovery-v1.js','./enhance-submission-recovery-v1.js',
        './annotations.js','../substitute-shared/backup-export-submission-recovery-v1.mjs?v=20261107-v1','../substitute-shared/audio-preparation-audio-status-v1.mjs?v=20261111-audio-status-v1',
        '../../shared/audio/direct.mjs?v=20261111-audio-status-v1',
        '../../shared/audio/catalog.mjs?v=20261107-r2-direct1','../../shared/audio/direct-cache.mjs?v=20261107-r2-direct1','../shared/writing-submission.mjs','../../shared/substitute-student-identity.js',
        '../../shared/student-identity.js','../../shared/student-identity-migration.js',
        '../../shared/teacher-entry.js','../../shared/master170/question-layout-v1.1.mjs',
        '../shared/audio-source-choice-audio-status-v1.js?v=20261027-v1&audio=20261028-part-rescue-v1&status=20261111-audio-status-v1',
        '../shared/cbt-audio-download-status.mjs?v=20261111-audio-status-v1','../../shared/audio/transport-audio-status-v1.mjs'])
        urls.push(new URL(path,location.href).href);
      registration.active?.postMessage({type:'PRECACHE',urls});
    }).catch(()=>{window.SUBSTITUTE_OFFLINE_STATUS='shell_cache_failed';});
  }
  let sharedIdentity;
  try {
    const module = await import('../../shared/substitute-student-identity.js?v=20261018-identity-v1');
    sharedIdentity = module.createSubstituteStudentIdentity({ testSlug: testConfig.slug,
      historyEpoch: window.SUBSTITUTE_STATE.meta.historyEpoch });
    await sharedIdentity.migrateLegacy();
  } catch {
    root.textContent = 'Chưa tải đủ phần mở bài. Hãy tải lại; nháp và lượt thi cũ vẫn được giữ.';
    return;
  }
  let selectionSnapshot = null, classLoadGeneration = 0;
  const storageNamespace = localDemo ? 'RETAKE-LOBBY' : classCode;
  const storageKey = window.SUBSTITUTE_STATE.key('izone-test:',storageNamespace,{lobby:true});
  const uiStorageKey = window.SUBSTITUTE_STATE.key('izone-test-ui:',storageNamespace,{lobby:true});
  const annotationStorageKey = window.SUBSTITUTE_STATE.key('izone-test-annotations:',storageNamespace,{lobby:true});
  let state = await readState();
  const offlineScope=()=>({testSlug:testConfig.slug,historyEpoch:window.SUBSTITUTE_STATE.meta.historyEpoch,
    classCode:state.classCode||classCode,studentRef:state.studentRef,clientRunId:state.clientRunId,
    deviceId:state.annotationRunId,generation:Number(state.generation)||0});
  window.SUBSTITUTE_OFFLINE=offline?Object.freeze({
    saveSnapshot:(kind,value)=>offline.saveSnapshot(offlineScope(),kind,value),
    loadSnapshot:kind=>offline.loadSnapshot(offlineScope(),kind),
    saveAudio:blob=>offline.saveAudio(offlineScope(),blob),
    loadAudio:()=>offline.loadAudio(offlineScope()),
    queueSection:(skill,answers,recovery)=>offline.queueSection(offlineScope(),skill,answers,recovery),
    rememberSectionHold:(skill,hold,code)=>offline.rememberSectionHold(offlineScope(),skill,hold,code),
    pendingSections:()=>offline.pendingSections(offlineScope()),
    acknowledgeSection:(skill,receipt)=>offline.acknowledgeSection(offlineScope(),skill,receipt),
    listeningOutcome:()=>offline.listeningOutcome(offlineScope()),
    queueListeningInterruption:value=>offline.queueListeningInterruption(offlineScope(),value),
    acknowledgeListeningInterruption:value=>offline.acknowledgeListeningInterruption(offlineScope(),value),
    recordListeningEof:value=>offline.recordListeningEof(offlineScope(),value),
    acknowledgeListeningEof:value=>offline.acknowledgeListeningEof(offlineScope(),value),
    queueWriting:(payload,recovery)=>offline.queueWriting(offlineScope(),payload,recovery),
    writingRecord:()=>offline.writingRecord(offlineScope()),
    claimWritingDispatch:operationId=>offline.claimWritingDispatch(offlineScope(),operationId),
    pendingWriting:()=>offline.pendingWriting(offlineScope()),
    acknowledgeWriting:receipt=>offline.acknowledgeWriting(offlineScope(),receipt),
    makeDownload:appState=>offline.makeDownload(offlineScope(),appState)
  }):null;
  let legacyUiState = readLegacyUiState();
  let legacyListeningResume = Boolean(state.studentRef && !state.attemptToken && legacyUiState.audioStarted);
  let roster = [];
  let encryptedAudio = null;
  let previewObjectUrl = '';
  let officialObjectUrl = '';
  let previewHeard = false;
  let officialPlayer=null,officialReady=false,playerReadyMs=null,verifiedAudioBytes=null;
  const continuityEnabled=()=>localDemo&&Boolean(offline)&&(
    state.listeningContinuityVersion===1||(!state.examSessionId&&window.SUBSTITUTE_STATE.meta?.listeningContinuityEnabled===true));
  const previewSeconds=()=>continuityEnabled()?10:30;
  const previewLabel=(again=false)=>(again?'Nghe lại ':'Nghe thử ')+previewSeconds()+' giây đầu';
  let preparing = false;
  let listeningLease = null;
  let pendingListeningLease = null;
  let downloadController = null;
  let preparedAudio = null;
  const localDemoClasses = Object.freeze([...(window.SUBSTITUTE_STATE.meta.classes || [
    {
      code: 'DEMO',
      name: 'DEMO · Chỉ kiểm tra, không gửi Portal'
    },
    {
      code: 'IC2063',
      name: 'IC2063 · Lớp K67'
    }
  ])].sort((a, b) => Number(a.code === 'DEMO') - Number(b.code === 'DEMO')));

  root.innerHTML = `
    <header class="topbar cbt-bootstrap-topbar">
      <h1>Substitute Test 1 · Khóa 67</h1>
    </header>
    <main class="page-shell cbt-bootstrap-shell">
      <section class="panel cbt-bootstrap-card" aria-labelledby="securePrepTitle">
        <header class="cbt-lobby-header">
          <span class="cbt-lobby-badge">Phòng chờ bài thi lại</span>
          <h2 id="securePrepTitle">Kiểm tra âm thanh trước khi bắt đầu</h2>
          <p>Chọn đúng lớp và họ tên của bạn. Đề thi vẫn khóa cho đến khi hoàn tất bước xác nhận.</p>
        </header>
        <div class="cbt-bootstrap-identity">
          <label>Lớp
            <select id="bootstrapClass" required>
              <option value="">Nhấn để chọn lớp</option>
            </select>
          </label>
          <label>Họ và tên
            <select id="bootstrapStudent" required disabled>
              <option value="">Chọn lớp trước</option>
            </select>
          </label>
          <p class="cbt-roster-note">Danh sách chỉ hiển thị học viên được xếp tham gia bài thi lại của lớp đã chọn.</p>
          <button class="button button-secondary" id="bootstrapChangeStudent" type="button">Đổi người học</button>
        </div>
        <label id="bootstrapOrderLabel" ${window.SUBSTITUTE_STATE.meta.readingFirstEnabled===true||state.examOrder==='reading-first'?'':'hidden'}>Thứ tự làm bài
          <select id="bootstrapOrder">
            <option value="listening-first">Listening trước · Reading sau</option>
            <option value="reading-first">Reading trước · Listening sau</option>
          </select>
        </label>
        <div class="cbt-lobby-steps">
          <section class="cbt-lobby-step" id="bootstrapDownloadStep" data-state="locked">
            <span class="cbt-lobby-step-number">1</span>
            <div class="cbt-lobby-step-body">
              <h3>Tải đủ audio đã mã hóa</h3>
              <p>Chọn đúng lớp và họ tên rồi chờ thanh tải đạt 100%.</p>
              <strong class="cbt-audio-status cbt-lobby-download-status" id="bootstrapDownloadStatus" role="status">Đang tải danh sách lớp...</strong>
              <progress class="cbt-audio-progress" id="bootstrapDownloadProgress" max="1" value="0"></progress>
              <button class="button button-secondary" id="bootstrapRetry" type="button" hidden>Thử tải lại</button>
            </div>
          </section>
          <section class="cbt-lobby-step" id="bootstrapPreviewStep" data-state="locked">
            <span class="cbt-lobby-step-number">2</span>
            <div class="cbt-lobby-step-body">
              <h3>Nghe thử ${previewSeconds()} giây</h3>
              <p>Bạn cần nghe đủ ${previewSeconds()} giây đầu. Âm lượng này được giữ cho bài thi chính.</p>
              <div class="cbt-lobby-preview-controls">
                <button class="button button-secondary" id="bootstrapPreview" type="button" disabled>${previewLabel()}</button>
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
    </main>
    <dialog class="cbt-identity-confirm" id="identityConfirm" aria-labelledby="identityConfirmTitle" aria-describedby="identityConfirmHelp">
      <p class="cbt-confirm-eyebrow">Kiểm tra trước khi vào bài</p>
      <h2 id="identityConfirmTitle">Xác nhận thông tin học viên</h2>
      <p id="identityConfirmHelp">Vui lòng kiểm tra đúng họ tên và lớp của bạn trước khi tiếp tục.</p>
      <dl><div><dt>Họ và tên</dt><dd id="confirmStudentName"></dd></div><div><dt>Lớp</dt><dd id="confirmClassName"></dd></div></dl>
      <p class="cbt-confirm-warning">Nếu thông tin chưa đúng, hãy quay lại và chọn lại tên.</p>
      <div class="cbt-confirm-actions"><button class="button button-secondary" id="cancelIdentity" type="button">Quay lại chọn tên</button><button class="button button-primary" id="confirmIdentity" type="button">Xác nhận, tiếp tục</button></div>
    </dialog>`;

  const elements = Object.fromEntries([
    'bootstrapStudent', 'bootstrapClass', 'bootstrapDownloadStep', 'bootstrapDownloadStatus',
    'bootstrapDownloadProgress', 'bootstrapRetry', 'bootstrapPreviewStep', 'bootstrapPreview',
    'bootstrapVolume', 'bootstrapPreviewStatus', 'bootstrapStartStep', 'bootstrapStartStatus',
    'bootstrapStart', 'bootstrapNotice', 'bootstrapOrder'
  ].map(id => [id, document.getElementById(id)]));
  elements.bootstrapOrder.value=state.examOrder==='reading-first'?'reading-first':'listening-first';
  elements.bootstrapOrder.disabled=Boolean(state.examSessionId);
  elements.bootstrapOrder.addEventListener('change',()=>{
    if(state.examSessionId){elements.bootstrapOrder.value=state.examOrder||'listening-first';return;}
    saveState({examOrder:elements.bootstrapOrder.value});
    setStartAvailability();
  });
  const previewAudio = document.createElement('audio');
  previewAudio.hidden = true;
  document.body.append(previewAudio);
  const identityDialog = document.getElementById('identityConfirm');
  let pendingStudent = null;

  function resetPreparation() {
    downloadController?.abort();
    previewAudio.pause();
    previewAudio.removeAttribute('src');
    clearOfficialPreparation();
    revokePreview();
    encryptedAudio = null;
    previewHeard = false;
    elements.bootstrapPreview.disabled = true;
    elements.bootstrapVolume.disabled = true;
    elements.bootstrapStart.disabled = true;
    window.IZONE_CBT_AUDIO_START_LABEL?.(elements.bootstrapStart);
    elements.bootstrapRetry.hidden = true;
    elements.bootstrapNotice.hidden = true;
    elements.bootstrapPreview.textContent = previewLabel();
    elements.bootstrapPreviewStatus.textContent = 'Chờ xác nhận học viên và tải audio.';
    elements.bootstrapDownloadProgress.max = 1;
    elements.bootstrapDownloadProgress.value = 0;
    elements.bootstrapDownloadStatus.textContent = 'Hãy chọn và xác nhận học viên để tải audio.';
    for (const step of ['bootstrapDownloadStep', 'bootstrapPreviewStep', 'bootstrapStartStep']) elements[step].dataset.state = 'locked';
  }

  function cancelIdentity() {
    pendingStudent = null;
    identityDialog.close();
    elements.bootstrapStudent.value = '';
    elements.bootstrapStudent.focus();
  }
  document.getElementById('cancelIdentity').addEventListener('click', cancelIdentity);
  identityDialog.addEventListener('cancel', event => { event.preventDefault(); cancelIdentity(); });
  document.getElementById('confirmIdentity').addEventListener('click', async () => {
    if (!pendingStudent || preparing || state.listeningStartedAt) return;
    const student = pendingStudent;
    pendingStudent = null;
    identityDialog.close();
    try {
      if (!await bindSelectedStudent(student)) return;
      await prepareSelectedStudent();
    } catch (error) { showNotice(error.message || 'Chưa mở được lượt thi. Hãy tải lại; nháp vẫn được giữ.', true); }
    return;
  });

  function studentPointer(studentRef, selectedClass = classCode) {
    return `izone-substitute-lobby-v1:${testConfig.slug}:${window.SUBSTITUTE_STATE.meta.historyEpoch}:${selectedClass}:${studentRef}`;
  }

  async function acquireListeningLease(studentRef, selectedClass) {
    if (!navigator.locks?.request) return;
    const key = studentPointer(studentRef, selectedClass);
    if (listeningLease?.key === key) return;
    if (pendingListeningLease?.key === key) return pendingListeningLease.result;
    if (listeningLease || pendingListeningLease) throw Error('Tab đang mở một lượt khác.');
    const result = new Promise((resolve, reject) => {
      navigator.locks.request(key, { ifAvailable: true }, lock => {
        if (!lock) {
          reject(Error('Bài đang mở ở tab khác. Hãy quay lại tab đó hoặc đóng tab đó trước khi thử lại.'));
          return;
        }
        return new Promise(release => {
          listeningLease = { key, release };
          resolve();
        });
      }).catch(reject);
    });
    pendingListeningLease = { key, result };
    try { await result; }
    finally { pendingListeningLease = null; }
  }

  function releaseListeningLease() {
    listeningLease?.release();
    listeningLease = null;
  }

  async function bindSelectedStudent(student) {
    const selectedClass = elements.bootstrapClass.value || classCode;
    const selectionGeneration = classLoadGeneration;
    const selectedStudentValue = elements.bootstrapStudent.value;
    await acquireListeningLease(student.ref, selectedClass);
    let restored = null;
    // Chỉ đọc con trỏ đúng người/lớp/lịch sử; nháp đầy đủ vẫn nằm trong khóa theo lượt.
    for (const storage of window.SUBSTITUTE_STATE.storages()) {
      try {
        const candidate = JSON.parse(storage.getItem(studentPointer(student.ref, selectedClass)) || 'null');
        if (candidate?.studentRef === student.ref && candidate.classCode === selectedClass
            && await window.SUBSTITUTE_STATE.verifyStoredRun(candidate) && window.SUBSTITUTE_STATE.accept(candidate, null)) { restored = candidate; break; }
      } catch { /* Không xóa nháp hỏng hoặc dữ liệu chưa xác định chủ. */ }
    }
    if(!restored&&offline){
      try{
        const candidate=await offline.latestLobby({historyEpoch:window.SUBSTITUTE_STATE.meta.historyEpoch,
          classCode:selectedClass,studentRef:student.ref});
        if(candidate?.studentRef===student.ref&&candidate.classCode===selectedClass
          &&await window.SUBSTITUTE_STATE.verifyStoredRun(candidate)
          &&window.SUBSTITUTE_STATE.accept(candidate,null))restored=candidate;
      }catch{/* Nếu IndexedDB lỗi, vẫn dùng lượt đã xác nhận trên máy chủ. */}
    }
    if (selectionGeneration !== classLoadGeneration || elements.bootstrapClass.value !== selectedClass
        || elements.bootstrapStudent.value !== selectedStudentValue) {
      releaseListeningLease();
      return false;
    }
    if (restored) {
      window.SUBSTITUTE_STATE.bind(restored);
      const ownKey = window.SUBSTITUTE_STATE.key('izone-test:', selectedClass);
      for (const storage of window.SUBSTITUTE_STATE.storages()) {
        try {
          const latest = JSON.parse(storage.getItem(ownKey) || 'null');
          if (latest?.studentRef === student.ref && window.SUBSTITUTE_STATE.accept(latest)) {
            restored = { ...restored, ...latest }; break;
          }
        } catch { /* Giữ bản phòng chờ của cùng lượt nếu bản đầy đủ không đọc được. */ }
      }
    }
    const chosenOrder=elements.bootstrapOrder.value;
    state = restored || { audioVolume: state.audioVolume, classCode: selectedClass,examOrder:chosenOrder };
    saveState({ classCode: selectedClass, studentRef: student.ref, studentName: student.name,
      identityConfirmed: true, annotationRunId: state.annotationRunId || crypto.randomUUID() });
    elements.bootstrapOrder.value=state.examOrder==='reading-first'?'reading-first':'listening-first';
    elements.bootstrapOrder.disabled=Boolean(state.examSessionId);
    elements.bootstrapClass.disabled = true;
    elements.bootstrapStudent.value = student.ref;
    legacyUiState = readLegacyUiState();
    legacyListeningResume = Boolean(state.listeningStartedAt);
    void Promise.resolve(sharedIdentity.rememberSelected(selectedClass, student, selectionSnapshot)).then(result => {
    if (!['ok', 'demo'].includes(result.status)) showNotice('Bài vẫn giữ đúng người. Chưa ghi nhớ được người học để dùng ở bài khác.');
    }).catch(() => showNotice('Bài vẫn giữ đúng người. Chưa ghi nhớ được người học để dùng ở bài khác.'));
    return true;
  }

  async function changeSharedStudent() {
    if ((await sharedIdentity.forget()).status !== 'empty') return false;
    window.SUBSTITUTE_STATE.stop();
    releaseListeningLease();
    window.TERM_TEST_ALLOW_NAVIGATION = true;
    location.reload();
    return true;
  }
  window.TERM_TEST_CHANGE_STUDENT = changeSharedStudent;
  document.getElementById('bootstrapChangeStudent').addEventListener('click', async () => {
    if (preparing) { showNotice('Đang chuẩn bị audio. Hãy chờ xong trước khi đổi người học.'); return; }
    if (!await changeSharedStudent()) showNotice('Chưa đổi được lựa chọn chung. Nháp vẫn được giữ.', true);
  });
  sharedIdentity.subscribe(() => {
    if (state.studentRef) showNotice('Lựa chọn chung trên trình duyệt đã đổi. Lượt thi trong tab này vẫn giữ đúng người đã chọn.');
  });

  function escapeText(value) {
    return String(value || '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  async function readState() {
    for (const storage of window.SUBSTITUTE_STATE.storages(['sessionStorage'])) {
      try {
        const parsed = JSON.parse(storage.getItem(storageKey) || '{}');
        if (await window.SUBSTITUTE_STATE.verifyStoredRun(parsed) && window.SUBSTITUTE_STATE.accept(parsed,null) && sharedIdentity.mayRestore(parsed)) {
          if(parsed.studentRef)window.SUBSTITUTE_STATE.bind(parsed);
          return parsed;
        }
      } catch {
        // Tiếp tục với nguồn bộ nhớ còn lại.
      }
    }
    return {};
  }

  function readLegacyUiState() {
    for (const storage of window.SUBSTITUTE_STATE.storages()) {
      try {
        const parsed = JSON.parse(storage.getItem(state.studentRef ? window.SUBSTITUTE_STATE.key('izone-test-ui:',state.classCode || classCode) : uiStorageKey) || '{}');
        if (window.SUBSTITUTE_STATE.accept(parsed)) {
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
    if(state.studentRef){
      state.clientRunId ||= crypto.randomUUID();
      window.SUBSTITUTE_STATE.bind(state);
    }
    state=window.SUBSTITUTE_STATE.stamp(state);
    if (state.studentRef) sharedIdentity.pin(state);
    const serialized = JSON.stringify(state);
    for (const storage of window.SUBSTITUTE_STATE.storages(['sessionStorage'])) {
      try {
        storage.setItem(storageKey, serialized);
      } catch {
        // Phiên thi chính vẫn nằm trên máy chủ nếu bộ nhớ trình duyệt bị chặn.
      }
    }
    if (state.studentRef && state.classCode) {
      for (const storage of window.SUBSTITUTE_STATE.storages()) {
        try { storage.setItem(studentPointer(state.studentRef, state.classCode), serialized); }
        catch { /* Không xóa con trỏ/bài cũ khi bộ nhớ hết chỗ. */ }
      }
    }
    if(state.studentRef&&state.clientRunId)
      void window.SUBSTITUTE_OFFLINE?.saveSnapshot('lobby',state)?.catch(()=>{
        window.SUBSTITUTE_OFFLINE_STATUS='checkpoint_failed';
      });
    if (localDemo) {
      history.replaceState({ ...(history.state || {}), k67DemoState: state }, '', window.location.href);
    }
  }

  function showNotice(message, error = false) {
    elements.bootstrapNotice.hidden = false;
    elements.bootstrapNotice.className = `notice${error ? ' error' : ''}`;
    elements.bootstrapNotice.textContent = message;
  }

  async function apiRequest(path, options = {}, timeoutMs = 30_000) {
    let initializationRequest, initializationStatus;
    try { initializationRequest = window.EXAM_JOURNAL_STARTUP?.startRequest(path, options); } catch {}
    const controller = new AbortController();
    const untrack=window.SUBSTITUTE_STATE.track(controller);
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(appConfig.API_BASE_URL + path, { ...options, signal: controller.signal });
      initializationStatus = response.status;
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Lỗi HTTP ${response.status}`);
      try { initializationRequest?.done(data, undefined, initializationStatus); } catch {}
      return data;
    } catch (error) {
      try { initializationRequest?.done(undefined, error, initializationStatus); } catch {}
      if (error.name === 'AbortError') throw new Error('Máy chủ phản hồi quá chậm. Hãy thử lại.');
      throw error;
    } finally {
      window.clearTimeout(timeout);
      untrack();
    }
  }

  function formatBytes(bytes) {
    return `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
  }

  function setStartAvailability() {
    const resumed = Boolean(state.listeningStartedAt || state.readingStartedAt || legacyListeningResume);
    const ready = Boolean(encryptedAudio && (previewHeard || resumed) && (!continuityEnabled()||officialReady));
    elements.bootstrapStart.disabled = !ready || preparing;
    elements.bootstrapStart.textContent = resumed ? 'Tiếp tục bài thi Listening' : 'Bắt đầu thi Listening';
    window.IZONE_CBT_AUDIO_START_LABEL?.(elements.bootstrapStart, previewHeard && !resumed);
    if(elements.bootstrapOrder.value==='reading-first')elements.bootstrapStart.textContent=resumed?'Tiếp tục lượt thi':'Bắt đầu thi Reading';
    elements.bootstrapStartStatus.textContent = elements.bootstrapOrder.value==='reading-first'
      ? (resumed?'Tiến độ Reading và Listening của lượt này được giữ.':'Reading mở trước; audio Listening chỉ phát sau khi Reading đã được lưu.')
      : resumed
      ? 'Đồng hồ máy chủ vẫn đang chạy. Tiếp tục ngay sau khi audio tải đủ.'
      : 'Sau khi bấm, đồng hồ máy chủ bắt đầu và đề mới được mở.';
  }

  function revokePreview() {
    window.IZONE_CBT_AUDIO_CANCEL_PREVIEW_WAIT?.(previewAudio);
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = '';
  }

  function waitForAudioMetadata(audioElement) {
    if (Number.isFinite(audioElement.duration) && audioElement.duration > 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      audioElement.addEventListener('loadedmetadata', resolve, { once: true });
      audioElement.addEventListener('error', () => reject(new Error('Trình duyệt không đọc được audio khóa 56.')), { once: true });
      audioElement.load();
    });
  }

  function clearOfficialPreparation(){
    if(officialPlayer)officialPlayer.remove();
    if(officialObjectUrl)URL.revokeObjectURL(officialObjectUrl);
    officialPlayer=null;officialObjectUrl='';officialReady=false;playerReadyMs=null;verifiedAudioBytes=null;
  }

  function prepareOfficialPlayer(blob,signal){
    clearOfficialPreparation();
    const preloadStarted=performance.now(),player=document.createElement('audio');
    player.hidden=true;player.preload='auto';player.controls=false;
    officialPlayer=player;
    verifiedAudioBytes=blob.size;
    officialObjectUrl=URL.createObjectURL(blob);
    player.src=officialObjectUrl;
    document.body.append(player);
    player.addEventListener('canplay',()=>{
      if(signal.aborted||officialPlayer!==player)return;
      officialReady=true;playerReadyMs=performance.now()-preloadStarted;
      setStartAvailability();
    },{once:true});
    player.addEventListener('error',()=>{
      if(signal.aborted||officialPlayer!==player||state.examSessionId)return;
      showNotice('Trình duyệt chưa chuẩn bị được trình phát chính. Hãy tải lại audio.',true);
      elements.bootstrapRetry.hidden=false;
    },{once:true});
    player.load();
  }

  const audioScope=()=>({...offlineScope(),examOrder:state.examOrder||'listening-first'});

  async function requestAudioPreparation(input,signal){
    const controller=new AbortController();
    const cancel=()=>controller.abort(signal?.reason);
    signal?.addEventListener('abort',cancel,{once:true});
    if(signal?.aborted)cancel();
    const timeout=window.setTimeout(()=>controller.abort(),20_000);
    const untrack=window.SUBSTITUTE_STATE.track(controller);
    try{
      const response=await fetch(appConfig.API_BASE_URL,{method:'POST',cache:'no-store',signal:controller.signal,
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify({route:'/api/test/exam/audio/prepare',payload:window.SUBSTITUTE_STATE.payload(input)})});
      if(!response.ok)throw Object.assign(new Error('Chưa xác nhận được quyền tải audio. Hãy thử lại.'),
        {accessDenied:response.status<500,audioRefreshUnavailable:response.status>=500});
      return await response.json();
    }catch(error){
      signal?.throwIfAborted();
      if(error instanceof TypeError||error.name==='AbortError')error.audioRefreshUnavailable=true;
      throw error;
    }finally{
      window.clearTimeout(timeout);signal?.removeEventListener('abort',cancel);untrack();
    }
  }

  async function authorizeAudio(scope,signal){
    const {authorizeSubstituteAudio}=await import('../substitute-shared/audio-preparation-audio-status-v1.mjs?v=20261111-audio-status-v1');
    return authorizeSubstituteAudio(scope,requestAudioPreparation,{signal});
  }

  async function downloadLocalDemoAudio(retry = false) {
    downloadController?.abort();
    downloadController = new AbortController();
    const signal = downloadController.signal;
    encryptedAudio = null;
    preparedAudio = null;
    clearOfficialPreparation();
    const resuming = Boolean(state.listeningStartedAt || state.readingStartedAt);
    window.IZONE_CBT_AUDIO_CANCEL_PREVIEW_WAIT?.(previewAudio);
    previewHeard = resuming;
    elements.bootstrapDownloadStep.dataset.state = 'active';
    elements.bootstrapPreviewStep.dataset.state = 'locked';
    elements.bootstrapStartStep.dataset.state = 'locked';
    elements.bootstrapRetry.hidden = true;
    elements.bootstrapPreview.disabled = true;
    elements.bootstrapVolume.disabled = true;
    elements.bootstrapStart.disabled = true;
    window.IZONE_CBT_AUDIO_START_LABEL?.(elements.bootstrapStart);
    const audioStatus = beginAudioDownloadStatus(elements.bootstrapDownloadStatus,
      elements.bootstrapDownloadProgress, {signal, formatBytes, retry, preparing: true});
    try {
      const source = window.K67_SUBSTITUTE_TEST_1_CONTENT?.audio?.src;
      if (!source) throw new Error('Không tìm thấy đường dẫn audio khóa 56.');
      const scope=audioScope();
      const canResumeAudio=state.offlinePermit&&state.examSessionId===scope.clientRunId&&
        state.offlineDeviceId===scope.deviceId&&state.offlineGeneration===scope.generation;
      let preparation=null,preparationError=null;
      if(window.SUBSTITUTE_STATE.meta?.r2DirectEnabled===true&&(navigator.onLine!==false||!canResumeAudio)){
        try{preparation=await authorizeAudio(scope,downloadController.signal);}
        catch(error){
          if(!canResumeAudio||!error.audioRefreshUnavailable)throw error;
          preparationError=error;
        }
      }
      let audioBlob=null;
      try{audioBlob=await window.SUBSTITUTE_OFFLINE?.loadAudio();}catch{/* Tải lại từ nguồn có kiểm hash. */}
      if(!audioBlob&&preparationError)throw preparationError;
      const fromCache=Boolean(audioBlob);
      const options={
        signal,
        onProgress: audioStatus.progress,
        onPhase: audioStatus.phase
      };
      if(!audioBlob)audioBlob = await (preparation?preparation.download(options):audioLoader.downloadAudio(source,options));
      preparation?.startFields(audioScope());
      if (continuityEnabled()&&!preparation&&!fromCache) {
        audioStatus.phase('Đã tải đủ. Đang kiểm tra tệp âm thanh…');
        await offline.verifyAudio(audioBlob);
      }
      downloadController.signal.throwIfAborted();
      preparedAudio=preparation;
      if(audioBlob&&!fromCache)
        void window.SUBSTITUTE_OFFLINE?.saveAudio(audioBlob)?.catch(()=>{window.SUBSTITUTE_OFFLINE_STATUS='audio_cache_failed';});
      encryptedAudio = audioBlob;
      if(continuityEnabled())prepareOfficialPlayer(audioBlob,downloadController.signal);
      signal.throwIfAborted();
      audioStatus.phase('Đang chuẩn bị trình phát…');
      revokePreview();
      previewObjectUrl = URL.createObjectURL(audioBlob);
      previewAudio.src = previewObjectUrl;
      previewAudio.volume = Number(elements.bootstrapVolume.value) || 1;
      await waitForAudioMetadata(previewAudio);
      signal.throwIfAborted();
      audioStatus.finish(`Đã tải đủ audio · 100% · ${formatBytes(audioBlob.size)}`, {ready:true});
      elements.bootstrapDownloadStep.dataset.state = 'complete';
      elements.bootstrapPreviewStep.dataset.state = resuming ? 'skipped' : 'active';
      elements.bootstrapPreview.hidden = resuming;
      elements.bootstrapPreview.disabled = resuming;
      elements.bootstrapVolume.disabled = false;
      elements.bootstrapPreviewStatus.textContent = resuming
        ? 'Bài thi đã bắt đầu nên chế độ nghe thử đã đóng.'
        : 'Bấm nút để nghe thử đúng '+previewSeconds()+' giây đầu của audio khóa 56.';
      elements.bootstrapPreview.textContent=previewLabel();
      if (resuming) elements.bootstrapStartStep.dataset.state = 'active';
      setStartAvailability();
    } catch (error) {
      if (signal.aborted) return;
      elements.bootstrapDownloadStep.dataset.state = 'error';
      elements.bootstrapPreviewStep.dataset.state = 'locked';
      elements.bootstrapStartStep.dataset.state = 'locked';
      audioStatus.finish('Chưa tải đủ audio. Bài thi vẫn đang khóa.');
      elements.bootstrapRetry.hidden = false;
      showNotice(error.userMessage || error.message, true);
    }
  }

  async function downloadForSession(session, retry = false) {
    downloadController?.abort();
    downloadController = new AbortController();
    const signal = downloadController.signal;
    encryptedAudio = null;
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
      const audioUrl = appConfig.API_BASE_URL + session.encryptedAudioUrl;
      const previewUrl = appConfig.API_BASE_URL + session.previewAudioUrl;
      const [encrypted, previewResponse] = await Promise.all([
        audioLoader.downloadAudio(audioUrl, {
          signal,
          onProgress: audioStatus.progress,
          onPhase: audioStatus.phase
        }),
        fetch(previewUrl, { cache: 'no-store', signal })
      ]);
      if (!previewResponse.ok) throw new Error('Không tải được bản nghe thử.');
      encryptedAudio = encrypted;
      const previewBlob = await previewResponse.blob();
      signal.throwIfAborted();
      audioStatus.phase('Đang chuẩn bị trình phát…');
      revokePreview();
      previewObjectUrl = URL.createObjectURL(previewBlob);
      previewAudio.src = previewObjectUrl;
      previewAudio.volume = Number(elements.bootstrapVolume.value) || 1;
      signal.throwIfAborted();
      audioStatus.finish(`Đã tải đủ audio mã hóa · 100% · ${formatBytes(encrypted.size)}`, {ready:true});
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
      elements.bootstrapRetry.hidden = false;
      showNotice(error.userMessage || error.message, true);
    }
  }

  // Phòng chờ và app dùng hai namespace khác nhau; chỉ nối lại đúng học viên/lớp.
  function hasSavedGradedProgress() {
    if (!localDemo || !state.identityConfirmed || !state.listeningStartedAt) return false;
    const key = window.SUBSTITUTE_STATE.key('izone-test:',state.classCode || classCode);
    for (const storage of window.SUBSTITUTE_STATE.storages()) {
      try {
        const saved = JSON.parse(storage.getItem(key) || '{}');
        if (!saved || !Object.keys(saved).length || !window.SUBSTITUTE_STATE.accept(saved,state)) continue;
        return saved.studentRef === state.studentRef
          && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(saved.attemptToken || ''))
          && Boolean(saved.testGrades?.listening);
      } catch {
        // Nếu vùng lưu bị chặn/hỏng thì thử bản dự phòng, không xóa dữ liệu.
      }
    }
    return false;
  }

  async function openRecoveredListening(){
    if(state.listeningContinuityVersion!==1||!state.listeningStartedAt)return false;
    const outcome=await window.SUBSTITUTE_OFFLINE.listeningOutcome();
    const appCheckpoint=await window.SUBSTITUTE_OFFLINE.loadSnapshot('app');
    const submitted=Boolean(outcome.submission||appCheckpoint?.testGrades?.listening||appCheckpoint?.pendingSections?.listening);
    const audioEndedAt=state.audioEndedAt||outcome.eof?.audioEndedAt;
    let interruption=outcome.interruption||state.listeningInterruption;
    if(state.listeningPlaybackPending&&!audioEndedAt&&!interruption&&!submitted)return false;
    if(!interruption&&!audioEndedAt&&!submitted){
      interruption=await window.SUBSTITUTE_OFFLINE.queueListeningInterruption({
        operationId:crypto.randomUUID(),reason:'reload',capturedAt:window.SUBSTITUTE_EXAM.clockIso(state)
      });
    }
    if(audioEndedAt)saveState({audioEndedAt,listeningDeadlineAt:state.listeningDeadlineAt||outcome.eof?.listeningDeadlineAt});
    if(interruption)saveState({listeningInterruption:interruption});
    await enterExam({content:window.K67_SUBSTITUTE_TEST_1_CONTENT,serverNow:window.SUBSTITUTE_EXAM.clockIso(state),
      listeningDeadlineAt:state.listeningDeadlineAt||'',listeningSubmitted:submitted,
      recoveredListeningSubmission:outcome.submission&&!appCheckpoint?.testGrades?.listening
        ?{answers:outcome.submission.answers}:null,
      continuityReview:Boolean(audioEndedAt&&!submitted&&!interruption)});
    return true;
  }

  async function prepareSelectedStudent(retry = false) {
    const studentRef = elements.bootstrapStudent.value;
    const student = roster.find(item => item.ref === studentRef);
    if (!student || preparing || (!state.identityConfirmed && !state.listeningStartedAt && !state.attemptToken && !legacyListeningResume)) return;
    preparing = true;
    const preparationStatus = beginAudioDownloadStatus(elements.bootstrapDownloadStatus,
      elements.bootstrapDownloadProgress, {formatBytes, retry, preparing:true});
    elements.bootstrapStudent.disabled = true;
    try {
      await acquireListeningLease(studentRef, state.classCode || classCode);
      saveState({ studentRef, studentName: student.name, annotationRunId: state.annotationRunId || crypto.randomUUID() });
      if (localDemo) {
        if(await openRecoveredListening())return;
        if (state.attemptToken || hasSavedGradedProgress()) {
          const serverNow = new Date().toISOString();
          await enterExam({
            content: window.K67_SUBSTITUTE_TEST_1_CONTENT,
            serverNow,
            listeningStartedAt: state.listeningStartedAt || serverNow,
            listeningDeadlineAt: state.listeningDeadlineAt || serverNow,
            listeningSubmitted: true
          });
          return;
        }
        if (!state.listeningStartedAt) {
          saveState({
            examSessionToken: 'local-demo-session',
            attemptToken: '',
            listeningStartedAt: '',
            listeningDeadlineAt: ''
          });
        }
        await downloadLocalDemoAudio(retry);
        return;
      }
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
        attemptToken: prepared.attemptToken || state.attemptToken || ''
      });
      if (state.attemptToken || prepared.listeningSubmitted) {
        await resumeAfterListening();
        return;
      }
      await downloadForSession(prepared,retry);
    } catch (error) {
      elements.bootstrapStudent.disabled = false;
      if (localDemo && !state.listeningStartedAt) elements.bootstrapClass.disabled = false;
      showNotice(`Chưa chuẩn bị được bài thi: ${error.message}`, true);
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

  async function enterExam(started, audioElement = null, deferredPlayback = null) {
    let appCheckpoint=null,uiCheckpoint=null;
    try{[appCheckpoint,uiCheckpoint]=await Promise.all([
      window.SUBSTITUTE_OFFLINE?.loadSnapshot('app'),window.SUBSTITUTE_OFFLINE?.loadSnapshot('ui')]);}
    catch{/* App sẽ dùng bản sessionStorage/RAM hiện có. */}
    deferredPlayback?.verify();
    window.addEventListener('term-test:listening-timing-updated',event=>{
      if(state.examSessionId&&event.detail?.audioEndedAt)saveState({audioEndedAt:event.detail.audioEndedAt,listeningDeadlineAt:event.detail.listeningDeadlineAt});
    });
    window.addEventListener('term-test:listening-phase-started',event=>{
      if(state.examSessionId&&event.detail?.clientRunId===state.clientRunId)
        saveState({listeningStartedAt:event.detail.listeningStartedAt,
          ...(event.detail.playbackPending?{listeningPlaybackPending:true}:{}),
          offlineListeningPending:event.detail.offlineListeningPending===true,serverTimeOffsetMs:
          (window.IZONE_EXAM_CLOCK?.offset(event.detail.serverNow) ?? (Date.parse(event.detail.serverNow)-Date.now()))});
    });
    window.TERM_TEST_CONTENT = Object.freeze(started.content);
    window.TERM_TEST_BOOTSTRAP = Object.freeze({
      startAtFirstSection,
      classCode: state.classCode || classCode,
      studentRef: state.studentRef,
      clientRunId: state.clientRunId,
      examSessionId:state.examSessionId,
      examOrder:state.examOrder||'listening-first',
      listeningContinuityVersion:state.listeningContinuityVersion,
      submissionRecoveryVersion:state.submissionRecoveryVersion===1?1:0,
      listeningInterruption:state.listeningInterruption||null,
      continuityReview:started.continuityReview===true,
      recoveredListeningSubmission:started.recoveredListeningSubmission||null,
      listeningStartup:state.listeningContinuityVersion===1?{playerReadyMs,verifiedAudioBytes}:null,
      preparedListeningPlayer:state.listeningContinuityVersion===1&&state.examOrder==='reading-first'&&!state.listeningStartedAt
        ?officialPlayer:null,
      readingStartedAt:state.readingStartedAt||'',
      readingDeadlineAt:state.readingDeadlineAt||'',
      offlinePermit:state.offlinePermit||'',
      offlineDeviceId:state.offlineDeviceId||'',
      offlineGeneration:state.offlineGeneration??null,
      offlineListeningPending:state.offlineListeningPending===true,
      uiState:uiCheckpoint,
      audioEndedAt:state.audioEndedAt,
      serverTimeOffsetMs:state.serverTimeOffsetMs,
      attemptToken: state.attemptToken,
      historyEpoch: window.SUBSTITUTE_STATE.meta.historyEpoch,
      listeningStartedAt: state.listeningStartedAt,
      studentName: state.studentName,
      examSessionToken: state.examSessionToken,
      listeningDeadlineAt: started.listeningDeadlineAt,
      serverNow: started.serverNow,
      audioVolume: Number(state.audioVolume) || 1,
      officialAudioElement: audioElement,
      deferredPlayback,
      markListeningPlaying:()=>saveState({listeningPlaybackPending:false}),
      preloadedAudioBlob:state.listeningContinuityVersion!==1&&state.examOrder==='reading-first'&&!state.listeningStartedAt?encryptedAudio:null,
      officialAudioUrl: officialObjectUrl,
      skipListeningAudio: Boolean(state.attemptToken || started.listeningSubmitted || state.listeningInterruption),
      sessionState: Object.freeze(appCheckpoint??{ ...state }),
      annotationRunId: state.annotationRunId
    });
    previewAudio.remove();
    revokePreview();
    await loadScript('../substitute-k67-shared/app-submission-recovery-v1.js?v=20261022-listening-recovery-v1&journal=20261024-startup-v2&ej=20261024-production-r1&recovery=20261026-v1&resilience=20261027-v1&status=20261103-t5r1&diagnostics=20261105-v2&sub_trace=20261105-v1&writingSubmit=20261105-v1&blankWriting=20261107-v1&order=20261107-v1&offline=20261107-v2&eofLog=20261108-v1&uiRestore=20261108-v2&handoff=20261108-v1&resultAnchor=20261108-v1&readingHandoff=20261108-v1&continuity=20261110-listening-observations-v1&submission=20261113-capacity-v1&startTrace=20261114-v1');
    deferredPlayback?.verify();
    await loadScript('enhance-submission-recovery-v1.js?v=20261022-listening-recovery-v1&recovery=20261026-v1&resilience=20261027-v1&examGuard=20261028-v1&workspace=20261031-v1&eof=20261107-v1&order=20261107-v1&offlineUi=20261107-v1&eofLog=20261108-v1&playLabel=20261108-v1&readingHandoff=20261108-v1&continuity=20261110-listening-observations-v1&previewWait=20261109-preview-10s-v1&submission=20261113-capacity-v1&startGuard=20261113-v1&startTrace=20261114-v1');
    await loadScript('annotations.js?v=20261018-identity-v1&recovery=20261026-v1');
    if(deferredPlayback){
      deferredPlayback.verify();
      if(typeof deferredPlayback.start!=='function')throw Error('Màn làm bài Listening chưa sẵn sàng.');
      await deferredPlayback.start();
    }
    if(state.examSessionId&&audioElement&&(state.audioEndedAt||audioElement.ended))window.SUBSTITUTE_EXAM?.ended(audioElement,state.audioEndedAt);
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
      serverTimeOffsetMs: (window.IZONE_EXAM_CLOCK?.offset(started.serverNow) ?? (Date.parse(started.serverNow) - Date.now())),
      attemptToken: started.attemptToken || state.attemptToken || ''
    });
    await enterExam(started);
  }

  elements.bootstrapPreview.addEventListener('click', async () => {
    if (!previewObjectUrl || state.listeningStartedAt || legacyListeningResume) return;
    if (!previewAudio.paused) {
      previewAudio.pause();
      elements.bootstrapPreview.textContent = previewLabel(true);
      return;
    }
    previewAudio.currentTime = 0;
    try {
      await previewAudio.play();
      elements.bootstrapPreview.textContent = 'Dừng nghe thử';
      elements.bootstrapPreviewStep.dataset.state = 'active';
      elements.bootstrapStartStep.dataset.state = 'locked';
      elements.bootstrapPreviewStatus.textContent = 'Đang nghe thử · '+previewSeconds()+' giây.';
      setStartAvailability();
      if (!previewHeard) {
        window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW(previewAudio, elements.bootstrapStart, () => {
          previewHeard = true;
          elements.bootstrapPreviewStep.dataset.state='complete';
          elements.bootstrapStartStep.dataset.state='active';
          setStartAvailability();
        });
      }
    } catch {
      elements.bootstrapPreviewStatus.textContent = 'Trình duyệt chưa cho phát. Hãy nhấn lại nút nghe thử.';
    }
  });
  previewAudio.addEventListener('ended', () => {
    elements.bootstrapPreview.textContent = previewLabel(true);
    elements.bootstrapPreviewStatus.textContent = 'Đã nghe hết bản thử. Bạn có thể bắt đầu thi.';
  });
  previewAudio.addEventListener('timeupdate', () => {
    if (previewAudio.paused) return;
    const elapsed = Math.min(previewSeconds(), previewAudio.currentTime || 0);
    elements.bootstrapPreviewStatus.textContent = `Đang nghe thử · ${formatTime(elapsed)} / ${formatTime(previewSeconds())}`;
    if (elapsed < 30 || continuityEnabled()) return;
    previewAudio.pause();
    elements.bootstrapPreview.textContent = previewLabel(true);
    elements.bootstrapPreviewStatus.textContent = 'Đã nghe đủ 30 giây. Bạn có thể bắt đầu thi.';
  });
  elements.bootstrapVolume.addEventListener('input', () => {
    const volume = Number(elements.bootstrapVolume.value) || 1;
    previewAudio.volume = volume;
    saveState({ audioVolume: volume });
  });
  let listeningStartEpoch=0;
  window.addEventListener('pagehide',()=>{listeningStartEpoch++;});
  elements.bootstrapStart.addEventListener('click', async () => {
    // Chỉ vị trí giao diện: bắt đầu mới khác với tiếp tục lượt đang làm.
    startAtFirstSection = !state.examSessionId && !state.listeningStartedAt && !state.readingStartedAt
      && !state.attemptToken && !legacyListeningResume;
    if (!encryptedAudio || preparing || (continuityEnabled()&&(!officialReady||(!previewHeard&&!state.examSessionId)))) return;
    preparing = true;
    const startClicked=performance.now();
    const epoch=++listeningStartEpoch;
    const {clientRunId,studentRef,classCode:boundClass}=state;
    const current=()=>epoch===listeningStartEpoch&&!window.SUBSTITUTE_STATE.blocked
      &&state.clientRunId===clientRunId&&state.studentRef===studentRef&&state.classCode===boundClass;
    const verify=()=>{if(!current())throw Error('Lượt Listening đã thay đổi.');};
    const deferredPlayback={verify, played:()=>{
      saveState({listeningPlaybackPending:false});
      return performance.now()-startClicked;
    }};
    elements.bootstrapStart.disabled = true;
    elements.bootstrapStart.textContent = 'Đang mở đề và audio...';
    previewAudio.pause();
    try {
      if (localDemo) {
        const officialAudio=officialPlayer||document.createElement('audio');
        if(!officialPlayer){
          officialObjectUrl=URL.createObjectURL(encryptedAudio);
          officialAudio.hidden=true;
          officialAudio.src=officialObjectUrl;
          document.body.append(officialAudio);
          await waitForAudioMetadata(officialAudio);
        }
        officialAudio.volume = Number(elements.bootstrapVolume.value) || 1;
        const scope=audioScope();
        if(preparedAudio&&!preparedAudio.isCurrent(scope))preparedAudio=await authorizeAudio(scope);
        verify();
        const timing=await window.SUBSTITUTE_EXAM?.start({...state,submissionRecoveryRequested:Boolean(offline)},preparedAudio?.startFields(scope),{continuity:continuityEnabled()});
        verify();
        if(timing)saveState({...timing,serverTimeOffsetMs:(window.IZONE_EXAM_CLOCK?.offset(timing.serverNow) ?? (Date.parse(timing.serverNow)-Date.now()))});
        if(timing?.offlinePermit)prepareShellCache();
        if(timing?.examOrder==='reading-first'&&!timing.listeningStartedAt){
          elements.bootstrapOrder.disabled=true;
          const readingDeadlineAt=new Date(Date.parse(timing.readingStartedAt)+Number(testConfig.reading.durationMinutes)*60000).toISOString();
          saveState({examOrder:'reading-first',readingStartedAt:timing.readingStartedAt,readingDeadlineAt,
            listeningStartedAt:'',listeningDeadlineAt:''});
          await enterExam({content:window.K67_SUBSTITUTE_TEST_1_CONTENT,serverNow:timing.serverNow,
            readingStartedAt:timing.readingStartedAt,readingDeadlineAt,listeningStartedAt:'',listeningDeadlineAt:'',listeningSubmitted:false},null);
          return;
        }
        // Bắt mốc trước play: audio có thể kết thúc trong lúc app/enhance đang tải khi resume.
        officialAudio.addEventListener('ended',()=>{
          if(!state.examSessionId||state.audioEndedAt||window.SUBSTITUTE_STATE.blocked
            ||!window.SUBSTITUTE_EXAM?.validAudioEnd(officialAudio))return;
          if(state.listeningContinuityVersion===1){
            if(window.TERM_TEST_BOOTSTRAP?.clientRunId===state.clientRunId)return;
            const audioEndedAt=window.SUBSTITUTE_EXAM.clockIso(state);
            const listeningDeadlineAt=new Date(Date.parse(audioEndedAt)+300000).toISOString();
            void window.SUBSTITUTE_OFFLINE.recordListeningEof({audioEndedAt,listeningDeadlineAt,heardSeconds:officialAudio.duration})
              .then(row=>{if(row)saveState({audioEndedAt:row.audioEndedAt,listeningDeadlineAt:row.listeningDeadlineAt});})
              .catch(()=>window.dispatchEvent(new Event('substitute:listening-storage-error')));
            return;
          }
          const audioEndedAt=new Date((window.IZONE_EXAM_CLOCK?.estimate(state.serverTimeOffsetMs) ?? (Date.now()+(Number(state.serverTimeOffsetMs)||0)))).toISOString();
          saveState({audioEndedAt,listeningDeadlineAt:new Date(Date.parse(audioEndedAt)+300000).toISOString()});
          if(window.TERM_TEST_BOOTSTRAP?.clientRunId===state.clientRunId)window.SUBSTITUTE_EXAM?.ended(officialAudio,audioEndedAt);
        });
        const existingStart = Date.parse(state.listeningStartedAt || '');
        // Bookmark đã được kiểm đúng người/lượt/epoch; thời gian gián đoạn không phải đoạn đã nghe.
        if(state.listeningContinuityVersion!==1){
          let savedUi=null;
          try{savedUi=await window.SUBSTITUTE_OFFLINE?.loadSnapshot('ui');}catch{}
          const heardSeconds=Math.max(readLegacyUiState().audioTime,Number(savedUi?.audio?.time)||0);
          officialAudio.currentTime=state.audioEndedAt?officialAudio.duration
            :Math.min(Math.max(0,heardSeconds),Math.max(0,officialAudio.duration-0.05));
        }
        const serverNow = new Date();
        const listeningStartedAt = Number.isFinite(existingStart) ? new Date(existingStart) : serverNow;
        const existingDeadline = Date.parse(state.listeningDeadlineAt || '');
        const listeningDeadlineAt = Number.isFinite(existingDeadline)
          ? new Date(existingDeadline)
          : new Date(listeningStartedAt.getTime() + Number(testConfig.listening.durationSeconds || 1848) * 1000);
        const started = {
          content: window.K67_SUBSTITUTE_TEST_1_CONTENT,
          serverNow: timing?.serverNow||serverNow.toISOString(),
          listeningStartedAt: listeningStartedAt.toISOString(),
          listeningDeadlineAt: state.examSessionId ? (state.listeningDeadlineAt||'') : listeningDeadlineAt.toISOString(),
          listeningSubmitted: false
        };
        saveState({
          listeningStartedAt: started.listeningStartedAt,
          listeningDeadlineAt: started.listeningDeadlineAt,
          listeningPlaybackPending:!state.audioEndedAt,
          serverTimeOffsetMs:state.examSessionId?(window.IZONE_EXAM_CLOCK?.offset(started.serverNow) ?? (Date.parse(started.serverNow)-Date.now())):0,
          audioVolume: officialAudio.volume
        });
        legacyListeningResume = false;
        const cleanQuery = new URLSearchParams(window.location.search);
        cleanQuery.delete('reset');
        try{history.replaceState(history.state, '', window.location.pathname + '?' + cleanQuery.toString() + window.location.hash);}catch{/* URL không được chặn xử lý bài hoặc màn đang xem. */}
        await enterExam(started, officialAudio, state.audioEndedAt?null:deferredPlayback);
        return;
      }
      const savedHeardSeconds = state.listeningStartedAt && legacyUiState.audioStarted
        ? legacyUiState.audioTime
        : undefined;
      const started = await apiRequest(`/api/term-tests/${testConfig.slug}/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examSessionToken: state.examSessionToken, heardSeconds: savedHeardSeconds })
      });
      verify();
      const decrypted = await decryptOfficialAudio(encryptedAudio, started);
      officialObjectUrl = URL.createObjectURL(new Blob([decrypted], { type: 'audio/mpeg' }));
      const officialAudio = document.createElement('audio');
      officialAudio.hidden = true;
      officialAudio.src = officialObjectUrl;
      officialAudio.volume = Number(elements.bootstrapVolume.value) || 1;
      document.body.append(officialAudio);
      const serverElapsed = Math.max(0, (Date.parse(started.serverNow) - Date.parse(started.listeningStartedAt)) / 1000);
      const serverResumeAt = Number(started.listeningResumeAtSeconds);
      const resumeAt = Number.isFinite(serverResumeAt) ? Math.min(serverElapsed, Math.max(0, serverResumeAt)) : serverElapsed;
      await new Promise((resolve, reject) => {
        officialAudio.addEventListener('loadedmetadata', resolve, { once: true });
        officialAudio.addEventListener('error', () => reject(new Error('Trình duyệt không đọc được audio chính.')), { once: true });
        officialAudio.load();
      });
      officialAudio.currentTime = Math.min(resumeAt, Math.max(0, officialAudio.duration - 0.05));
      verify();
      saveState({
        listeningStartedAt: started.listeningStartedAt,
        listeningDeadlineAt: started.listeningDeadlineAt,
        listeningRecoverySeconds: Number(started.listeningRecoverySeconds) || 0,
        serverTimeOffsetMs: (window.IZONE_EXAM_CLOCK?.offset(started.serverNow) ?? (Date.parse(started.serverNow) - Date.now())),
        audioVolume: officialAudio.volume
      });
      legacyListeningResume = false;
      await enterExam(started, officialAudio, resumeAt<officialAudio.duration?deferredPlayback:null);
    } catch (error) {
      if(!current())return;
      if(!elements.bootstrapNotice.isConnected){
        const notice=document.getElementById('notice');
        if(notice){
          notice.hidden=false;notice.className='notice error';
          notice.textContent='Chưa mở được màn Listening. Hãy tải lại để tiếp tục đúng lượt.';
        }
        return;
      }
      showNotice(`Chưa thể bắt đầu: ${error.userMessage || error.message}. Đề vẫn đang khóa.`, true);
      elements.bootstrapStart.textContent = state.listeningStartedAt ? 'Tiếp tục bài thi Listening' : 'Bắt đầu thi Listening';
      elements.bootstrapStart.disabled = false;
      window.IZONE_CBT_AUDIO_START_LABEL?.(elements.bootstrapStart,
        previewHeard && !state.listeningStartedAt && !legacyListeningResume);
    } finally {
      preparing = false;
    }
  });
  elements.bootstrapRetry.addEventListener('click', () => prepareSelectedStudent(true));
  async function loadDemoRoster(selectedClass) {
    if (!selectedClass) return [];
    if (selectedClass.code === 'DEMO') return [{ ref: 'demo-k67-sub1-01', name: 'Học viên Demo K67' }];
    let response;
    try{response = await fetch(appConfig.API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ route: '/api/test/roster', payload: { classCode: selectedClass.code } }),
      cache: 'no-store'
    });}
    catch(error){
      const cached=await offline?.cachedStudents({historyEpoch:window.SUBSTITUTE_STATE.meta.historyEpoch,
        classCode:selectedClass.code}).catch(()=>[]);
      if(cached?.length)return cached;
      throw error;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Không tải được danh sách lớp từ Portal.');
    return Array.isArray(data.students) ? data.students : [];
  }

  elements.bootstrapClass.addEventListener('change', async () => {
    if (preparing || state.listeningStartedAt || state.attemptToken) {
      elements.bootstrapClass.value = classCode;
      return;
    }
    resetPreparation();
    const generation = ++classLoadGeneration;
    const selectedClass = localDemoClasses.find(item => item.code === elements.bootstrapClass.value);
    classCode = selectedClass?.code || '';
    if (classCode) query.set('class', classCode);
    else query.delete('class');
    try{history.replaceState(history.state, '', `${location.pathname}?${query.toString()}${location.hash}`);}catch{/* URL không được chặn xử lý bài hoặc màn đang xem. */}
    try {
      const loaded = await loadDemoRoster(selectedClass);
      if (generation !== classLoadGeneration) return;
      roster = loaded;
    } catch (error) {
      if (generation !== classLoadGeneration) return;
      roster = [];
      showNotice(`Không tải được danh sách lớp: ${error.message}`, true);
    }
    const options = [new Option(selectedClass ? 'Nhấn để chọn đúng tên' : 'Chọn lớp trước', '')];
    for (const student of roster) options.push(new Option(student.name, student.ref));
    elements.bootstrapStudent.replaceChildren(...options);
    elements.bootstrapStudent.disabled = !selectedClass;
    elements.bootstrapStudent.value = '';
    state = { audioVolume: state.audioVolume };
    saveState({ classCode: selectedClass?.code || '', identityConfirmed: false });
    elements.bootstrapDownloadStatus.textContent = selectedClass
      ? 'Hãy chọn đúng họ và tên của bạn trong lớp này.'
      : 'Hãy chọn lớp trước khi chọn học viên.';
    elements.bootstrapDownloadStep.dataset.state = selectedClass ? 'active' : 'locked';
    if (selectedClass) await selectRememberedFromCurrentRoster();
  });
  elements.bootstrapStudent.addEventListener('change', () => {
    if (preparing || state.listeningStartedAt || state.attemptToken) {
      elements.bootstrapStudent.value = state.studentRef || '';
      return;
    }
    resetPreparation();
    pendingStudent = roster.find(item => item.ref === elements.bootstrapStudent.value) || null;
    if (!pendingStudent) return;
    selectionSnapshot = sharedIdentity.read();
    document.getElementById('confirmStudentName').textContent = pendingStudent.name;
    document.getElementById('confirmClassName').textContent = elements.bootstrapClass.selectedOptions[0]?.textContent || classCode;
    identityDialog.showModal();
    document.getElementById('confirmIdentity').focus();
  });

  async function selectRememberedFromCurrentRoster() {
    const result = sharedIdentity.selectFromRoster(classCode, roster);
    if (result.status !== 'unique' || !sharedIdentity.isCurrent(result.snapshot)) return false;
    selectionSnapshot = result.snapshot;
    if (!await bindSelectedStudent(result.student)) return false;
    await prepareSelectedStudent();
    return true;
  }

  async function findRememberedClass() {
    if (classCode && localDemoClasses.some(item => item.code === classCode && item.code !== 'DEMO')) return classCode;
    const snapshot = sharedIdentity.read();
    if (snapshot.status !== 'ok') return '';
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('https://ducizone.ddns.net/mapping-api/api/student-identity/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ identity: snapshot.identity })
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true || data.status !== 'unique' || data.identity?.id !== snapshot.identity.id
          || data.identity?.authority !== 'erp-contact' || !Array.isArray(data.aliases) || !sharedIdentity.isCurrent(snapshot)) return '';
      const classes = [...new Set(data.aliases.map(item => item.classCode)
        .filter(code => localDemoClasses.some(item => item.code === code && code !== 'DEMO')))];
      return classes.length === 1 ? classes[0] : '';
    } catch { return ''; }
    finally { clearTimeout(timer); }
  }

  async function initialize() {
    if (!localDemo && !/^[A-Z0-9_-]{2,32}$/.test(classCode)) {
      showNotice('Link chưa có mã lớp hợp lệ.', true);
      return;
    }
    try {
      if (localDemo) {
        const classOptions = [new Option('Nhấn để chọn lớp', '')];
        for (const item of localDemoClasses) classOptions.push(new Option(item.name, item.code));
        elements.bootstrapClass.replaceChildren(...classOptions);
        const savedClass = localDemoClasses.find(item => item.code === (state.classCode || classCode));
        if (savedClass && state.studentRef && (state.listeningStartedAt || state.readingStartedAt || state.attemptToken)) {
          roster = await loadDemoRoster(savedClass);
          elements.bootstrapClass.value = savedClass.code;
          elements.bootstrapClass.disabled = true;
          elements.bootstrapStudent.replaceChildren(
            new Option('Nhấn để chọn đúng tên', ''),
            ...roster.map(student => new Option(student.name, student.ref))
          );
          elements.bootstrapStudent.disabled = false;
          const savedStudent = roster.find(student => student.ref === state.studentRef);
          if (!savedStudent) throw new Error('Học viên không còn trong danh sách thi lại của lớp.');
          elements.bootstrapStudent.value = savedStudent.ref;
          await prepareSelectedStudent();
        } else {
          const generation = classLoadGeneration;
          const rememberedClass = await findRememberedClass();
          if (generation !== classLoadGeneration) return;
          if (rememberedClass && sharedIdentity.read().status === 'ok') {
            classCode = rememberedClass;
            elements.bootstrapClass.value = classCode;
            const loaded = await loadDemoRoster(localDemoClasses.find(item => item.code === classCode));
            if (generation !== classLoadGeneration) return;
            roster = loaded;
            elements.bootstrapStudent.replaceChildren(new Option('Nhấn để chọn đúng tên', ''),
              ...roster.map(student => new Option(student.name, student.ref)));
            elements.bootstrapStudent.disabled = false;
            if (await selectRememberedFromCurrentRoster()) return;
            showNotice('Người đã nhớ chưa có tên trong danh sách thi lại của lớp này. Hãy kiểm tra link hoặc dùng Đổi người học.');
            return;
          }
          roster = [];
          elements.bootstrapClass.value = '';
          elements.bootstrapStudent.replaceChildren(new Option('Chọn lớp trước', ''));
          elements.bootstrapStudent.disabled = true;
          elements.bootstrapStudent.value = '';
          elements.bootstrapDownloadStatus.textContent = 'Hãy chọn lớp, sau đó chọn đúng họ và tên của bạn.';
          elements.bootstrapDownloadStep.dataset.state = 'locked';
          elements.bootstrapPreviewStep.dataset.state = 'locked';
          elements.bootstrapStartStep.dataset.state = 'locked';
        }
        return;
      }
      const data = await apiRequest(`/api/term-tests/roster?class=${encodeURIComponent(classCode)}&test=${encodeURIComponent(testConfig.slug)}`);
      roster = data.students || [];
      elements.bootstrapClass.replaceChildren(new Option(data.class.name || classCode, classCode));
      elements.bootstrapClass.value = classCode;
      elements.bootstrapClass.disabled = true;
      const options = [new Option('Nhấn để chọn đúng tên', '')];
      for (const student of roster) options.push(new Option(student.name, student.ref));
      elements.bootstrapStudent.replaceChildren(...options);
      elements.bootstrapStudent.disabled = false;
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
        await prepareSelectedStudent();
        return;
      }
      if (state.studentRef && (state.listeningStartedAt || state.readingStartedAt || state.attemptToken || legacyListeningResume) && roster.some(student => student.ref === state.studentRef)) {
        elements.bootstrapStudent.value = state.studentRef;
        await prepareSelectedStudent();
      } else {
        elements.bootstrapDownloadStatus.textContent = 'Hãy chọn họ và tên để bắt đầu tải audio.';
        elements.bootstrapDownloadStep.dataset.state = 'active';
      }
    } catch (error) {
      showNotice(`Không thể mở phòng chờ: ${error.message}`, true);
    }
  }

  window.addEventListener('pagehide', event => {
    if (!event.persisted) releaseListeningLease();
    downloadController?.abort();
    previewAudio.pause();
    revokePreview();
  });

  // Phòng tải lại audio vẫn giữ cảnh báo khi lượt thi đã bắt đầu.
  window.addEventListener('beforeunload', event => {
    if (window.TERM_TEST_LEAVE_GUARD_READY || window.TERM_TEST_ALLOW_NAVIGATION || ['complete', 'listening-only', 'writing-prep', 'writing'].includes(query.get('demo'))) return;
    const active = state.studentRef && !state.completed && (
      (state.listeningStartedAt && !state.listeningSubmitted && !state.attemptToken)
      || (state.readingStartedAt && !state.readingSubmitted)
      || (state.writingStarted && !state.writingSubmitted));
    if (!active) return;
    event.preventDefault(); event.returnValue = true;
  });

  initialize();
}());

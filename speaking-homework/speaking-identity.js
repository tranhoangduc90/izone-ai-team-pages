import { memoryKey, readMemory, writeMemory } from '../shared/student-memory.js';
import { createStudentIdentityMemory } from '../shared/student-identity.js?v=20261018-identity-v1';
import { createStudentIdentityClient, selectStudentIdentityAlias } from '../shared/student-identity-client.js?v=20261018-identity-v1';

const $ = id => document.getElementById(id);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refOf = student => student.student_ref || student.studentRef || '';
const tabOwnerKey = 'izoneSpeakingTabOwnerV1';

async function requestJson(base, path, body, signal) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET', cache: 'no-store',
    ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    const error = new Error(data.message || 'Hệ thống chưa xử lý được yêu cầu. Hãy thử lại.');
    error.code = data.error || `HTTP_${response.status}`;
    throw error;
  }
  return data;
}

// Nhận mã bài, lớp gợi ý và file Docs; phiên luôn gắn đúng người/file đã được máy chủ kiểm.
// Khi bật nhận diện chung: mã ERP đã nhớ giúp bỏ màn đăng nhập; đường cũ giữ cho lúc chuyển đổi.
// Lỗi roster hoặc bộ nhớ có thông báo; kết quả tải cũ không thay lựa chọn mới.
export function createSpeakingIdentity({ apiBase, identityBase, assignmentCode, lessonNumber,
  originalDocumentId = '', classHint = '', allowWebReceipt = false, sharedIdentityEnabled = false,
  validateAssignment, onOpened, onReset }) {
  const key = memoryKey(identityBase, location.href);
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  let remembered = readMemory(storage, key);
  const sharedMemory = sharedIdentityEnabled ? createStudentIdentityMemory() : null;
  const sharedClient = sharedMemory ? createStudentIdentityClient({ memory: sharedMemory,
    requestIdentity: body => requestJson(identityBase, '/api/student-identity/resolve', body) }) : null;
  const classSelect = $('class-select');
  const studentSelect = $('student-select');
  const button = $('open-homework');
  const remember = $('remember-student') || { checked: true };
  const roster = new Map();
  let classes = [];
  let assignment = null;
  let originalClass = '';
  let originalAssignment = null;
  let documentDropped = false;
  let active = false;
  let revision = 0;
  let controller;
  let memoryNotice = '';
  let mismatchNotice = '';
  let selectedCode = '';
  let selectionGeneration = 0;
  let sharedResolution = null;
  let activeIdentity = null;
  // Giữ mã người/lớp theo chính lượt trang này qua reload; không lưu token hoặc quyền.
  // Tab mới vẫn lấy danh tính chung; máy chủ phải kiểm lại roster và cấp phiên mới.
  const entry = location.pathname + location.search;
  let tabBinding = null;
  try {
    const saved = sharedIdentityEnabled && window.history.state?.[tabOwnerKey];
    if (saved?.assignmentCode === assignmentCode && saved.entry === entry
        && (saved.cleared === true || (uuid.test(saved.studentRef || '')
          && typeof saved.classCode === 'string' && saved.classCode.length > 0 && saved.classCode.length <= 128)))
      tabBinding = saved;
  } catch { /* Không có history thì đường chọn người hiện hành vẫn dùng được. */ }
  // Link Docs luôn giữ chủ đã được máy chủ xác minh, kể cả history của bản cũ.
  if (tabBinding && !tabBinding.cleared && !originalDocumentId) documentDropped = tabBinding.documentDropped === true;
  let requireManualSelection = tabBinding?.cleared === true;
  function bindTab(studentRef, classCode) {
    if (!sharedIdentityEnabled) return true;
    tabBinding = { assignmentCode, entry, ...(studentRef ? { studentRef, classCode, documentDropped } : { cleared: true }) };
    try {
      window.history.replaceState({ ...(window.history.state || {}), [tabOwnerKey]: tabBinding }, '');
      return true;
    } catch { return false; }
  }
  function resolutionIsCurrent(result) {
    if (!result?.restoredFromTab) return sharedClient.isCurrent(result);
    const current = sharedMemory.read();
    return !requireManualSelection && !tabBinding?.cleared
      && result.tabStudentRef === tabBinding?.studentRef && result.tabClassCode === tabBinding?.classCode
      && current.status === result.snapshot?.status && current.revision === result.snapshot?.revision
      && current.identity?.id === result.snapshot?.identity?.id;
  }
  if (sharedIdentityEnabled) {
    $('forget-remembered').textContent = 'Đổi người học';
    const help = document.querySelector('#login-screen .memory-help');
    if (help) help.textContent = 'Trình duyệt sẽ nhớ người học sau khi mở bài. Dùng Đổi người học khi dùng chung thiết bị.';
  }
  function message(text, kind = '') {
    $('identity-message').textContent = [mismatchNotice, memoryNotice, text].filter(Boolean).join(' ');
    $('identity-message').dataset.kind = kind || (mismatchNotice || memoryNotice ? 'warning' : '');
  }
  function loading(text) {
    assignment = null;
    roster.clear();
    studentSelect.disabled = true;
    button.disabled = true;
    studentSelect.replaceChildren(new Option(text, ''));
    $('remembered-identity').hidden = true;
    $('forget-remembered').hidden = sharedMemory?.read().status !== 'ok';
    $('reload-roster').hidden = true;
  }
  function itemFor(code) { return classes.find(item => item.classCode === code || item.classRef === code); }
  function useDocument(code) { return originalDocumentId && !documentDropped && originalClass === code; }
  // CTA của bài đã đóng vẫn cần máy chủ kiểm tra biên nhận trước khi cấp phiên.
  function canOpenClass(code) {
    return itemFor(code)?.ready === true || (useDocument(code) && originalAssignment?.assignmentStatus === 'closed');
  }
  function contextText(data) {
    const code = data.classCode;
    document.title = `${data.title || `Speaking Homework Lesson ${lessonNumber}`} · ${code}`;
    $('lesson-badge').textContent = `${code} · Lesson ${lessonNumber}`;
    $('class-code').textContent = code;
    $('page-footer').textContent = `IZONE · Speaking Homework Lesson ${lessonNumber} · ${code}`;
    $('assignment-context').textContent = `${data.title || `Speaking Homework Lesson ${lessonNumber}`} · ${code}`;
  }
  async function loadRoster(code, preferred = '') {
    const current = ++revision;
    controller?.abort();
    controller = new AbortController();
    selectedCode = code;
    loading(code ? 'Đang tải danh sách học viên…' : 'Chọn lớp trước để xem danh sách');
    if (!code) { message('Chọn lớp và tên của bạn để mở bài.'); return; }
    const item = itemFor(code);
    if (!canOpenClass(code)) {
      message(`Bài của lớp ${code} chưa sẵn sàng (${item?.assignmentStatus || 'chưa có bài'}).`, 'warning');
      return;
    }
    message('Đang tải đúng bài và danh sách của lớp đã chọn…');
    try {
      const body = { classCode: code, assignmentCode };
      if (useDocument(code)) body.documentId = originalDocumentId;
      const data = await requestJson(apiBase, '/assignment/roster', body, controller.signal);
      if (current !== revision || active) return;
      const next = data.assignment;
      if (!next || next.classCode !== code || (next.assignmentCode && next.assignmentCode !== assignmentCode)
        || !Array.isArray(next.students) || validateAssignment(next) !== true) {
        throw new Error('Cấu hình bài chưa sẵn sàng hoặc chưa khớp lớp đã chọn.');
      }
      if (['draft', 'deleted', 'missing', 'ambiguous'].includes(next.assignmentStatus)) {
        throw new Error('Bài của lớp này chưa sẵn sàng để mở.');
      }
      if (useDocument(code)) {
        const owner = next.selectedStudentRef;
        if (!uuid.test(owner || '') || next.students.filter(s => refOf(s) === owner).length !== 1)
          throw new Error('Link Homework chưa có duy nhất chủ bài hợp lệ.');
        next.students = next.students.filter(s => refOf(s) === owner);
        const alias = sharedResolution && selectStudentIdentityAlias(sharedResolution, { classHint: code });
        if (sharedMemory?.read().status === 'ok' && (!alias || alias.status !== 'unique' || alias.alias.studentRef !== owner))
          mismatchNotice = 'Người học đã nhớ khác chủ link. Chỉ tiếp tục nếu đây là bài của bạn; thông tin đã nhớ được giữ đến khi bạn xác nhận.';
      }
      const seen = new Set();
      const counts = new Map();
      for (const student of next.students) {
        const ref = refOf(student);
        if (!uuid.test(ref) || seen.has(ref)) throw new Error('Danh sách học viên chưa có mã hồ sơ duy nhất. Nhờ giảng viên kiểm tra.');
        seen.add(ref);
        counts.set(student.name, (counts.get(student.name) || 0) + 1);
      }
      assignment = next;
      studentSelect.replaceChildren(new Option('Chọn tên của bạn', ''));
      for (const student of next.students) {
        const ref = refOf(student);
        roster.set(ref, student.name);
        studentSelect.add(new Option(student.name + (counts.get(student.name) > 1 ? ` · ${ref.slice(-4)}` : ''), ref));
      }
      studentSelect.disabled = !roster.size;
      const suggested = next.selectedStudentRef || preferred;
      studentSelect.value = roster.has(suggested) ? suggested : '';
      button.disabled = !studentSelect.value;
      $('remembered-identity').hidden = !studentSelect.value;
      $('forget-remembered').hidden = !studentSelect.value && sharedMemory?.read().status !== 'ok';
      contextText(next);
      if (useDocument(code)) {
        classSelect.disabled = true;
        $('assignment-context').textContent = `Bài của ${roster.get(next.selectedStudentRef)} · ${code}. Nếu không phải bạn, hãy mở link Homework của mình.`;
      }
      message(roster.size ? `Đã tải ${roster.size} học viên của lớp ${code}.${next.assignmentStatus === 'closed' ? ' Homework đã đóng. Chỉ học viên đã nộp bài mới có thể vào luyện thêm.' : useDocument(code) ? ' Bài sẽ được ghi vào đúng file Homework của link này.' : ''}` : 'Lớp này chưa có học viên hợp lệ để mở bài.');
    } catch (error) {
      if (current !== revision || error.name === 'AbortError') return;
      loading('Chưa tải được danh sách học viên');
      message(`Chưa mở được bài: ${error.message}`, 'error');
      $('reload-roster').hidden = false;
    }
  }
  async function start() {
    if (active) return;
    const current = ++revision;
    const generation = selectionGeneration;
    controller?.abort();
    controller = new AbortController();
    classSelect.disabled = true;
    loading('Đang tải danh sách lớp…');
    remembered = readMemory(storage, key);
    if(sharedClient)await sharedClient.migrateLegacy();
    const sharedSnapshot = sharedMemory?.read();
    const hasShared = sharedSnapshot?.status === 'ok';
    const restore = !requireManualSelection && tabBinding && !tabBinding.cleared ? tabBinding : null;
    if(sharedClient&&!hasShared)remembered={status:'empty',studentRef:''};
    // Đã chủ động quên danh tính chung thì không chọn lại từ bộ nhớ UUID cũ.
    if (sharedSnapshot?.status === 'empty' && sharedSnapshot.revision !== null)
      remembered = { status: 'empty', studentRef: '' };
    sharedResolution = null;
    memoryNotice = remembered.status === 'unavailable' ? 'Trình duyệt đang chặn bộ nhớ. Bạn vẫn có thể chọn lớp, tên và mở bài.'
      : remembered.status === 'invalid' ? 'Thông tin đã nhớ không còn hợp lệ. Hãy chọn lại lớp và tên.' : '';
    if (remembered.status === 'unavailable') { remember.checked = false; remember.disabled = true; }
    message('Đang tải danh sách lớp…');
    try {
      const classesRead = requestJson(apiBase, `/classes?assignmentCode=${encodeURIComponent(assignmentCode)}`, null, controller.signal);
      const sharedRead = restore
        ? sharedClient.resolveSelection({ studentRef: restore.studentRef, classHint: restore.classCode }).then(data => {
          const choice = selectStudentIdentityAlias(data, { studentRef: restore.studentRef, classHint: restore.classCode });
          if (choice.status !== 'unique') throw new Error('Hồ sơ của tab này chưa còn hợp lệ. Hãy dùng Đổi người học để chọn lại.');
          return { data: { ...data, snapshot: sharedSnapshot, restoredFromTab: true,
            tabStudentRef: restore.studentRef, tabClassCode: restore.classCode } };
        }, error => ({ error })).catch(error => ({ error }))
        : hasShared && !requireManualSelection ? sharedClient.resolveRemembered()
          .then(data => ({ data }), error => ({ error })) : null;
      // Hai lượt chỉ đọc không phụ thuộc nhau; bắt lỗi ngay để không có promise lỗi bỏ ngỏ.
      // Kết quả vẫn phải qua kiểm lớp/người và revision như trước, không tự mở phiên.
      const identityRead = !sharedRead && !requireManualSelection && remembered.status === 'ok'
        ? requestJson(apiBase, '/identity/resolve', { assignmentCode, studentRef: remembered.studentRef }, controller.signal)
          .then(data => ({ data }), error => ({ error })) : null;
      const data = await classesRead;
      if (current !== revision || active) return;
      classes = Array.isArray(data.classes) ? data.classes : [];
      classSelect.replaceChildren(new Option('Chọn lớp của bạn', ''));
      for (const item of classes) {
        const option = new Option(`${item.classCode}${item.ready === true ? '' : ` · Chưa sẵn sàng (${item.assignmentStatus || 'chưa có bài'})`}`, item.classCode);
        option.disabled = item.ready !== true;
        classSelect.add(option);
      }
      let resolved = null;
      if (identityRead) {
        try {
          const result = await identityRead;
          if (current !== revision || active) return;
          if (result.error) throw result.error;
          resolved = result.data;
          if (resolved.status !== 'unique') {
            memoryNotice = resolved.status === 'ambiguous' ? 'Hồ sơ đã nhớ khớp nhiều lớp. Hãy chọn đúng lớp và tên.' : 'Hồ sơ đã nhớ chưa có bài phù hợp. Hãy chọn lớp và tên.';
            resolved = null;
          }
        } catch (error) { memoryNotice = `Chưa kiểm tra được hồ sơ đã nhớ: ${error.message}`; }
      }
      if (sharedRead) {
        const result = await sharedRead;
        if (current !== revision || active || generation !== selectionGeneration) return;
        if (result.error && restore) throw result.error;
        if (result.error) memoryNotice = `Chưa kiểm được người học đã nhớ: ${result.error.message}`;
        else if (result.data.status === 'unique') sharedResolution = result.data;
        else if (result.data.status === 'changed') return;
        else memoryNotice = 'Người học đã nhớ chưa có hồ sơ phù hợp để mở bài này. Danh tính chung vẫn được giữ.';
      }
      if (current !== revision || active) return;
      if (originalDocumentId && !documentDropped) {
        const doc = await requestJson(apiBase, '/assignment/open', { assignmentCode, documentId: originalDocumentId, ...(classHint ? { classCode: classHint } : {}) }, controller.signal);
        if (current !== revision || active) return;
        originalAssignment = doc.assignment;
        originalClass = originalAssignment?.classCode || '';
        if (!originalClass) throw new Error('Chưa xác định được lớp của file Homework.');
        if (allowWebReceipt && originalAssignment.intakeMode === 'document') {
          if(validateAssignment(originalAssignment)!==true || originalAssignment.students?.length!==1)
            throw new Error('Bản Docs chưa có duy nhất cấu hình bài riêng.');
          const profile=originalAssignment.students[0];
          const wrongRemembered = (hasShared || restore) && (!sharedResolution || !resolutionIsCurrent(sharedResolution)
              || !sharedResolution.aliases.some(alias => alias.studentRef === refOf(profile)));
          if (wrongRemembered || requireManualSelection) {
            assignment = originalAssignment; selectedCode = originalClass;
            roster.set(refOf(profile), profile.name);
            classSelect.replaceChildren(new Option('Bài riêng', originalClass)); classSelect.value = originalClass; classSelect.disabled = true;
            studentSelect.replaceChildren(new Option('Chọn tên của bạn', ''), new Option(profile.name, refOf(profile)));
            studentSelect.disabled = false; button.disabled = true;
            $('assignment-context').textContent = `Link bài riêng của ${profile.name}. Nếu không phải bạn, hãy mở link Homework của mình.`;
            mismatchNotice = wrongRemembered ? 'Link bài riêng khác người học đã nhớ. Xác nhận chủ bài để tiếp tục.' : '';
            message('Chọn chủ bài rồi bấm Mở bài Speaking. Hồ sơ lớp đã nhớ được giữ nguyên.');
            return;
          }
          const opened=await requestJson(apiBase,'/session/start-selected',{
            assignmentCode,classCode:originalClass,documentId:originalDocumentId,
            studentRef:refOf(profile),identityConfirmed:true
          },controller.signal);
          if(current!==revision||active)return;
          const session=opened.session;
          if(!session?.accessToken || session.studentRef!==refOf(profile) || session.documentId!==originalDocumentId || !session.workUnitId)
            throw new Error('Phiên bài riêng chưa khớp bản Docs.');
          active=true;
          activeIdentity=sharedResolution?.identity || null;
          // Docs chưa gắn lớp không có mã ERP để quy đổi; URL Docs đã giữ đúng chủ.
          if (sharedResolution) bindTab(session.studentRef, originalClass);
          $('login-screen').hidden=true;
          $('lesson-hero').hidden=false;
          $('identity-confirmed').hidden=!sharedIdentityEnabled;
          if (sharedIdentityEnabled) {
            $('active-student').textContent=profile.name;
            $('active-class').textContent='Bài riêng';
          }
          $('homework-content').hidden=false;
          $('lesson-badge').textContent=`Bài riêng · Lesson ${lessonNumber}`;
          $('memory-status').textContent='Bài đang được lưu theo bản Docs này và chưa gắn lớp. Hồ sơ lớp đã ghi nhớ trên thiết bị được giữ nguyên.';
          $('memory-status').hidden=false;
          await onOpened(Object.freeze({session:Object.freeze({...session}),assignment:originalAssignment,
            studentRef:session.studentRef,studentName:profile.name,classCode:originalClass,documentId:session.documentId}));
          return;
        }
        if (originalAssignment.assignmentStatus === 'closed') {
          let option = [...classSelect.options].find(item => item.value === originalClass);
          if (!option) { option = new Option('', originalClass); classSelect.add(option); }
          option.textContent = `${originalClass} · Bài đã đóng`;
          option.disabled = false;
        }
      }
      let code = originalDocumentId && !documentDropped ? originalClass : resolved?.classCode || itemFor(classHint)?.classCode || '';
      let preferred = resolved?.classCode === code ? remembered.studentRef : '';
      if (sharedResolution) {
        const allowedClassCodes = classes.filter(item => canOpenClass(item.classCode)).map(item => item.classCode);
        if (originalClass && useDocument(originalClass) && canOpenClass(originalClass)) allowedClassCodes.push(originalClass);
        const choice = selectStudentIdentityAlias(sharedResolution, {
          classHint: useDocument(originalClass) ? originalClass : restore?.classCode || itemFor(classHint)?.classCode || '', allowedClassCodes,
          ...(restore ? { studentRef: restore.studentRef } : {}),
        });
        if (choice.status === 'unique' && (!originalDocumentId || choice.alias.classCode === originalClass)) { code=choice.alias.classCode; preferred=choice.alias.studentRef; }
        else memoryNotice = choice.status === 'ambiguous'
          ? 'Đã nhận diện người học nhưng có nhiều lớp mở bài này. Chọn lớp muốn học, không cần chọn lại tên.'
          : 'Người học đã nhớ chưa có bài phù hợp với lớp hoặc link này. Hãy mở đúng bài của bạn hoặc Đổi người học.';
      }
      mismatchNotice = originalDocumentId && !documentDropped && resolved?.classCode && resolved.classCode !== code
        ? `Link Homework thuộc lớp ${code}; hồ sơ đã nhớ thuộc lớp ${resolved.classCode}. Hãy chọn đúng người trong lớp của link hoặc đổi lớp để mở bài của bạn.` : '';
      classSelect.disabled = Boolean(originalDocumentId) || classSelect.options.length < 2;
      if (code && canOpenClass(code)) {
        classSelect.value = code;
        await loadRoster(code, preferred);
        await tryAutoOpen(generation);
      } else {
        classSelect.value = '';
        loading('Chọn lớp trước để xem danh sách');
        message(classes.some(item => item.ready === true) ? 'Chọn lớp và tên của bạn để mở bài.' : 'Chưa có lớp nào sẵn sàng cho bài này.');
      }
    } catch (error) {
      if (current !== revision || error.name === 'AbortError') return;
      message(`Chưa tải được bài: ${error.message}`, 'error');
      $('reload-roster').hidden = false;
      if (restore) $('forget-remembered').hidden = false;
    }
  }
  async function tryAutoOpen(generation) {
    if (requireManualSelection || !sharedResolution || !resolutionIsCurrent(sharedResolution) || active
        || generation !== selectionGeneration || !assignment || !canOpenClass(selectedCode)) return;
    const choice = selectStudentIdentityAlias(sharedResolution, { classHint: selectedCode });
    if (choice.status !== 'unique' || !roster.has(choice.alias.studentRef)) return;
    if (useDocument(selectedCode) && assignment.selectedStudentRef
        && assignment.selectedStudentRef !== choice.alias.studentRef) {
      mismatchNotice = 'Link Homework thuộc người khác với người học đã nhớ. Hãy mở đúng bài của bạn hoặc Đổi người học.';
      button.disabled = true;
      $('forget-remembered').hidden = false;
      message('');
      return;
    }
    studentSelect.value = choice.alias.studentRef;
    button.disabled = false;
    await openSelected({ automatic: true, resolution: sharedResolution });
  }
  classSelect.addEventListener('change', () => {
    if (active) return;
    if (originalDocumentId) { classSelect.value = originalClass; return; }
    const generation = ++selectionGeneration;
    if (originalClass && classSelect.value !== originalClass) {
      documentDropped = true;
      const option = [...classSelect.options].find(item => item.value === originalClass);
      if (option && itemFor(originalClass)?.ready !== true) option.disabled = true;
    }
    mismatchNotice = '';
    loadRoster(classSelect.value).then(() => tryAutoOpen(generation));
  });
  studentSelect.addEventListener('change', () => {
    ++selectionGeneration;
    button.disabled = !roster.has(studentSelect.value);
    $('remembered-identity').hidden = true;
    $('forget-remembered').hidden = true;
  });
  $('forget-remembered').addEventListener('click', async () => {
    if (active) return;
    ++selectionGeneration;
    ++revision;
    controller?.abort();
    requireManualSelection = true;
    bindTab();
    sharedResolution = null;
    const forgotten = sharedMemory ? await sharedMemory.forgetAtomic(sharedMemory.read().revision) : null;
    memoryNotice = (sharedMemory ? forgotten.status === 'empty' : writeMemory(storage, key, ''))
      ? '' : 'Chưa quên được hồ sơ đã nhớ. Bạn vẫn có thể chọn người học khác cho lượt này.';
    studentSelect.value = '';
    button.disabled = true;
    $('remembered-identity').hidden = true;
    $('forget-remembered').hidden = true;
    message('Chọn đúng tên của bạn để mở bài.');
    if (!roster.size) await (classes.length && selectedCode ? loadRoster(selectedCode) : start());
    studentSelect.focus();
  });
  $('reload-roster').addEventListener('click', () => classes.length && selectedCode ? loadRoster(selectedCode) : start());
  async function openSelected({ automatic = false, resolution = null } = {}) {
    if (active || !assignment || !roster.has(studentSelect.value)) return;
    if (automatic && (!resolution || !resolutionIsCurrent(resolution)
        || !resolution.aliases.some(alias => alias.classCode === selectedCode && alias.studentRef === studentSelect.value))) return;
    const studentRef = studentSelect.value;
    const code = selectedCode;
    const studentName = roster.get(studentRef);
    const selectedAssignment = assignment;
    const selectionSnapshot = sharedClient?.captureSelection();
    const documentOnly = selectedAssignment.intakeMode === 'document';
    const identityRead = sharedClient && !automatic && remember.checked && !documentOnly
      ? sharedClient.resolveSelection({ studentRef, classHint: code }).then(data => ({ data }), error => ({ error })) : null;
    active = true;
    activeIdentity = resolution?.identity || null;
    ++revision;
    controller?.abort();
    classSelect.disabled = studentSelect.disabled = button.disabled = true;
    message('Đang mở bài Speaking…');
    try {
      const body = { assignmentCode, classCode: code, studentRef, identityConfirmed: true };
      if (useDocument(code)) body.documentId = originalDocumentId;
      const data = await requestJson(apiBase, '/session/start-selected', body);
      const session = data.session;
      if (!session?.accessToken || session.studentRef !== studentRef || session.classCode !== code || (!session.documentId && !(allowWebReceipt && session.workUnitId))
        || (body.documentId && session.documentId !== body.documentId)) {
        throw new Error('Phiên trả về chưa khớp người, lớp hoặc file Homework. Hãy thử lại.');
      }
      const stored = documentOnly || writeMemory(storage, key, remember.checked ? studentRef : '');
      let sharedNotice = '';
      if (sharedClient && !automatic && !documentOnly) {
        if (remember.checked) {
          const identityResult = await identityRead;
          if (identityResult.error) sharedNotice = 'Đã mở bài nhưng chưa nhớ được người học dùng chung. Bạn vẫn làm bài bình thường.';
          else {
            activeIdentity = identityResult.data.identity || null;
            const saved = await sharedClient.rememberResolvedSelection(identityResult.data, selectionSnapshot);
            if (saved.status !== 'ok') sharedNotice = saved.status === 'conflict'
              ? 'Trình duyệt vừa đổi người ở nơi khác. Bài này vẫn thuộc người vừa mở; danh tính chung mới được giữ nguyên.'
              : 'Đã mở bài nhưng chưa nhớ được người học dùng chung. Bạn vẫn làm bài bình thường.';
          }
        } else if ((await sharedMemory.forgetAtomic(selectionSnapshot.revision)).status !== 'empty')
          sharedNotice = 'Chưa quên được danh tính chung trên trình duyệt. Hãy kiểm lại trước khi dùng chung thiết bị.';
      }
      const notice = $('memory-status');
      if (!documentOnly && !bindTab(studentRef, code)) sharedNotice = 'Bài vẫn thuộc đúng người vừa mở, nhưng trình duyệt chưa giữ được người của tab khi tải lại.';
      if (documentOnly) sharedNotice = 'Bài được lưu theo bản Docs này. Hồ sơ lớp đã nhớ trên thiết bị được giữ nguyên.';
      notice.textContent = sharedNotice || (stored ? '' : 'Đã mở bài, nhưng trình duyệt không lưu hoặc xóa được hồ sơ ghi nhớ. Không dùng thiết bị chung nếu hồ sơ cũ chưa được xóa.');
      notice.hidden = !notice.textContent;
      $('active-student').textContent = studentName;
      $('active-class').textContent = code;
      $('login-screen').hidden = true;
      $('lesson-hero').hidden = false;
      $('identity-confirmed').hidden = false;
      $('homework-content').hidden = false;
      await onOpened(Object.freeze({ session: Object.freeze({ ...session }), assignment: selectedAssignment, studentRef, studentName, classCode: code, documentId: session.documentId }));
    } catch (error) {
      active = false;
      activeIdentity = null;
      classSelect.disabled = Boolean(originalDocumentId);
      studentSelect.disabled = false;
      button.disabled = !studentSelect.value;
      message(`Chưa mở được bài: ${error.message}`, 'error');
    }
  }
  button.addEventListener('click', () => openSelected());
  $('change-student').addEventListener('click', async () => {
    if ($('change-student').disabled) return;
    const beforeReset = sharedMemory?.read();
    if (await onReset?.() === false) return;
    bindTab();
    active = false;
    activeIdentity = null;
    ++selectionGeneration;
    ++revision;
    controller?.abort();
    mismatchNotice = '';
    requireManualSelection = true;
    sharedResolution = null;
    const forgotten = sharedMemory ? await sharedMemory.forgetAtomic(beforeReset.revision) : null;
    memoryNotice = (sharedMemory ? forgotten.status === 'empty' : writeMemory(storage, key, ''))
      ? '' : 'Chưa quên được hồ sơ đã nhớ. Bạn vẫn có thể chọn người học khác cho lượt này.';
    $('memory-status').hidden = true;
    $('lesson-hero').hidden = $('identity-confirmed').hidden = $('homework-content').hidden = true;
    $('login-screen').hidden = false;
    classSelect.disabled = Boolean(originalDocumentId);
    // Giữ file CTA khi chọn người khác cùng lớp; đổi lớp mới bỏ ngữ cảnh Docs cũ.
    classSelect.value = selectedCode;
    if (originalAssignment?.intakeMode === 'document') await start();
    else await loadRoster(selectedCode);
    classSelect.focus();
  });
  window.addEventListener('storage', event => {
    if (sharedIdentityEnabled) return;
    if (active || (event.key !== key && event.key !== null)) return;
    // Bộ nhớ chỉ gợi ý trước xác nhận. Khi thay đổi ở tab khác, xóa chọn sẵn cũ.
    remembered = readMemory(storage, key);
    studentSelect.value = '';
    button.disabled = true;
    $('remembered-identity').hidden = true;
    $('forget-remembered').hidden = true;
    message('Hồ sơ ghi nhớ vừa thay đổi ở tab khác. Hãy chọn lại tên trước khi mở bài.');
  });
  sharedMemory?.subscribe(next => {
    if (active) {
      if (next.status !== 'ok' || next.identity.id !== activeIdentity?.id) {
        $('memory-status').textContent = 'Trình duyệt đã đổi hoặc quên người học ở nơi khác. Bài đang làm vẫn giữ đúng người ban đầu.';
        $('memory-status').hidden = false;
      }
      return;
    }
    ++selectionGeneration;
    ++revision;
    controller?.abort();
    sharedResolution = null;
    if (next.status === 'ok') void start();
  });
  return { start };
}

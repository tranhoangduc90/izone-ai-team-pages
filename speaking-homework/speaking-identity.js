import { memoryKey, readMemory, writeMemory } from '../shared/student-memory.js';

const $ = id => document.getElementById(id);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refOf = student => student.student_ref || student.studentRef || '';

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

// Nhận mã bài, lớp gợi ý và file Docs từ link; chỉ nhớ UUID trong khóa chung.
// Tải lại lớp/tên từ máy chủ, yêu cầu bấm Mở bài và khóa danh tính sau khi mở phiên.
// Lỗi roster hoặc bộ nhớ có thông báo; kết quả tải cũ không thay lựa chọn mới.
export function createSpeakingIdentity({ apiBase, identityBase, assignmentCode, lessonNumber,
  originalDocumentId = '', classHint = '', allowWebReceipt = false, validateAssignment, onOpened, onReset }) {
  const key = memoryKey(identityBase, location.href);
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  let remembered = readMemory(storage, key);
  const classSelect = $('class-select');
  const studentSelect = $('student-select');
  const button = $('open-homework');
  const remember = $('remember-student');
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
    $('forget-remembered').hidden = true;
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
      studentSelect.value = roster.has(preferred) ? preferred : '';
      button.disabled = !studentSelect.value;
      $('remembered-identity').hidden = !studentSelect.value;
      $('forget-remembered').hidden = !studentSelect.value;
      contextText(next);
      message(roster.size ? `Đã tải ${roster.size} học viên của lớp ${code}.${next.assignmentStatus === 'closed' ? ' Homework đã đóng. Chỉ học viên đã nộp bài mới có thể vào luyện thêm.' : useDocument(code) ? ' Bài sẽ được ghi vào đúng file Homework của link này.' : ''}` : 'Lớp này chưa có học viên hợp lệ để mở bài.');
    } catch (error) {
      if (current !== revision || error.name === 'AbortError') return;
      loading('Chưa tải được danh sách học viên');
      message(`Chưa mở được bài: ${error.message}`, 'error');
      $('reload-roster').hidden = false;
    }
  }
  async function start() {
    const current = ++revision;
    controller?.abort();
    controller = new AbortController();
    classSelect.disabled = true;
    loading('Đang tải danh sách lớp…');
    remembered = readMemory(storage, key);
    memoryNotice = remembered.status === 'unavailable' ? 'Trình duyệt đang chặn bộ nhớ. Bạn vẫn có thể chọn lớp, tên và mở bài.'
      : remembered.status === 'invalid' ? 'Thông tin đã nhớ không còn hợp lệ. Hãy chọn lại lớp và tên.' : '';
    if (remembered.status === 'unavailable') { remember.checked = false; remember.disabled = true; }
    message('Đang tải danh sách lớp…');
    try {
      const data = await requestJson(apiBase, `/classes?assignmentCode=${encodeURIComponent(assignmentCode)}`, null, controller.signal);
      if (current !== revision || active) return;
      classes = Array.isArray(data.classes) ? data.classes : [];
      classSelect.replaceChildren(new Option('Chọn lớp của bạn', ''));
      for (const item of classes) {
        const option = new Option(`${item.classCode}${item.ready === true ? '' : ` · Chưa sẵn sàng (${item.assignmentStatus || 'chưa có bài'})`}`, item.classCode);
        option.disabled = item.ready !== true;
        classSelect.add(option);
      }
      let resolved = null;
      if (remembered.status === 'ok') {
        try {
          resolved = await requestJson(apiBase, '/identity/resolve', { assignmentCode, studentRef: remembered.studentRef }, controller.signal);
          if (resolved.status !== 'unique') {
            memoryNotice = resolved.status === 'ambiguous' ? 'Hồ sơ đã nhớ khớp nhiều lớp. Hãy chọn đúng lớp và tên.' : 'Hồ sơ đã nhớ chưa có bài phù hợp. Hãy chọn lớp và tên.';
            resolved = null;
          }
        } catch (error) { memoryNotice = `Chưa kiểm tra được hồ sơ đã nhớ: ${error.message}`; }
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
          const opened=await requestJson(apiBase,'/session/start-selected',{
            assignmentCode,classCode:originalClass,documentId:originalDocumentId,
            studentRef:refOf(profile),identityConfirmed:true
          },controller.signal);
          if(current!==revision||active)return;
          const session=opened.session;
          if(!session?.accessToken || session.studentRef!==refOf(profile) || session.documentId!==originalDocumentId || !session.workUnitId)
            throw new Error('Phiên bài riêng chưa khớp bản Docs.');
          active=true;
          $('login-screen').hidden=true;
          $('lesson-hero').hidden=false;
          $('identity-confirmed').hidden=true;
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
      mismatchNotice = originalDocumentId && !documentDropped && resolved?.classCode && resolved.classCode !== code
        ? `Link Homework thuộc lớp ${code}; hồ sơ đã nhớ thuộc lớp ${resolved.classCode}. Hãy chọn đúng người trong lớp của link hoặc đổi lớp để mở bài của bạn.` : '';
      classSelect.disabled = classSelect.options.length < 2;
      if (code && canOpenClass(code)) {
        classSelect.value = code;
        await loadRoster(code, preferred);
      } else {
        classSelect.value = '';
        loading('Chọn lớp trước để xem danh sách');
        message(classes.some(item => item.ready === true) ? 'Chọn lớp và tên của bạn để mở bài.' : 'Chưa có lớp nào sẵn sàng cho bài này.');
      }
    } catch (error) {
      if (current !== revision || error.name === 'AbortError') return;
      message(`Chưa tải được bài: ${error.message}`, 'error');
      $('reload-roster').hidden = false;
    }
  }
  classSelect.addEventListener('change', () => {
    if (active) return;
    if (originalClass && classSelect.value !== originalClass) {
      documentDropped = true;
      const option = [...classSelect.options].find(item => item.value === originalClass);
      if (option && itemFor(originalClass)?.ready !== true) option.disabled = true;
    }
    mismatchNotice = '';
    loadRoster(classSelect.value);
  });
  studentSelect.addEventListener('change', () => {
    button.disabled = !roster.has(studentSelect.value);
    $('remembered-identity').hidden = true;
    $('forget-remembered').hidden = true;
  });
  $('forget-remembered').addEventListener('click', () => {
    if (active) return;
    memoryNotice = writeMemory(storage, key, '') ? '' : 'Chưa xóa được hồ sơ đã nhớ. Bạn vẫn có thể chọn người học khác cho lượt này.';
    studentSelect.value = '';
    button.disabled = true;
    $('remembered-identity').hidden = true;
    $('forget-remembered').hidden = true;
    message('Chọn đúng tên của bạn để mở bài.');
    studentSelect.focus();
  });
  $('reload-roster').addEventListener('click', () => classes.length && selectedCode ? loadRoster(selectedCode) : start());
  button.addEventListener('click', async () => {
    if (active || !assignment || !roster.has(studentSelect.value)) return;
    const studentRef = studentSelect.value;
    const code = selectedCode;
    const studentName = roster.get(studentRef);
    const selectedAssignment = assignment;
    active = true;
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
      const stored = writeMemory(storage, key, remember.checked ? studentRef : '');
      const notice = $('memory-status');
      notice.textContent = stored ? '' : 'Đã mở bài, nhưng trình duyệt không lưu hoặc xóa được hồ sơ ghi nhớ. Không dùng thiết bị chung nếu hồ sơ cũ chưa được xóa.';
      notice.hidden = stored;
      $('active-student').textContent = studentName;
      $('active-class').textContent = code;
      $('login-screen').hidden = true;
      $('lesson-hero').hidden = false;
      $('identity-confirmed').hidden = false;
      $('homework-content').hidden = false;
      await onOpened(Object.freeze({ session: Object.freeze({ ...session }), assignment: selectedAssignment, studentRef, studentName, classCode: code, documentId: session.documentId }));
    } catch (error) {
      active = false;
      classSelect.disabled = false;
      studentSelect.disabled = false;
      button.disabled = !studentSelect.value;
      message(`Chưa mở được bài: ${error.message}`, 'error');
    }
  });
  $('change-student').addEventListener('click', async () => {
    if ($('change-student').disabled) return;
    await onReset?.();
    active = false;
    ++revision;
    controller?.abort();
    mismatchNotice = '';
    memoryNotice = writeMemory(storage, key, '') ? '' : 'Chưa xóa được hồ sơ đã nhớ. Bạn vẫn có thể chọn người học khác cho lượt này.';
    $('memory-status').hidden = true;
    $('lesson-hero').hidden = $('identity-confirmed').hidden = $('homework-content').hidden = true;
    $('login-screen').hidden = false;
    classSelect.disabled = false;
    // Giữ file CTA khi chọn người khác cùng lớp; đổi lớp mới bỏ ngữ cảnh Docs cũ.
    classSelect.value = selectedCode;
    await loadRoster(selectedCode);
    classSelect.focus();
  });
  window.addEventListener('storage', event => {
    if (active || (event.key !== key && event.key !== null)) return;
    // Bộ nhớ chỉ gợi ý trước xác nhận. Khi thay đổi ở tab khác, xóa chọn sẵn cũ.
    remembered = readMemory(storage, key);
    studentSelect.value = '';
    button.disabled = true;
    $('remembered-identity').hidden = true;
    $('forget-remembered').hidden = true;
    message('Hồ sơ ghi nhớ vừa thay đổi ở tab khác. Hãy chọn lại tên trước khi mở bài.');
  });
  return { start };
}

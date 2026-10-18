import { classMatches, classRefOf, officialStudent, rosterGroups, studentRefOf } from './student-memory.js?v=20260905-memory-v3';
import { createCourseStudentIdentity, requestMappingStudentIdentity } from '../../shared/course-student-identity.js?v=20261018-identity-v1';

// Nhận roster mới, chỉ chọn UUID chính thức rồi mở bằng API Writing cũ.
// Mã tạm giữ PIN riêng; nháp/phiên/Check vẫn do app sở hữu theo activity–lớp–người.
export function installStudentMemory(options) {
  const { roster, form, classSelect, studentSelect, refreshStudents, refreshAccessCode,
    resetIdentityFields = () => {}, resumeButton, workspace, workspaceActions, beforeSwitch, notice } = options;
  const groups = rosterGroups(roster), query = new URLSearchParams(location.search);
  const entry = roster.activity?.slug || query.get('task') || location.pathname;
  const identity = createCourseStudentIdentity({ product: 'writing-handout', entry, requestIdentity: requestMappingStudentIdentity });
  const requested = query.get('class')?.trim() || '';
  const label = document.createElement('label'); label.className = 'checkbox-row';
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = 'remember-student'; checkbox.checked = true;
  label.append(checkbox, document.createTextNode('Ghi nhớ tôi trên thiết bị này'));
  const status = document.createElement('p'); status.id = 'remember-student-status'; status.className = 'muted'; status.setAttribute('role', 'status');
  const change = document.createElement('button'); change.type = 'button'; change.className = 'secondary';
  change.id = 'change-remembered-student'; change.textContent = 'Đổi người học';
  form.querySelector('[type="submit"]').before(label, status, change);
  const changeActive = change.cloneNode(true); changeActive.id = 'change-active-student'; workspaceActions.append(changeActive);
  resumeButton.hidden = true;
  let busy = false, activeStudentRef = '', disabledBefore = [], context = null, remember = true;
  let automatic = null, pinned = false, selectionGeneration = 0;
  const selection = () => {
    const group = groups.find(item => classRefOf(item) === classSelect.value);
    const students = group?.students.filter(item => studentRefOf(item) === studentSelect.value) || [];
    return { group, student: students.length === 1 ? students[0] : null };
  };
  function sync() {
    const { student } = selection();
    const temporary = Boolean(student && !officialStudent(student)) || Boolean(form.querySelector('[id$="provisional-panel"]:not([hidden])'));
    checkbox.disabled = temporary || identity.read().status === 'unavailable';
    status.textContent = temporary ? 'Hồ sơ tạm giữ mã 4 số, chưa được nhớ sang bài khác.'
      : 'Lần sau trình duyệt tự nhận bạn và mở đúng bài. Bỏ tick nếu dùng máy chung.';
  }
  function choose(group, student) {
    classSelect.value = classRefOf(group); refreshStudents(); studentSelect.value = studentRefOf(student);
    resetIdentityFields(); refreshAccessCode(); sync();
  }
  async function applyMemory() {
    const version = ++selectionGeneration;
    if (busy || activeStudentRef) return;
    const own = identity.getPinned();
    if (own?.studentRef) {
      const matches = groups.filter(g => !own.classRef || classRefOf(g) === own.classRef).flatMap(group =>
        group.students.filter(s => studentRefOf(s) === own.studentRef).map(student => ({ group, student })));
      if (matches.length === 1) { choose(matches[0].group, matches[0].student); pinned = true; form.requestSubmit(); return; }
      status.textContent = 'Chưa xác minh được người của tab đang mở. Bài và nháp vẫn được giữ.'; return;
    }
    try {
      const resolved = await identity.resolveAliases();
      if (version !== selectionGeneration || busy || activeStudentRef) return;
      if (resolved.status !== 'unique') { sync(); return; }
      const candidates = groups.filter(g => !requested || classMatches(g, requested)).flatMap(group =>
        group.students.filter(officialStudent).flatMap(student => resolved.aliases
          .filter(alias => alias.studentRef === studentRefOf(student)).map(alias => ({ group, student, alias }))));
      const matches = classSelect.value ? candidates.filter(c => classRefOf(c.group) === classSelect.value) : candidates;
      if (matches.length !== 1) {
        status.textContent = candidates.length > 1 ? 'Trình duyệt đã nhớ bạn. Chọn lớp của bài muốn mở; không cần chọn lại tên.'
          : 'Chưa tìm thấy đúng một hồ sơ có quyền trong bài này. Danh tính đã nhớ được giữ; hãy kiểm tra link hoặc dùng Đổi người học.';
        return;
      }
      const match = matches[0]; choose(match.group, match.student);
      automatic = { alias: match.alias, resolution: resolved }; pinned = false; form.requestSubmit();
    } catch { status.textContent = 'Chưa kiểm được người đã nhớ. Bạn vẫn có thể chọn tên; danh tính cũ được giữ.'; }
  }
  change.addEventListener('click', async () => {
    if (busy) return;
    if ((await identity.forget()).status !== 'empty') { status.textContent = 'Chưa bỏ được ghi nhớ; nháp vẫn được giữ.'; return; }
    ++selectionGeneration; automatic = null; pinned = false; resetIdentityFields(); studentSelect.value = ''; refreshAccessCode(); sync();
    status.textContent = 'Đã bỏ ghi nhớ. Hãy chọn người học.';
  });
  changeActive.addEventListener('click', async () => {
    if (busy) return;
    busy = true; workspace.inert = true;
    try {
      if (!(await beforeSwitch())) { notice('Chưa thể đổi người học. Hãy chờ xử lý hoặc lưu xong bài hiện tại.'); return; }
      if ((await identity.forget()).status !== 'empty') { notice('Chưa bỏ được ghi nhớ. Bài hiện tại vẫn được giữ.'); return; }
      location.reload();
    } catch { notice('Chưa thể đổi người học. Bài và nháp vẫn được giữ.'); }
    finally { busy = false; workspace.inert = false; }
  });
  classSelect.addEventListener('change', () => { ++selectionGeneration; automatic = null; pinned = false; resetIdentityFields(); refreshAccessCode(); sync(); void applyMemory(); });
  studentSelect.addEventListener('change', () => { ++selectionGeneration; automatic = null; pinned = false; identity.invalidate(); resetIdentityFields(); refreshAccessCode(); sync(); });
  identity.subscribe(() => {
    if (activeStudentRef || !workspace.hidden) notice('Lựa chọn chung đã đổi ở tab khác. Bài tại đây vẫn giữ nguyên người và nháp.');
    else if (!busy) void applyMemory();
  });
  if (requested) { const matches = groups.filter(group => classMatches(group, requested));
    if (matches.length === 1) { classSelect.value = classRefOf(matches[0]); refreshStudents(); } }
  sync();
  // Chờ caller nhận controller trước khi submit tự động để vẫn đi qua khóa mở phiên.
  const ready = Promise.resolve().then(applyMemory);
  return {
    ready, refresh: sync,
    begin() {
      if (busy) return false;
      busy = true;
      const { student } = selection(); remember = checkbox.checked && !checkbox.disabled && officialStudent(student);
      context = pinned ? null : automatic ? identity.automaticContext(automatic) : identity.prepare(studentSelect.value, '');
      disabledBefore = [...form.elements].map(element => [element, element.disabled]);
      for (const [element] of disabledBefore) element.disabled = true;
      return true;
    },
    isCurrent() { return !automatic || identity.isCurrent(automatic); },
    async complete(opened) {
      const { group, student } = selection();
      if (classRefOf(group || {}) !== opened.classRef || studentRefOf(student || {}) !== opened.studentRef) throw new Error('Phiên chưa khớp lớp và người đã chọn.');
      activeStudentRef = opened.studentRef;
      if (!pinned) await identity.commit(context, { automatic: Boolean(automatic), remember }).then(result => {
        if (!['ok', 'empty'].includes(result.status)) notice('Bài đã mở đúng người; trình duyệt chưa nhớ được cho bài khác.');
      }).catch(() => notice('Bài đã mở đúng người; trình duyệt chưa nhớ được cho bài khác.'));
      identity.pin(opened.studentRef, { classRef: opened.classRef });
    },
    end() { for (const [element, disabled] of disabledBefore) element.disabled = disabled;
      disabledBefore = []; busy = false; sync(); }
  };
}

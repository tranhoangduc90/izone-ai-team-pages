const template = `<div class="login-layout hw-student-entry">
  <div class="login-intro"><p class="hw-login-lesson">Homework Lesson 3</p><h1>Fast Food · Viết mở bài</h1><p>Chốt dàn ý rồi viết phần mở bài.</p></div>
  <section class="card login-card" aria-labelledby="hw-student-title">
    <h2 id="hw-student-title">Bạn học lớp nào?</h2>
    <p class="hw-login-subtitle">Chọn đúng lớp và tên trước khi bắt đầu.</p>
    <p id="hw-entry-note" role="status" hidden></p>
    <div id="owned-profiles">
      <label class="field" for="hw-entry-class">Lớp<select id="hw-entry-class" disabled><option>Chọn lớp của bạn</option></select></label>
      <label class="field" for="hw-entry-student">Học viên<select id="hw-entry-student" disabled><option>Chọn tên của bạn</option></select></label>
      <p class="hw-entry-hint">Trình duyệt sẽ nhớ người học sau khi mở bài. Dùng Đổi người học khi dùng chung thiết bị.</p>
      <button type="button" class="primary" id="online-login" disabled>Mở bài Writing <span aria-hidden="true">→</span></button>
    </div>
    <div id="hw-entry-verification"><p>Đăng nhập Google để xác nhận đúng chủ bài trước khi chọn tên.</p><div id="google-login"></div></div>
    <div id="online-error" role="alert"></div>
    <button type="button" class="hw-entry-link" id="hw-entry-change" hidden>Đổi người học</button>
    <div class="hw-entry-footer"><p>Không thấy lớp hoặc tên? Nhờ giảng viên kiểm tra.</p><button type="button" class="hw-entry-link" id="hw-entry-teacher">Giảng viên</button></div>
    <dialog id="hw-entry-confirm" aria-labelledby="hw-entry-confirm-title">
      <h2 id="hw-entry-confirm-title">Kiểm tra thông tin trước khi vào bài</h2>
      <p id="hw-entry-confirm-summary"></p>
      <p>Bạn xác nhận đây là tài khoản và họ tên của mình chứ?</p>
      <form method="dialog" class="hw-entry-confirm-actions">
        <button value="cancel" autofocus>Quay lại</button>
        <button value="confirm" class="primary">Xác nhận và vào bài</button>
      </form>
    </dialog>
  </section>
</div>`;

export function mountStudentEntry(root, { personal, rememberedDifferent, onTeacher, onChange, onChoose }) {
  root.innerHTML = template;
  const find = id => root.querySelector('#' + id);
  const group = find('hw-entry-class');
  const name = find('hw-entry-student');
  const note = find('hw-entry-note');
  const open = find('online-login');
  const verification = find('hw-entry-verification');
  const dialog = find('hw-entry-confirm');
  let candidates = [], match = null, pendingChoice = null;
  let busy = false;

  function options(select, placeholder, items) {
    select.replaceChildren(new Option(placeholder, ''));
    for (const [key, label] of items) select.add(new Option(label, key));
  }
  function selected() {
    const candidate = name.value === '' ? null : candidates[Number(name.value)];
    return candidate?.classId === group.value ? candidate : null;
  }
  function updateNames() {
    const members = candidates.flatMap((row, index) => row.classId === group.value ? [[String(index), row.name]] : []);
    options(name, 'Chọn tên của bạn', members);
    name.disabled = busy || members.length === 0;
    open.disabled = true;
  }
  function profiles(rows, selfMatch = null) {
    match = selfMatch;
    if (dialog.open) dialog.close();
    candidates = rows;
    const classes = new Map(rows.map(row => [row.classId, row.classCode]));
    options(group, 'Chọn lớp của bạn', classes);
    if (classes.size === 1) group.value = classes.keys().next().value;
    group.disabled = personal || classes.size < 2;
    updateNames();
    verification.hidden = true;
    note.hidden = !personal;
    const different = rows.length === 1 && rememberedDifferent(rows[0]);
    note.textContent = different ? 'Link Homework khác người học đã nhớ. Chỉ tiếp tục nếu đây là bài của bạn.' :
      'Bài mở từ Docs cá nhân. Nếu đây là Docs của người khác, hãy mở lại từ Docs của bạn.';
    find('hw-entry-change').hidden = false;
    find('hw-student-title').textContent = match ? 'Xác nhận họ và tên của bạn' : 'Bạn học lớp nào?';
    open.firstChild.textContent = match ? 'Tiếp tục ' : 'Mở bài Writing ';
    if (match) {
      note.hidden = false;
      note.textContent = 'Bài này được giao cho tài khoản Google ' + match.account + '.';
    }
  }
  function setBusy(value) {
    busy = value;
    group.disabled = busy || personal || new Set(candidates.map(row => row.classId)).size < 2;
    name.disabled = busy || !group.value || !candidates.length;
    open.disabled = busy || !selected();
    find('hw-entry-change').disabled = busy;
  }
  group.addEventListener('change', updateNames);
  name.addEventListener('change', () => { open.disabled = busy || !selected(); });
  open.addEventListener('click', () => {
    const choice = selected();
    if (busy || !choice) return;
    if (!match) { void onChoose(choice); return; }
    pendingChoice = choice;
    dialog.returnValue = '';
    find('hw-entry-confirm-summary').textContent = [match.account, choice.name, choice.classCode].join(' · ');
    dialog.showModal();
  });
  dialog.addEventListener('close', () => {
    const choice = pendingChoice;
    pendingChoice = null;
    if (dialog.returnValue === 'confirm' && choice === selected() && !busy) void onChoose(choice);
    else open.focus();
  });
  find('hw-entry-change').addEventListener('click', onChange);
  find('hw-entry-teacher').addEventListener('click', onTeacher);
  return { profiles, setBusy };
}

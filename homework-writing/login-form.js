// Chỉ là bộ chọn danh tính giả. Quyền bài/lớp vẫn được kiểm ở máy chủ.
export function setupLoginForm(people) {
  const role = document.querySelector('#role-select'), classes = document.querySelector('#class-select');
  const profile = document.querySelector('#profile'), login = document.querySelector('#login');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const classLabel = id => ({ 'c-01': 'DEMO 1', 'c-02': 'DEMO 2', 'c-03': 'DEMO 3' })[id] || id;
  classes.innerHTML = '<option value="">Chọn lớp của em</option>' + [...new Set(people.filter(p => p.role === 'student').map(p => p.class_id))].sort().map(id => `<option value="${escape(id)}">${escape(classLabel(id))}</option>`).join('');
  const refresh = () => {
    const student = role.value === 'student';
    document.querySelector('#class-field').hidden = !student;
    document.querySelector('#profile-field').hidden = role.value === 'operator';
    document.querySelector('#profile-label').textContent = student ? 'Tên học viên' : role.value === 'teacher' ? 'Giảng viên' : 'Tài khoản vận hành';
    const options = people.filter(p => p.role === role.value && (!student || p.class_id === classes.value));
    profile.innerHTML = `<option value="">${student ? 'Chọn tên học viên' : 'Chọn tài khoản'}</option>` + options.map(p => `<option value="${escape(p.id)}">${escape(p.label)}</option>`).join('');
    profile.disabled = student && !classes.value;
    if (role.value === 'operator') profile.value = options[0]?.id || '';
    login.disabled = !profile.value;
  };
  role.onchange = refresh; classes.onchange = refresh;
  profile.onchange = () => { login.disabled = !profile.value; };
  refresh();
}

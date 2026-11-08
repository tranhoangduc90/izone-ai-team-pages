const endpoint = '/api/term-tests/term-test-1-k56/skill-fallback/';
const modeLabels = { lis_first: 'Listening trước', read_first: 'Reading trước' };
const grantLabels = { awaiting: 'Đã cấp · Chưa kích hoạt', bound: 'Đang gắn với thiết bị học viên', expired: 'Đã hết hạn kích hoạt' };
let active;

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function button(text, primary = false) {
  const result = node('button', text, 'button ' + (primary ? 'button-primary' : 'button-secondary'));
  result.type = 'button';
  return result;
}

export function clearTerm1SkillManager({ staleOnly = false } = {}) {
  if (!active || (staleOnly && active.isCurrent())) return;
  const previous = active;
  active = null;
  previous.dialog.remove();
  if (previous.isCurrent() && previous.opener.isConnected) previous.opener.focus();
}

export function openTerm1SkillManager({ classCode, student, opener, request, isCurrent }) {
  if (!isCurrent()) return;
  clearTerm1SkillManager();
  const dialog = node('dialog', '', 'teacher-saved-progress-dialog term1-skill-manager');
  const title = node('h2', 'Link dự phòng Reading');
  title.id = 'term1SkillManagerTitle';
  dialog.setAttribute('aria-labelledby', title.id);
  const header = node('header');
  const close = button('Đóng');
  header.append(title, close);
  const status = node('p', '', 'notice');
  status.setAttribute('role', 'status');
  const actions = node('section');
  dialog.append(header, node('p', `${student.name} · ${classCode} · Term Test 1`), status, actions);
  active = { dialog, opener, isCurrent };
  const current = () => active?.dialog === dialog && dialog.isConnected && isCurrent();
  const scope = { classCode, studentRef: student.ref, section: 'reading' };
  let issued;

  const send = (action, fields = {}) => request(endpoint + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...scope, ...fields }), isCurrent: current
  });

  function copyField(label, value) {
    const wrap = node('p');
    const caption = node('label', label + ' ');
    const field = node('input');
    field.value = value;
    field.readOnly = true;
    caption.append(field);
    const copy = button('Sao chép ' + label.toLowerCase());
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(field.value); if (current()) status.textContent = 'Đã sao chép ' + label.toLowerCase() + '.'; }
      catch { if (current()) { field.select(); status.textContent = 'Hãy sao chép nội dung đang được chọn.'; } }
    });
    wrap.append(caption, document.createTextNode(' '), copy);
    return wrap;
  }

  async function refresh() {
    status.textContent = 'Đang kiểm tra lượt thi và quyền cấp link…';
    actions.replaceChildren();
    try {
      const value = await send('manage');
      if (current()) render(value);
    } catch (error) {
      if (!current()) return;
      status.textContent = error.status === 404 ? 'Cổng này chưa mở quản lý link dự phòng.' : error.message;
      const retry = button('Kiểm tra lại');
      retry.addEventListener('click', refresh);
      actions.append(retry);
    }
  }

  async function mutate(action, fields) {
    actions.querySelectorAll('button, input, select').forEach(control => { control.disabled = true; });
    status.textContent = action === 'issue' ? 'Đang cấp link…' : 'Đang thu hồi link…';
    try {
      const value = await send(action, fields);
      if (!current()) return;
      issued = action === 'issue' ? value : null;
      await refresh();
    } catch (error) {
      if (!current()) return;
      status.textContent = error.status ? error.message : 'Chưa nhận được xác nhận. Kiểm tra trạng thái trước khi thao tác lại.';
      const retry = button('Kiểm tra trạng thái');
      retry.addEventListener('click', refresh);
      actions.append(retry);
    }
  }

  function render(value) {
    const grant = value.activeGrant;
    status.textContent = value.submitted ? 'Reading đã nộp.' : grant ? grantLabels[grant.state]
      : value.issueEnabled ? 'Có thể cấp một link Reading cho học viên này.' : 'Cấp link mới đang tạm đóng.';
    if (value.attemptExists && modeLabels[value.examMode]) actions.append(node('p', 'Bài chính · ' + modeLabels[value.examMode]));
    if (grant) {
      if (grant.state === 'awaiting') actions.append(node('p', 'Hạn kích hoạt · ' + new Date(grant.expiresAt).toLocaleString('vi-VN')));
      if (issued?.grantId === grant.grantId && grant.state === 'awaiting') {
        const link = new URL('../term-test-1-k56-reading-fallback/', import.meta.url);
        link.searchParams.set('class', classCode);
        link.hash = new URLSearchParams({ g: issued.token });
        actions.append(node('p', 'Sao chép link và gửi mã kích hoạt riêng cho học viên.'),
          copyField('Link Reading', link.href), copyField('Mã kích hoạt', issued.activationCode));
      } else if (grant.state === 'awaiting') {
        actions.append(node('p', 'Link và mã được hiển thị khi cấp. Nếu chưa lưu được, hãy thu hồi rồi cấp lại.'));
      }
      const revoke = button('Thu hồi link');
      revoke.addEventListener('click', () => {
        const message = grant.state === 'bound' ? 'Link đã gắn với thiết bị học viên. Xác nhận đã dừng làm và lưu bản trên thiết bị đó trước khi thu hồi?' : 'Thu hồi link Reading của học viên này?';
        if (window.confirm(message)) void mutate('revoke', { grantId: grant.grantId });
      });
      actions.append(revoke);
      return;
    }
    if (!value.issueEnabled || value.submitted) return;
    const issue = button('Cấp link Reading', true);
    const mode = node('select');
    const stopped = node('input');
    if (!value.attemptExists) {
      const label = node('label', 'Thứ tự của bài chính');
      mode.append(new Option('Chọn thứ tự bài chính', ''), ...Object.entries(modeLabels).map(([key, name]) => new Option(name, key)));
      label.append(mode);
      actions.append(label);
    }
    if (value.started) {
      const label = node('label');
      stopped.type = 'checkbox';
      label.append(stopped, document.createTextNode(' Tôi đã xác nhận học viên dừng Reading và lưu bài trên thiết bị cũ.'));
      actions.append(node('p', 'Link tiếp tục từ giờ và nháp đã lưu trên máy chủ.'), label, node('br'));
    }
    const validate = () => { issue.disabled = (!value.attemptExists && !mode.value) || (value.started && !stopped.checked); };
    mode.addEventListener('change', validate);
    stopped.addEventListener('change', validate);
    validate();
    issue.addEventListener('click', () => void mutate('issue', {
      ...mode.value ? { examMode: mode.value } : {}, oldDeviceStopped: stopped.checked
    }));
    actions.append(issue);
  }

  close.addEventListener('click', () => clearTerm1SkillManager());
  dialog.addEventListener('cancel', event => { event.preventDefault(); clearTerm1SkillManager(); });
  document.body.append(dialog);
  dialog.showModal();
  void refresh();
}

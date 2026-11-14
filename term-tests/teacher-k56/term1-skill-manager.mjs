const endpoint = '/api/term-tests/term-test-1-k56/skill-fallback/';
const modeLabels = { lis_first: 'Listening trước', read_first: 'Reading trước' };
const grantLabels = { awaiting: 'Đã cấp · Chưa kích hoạt', bound: 'Đang gắn với thiết bị học viên', expired: 'Đã hết hạn kích hoạt' };
let active;
const journalKey = 'izone:term1-k56-fallback-grant:v1';
const isGrantId = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export function readTerm1SkillGrantJournal() {
  try {
    const rows = JSON.parse(sessionStorage.getItem(journalKey) || '[]');
    return Array.isArray(rows) ? rows.slice(-80) : [];
  } catch { return []; }
}

function record(section, action, outcome, { grantId, status } = {}) {
  try {
    const event = { schemaVersion: 1, testSlug: 'term-test-1-k56', section, action, outcome, occurredAt: new Date().toISOString() };
    if (isGrantId(grantId)) event.grantId = grantId;
    if (Number.isInteger(status) && status >= 100 && status <= 599) event.status = status;
    const rows = readTerm1SkillGrantJournal();
    rows.push(event);
    sessionStorage.setItem(journalKey, JSON.stringify(rows.slice(-80)));
  } catch {}
}

function outcomeFor(error, current) {
  if (error.status === 401 || error.status === 403) return 'denied';
  if (!current()) return 'stale';
  return error.status >= 400 && error.status < 500 ? 'refused' : 'unconfirmed';
}

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

export function openTerm1SkillManager({ classCode, student, opener, request, isCurrent, section = 'reading' }) {
  if (!isCurrent()) return;
  const label = { listening: 'Listening', reading: 'Reading', writing: 'Writing' }[section];
  clearTerm1SkillManager();
  const dialog = node('dialog', '', 'teacher-saved-progress-dialog term1-skill-manager');
  const title = node('h2', 'Link dự phòng ' + label);
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
  const scope = { classCode, studentRef: student.ref, section };
  let issued;

  const send = (action, fields = {}) => request(endpoint + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...scope, ...fields }), isCurrent: current
  });

  function copyField(label, value, grantId) {
    const wrap = node('p');
    const caption = node('label', label + ' ');
    const field = node('input');
    field.value = value;
    field.readOnly = true;
    caption.append(field);
    const copy = button('Sao chép ' + label.toLowerCase());
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(field.value);
        if (grantId) record(section, 'copy_link', current() ? 'confirmed' : 'stale', { grantId });
        if (current()) status.textContent = 'Đã sao chép ' + label.toLowerCase() + '.';
      } catch {
        if (grantId) record(section, 'copy_link', current() ? 'unconfirmed' : 'stale', { grantId });
        if (current()) { field.select(); status.textContent = 'Hãy sao chép nội dung đang được chọn.'; }
      }
    });
    wrap.append(caption, document.createTextNode(' '), copy);
    return wrap;
  }

  async function refresh() {
    status.textContent = 'Đang kiểm tra lượt thi và quyền cấp link…';
    actions.replaceChildren();
    try {
      const value = await send('manage');
      record(section, 'manage', current() ? 'confirmed' : 'stale', { grantId: value.activeGrant?.grantId });
      if (current()) render(value);
    } catch (error) {
      record(section, 'manage', outcomeFor(error, current), { status: error.status });
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
    record(section, action, 'requested', { grantId: fields.grantId });
    try {
      const value = await send(action, fields);
      const verified = value?.ok === true && value.section === section && isGrantId(value.grantId)
        && (action !== 'revoke' || value.grantId === fields.grantId);
      if (!verified) throw Error('Phản hồi chưa xác nhận đúng link đang xử lý.');
      record(section, action, current() ? 'confirmed' : 'stale', { grantId: value.grantId });
      if (!current()) return;
      issued = action === 'issue' ? value : null;
      await refresh();
    } catch (error) {
      record(section, action, outcomeFor(error, current), { grantId: fields.grantId, status: error.status });
      if (!current()) return;
      status.textContent = error.status ? error.message : 'Chưa nhận được xác nhận. Kiểm tra trạng thái trước khi thao tác lại.';
      const retry = button('Kiểm tra trạng thái');
      retry.addEventListener('click', refresh);
      actions.append(retry);
    }
  }

  function render(value) {
    const grant = value.activeGrant;
    status.textContent = value.submitted ? label + ' đã nộp.' : grant ? grantLabels[grant.state]
      : value.issueEnabled ? `Có thể cấp một link ${label} cho học viên này.` : 'Cấp link mới đang tạm đóng.';
    if (value.attemptExists && modeLabels[value.examMode]) actions.append(node('p', 'Bài chính · ' + modeLabels[value.examMode]));
    if (grant) {
      if (grant.state === 'awaiting') actions.append(node('p', 'Hạn kích hoạt · ' + new Date(grant.expiresAt).toLocaleString('vi-VN')));
      if (issued?.grantId === grant.grantId && grant.state === 'awaiting') {
        const link = new URL('../term-test-1-k56-' + section + '-fallback/', import.meta.url);
        link.searchParams.set('class', classCode);
        link.hash = new URLSearchParams({ g: issued.token });
        actions.append(node('p', 'Sao chép link và gửi mã kích hoạt riêng cho học viên.'),
          copyField('Link ' + label, link.href, grant.grantId), copyField('Mã kích hoạt', issued.activationCode));
      } else if (grant.state === 'awaiting') {
        actions.append(node('p', 'Link và mã được hiển thị khi cấp. Nếu chưa lưu được, hãy thu hồi rồi cấp lại.'));
      }
      const revoke = button('Thu hồi link');
      revoke.addEventListener('click', () => {
        const message = grant.state === 'bound' ? 'Link đã gắn với thiết bị học viên. Xác nhận đã dừng làm và lưu bản trên thiết bị đó trước khi thu hồi?' : `Thu hồi link ${label} của học viên này?`;
        if (window.confirm(message)) void mutate('revoke', { grantId: grant.grantId });
      });
      actions.append(revoke);
      return;
    }
    if (!value.issueEnabled || value.submitted) return;
    const issue = button('Cấp link ' + label, true);
    const mode = node('select');
    const stopped = node('input');
    if (!value.attemptExists) {
      const label = node('label', 'Thứ tự của bài chính');
      mode.append(new Option('Chọn thứ tự bài chính', ''), ...Object.entries(modeLabels).map(([key, name]) => new Option(name, key)));
      label.append(mode);
      actions.append(label);
    }
    if (value.started) {
      const stopLabel = node('label');
      stopped.type = 'checkbox';
      stopLabel.append(stopped, document.createTextNode(` Tôi đã xác nhận học viên dừng ${label} và lưu bài trên thiết bị cũ.`));
      const resumeCopy = section === 'listening' ? 'Cần mốc nghe đã được máy chủ xác nhận trước khi chuyển thiết bị.' : 'Link tiếp tục từ giờ và nháp đã lưu trên máy chủ.';
      actions.append(node('p', resumeCopy), stopLabel, node('br'));
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

const fragmentKey = 'sw-invite';
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu;

export async function redeemSwRosterLink(claim) {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (!fragment.has(fragmentKey)) return null;
  const classRef = url.searchParams.get('class');
  const token = fragment.get(fragmentKey);
  if (!uuidPattern.test(classRef || '') || !/^[a-zA-Z0-9_-]{43}$/u.test(token || '')) {
    throw new Error('Liên kết giảng viên gửi chưa đúng. Hãy xin lại liên kết vào bài.');
  }
  const result = await claim({ classRef, token });
  if (result.classRef !== classRef || !uuidPattern.test(result.studentRef || '')) {
    throw new Error('Chưa xác nhận được đúng hồ sơ học viên.');
  }
  fragment.delete(fragmentKey);
  url.hash = fragment.toString();
  try { history.replaceState(history.state, '', url); } catch {}
  return result;
}

function invitationUrl({ activitySlug, classRef }, token) {
  const url = new URL('./index.html', location.href);
  url.searchParams.set('task', activitySlug);
  url.searchParams.set('class', classRef);
  url.hash = new URLSearchParams([[fragmentKey, token]]);
  return url.href;
}

async function nameFingerprint(displayName) {
  const value = displayName.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function storageKey(scope) {
  return `izone:sw:roster:add:${scope.activitySlug}:${scope.classRef}`;
}

function readPending(scope) {
  try { return JSON.parse(sessionStorage.getItem(storageKey(scope))); } catch { return null; }
}

function storePending(scope, value) {
  try {
    if (value) sessionStorage.setItem(storageKey(scope), JSON.stringify(value));
    else sessionStorage.removeItem(storageKey(scope));
  } catch {}
}

function deliveryText(member) {
  if (!member.currentReady) return 'Bài này đang chờ đồng bộ.';
  const targets = member.delivery.flatMap(item => item.targets);
  const ready = targets.filter(target => target.status === 'ready').length;
  if (!targets.length) return 'Bài này đã sẵn sàng.';
  if (member.delivery.length < 2 || ready < targets.length) return `Đã có ở ${ready}/${targets.length} bài đã kiểm. Đang đồng bộ.`;
  return `Đã xác nhận ${ready} bài.`;
}

export function createSwRosterDialog({ list, add, reissue, refresh, isCurrent }) {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('./sw-class-roster.css?v=20261111-v1', import.meta.url).href;
  document.head.append(css);
  const dialog = document.createElement('dialog');
  dialog.className = 'sw-roster-dialog';
  dialog.setAttribute('aria-labelledby', 'sw-roster-title');
  dialog.innerHTML = `
    <header><h2 id="sw-roster-title">Thêm học viên</h2><button type="button" data-close aria-label="Đóng">Đóng</button></header>
    <p data-class></p>
    <form hidden>
      <label>Họ và tên <input name="displayName" autocomplete="name" required minlength="2" maxlength="100"></label>
      <button type="submit" class="primary">Lưu</button>
      <button type="button" data-duplicate hidden>Thêm người khác cùng tên</button>
    </form>
    <p data-status role="status" aria-live="polite"></p>
    <div data-invitation hidden>
      <a target="_blank" rel="noreferrer noopener">Mở liên kết vào bài</a>
      <button type="button" data-copy>Sao chép liên kết</button>
    </div>
    <section aria-label="Học viên đã thêm"><ul data-members></ul></section>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const form = $('form');
  const name = form.elements.displayName;
  const duplicate = $('[data-duplicate]');
  const status = $('[data-status]');
  const invitation = $('[data-invitation]');
  let scope;
  let generation = 0;
  let sending = false;
  let pending;
  let memberPoll;
  let memberFingerprint;
  let renewing = 0;

  const current = (target, epoch) => epoch === generation && dialog.open && isCurrent(target);

  function close() {
    generation += 1;
    clearTimeout(memberPoll);
    scope = null;
    if (dialog.open) dialog.close();
    invitation.hidden = true;
    $('a').removeAttribute('href');
  }

  function busy(value) {
    sending = value;
    name.disabled = value;
    form.querySelector('button[type=submit]').disabled = value;
    duplicate.disabled = value;
  }

  async function refreshMembers(target, epoch) {
    const result = await list(target);
    if (!current(target, epoch)) return;
    form.hidden = !result.canAdd;
    const fingerprint = JSON.stringify(result.members);
    if (fingerprint === memberFingerprint || renewing) return;
    memberFingerprint = fingerprint;
    $('[data-members]').replaceChildren(...result.members.map(member => {
      const row = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = `${member.displayName} · ${member.reconciliationStatus === 'pending_erp' ? 'Chờ đối soát ERP' : 'Đã đối soát ERP'} · ${deliveryText(member)} · ${member.studentRef.replaceAll('-', '').slice(0, 12)}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = member.currentReady ? 'Cấp lại liên kết' : 'Thử lại bài này';
      button.addEventListener('click', () => void renew(target, member, button, epoch));
      row.append(label, button);
      const targets = member.delivery.flatMap(item => item.targets);
      if (targets.length) {
        const detail = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Trạng thái từng bài';
        detail.append(summary);
        for (const target of targets) {
          const line = document.createElement('div');
          line.textContent = `${target.title || target.activitySlug} · ${target.status === 'ready' ? 'Sẵn sàng' : 'Đang đồng bộ'}`;
          detail.append(line);
        }
        row.append(detail);
      }
      return row;
    }));
  }

  function pollMembers(target, epoch) {
    if (!current(target, epoch)) return;
    clearTimeout(memberPoll);
    memberPoll = setTimeout(async () => {
      if (!sending && !renewing && !document.hidden) await refreshMembers(target, epoch).catch(() => {});
      pollMembers(target, epoch);
    }, 8000);
  }

  async function showResult(target, result, epoch) {
    if (!current(target, epoch)) return;
    invitation.hidden = true;
    $('a').removeAttribute('href');
    if (result.state !== 'ready') {
      status.textContent = 'Đã nhận yêu cầu. Chưa thể vào bài này. Hãy thử lại khi kết nối ổn định.';
    } else if (result.invitationToken) {
      $('a').href = invitationUrl(target, result.invitationToken);
      invitation.hidden = false;
      status.textContent = 'Có thể làm bài ngay. Hãy gửi liên kết dùng một lần cho học viên.';
    } else {
      status.textContent = 'Học viên đã có tên. Có thể cấp lại liên kết nếu học viên cần.';
    }
    void Promise.resolve(refresh(target)).catch(() => {});
    void refreshMembers(target, epoch).catch(() => {});
  }

  async function submit(confirmDuplicate = false) {
    if (sending || !scope || !form.reportValidity()) return;
    const target = scope;
    const epoch = generation;
    const displayName = name.value.trim().replace(/\s+/gu, ' ');
    busy(true);
    try {
      const fingerprint = await nameFingerprint(displayName);
      if (!current(target, epoch)) return;
      if (!pending || pending.fingerprint !== fingerprint) {
        pending = { fingerprint, requestId: crypto.randomUUID(), duplicateConfirmed: false };
      }
      pending.duplicateConfirmed ||= confirmDuplicate;
      storePending(target, pending);
      status.textContent = 'Đang lưu…';
      invitation.hidden = true;
      const result = await add(target, { displayName, requestId: pending.requestId, duplicateConfirmed: pending.duplicateConfirmed });
      if (!current(target, epoch)) return;
      duplicate.hidden = true;
      if (result.state === 'ready') {
        name.value = '';
        storePending(target, null);
        pending = null;
      }
      await showResult(target, result, epoch);
    } catch (err) {
      if (!current(target, epoch)) return;
      duplicate.hidden = (err.code || err.data?.error) !== 'SW_ROSTER_DUPLICATE_NAME';
      status.textContent = err.status ? err.message : 'Chưa nhận được phản hồi. Bấm Lưu để thử lại.';
    } finally {
      if (current(target, epoch)) busy(false);
    }
  }

  async function renew(target, member, button, epoch) {
    renewing += 1;
    button.disabled = true;
    const requestId = button.dataset.requestId ||= crypto.randomUUID();
    try {
      const result = await reissue(target, { studentRef: member.studentRef, requestId });
      if (result.state === 'ready') delete button.dataset.requestId;
      await showResult(target, result, epoch);
    } catch (err) {
      if (current(target, epoch)) status.textContent = err.message || 'Chưa lấy được liên kết.';
    } finally {
      renewing -= 1;
      button.disabled = false;
    }
  }

  form.addEventListener('submit', event => { event.preventDefault(); void submit(); });
  name.addEventListener('input', () => { duplicate.hidden = true; });
  duplicate.addEventListener('click', () => void submit(true));
  $('[data-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  $('[data-copy]').addEventListener('click', async () => {
    const anchor = $('a');
    try {
      await navigator.clipboard.writeText(anchor.href);
      status.textContent = 'Đã sao chép liên kết vào bài.';
    } catch {
      status.textContent = 'Hãy sao chép địa chỉ từ liên kết vào bài.';
      anchor.focus();
    }
  });

  async function open(target) {
    if (!target || !isCurrent(target)) return;
    const epoch = ++generation;
    scope = target;
    memberFingerprint = null;
    pending = readPending(target);
    name.value = '';
    duplicate.hidden = true;
    invitation.hidden = true;
    $('a').removeAttribute('href');
    $('[data-class]').textContent = target.classLabel;
    $('[data-members]').replaceChildren();
    busy(false);
    form.hidden = false;
    status.textContent = 'Đang đọc danh sách…';
    if (!dialog.open) dialog.showModal();
    name.focus();
    try {
      await refreshMembers(target, epoch);
      if (current(target, epoch) && status.textContent === 'Đang đọc danh sách…') status.textContent = '';
    } catch (err) {
      if (current(target, epoch)) status.textContent = err.message || 'Chưa đọc được danh sách lớp.';
    }
    pollMembers(target, epoch);
  }

  return { open, close };
}

export function clearLegacySwInvitation() {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (!fragment.has('sw-invite')) return;
  fragment.delete('sw-invite');
  url.hash = fragment.toString();
  try { history.replaceState(history.state, '', url); } catch {}
}

function classHandoutUrl({ activitySlug, classRef }) {
  const url = new URL('./index.html', location.href);
  url.searchParams.set('task', activitySlug);
  url.searchParams.set('class', classRef);
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
  if (ready < targets.length) return `Đã có ở ${ready}/${targets.length} bài đã kiểm. Đang đồng bộ.`;
  return `Đã xác nhận ${ready} bài.`;
}

export function createSwRosterDialog({ list, add, retry, refresh, isCurrent }) {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('./sw-class-roster.css?v=20261115-v1', import.meta.url).href;
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
    <div data-class-link hidden>
      <a target="_blank" rel="noreferrer noopener">Mở handout của lớp</a>
      <button type="button" data-copy>Sao chép liên kết lớp</button>
    </div>
    <section aria-label="Học viên đã thêm"><ul data-members></ul></section>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const form = $('form');
  const name = form.elements.displayName;
  const duplicate = $('[data-duplicate]');
  const status = $('[data-status]');
  const classLink = $('[data-class-link]');
  let scope;
  let generation = 0;
  let sending = false;
  let pending;
  let memberPoll;
  let memberFingerprint;
  let retrying = 0;

  const current = (target, epoch) => epoch === generation && dialog.open && isCurrent(target);

  function close() {
    generation += 1;
    clearTimeout(memberPoll);
    scope = null;
    if (dialog.open) dialog.close();
    classLink.hidden = true;
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
    if (fingerprint === memberFingerprint || retrying) return;
    memberFingerprint = fingerprint;
    $('[data-members]').replaceChildren(...result.members.map(member => {
      const row = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = `${member.displayName} · ${member.reconciliationStatus === 'pending_erp' ? 'Chờ đối soát ERP' : 'Đã đối soát ERP'} · ${deliveryText(member)} · ${member.studentRef.replaceAll('-', '').slice(0, 12)}`;
      row.append(label);
      if (!member.currentReady) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Thử lại bài này';
        button.addEventListener('click', () => void retryDelivery(target, member, button, epoch));
        row.append(button);
      }
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
      if (!sending && !retrying && !document.hidden) await refreshMembers(target, epoch).catch(() => {});
      pollMembers(target, epoch);
    }, 8000);
  }

  async function showResult(target, result, epoch) {
    if (!current(target, epoch)) return;
    if (result.state !== 'ready') {
      status.textContent = 'Đã nhận yêu cầu. Bài này đang chờ đồng bộ. Hãy thử lại khi kết nối ổn định.';
    } else {
      status.textContent = 'Học viên có thể vào handout của lớp, chọn tên và làm bài ngay.';
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

  async function retryDelivery(target, member, button, epoch) {
    retrying += 1;
    button.disabled = true;
    try {
      const result = await retry(target, { studentRef: member.studentRef });
      await showResult(target, result, epoch);
    } catch (err) {
      if (current(target, epoch)) status.textContent = err.message || 'Chưa đồng bộ được học viên vào bài này.';
    } finally {
      retrying -= 1;
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
    $('a').href = classHandoutUrl(target);
    classLink.hidden = false;
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

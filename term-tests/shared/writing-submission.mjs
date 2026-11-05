// Nhận trạng thái của đúng bài Writing; quản lý thông báo và một lần gửi đang chờ.
// Chỉ đọc khi kiểm tra lại. Mất phản hồi giữ nguyên gói gửi để phục hồi, không chấm lại.
export function writingStatus(grading, submitted) {
  if (!submitted) return 'Bài Writing chưa được xác nhận nộp.';
  if (grading?.ready) return 'Bài Writing đã chấm xong. Bạn có thể xem kết quả bên dưới.';
  if (['failed', 'review_required', 'incomplete'].includes(grading?.status))
    return 'Bài Writing đã được nhận. Phần chấm cần được kiểm tra; bạn không cần nộp lại.';
  if (grading?.status === 'queued') return 'Đã nộp Writing thành công. Bài đang chờ chấm; bạn không cần nộp lại.';
  if (!grading?.status) return 'Bài Writing đã được nhận. Hệ thống đang cập nhật trạng thái chấm; bạn không cần nộp lại.';
  return 'Bài Writing đã được nhận và đang chấm. Bạn không cần nộp lại.';
}

export function createWritingSubmission({ owner, submitted, grading, notify, check, hosts,
  storage = () => [], doc = globalThis.document }) {
  let sendingOwner = null, checkingOwner = null, readError = false, deliveryPending = false;
  const panels = new Map(), memory = new Map();
  const key = value => 'izone-writing-pending-v1:' + value;
  const current = value => value === owner();
  function pending(value = owner()) {
    if (memory.has(value)) return memory.get(value);
    for (const store of storage()) {
      try { const saved = JSON.parse(store.getItem(key(value)) || 'null');
        if (saved?.owner === value && saved.payload && typeof saved.payload === 'object') {
          memory.set(value, saved.payload); return saved.payload;
        }
      } catch {}
    }
    return null;
  }
  function retain(value, payload) {
    memory.set(value, payload);
    for (const store of storage()) try { store.setItem(key(value), JSON.stringify({ owner: value, payload })); } catch {}
  }
  function clear(value) {
    memory.delete(value);
    for (const store of storage()) try { store.removeItem(key(value)); } catch {}
  }
  function message() {
    if (!submitted() && sendingOwner === owner()) return 'Đang gửi bài Writing, vui lòng chờ xác nhận. Bạn không cần nhấn nộp lại.';
    if (!submitted() && pending()) return deliveryPending
      ? 'Bài Writing đã lưu. Chưa xác nhận được bộ chấm nhận bài; hãy nhấn Nộp để kiểm tra và tiếp tục đúng bài đã gửi.'
      : 'Chưa xác nhận được trạng thái nộp Writing. Bản đã gửi vẫn được giữ; hãy nhấn Nộp để kiểm tra lại.';
    const text = writingStatus(grading(), submitted());
    return readError && submitted() ? text + ' Hiện chưa đọc được cập nhật mới; hãy kiểm tra lại khi có mạng.' : text;
  }
  function sync() {
    if (!doc || !hosts) return;
    for (const [index,host] of hosts().entries()) {
      if (!host) continue;
      let panel = panels.get(host);
      if (index === 1) {
        // Dùng đúng vùng trạng thái Writing native, tránh tạo thêm banner rời trên toàn trang.
        const native = host.querySelector('.writing-grading-status');
        if (!submitted() || !native) { if (panel?.isConnected) panel.hidden = true; continue; }
        if (panel !== native) {
          panel = native;
          if (native.tagName === 'P') {
            panel = doc.createElement('div'); panel.className = native.className;
            native.replaceWith(panel); panel.append(native);
          }
          panel.classList.add('writing-submission-status');
          panel.setAttribute('role','status'); panel.setAttribute('aria-live','polite');
          let copy = panel.querySelector('p');
          if (!copy) { copy = doc.createElement('p'); panel.prepend(copy); }
          copy.dataset.writingReceiptCopy = 'true';
          let button = panel.querySelector('button');
          if (button) { const replacement=button.cloneNode(true);button.replaceWith(replacement);button=replacement; }
          else { button=doc.createElement('button');button.className='button button-secondary';panel.append(button); }
          button.type='button';button.addEventListener('click',()=>inspect());panels.set(host,panel);
        }
      } else if (!panel?.isConnected) {
        panel = doc.createElement('div'); panel.className = 'writing-grading-status writing-submission-status';
        panel.setAttribute('role', 'status'); panel.setAttribute('aria-live', 'polite');
        const copy = doc.createElement('p'), button = doc.createElement('button');
        copy.dataset.writingReceiptCopy='true';
        button.type = 'button'; button.className = 'button button-secondary'; button.textContent = 'Kiểm tra trạng thái Writing';
        button.addEventListener('click', () => inspect()); panel.append(copy, button);
        host.parentNode.insertBefore(panel, host); panels.set(host, panel);
      }
      panel.hidden = index===0 ? submitted() || host.hidden || sendingOwner !== owner() && !pending() : !submitted();
      const copy=panel.querySelector('[data-writing-receipt-copy]'),text = message();
      if (copy.textContent !== text) copy.textContent = text;
      const button = panel.querySelector('button');
      button.hidden = !submitted(); button.disabled = checkingOwner === owner();
      button.textContent = checkingOwner === owner() ? 'Đang kiểm tra…' : 'Kiểm tra trạng thái Writing';
      if (index===1 && grading()?.status==='queued') {
        const heading=host.querySelector('h3'),title=panel.querySelector('strong');
        if(heading)heading.textContent='Bài Writing đã nộp, đang chờ chấm';
        if(title)title.textContent='Đang chờ chấm Writing';
      }
    }
  }
  async function inspect() {
    notify(message(), submitted() && !readError ? 'success' : '');
    if (!submitted() || sendingOwner === owner() || checkingOwner === owner()) return;
    const captured = owner(); checkingOwner = captured; sync();
    try {
      const outcome = await check();
      if (current(captured)) readError = outcome === 'unavailable';
    } catch { if (current(captured)) readError = true; }
    finally {
      if (checkingOwner === captured) checkingOwner = null;
      if (current(captured)) { sync(); notify(message(), readError ? '' : 'success'); }
    }
  }
  function begin() {
    if (sendingOwner === owner() || submitted()) { void inspect(); return null; }
    const captured = owner(); sendingOwner = captured; readError = false; sync();
    notify(message()); return captured;
  }
  function end(captured) { if (sendingOwner === captured) sendingOwner = null; if (current(captured)) sync(); }
  function readUnavailable() { readError = true; sync(); }
  const accepted = data => data?.accepted === true && data.grading && typeof data.grading.ready === 'boolean'
    && typeof data.grading.status === 'string';
  async function submitOnline({ payload, send, read }) {
    const captured = owner(), saved = pending(captured), snapshot = saved || JSON.parse(JSON.stringify(payload));
    const verify = () => { if (!current(captured)) throw Object.assign(new Error('Đã đổi lượt thi; không dùng phản hồi của lượt trước.'), {code:'WRITING_IDENTITY_CHANGED'}); };
    if (saved) {
      // Chỉ gửi lại sau khi đường đọc xác nhận lượt này chưa có trong kho.
      try { const data = await read(snapshot); verify();
        if (!accepted(data)) throw new Error('Chưa có biên nhận Writing hợp lệ.');
        if (data.grading.status !== 'queued') { clear(captured); return data; }
        // Kho đã có bài nhưng chưa có người nhận chấm: gửi lại đúng gói/mã cũ để nối việc giao bài.
        deliveryPending = true;
      } catch (error) { verify(); if (error.status !== 404) throw error; }
    }
    retain(captured, snapshot);
    try {
      const data = await send(snapshot); verify();
      if (!accepted(data)) throw new Error('Chưa có biên nhận Writing hợp lệ.');
      clear(captured); return data;
    } catch (error) {
      verify();
      try { const data = await read(snapshot); verify();
        if (accepted(data) && data.grading.status !== 'queued') { clear(captured); return data; }
        if (accepted(data) && data.grading.status === 'queued') deliveryPending = true;
      } catch (readFailure) { if (readFailure.code === 'WRITING_IDENTITY_CHANGED') throw readFailure; }
      if ([400,401,403,409,422].includes(error.status)) clear(captured);
      throw error;
    }
  }
  function readAvailable() { readError = false; }
  return { owner, begin, end, current, sync, inspect, submitOnline, readUnavailable, readAvailable, pending, message,
    get busy() { return sendingOwner === owner(); } };
}

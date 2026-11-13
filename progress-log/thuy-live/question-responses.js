const labels = {
  correct: 'Đúng', incorrect: 'Sai', pending: 'Chờ chấm',
  manual_review: 'Cần xem lại', ungraded: 'Không tính điểm'
};

function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}

function answerCell(row, question, optionLabels) {
  const cell = node('td', null, 'thuy-response-value');
  if (row.answerState === 'blank' && (!row.answer || (Array.isArray(row.answer) && !row.answer.length))) {
    cell.textContent = 'Bỏ trống';
    return cell;
  }
  const formatOption = value => optionLabels.has(value) ? value + ' · ' + optionLabels.get(value) : String(value ?? '');
  const value = row.answer;
  if (Array.isArray(value)) {
    const list = node('ul');
    value.forEach((entry, index) => {
      const label = question.gradingUnit === 'text_slots'
        ? 'Ô ' + (index + 1) + ': ' + (entry || 'Bỏ trống')
        : formatOption(entry);
      list.append(node('li', label));
    });
    cell.append(list);
  } else if (value && typeof value === 'object') {
    if (Number.isFinite(value.correct) && Number.isFinite(value.total)) {
      cell.textContent = value.correct + '/' + value.total;
    } else {
      cell.textContent = JSON.stringify(value);
    }
  } else {
    cell.textContent = value == null || value === '' ? 'Bỏ trống' : formatOption(value);
  }
  if (row.answerState === 'invalid') cell.append(node('small', 'Câu trả lời không hợp lệ'));
  return cell;
}

export function createQuestionResponses() {
  const section = node('section', null, 'thuy-responses');
  const heading = node('h3', 'Câu trả lời đã nộp');
  const status = node('p', null, 'thuy-responses-status');
  status.setAttribute('role', 'status');
  const controls = node('div', null, 'thuy-responses-controls');
  const result = node('div');
  section.append(heading, status, controls, result);
  section.hidden = true;

  let active = null;
  let controller = null;
  let requested = false;
  let renderedVersion = null;
  let filter = 'all';
  let reconcile;
  let retryTimer;
  let retries = 0;
  let pendingDetail = null;
  let renderedStatus = '';
  const update = node('button', 'Xem câu trả lời mới', 'button secondary');
  update.type = 'button';
  update.hidden = true;
  section.insertBefore(update, controls);
  update.addEventListener('click', () => {
    if (!pendingDetail || pendingDetail.responseVersion !== active?.version) return;
    showTable(pendingDetail, true);
    pendingDetail = null;
    update.hidden = true;
    renderedStatus = '';
  });

  function resetRetry() {
    clearTimeout(retryTimer);
    retryTimer = null;
    retries = 0;
  }

  function clear() {
    resetRetry();
    controller?.abort();
    controller = null;
    active = null;
    requested = false;
    renderedVersion = null;
    filter = 'all';
    pendingDetail = null;
    update.hidden = true;
    status.textContent = '';
    controls.replaceChildren();
    result.replaceChildren();
    section.hidden = true;
  }

  function showTable(detail, keepPosition = false) {
    const previous = result.querySelector('.thuy-responses-table');
    const scroll = keepPosition ? previous?.scrollTop ?? 0 : 0;
    const optionLabels = new Map(detail.options.map(option => [option.id, option.label]));
    const rows = detail.students.filter(row => filter === 'all' || row.verdict === filter);
    const filters = node('div', null, 'thuy-responses-filters');
    if (detail.objective) {
      const totals = {all:detail.students.length, incorrect:detail.counts.incorrect, correct:detail.counts.correct,
        pending:detail.counts.pending, manual_review:detail.counts.manual, ungraded:detail.counts.ungraded};
      for (const [key, total] of Object.entries(totals)) {
        if (!total && !['all','incorrect','correct'].includes(key) && key !== filter) continue;
        const button = node('button', (key === 'all' ? 'Tất cả' : labels[key]) + ' ' + total, 'button secondary');
        button.type = 'button';
        button.dataset.responseFilter = key;
        button.setAttribute('aria-pressed', String(key === filter));
        button.addEventListener('click', () => {
          filter = key;
          showTable(detail);
          controls.querySelector('[aria-pressed="true"]')?.focus();
        });
        filters.append(button);
      }
    }
    const wrap = node('div', null, 'thuy-responses-table');
    wrap.tabIndex = 0;
    wrap.setAttribute('aria-label', 'Danh sách câu trả lời');
    const table = node('table');
    const header = table.createTHead().insertRow();
    for (const label of ['Học viên','Câu trả lời',...(detail.objective ? ['Kết quả'] : [])]) {
      const cell = node('th', label);
      cell.scope = 'col';
      header.append(cell);
    }
    const body = table.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      const person = node('td', row.name, 'thuy-response-name');
      if (row.discriminator) person.append(node('small', row.discriminator));
      tr.append(person, answerCell(row, detail, optionLabels));
      if (detail.objective) {
        const cell = tr.insertCell();
        cell.append(node('span', labels[row.verdict], 'thuy-response-verdict ' + row.verdict));
      }
    }
    wrap.append(table);
    controls.replaceChildren(filters);
    result.replaceChildren(...(rows.length ? [wrap, node('p', 'Hiển thị ' + rows.length + '/' + detail.students.length + ' học viên.')]
      : [node('p', detail.students.length ? 'Không có học viên trong nhóm này.' : 'Chưa có bài nộp cho câu này.')]));
    wrap.scrollTop = scroll;
    renderedStatus = detail.objective
      ? detail.counts.correct + ' đúng · ' + detail.counts.incorrect + ' sai · ' + detail.counts.graded + ' đã chấm'
      : detail.counts.answered + '/' + detail.counts.visible + ' đã trả lời · Không chấm điểm';
    status.textContent = renderedStatus;
  }

  function action(label, callback) {
    const button = node('button', label, 'button');
    button.type = 'button';
    button.addEventListener('click', callback);
    controls.replaceChildren(button);
  }

  function retry(target) {
    if (retryTimer || !reconcile) return;
    if (retries >= 3) {
      status.textContent = 'Chưa đối chiếu được câu trả lời. Hãy bấm Làm mới.';
      if (!result.firstChild) action('Thử lại', () => refresh());
      return;
    }
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      if (active !== target || document.hidden || !section.isConnected) return;
      try { await reconcile(); } catch { /* Giữ dữ liệu đang đọc, thử lại có giới hạn. */ }
      if (active === target && !document.hidden && section.isConnected) void load({force:true});
    }, 350 * 2 ** retries++);
  }

  async function load({force=false} = {}) {
    if (controller || !active || (!force && renderedVersion === active.version)) return;
    const target = active;
    const request = new AbortController();
    controller = request;
    const timer = setTimeout(() => request.abort(), 15000);
    const previous = result.querySelector('.thuy-responses-table');
    if (!previous) controls.replaceChildren();
    if (!previous || !force) status.textContent = previous ? 'Đang đối chiếu với thống kê mới…' : 'Đang đọc câu trả lời…';
    try {
      const detail = await target.read(target.itemId, request.signal);
      if (active !== target || request.signal.aborted || !section.isConnected) return;
      if (detail.assignmentId !== target.assignmentId || detail.formVersionId !== target.formVersionId ||
          detail.itemVersionId !== target.itemId) throw Error('Dữ liệu trả về sai câu.');
      if (detail.responseVersion !== target.version) {
        status.textContent = 'Có dữ liệu mới. Đang đối chiếu với thống kê.';
        retry(target);
        return;
      }
      resetRetry();
      if (renderedVersion === detail.responseVersion) {
        status.textContent = pendingDetail ? 'Có câu trả lời mới.' : renderedStatus;
        return;
      }
      renderedVersion = detail.responseVersion;
      const selection = document.getSelection();
      if (previous && selection && !selection.isCollapsed &&
          (previous.contains(selection.anchorNode) || previous.contains(selection.focusNode))) {
        pendingDetail = detail;
        update.hidden = false;
        status.textContent = 'Có câu trả lời mới.';
      } else {
        pendingDetail = null;
        update.hidden = true;
        showTable(detail, Boolean(previous));
      }
    } catch (error) {
      if (active !== target || !section.isConnected) return;
      if ([401,403,404].includes(error.status)) {
        clear();
        section.hidden = false;
        status.textContent = 'Câu trả lời không còn trong phạm vi xem.';
        return;
      }
      status.textContent = error.name === 'AbortError' ? 'Đọc câu trả lời quá thời gian chờ.' : 'Chưa đọc được câu trả lời.';
      if (!previous) action('Thử lại', () => refresh());
    } finally {
      clearTimeout(timer);
      if (controller === request) controller = null;
    }
  }

  function refresh() {
    resetRetry();
    if (requested) void load({force:true});
  }

  function select({assignmentId, formVersionId, item, read, sync, open = false}) {
    if (!read || !item?.responseVersion) {clear();return;}
    reconcile = sync;
    const same = active?.itemId === item.itemVersionId && active?.assignmentId === assignmentId &&
      active?.formVersionId === formVersionId;
    if (!same) clear();
    const changed = active?.version !== item.responseVersion;
    if (changed) {
      resetRetry();
      controller?.abort();
      controller = null;
      pendingDetail = null;
      update.hidden = true;
      active = {assignmentId, formVersionId, itemId:item.itemVersionId, version:item.responseVersion, read};
    }
    section.hidden = false;
    if (open && !requested) {
      requested = true;
      void load();
    } else if (requested && changed) {
      void load();
    } else if (!requested && !controls.firstChild) {
      action('Xem câu trả lời', () => {requested = true;void load();});
    } else if (open && !controller && !retryTimer && !renderedVersion) {
      void load();
    }
  }

  return {section, select, clear, refresh};
}

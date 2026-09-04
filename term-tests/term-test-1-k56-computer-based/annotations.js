(function () {
  'use strict';

  if (!window.TERM_TEST_CONTENT || document.getElementById('cbtNotesPanel')) return;
  const query = new URLSearchParams(location.search);
  const slug = window.TERM_TEST_CONFIG.slug;
  const classCode = (query.get('class') || '').trim().toUpperCase();
  const suffix = query.get('demo') === 'exam' && query.get('grading') === 'server' ? ':server-grade' : '';
  const storageKey = `izone-test-annotations:${slug}:${classCode}${suffix}`;
  const sessionKey = `izone-test:${slug}:${classCode}${suffix}`;
  const previewMode = ['complete', 'listening-only', 'writing-prep', 'writing'].includes(query.get('demo'));
  const session = readStored(sessionKey) || {};
  // Mã ngẫu nhiên của lượt thi, không dùng tên học viên hoặc token truy cập.
  const runId = window.TERM_TEST_BOOTSTRAP?.annotationRunId || session.annotationRunId
    || (previewMode ? `preview-${query.get('demo')}` : crypto.randomUUID());
  const stored = readStored(storageKey);
  let revision = Number(stored?.revision) || 0;
  let records = stored?.runId === runId && Array.isArray(stored.records) ? stored.records : [];
  const regions = new Map();
  const excluded = 'input, textarea, select, option, button, nav, script, style, [contenteditable], [data-answer-slot], .writing-outline-card, .writing-answer-pane, .cbt-question-number, .cbt-blank-number';
  let pending = null;
  let activeNoteId = null;
  let saveTimer = 0;
  let dirty = false;
  let returnFocus = null;

  function readStored(key) {
    const values = [];
    for (const storage of [sessionStorage, localStorage]) {
      try {
        const value = JSON.parse(storage.getItem(key) || 'null');
        if (value) values.push(value);
      } catch { /* Không dùng dữ liệu hỏng. */ }
    }
    // Một bộ nhớ có thể hết dung lượng; ưu tiên bản mới nhất đã ghi thành công.
    return values.sort((left, right) => (Number(right.revision) || 0) - (Number(left.revision) || 0))[0] || null;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(className, text, onClick) {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  const menu = element('div', 'cbt-selection-menu');
  menu.id = 'cbtSelectionMenu';
  menu.hidden = true;
  menu.setAttribute('role', 'toolbar');
  menu.setAttribute('aria-label', 'Công cụ cho văn bản đã chọn');
  const highlightButton = button('', 'Highlight', toggleHighlight);
  const noteButton = button('', 'Note', createNote);
  menu.append(highlightButton, noteButton);
  // Giữ vùng chọn khi người dùng nhấn menu bằng chuột/cảm ứng.
  menu.addEventListener('pointerdown', event => event.preventDefault());

  const panel = element('aside', 'cbt-notes-panel');
  panel.id = 'cbtNotesPanel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Notes');
  const header = element('header', 'cbt-notes-header');
  const closeButton = button('cbt-notes-close', '×', closePanel);
  closeButton.setAttribute('aria-label', 'Đóng Notes');
  header.append(element('strong', '', 'Notes'), closeButton);
  const body = element('div', 'cbt-notes-body');
  const allButton = button('cbt-notes-back', '← All Notes', showAllNotes);
  const quote = element('blockquote', 'cbt-notes-quote');
  const editor = element('textarea', 'cbt-note-editor');
  editor.placeholder = 'Write your note...';
  editor.setAttribute('aria-label', 'Nội dung ghi chú');
  const footer = element('footer', 'cbt-notes-footer');
  const status = element('span', 'cbt-notes-save-status', 'Ghi chú chỉ lưu trên trình duyệt này.');
  status.setAttribute('role', 'status');
  const deleteButton = button('cbt-note-delete', 'Delete', deleteNote);
  footer.append(status, deleteButton);
  const list = element('div', 'cbt-notes-list');
  body.append(allButton, quote, editor, list, footer);
  panel.append(header, body);
  const saveWarning = element('div', 'cbt-annotation-warning', 'Chưa lưu được Highlight/Note. Hãy giữ trang mở và sao chép ghi chú trước khi rời trang.');
  saveWarning.setAttribute('role', 'alert');
  saveWarning.hidden = true;
  document.body.append(menu, panel, saveWarning);

  function textNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest(excluded) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }
  function regionText(root) { return textNodes(root).map(node => node.data).join(''); }
  function register(root, key, skill, label) {
    root.dataset.annotationRegion = key;
    regions.set(key, { root, skill, label, text: regionText(root) });
  }
  document.querySelectorAll('.cbt-listening-section').forEach((root, index) => register(root, `listening:${index}`, 'Listening', `Part ${index + 1}`));
  document.querySelectorAll('.cbt-reading-section').forEach((section, index) => {
    register(section.querySelector('.cbt-passage-body'), `reading:${index}:passage`, 'Reading', `Passage ${index + 1} · Đề bài`);
    register(section.querySelector('.cbt-reading-questions'), `reading:${index}:questions`, 'Reading', `Passage ${index + 1} · Câu hỏi`);
  });
  document.querySelectorAll('.writing-task-panel').forEach((section, index) => {
    register(section.querySelector('.writing-prompt-body'), `writing:${index}`, 'Writing', 'Task 2 · Đề bài');
  });
  // Chỉ khôi phục anchor còn khớp đề gốc; không tự gắn sang một câu khác.
  records = records.filter(record => {
    const region = regions.get(record.region);
    return region && typeof record.id === 'string' && /^[\w-]+$/.test(record.id)
      && Number.isInteger(record.start) && Number.isInteger(record.end)
      && record.start >= 0 && record.end > record.start && record.end <= region.text.length
      && record.quote === region.text.slice(record.start, record.end)
      && typeof record.highlight === 'boolean' && (record.note === null || typeof record.note === 'string');
  });

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    if (!dirty) return;
    const serialized = JSON.stringify({ version: 1, runId, revision: ++revision, records });
    let saved = false;
    for (const storage of [sessionStorage, localStorage]) {
      try { storage.setItem(storageKey, serialized); saved = true; } catch { /* Hiện lỗi nếu cả hai bộ nhớ không ghi được. */ }
    }
    dirty = !saved;
    saveWarning.hidden = saved;
    status.textContent = saved ? 'Saved automatically · chỉ trên trình duyệt này' : 'Chưa lưu được. Hãy giữ trang mở và sao chép ghi chú.';
    status.classList.toggle('is-error', !saved);
  }
  function changed() { dirty = true; persist(); }
  editor.addEventListener('input', () => {
    const record = records.find(item => item.id === activeNoteId);
    if (!record) return;
    record.note = editor.value;
    dirty = true;
    status.textContent = 'Đang lưu…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 300);
  });

  function paint() {
    for (const [key, region] of regions) {
      region.root.querySelectorAll('[data-annotation-ids]').forEach(mark => mark.replaceWith(...mark.childNodes));
      region.root.normalize();
      const items = records.filter(record => record.region === key && (record.highlight || record.note !== null));
      let offset = 0;
      for (const node of textNodes(region.root)) {
        const start = offset;
        offset += node.length;
        const overlapping = items.filter(record => record.start < offset && record.end > start);
        if (!overlapping.length) continue;
        const stops = [...new Set([0, node.length, ...overlapping.flatMap(record => [Math.max(0, record.start - start), Math.min(node.length, record.end - start)])])].sort((a, b) => a - b);
        const fragment = document.createDocumentFragment();
        for (let i = 1; i < stops.length; i += 1) {
          const from = stops[i - 1];
          const to = stops[i];
          const covered = overlapping.filter(record => record.start < start + to && record.end > start + from);
          const text = node.data.slice(from, to);
          if (!covered.length) fragment.append(document.createTextNode(text));
          else {
            const mark = element('span', 'cbt-annotation', text);
            mark.dataset.annotationIds = covered.map(record => record.id).join(',');
            mark.classList.toggle('is-highlight', covered.some(record => record.highlight));
            mark.classList.toggle('has-note', covered.some(record => record.note !== null));
            mark.tabIndex = 0;
            mark.setAttribute('role', 'button');
            mark.setAttribute('aria-label', covered.some(record => record.note !== null) ? 'Mở ghi chú: ' + text : 'Sửa highlight: ' + text);
            fragment.append(mark);
          }
        }
        node.replaceWith(fragment);
      }
    }
  }

  function hideMenu() { menu.hidden = true; pending = null; }
  function showMenu(anchor, rect) {
    pending = anchor;
    highlightButton.textContent = matchingRecord()?.highlight ? 'Bỏ highlight' : 'Highlight';
    menu.hidden = false;
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(innerWidth - bounds.width - 8, rect.left))}px`;
    const top = rect.top >= bounds.height + 10 ? rect.top - bounds.height - 6 : rect.bottom + 6;
    menu.style.top = `${Math.max(8, Math.min(innerHeight - bounds.height - 8, top))}px`;
  }
  function matchingRecord() {
    return pending && records.find(record => record.region === pending.region && record.start === pending.start && record.end === pending.end);
  }
  function ensureRecord() {
    let record = matchingRecord();
    if (!record && pending) {
      record = { id: crypto.randomUUID(), ...pending, highlight: false, note: null };
      records.push(record);
    }
    return record;
  }
  function captureSelection() {
    if (menu.contains(document.activeElement) || panel.contains(document.activeElement)) return;
    if (document.activeElement?.matches('input:not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable]')) { hideMenu(); return; }
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) { hideMenu(); return; }
    const range = selection.getRangeAt(0);
    const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
    const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement;
    const root = startElement?.closest('[data-annotation-region]');
    if (!root || root !== endElement?.closest('[data-annotation-region]') || startElement.closest(excluded) || endElement.closest(excluded) || !root.getClientRects().length) { hideMenu(); return; }
    let offset = 0;
    let start = null;
    let end = null;
    for (const node of textNodes(root)) {
      if (range.intersectsNode(node)) {
        const from = range.startContainer === node ? range.startOffset : 0;
        const to = range.endContainer === node ? range.endOffset : node.length;
        if (to > from) { if (start === null) start = offset + from; end = offset + to; }
      }
      offset += node.length;
    }
    if (start === null || end === null) { hideMenu(); return; }
    const region = regions.get(root.dataset.annotationRegion);
    const raw = region.text.slice(start, end);
    start += raw.length - raw.trimStart().length;
    end -= raw.length - raw.trimEnd().length;
    if (end <= start) { hideMenu(); return; }
    showMenu({ region: root.dataset.annotationRegion, start, end, quote: region.text.slice(start, end) }, range.getBoundingClientRect());
  }
  function toggleHighlight() {
    const record = ensureRecord();
    if (!record) return;
    record.highlight = !record.highlight;
    records = records.filter(item => item.highlight || item.note !== null);
    hideMenu();
    window.getSelection()?.removeAllRanges();
    paint();
    changed();
  }
  function createNote() {
    const record = ensureRecord();
    if (!record) return;
    if (record.note === null) record.note = '';
    hideMenu();
    window.getSelection()?.removeAllRanges();
    paint();
    changed();
    openNote(record.id);
  }
  function openPanel() {
    if (panel.hidden) returnFocus = document.activeElement;
    panel.hidden = false;
  }
  function openNote(id) {
    persist();
    const record = records.find(item => item.id === id && item.note !== null);
    if (!record) return;
    openPanel();
    activeNoteId = id;
    allButton.hidden = quote.hidden = editor.hidden = deleteButton.hidden = false;
    list.hidden = true;
    quote.textContent = record.quote.replace(/\s+/g, ' ').trim();
    editor.value = record.note;
    editor.focus({ preventScroll: true });
  }
  function showAllNotes() {
    persist();
    hideMenu();
    openPanel();
    activeNoteId = null;
    allButton.hidden = quote.hidden = editor.hidden = deleteButton.hidden = true;
    list.hidden = false;
    list.replaceChildren();
    const notes = records.filter(record => record.note !== null);
    if (!notes.length) list.append(element('p', '', 'Chưa có ghi chú. Bôi đen nội dung đề rồi chọn Note.'));
    for (const skill of ['Listening', 'Reading', 'Writing']) {
      const items = notes.filter(record => regions.get(record.region)?.skill === skill);
      if (!items.length) continue;
      list.append(element('h3', '', skill));
      for (const record of items) {
        const item = button('cbt-note-list-item', '', () => openNote(record.id));
        item.append(element('small', '', regions.get(record.region).label), element('strong', '', record.quote.replace(/\s+/g, ' ').trim()), element('span', '', record.note || 'Chưa nhập nội dung'));
        list.append(item);
      }
    }
    closeButton.focus({ preventScroll: true });
  }
  function closePanel() {
    persist();
    panel.hidden = true;
    activeNoteId = null;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  function deleteNote() {
    const record = records.find(item => item.id === activeNoteId);
    if (!record) return;
    record.note = null;
    records = records.filter(item => item.highlight || item.note !== null);
    changed();
    paint();
    showAllNotes();
  }
  function activateMark(mark) {
    const ids = mark.dataset.annotationIds.split(',');
    const record = records.find(item => ids.includes(item.id) && item.note !== null) || records.find(item => ids.includes(item.id));
    if (!record) return;
    if (record.note !== null) openNote(record.id);
    else showMenu({ region: record.region, start: record.start, end: record.end, quote: record.quote }, mark.getBoundingClientRect());
  }

  document.addEventListener('pointerup', event => {
    if (menu.contains(event.target) || panel.contains(event.target)) return;
    setTimeout(() => {
      const mark = event.target.closest?.('[data-annotation-ids]');
      if (mark && window.getSelection()?.isCollapsed) activateMark(mark);
      else captureSelection();
    }, 0);
  });
  // Bấm chữ đã đánh dấu trong một lựa chọn chỉ mở ghi chú, không chọn đáp án.
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-annotation-ids]')) event.preventDefault();
  });
  document.addEventListener('selectionchange', () => {
    if (!window.getSelection()?.isCollapsed) requestAnimationFrame(captureSelection);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { hideMenu(); if (!panel.hidden) closePanel(); }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches?.('[data-annotation-ids]')) { event.preventDefault(); activateMark(event.target); }
    if (event.key === 'Tab' && !menu.hidden && !menu.contains(event.target)) { event.preventDefault(); highlightButton.focus(); }
  });
  document.addEventListener('keyup', event => { if (event.key.startsWith('Arrow') && event.shiftKey) captureSelection(); });
  document.addEventListener('scroll', event => { if (!panel.contains(event.target)) hideMenu(); }, true);
  window.addEventListener('resize', hideMenu);
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
  const viewObserver = new MutationObserver(changes => {
    if (changes.some(change => change.attributeName === 'hidden')) {
      persist();
      hideMenu();
      if (!panel.hidden) closePanel();
    }
  });
  document.querySelectorAll('#listeningView, #readingView, #writingView, .cbt-listening-section, .cbt-reading-section').forEach(view => viewObserver.observe(view, { attributes: true, attributeFilter: ['hidden'] }));
  document.querySelectorAll('.cbt-toolbar-controls, .writing-exam-header').forEach(toolbar => {
    const opener = button('cbt-tool-button cbt-notes-open', 'Notes', showAllNotes);
    opener.setAttribute('aria-controls', 'cbtNotesPanel');
    toolbar.append(opener);
  });
  paint();
}());

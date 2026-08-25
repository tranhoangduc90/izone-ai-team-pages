(function () {
  'use strict';

  // Dữ liệu nhận vào: phần chữ học viên chọn trong đề, trạng thái câu hỏi đang có trên giao diện
  // và mã lượt thi đã lưu bởi ứng dụng chính.
  // Việc chính: tạo Highlight/Note theo đúng đoạn chữ, tự lưu ghi chú theo lượt thi và dựng bảng rà soát câu.
  // Kết quả: tải lại tab vẫn còn phần tô sáng/ghi chú; bảng rà soát đi tới đúng câu nhưng không sửa đáp án.
  // Khi lỗi: công cụ phụ tự bỏ qua dữ liệu hỏng; ô trả lời, chấm điểm và nộp bài của ứng dụng chính không bị can thiệp.

  const testConfig = window.TERM_TEST_CONFIG;
  if (!testConfig) return;

  const query = new URLSearchParams(window.location.search);
  const classCode = (query.get('class') || '').trim().toUpperCase();
  const submissionStorageKey = 'izone-test:' + testConfig.slug + ':' + classCode;
  const rootSelector = [
    '.cbt-listening-section',
    '.cbt-reading-passage',
    '.cbt-reading-questions',
    '.writing-prompt-body'
  ].join(',');
  const excludedTextSelector = [
    'button', 'input', 'select', 'textarea', 'script', 'style',
    '[contenteditable="true"]', '.cbt-annotation-toolbar', '.cbt-note-panel'
  ].join(',');

  function readSubmission() {
    for (const storage of [sessionStorage, localStorage]) {
      try {
        const value = JSON.parse(storage.getItem(submissionStorageKey) || '{}');
        if (Object.keys(value).length) return value;
      } catch {
        // Thử nguồn lưu còn lại nếu một bản bị hỏng.
      }
    }
    return {};
  }

  function attemptScope() {
    const submission = readSubmission();
    return String(
      submission.attemptToken
      || submission.examSessionToken
      || submission.studentRef
      || query.get('demoAttempt')
      || 'local-preview'
    ).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 96) || 'local-preview';
  }

  function storageKeyForCurrentAttempt() {
    return 'izone-test-interactions:' + testConfig.slug + ':' + classCode + ':' + attemptScope();
  }

  let activeStorageKey = storageKeyForCurrentAttempt();

  function cleanAnnotation(value) {
    const rootKey = String(value?.rootKey || '').slice(0, 100);
    const start = Math.max(0, Math.floor(Number(value?.start) || 0));
    const end = Math.max(0, Math.floor(Number(value?.end) || 0));
    const kind = value?.kind === 'note' ? 'note' : 'highlight';
    if (!rootKey || end <= start) return null;
    return {
      id: String(value?.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100),
      rootKey,
      skill: ['listening', 'reading', 'writing'].includes(value?.skill) ? value.skill : 'reading',
      start,
      end,
      quote: String(value?.quote || '').slice(0, 800),
      questionRef: formatQuestionRef(parseQuestionNumbers(value?.questionRef)),
      kind,
      note: kind === 'note' ? String(value?.note || '').slice(0, 4000) : ''
    };
  }

  function readState(storageKey = activeStorageKey) {
    for (const storage of [sessionStorage, localStorage]) {
      try {
        const parsed = JSON.parse(storage.getItem(storageKey) || '{}');
        const annotations = Array.isArray(parsed.annotations)
          ? parsed.annotations.map(cleanAnnotation).filter(item => item?.id).slice(-250)
          : [];
        if (annotations.length || Object.keys(parsed).length) return { annotations };
      } catch {
        // Dữ liệu công cụ hỏng không được phép cản việc làm bài.
      }
    }
    return { annotations: [] };
  }

  const state = readState();

  // Mã lượt thi được máy chủ cấp sau khi trang đã tải. Mỗi lần giao diện bài thi
  // được mở hoặc học viên dùng công cụ, chuyển sang đúng vùng lưu của lượt hiện tại.
  // Nhờ vậy ghi chú của lượt cũ không lẫn sang lượt mới và không mất khi tải lại trang.
  function syncStorageScope() {
    const nextStorageKey = storageKeyForCurrentAttempt();
    if (nextStorageKey === activeStorageKey) return false;
    activeStorageKey = nextStorageKey;
    const restored = readState(activeStorageKey);
    state.annotations.splice(0, state.annotations.length, ...restored.annotations);
    return true;
  }

  function saveState() {
    const serialized = JSON.stringify({ annotations: state.annotations });
    for (const storage of [sessionStorage, localStorage]) {
      try {
        storage.setItem(activeStorageKey, serialized);
      } catch {
        // Nếu trình duyệt chặn bộ nhớ, công cụ chỉ mất khả năng khôi phục sau khi tải lại.
      }
    }
  }

  function makeButton(className, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return 'annotation-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function rootSkill(root) {
    if (root.closest('#listeningView')) return 'listening';
    if (root.closest('#readingView')) return 'reading';
    return 'writing';
  }

  function parseQuestionNumbers(value) {
    return [...new Set((String(value || '').match(/\d+/g) || [])
      .map(Number)
      .filter(number => number >= 1 && number <= 40))]
      .sort((left, right) => left - right);
  }

  function formatQuestionRef(numbers) {
    const sorted = [...new Set(numbers.map(Number).filter(Number.isFinite))]
      .sort((left, right) => left - right);
    if (!sorted.length) return '';
    if (sorted.length === 1) return String(sorted[0]);
    return sorted[0] + '–' + sorted[sorted.length - 1];
  }

  function directQuestionNumbers(element) {
    if (!element?.dataset) return [];
    return parseQuestionNumbers(
      element.dataset.questionNumbers
      || element.dataset.questionNumber
      || element.dataset.answerSlot
      || element.dataset.questionRange
    );
  }

  function contextQuestionNumbers(element, root) {
    let current = element;
    while (current && root.contains(current)) {
      const direct = directQuestionNumbers(current);
      if (direct.length) return direct;
      const descendants = [...current.querySelectorAll(
        '[data-question-numbers], [data-question-number], [data-answer-slot]'
      )].flatMap(directQuestionNumbers);
      if (descendants.length) return parseQuestionNumbers(descendants.join(','));
      if (current === root) break;
      current = current.parentElement;
    }
    return [];
  }

  function fallbackQuestionNumbers(root) {
    if (!['listening', 'reading'].includes(rootSkill(root))) return [];
    const section = root.closest('[data-section-index]');
    const fromDataset = parseQuestionNumbers(section?.dataset.questionRange);
    if (fromDataset.length) return fromDataset;
    const sectionIndex = Number(section?.dataset.sectionIndex) || 0;
    return parseQuestionNumbers(window.TERM_TEST_CONTENT?.[rootSkill(root)]?.sections?.[sectionIndex]?.range);
  }

  function questionRefForSelection(startElement, endElement, root) {
    if (!['listening', 'reading'].includes(rootSkill(root))) return '';
    const contextual = [
      ...contextQuestionNumbers(startElement, root),
      ...contextQuestionNumbers(endElement, root)
    ];
    return formatQuestionRef(contextual.length ? contextual : fallbackQuestionNumbers(root));
  }

  function questionRefForAnnotation(annotation) {
    if (annotation.questionRef) return annotation.questionRef;
    const root = annotationRoot(annotation);
    if (!root || !['listening', 'reading'].includes(annotation.skill)) return '';
    const marks = [...root.querySelectorAll(
      '[data-annotation-id="' + CSS.escape(annotation.id) + '"]'
    )];
    const contextual = marks.flatMap(mark => contextQuestionNumbers(mark, root));
    return formatQuestionRef(contextual.length ? contextual : fallbackQuestionNumbers(root));
  }

  function ensureRootKey(root) {
    if (root.dataset.annotationRootKey) return root.dataset.annotationRootKey;
    let key = '';
    if (root.classList.contains('cbt-listening-section')) {
      key = 'listening-section-' + (root.dataset.sectionIndex || '0');
    } else if (root.classList.contains('cbt-reading-passage')) {
      key = 'reading-passage-' + (root.closest('.cbt-reading-section')?.dataset.sectionIndex || '0');
    } else if (root.classList.contains('cbt-reading-questions')) {
      key = 'reading-questions-' + (root.closest('.cbt-reading-section')?.dataset.sectionIndex || '0');
    } else {
      key = 'writing-' + (root.closest('[data-writing-task-panel]')?.dataset.writingTaskPanel || 'task');
    }
    root.dataset.annotationRootKey = key;
    return key;
  }

  function textNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.parentElement || node.parentElement.closest(excludedTextSelector)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function pointOffset(root, container, offset) {
    const nodes = textNodes(root);
    let boundary = null;
    if (container.nodeType === Node.ELEMENT_NODE) {
      boundary = document.createRange();
      try {
        boundary.setStart(root, 0);
        boundary.setEnd(container, offset);
      } catch {
        return null;
      }
    }
    let total = 0;
    for (const node of nodes) {
      if (node === container) return total + Math.min(node.data.length, Math.max(0, offset));
      if (boundary) {
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(node);
        if (boundary.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0) {
          total += node.data.length;
          continue;
        }
        return total;
      }
      total += node.data.length;
    }
    return null;
  }

  function selectionData() {
    syncStorageScope();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const startElement = range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer;
    const endElement = range.endContainer.nodeType === Node.TEXT_NODE
      ? range.endContainer.parentElement
      : range.endContainer;
    const root = startElement?.closest?.(rootSelector);
    if (!root || endElement?.closest?.(rootSelector) !== root) return null;
    if (startElement.closest(excludedTextSelector) || endElement.closest(excludedTextSelector)) return null;

    const start = pointOffset(root, range.startContainer, range.startOffset);
    const end = pointOffset(root, range.endContainer, range.endOffset);
    const quote = range.toString().replace(/\s+/g, ' ').trim();
    if (start === null || end === null || end <= start || !quote) return null;
    const rootKey = ensureRootKey(root);
    const overlaps = state.annotations.some(item => item.rootKey === rootKey && start < item.end && end > item.start);
    if (overlaps) return null;
    return {
      root,
      rootKey,
      skill: rootSkill(root),
      start,
      end,
      quote,
      questionRef: questionRefForSelection(startElement, endElement, root)
    };
  }

  function unwrapMarks(root) {
    root.querySelectorAll('mark.cbt-annotation-mark').forEach(mark => mark.replaceWith(...mark.childNodes));
    root.normalize();
  }

  function markSegment(node, start, end, annotation) {
    if (end <= start || start < 0 || end > node.data.length) return;
    if (end < node.data.length) node.splitText(end);
    const selected = start > 0 ? node.splitText(start) : node;
    const mark = document.createElement('mark');
    mark.className = 'cbt-annotation-mark' + (annotation.kind === 'note' ? ' is-note' : '');
    mark.dataset.annotationId = annotation.id;
    mark.title = annotation.kind === 'note' ? 'Open Note' : 'Delete Highlight';
    mark.tabIndex = 0;
    selected.parentNode.insertBefore(mark, selected);
    mark.append(selected);
  }

  function renderRoot(root) {
    const rootKey = ensureRootKey(root);
    unwrapMarks(root);
    const annotations = state.annotations
      .filter(item => item.rootKey === rootKey)
      .sort((left, right) => left.start - right.start);
    for (const annotation of annotations) {
      const nodes = textNodes(root);
      let cursor = 0;
      const segments = [];
      for (const node of nodes) {
        const nodeStart = cursor;
        const nodeEnd = cursor + node.data.length;
        const start = Math.max(annotation.start, nodeStart);
        const end = Math.min(annotation.end, nodeEnd);
        if (end > start) segments.push({ node, start: start - nodeStart, end: end - nodeStart });
        cursor = nodeEnd;
      }
      segments.reverse().forEach(segment => markSegment(segment.node, segment.start, segment.end, annotation));
    }
  }

  function renderAllAnnotations() {
    document.querySelectorAll(rootSelector).forEach(root => renderRoot(root));
    updateNoteLaunchers();
  }

  const actionToolbar = document.createElement('div');
  actionToolbar.className = 'cbt-annotation-toolbar';
  actionToolbar.hidden = true;
  actionToolbar.setAttribute('role', 'toolbar');
  actionToolbar.setAttribute('aria-label', 'Text tools');
  document.body.append(actionToolbar);
  let pendingSelection = null;

  function hideActionToolbar() {
    actionToolbar.hidden = true;
    actionToolbar.replaceChildren();
    pendingSelection = null;
  }

  function positionActionToolbar(rect) {
    actionToolbar.hidden = false;
    const left = Math.min(window.innerWidth - actionToolbar.offsetWidth - 10, Math.max(10, rect.left));
    const top = Math.max(10, rect.top - actionToolbar.offsetHeight - 10);
    actionToolbar.style.left = left + 'px';
    actionToolbar.style.top = top + 'px';
  }

  function addAnnotation(kind) {
    if (!pendingSelection) return;
    syncStorageScope();
    const annotation = {
      id: createId(),
      rootKey: pendingSelection.rootKey,
      skill: pendingSelection.skill,
      start: pendingSelection.start,
      end: pendingSelection.end,
      quote: pendingSelection.quote,
      questionRef: pendingSelection.questionRef,
      kind,
      note: ''
    };
    state.annotations.push(annotation);
    saveState();
    hideActionToolbar();
    window.getSelection()?.removeAllRanges();
    renderAllAnnotations();
    if (kind === 'note') openNoteDetail(annotation.id);
  }

  function showSelectionToolbar(data, rect) {
    pendingSelection = data;
    const highlight = makeButton('cbt-annotation-action', 'Highlight');
    const note = makeButton('cbt-annotation-action', 'Note');
    [highlight, note].forEach(button => button.addEventListener('pointerdown', event => event.preventDefault()));
    highlight.addEventListener('click', () => addAnnotation('highlight'));
    note.addEventListener('click', () => addAnnotation('note'));
    actionToolbar.replaceChildren(highlight, note);
    positionActionToolbar(rect);
  }

  function deleteAnnotation(id) {
    const index = state.annotations.findIndex(item => item.id === id);
    if (index < 0) return;
    state.annotations.splice(index, 1);
    saveState();
    hideActionToolbar();
    closeNotePanel();
    renderAllAnnotations();
  }

  function showExistingToolbar(annotation, rect) {
    const buttons = [];
    if (annotation.kind === 'highlight') {
      const remove = makeButton('cbt-annotation-action', 'Delete Highlight');
      remove.addEventListener('click', () => deleteAnnotation(annotation.id));
      buttons.push(remove);
    } else {
      const open = makeButton('cbt-annotation-action', 'Open Note');
      const remove = makeButton('cbt-annotation-action', 'Delete Note');
      open.addEventListener('click', () => {
        hideActionToolbar();
        openNoteDetail(annotation.id);
      });
      remove.addEventListener('click', () => deleteAnnotation(annotation.id));
      buttons.push(open, remove);
    }
    actionToolbar.replaceChildren(...buttons);
    positionActionToolbar(rect);
  }

  const notePanel = document.createElement('aside');
  notePanel.className = 'cbt-note-panel';
  notePanel.hidden = true;
  notePanel.setAttribute('aria-label', 'Notes');
  notePanel.innerHTML = [
    '<header><strong>Notes</strong><button type="button" class="cbt-note-close" aria-label="Close Notes">×</button></header>',
    '<div class="cbt-note-content"></div>'
  ].join('');
  document.body.append(notePanel);
  const noteContent = notePanel.querySelector('.cbt-note-content');
  notePanel.querySelector('.cbt-note-close').addEventListener('click', closeNotePanel);
  let noteSkillFilter = '';

  function closeNotePanel() {
    notePanel.hidden = true;
    noteContent.replaceChildren();
  }

  function annotationRoot(annotation) {
    return document.querySelector('[data-annotation-root-key="' + CSS.escape(annotation.rootKey) + '"]');
  }

  function goToAnnotation(annotation) {
    const root = annotationRoot(annotation);
    const section = root?.closest('[data-section-index]');
    const skill = annotation.skill;
    if (section && ['listening', 'reading'].includes(skill)) {
      const index = Number(section.dataset.sectionIndex) || 0;
      document.querySelectorAll('#' + skill + 'View .cbt-part-button')[index]?.click();
    } else if (skill === 'writing') {
      const taskId = root?.closest('[data-writing-task-panel]')?.dataset.writingTaskPanel;
      const index = taskId === 'task2' ? 1 : 0;
      document.querySelectorAll('#writingTaskTabs .writing-task-tab')[index]?.click();
    }
    window.requestAnimationFrame(() => {
      root?.querySelector('[data-annotation-id="' + CSS.escape(annotation.id) + '"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function openNoteList(skill = '') {
    syncStorageScope();
    noteSkillFilter = skill;
    notePanel.hidden = false;
    const notes = state.annotations.filter(item => item.kind === 'note' && (!skill || item.skill === skill));
    const list = document.createElement('div');
    list.className = 'cbt-note-list';
    if (!notes.length) {
      const empty = document.createElement('p');
      empty.className = 'cbt-note-empty';
      empty.textContent = 'No notes yet.';
      list.append(empty);
    }
    notes.forEach(annotation => {
      const button = makeButton('cbt-note-list-item', '');
      const quote = document.createElement('strong');
      const questionRef = questionRefForAnnotation(annotation);
      quote.textContent = (questionRef ? questionRef + ' · ' : '') + (annotation.quote || 'Selected text');
      const preview = document.createElement('span');
      preview.textContent = annotation.note || 'Empty note';
      button.append(quote, preview);
      button.addEventListener('click', () => openNoteDetail(annotation.id));
      list.append(button);
    });
    noteContent.replaceChildren(list);
  }

  function openNoteDetail(id) {
    syncStorageScope();
    const annotation = state.annotations.find(item => item.id === id && item.kind === 'note');
    if (!annotation) return;
    notePanel.hidden = false;
    const back = makeButton('cbt-note-back', '← All Notes');
    const quote = document.createElement('blockquote');
    const questionRef = questionRefForAnnotation(annotation);
    if (questionRef) {
      const reference = document.createElement('strong');
      reference.className = 'cbt-note-question-ref';
      reference.textContent = questionRef;
      quote.append(reference);
    }
    const quoteText = document.createElement('span');
    quoteText.className = 'cbt-note-quote-text';
    quoteText.textContent = annotation.quote;
    quote.append(quoteText);
    const textarea = document.createElement('textarea');
    textarea.className = 'cbt-note-editor';
    textarea.setAttribute('aria-label', 'Note');
    textarea.placeholder = 'Write your note...';
    textarea.value = annotation.note;
    const footer = document.createElement('footer');
    const saved = document.createElement('span');
    saved.textContent = 'Saved automatically';
    const remove = makeButton('cbt-note-delete', 'Delete');
    footer.append(saved, remove);
    back.addEventListener('click', () => openNoteList(noteSkillFilter || annotation.skill));
    textarea.addEventListener('input', () => {
      annotation.note = textarea.value.slice(0, 4000);
      saveState();
      saved.textContent = 'Saved automatically';
    });
    remove.addEventListener('click', () => deleteAnnotation(annotation.id));
    noteContent.replaceChildren(back, quote, textarea, footer);
    goToAnnotation(annotation);
    textarea.focus();
  }

  function installNoteLaunchers() {
    document.querySelectorAll('.cbt-toolbar-controls').forEach(host => {
      if (host.querySelector('.cbt-notes-launcher')) return;
      const skill = host.closest('#readingView') ? 'reading' : 'listening';
      const button = makeButton('cbt-tool-button cbt-notes-launcher', 'Notes');
      button.dataset.notesSkill = skill;
      button.addEventListener('click', () => openNoteList(skill));
      host.append(button);
    });
    const writingHeader = document.querySelector('.writing-exam-header');
    if (writingHeader && !writingHeader.querySelector('.cbt-notes-launcher')) {
      const button = makeButton('button button-secondary cbt-notes-launcher', 'Notes');
      button.dataset.notesSkill = 'writing';
      button.addEventListener('click', () => openNoteList('writing'));
      writingHeader.insertBefore(button, writingHeader.querySelector('.writing-submit'));
    }
    updateNoteLaunchers();
  }

  function updateNoteLaunchers() {
    document.querySelectorAll('.cbt-notes-launcher').forEach(button => {
      const count = state.annotations.filter(item => item.kind === 'note' && item.skill === button.dataset.notesSkill).length;
      button.textContent = count ? 'Notes (' + count + ')' : 'Notes';
      button.setAttribute('aria-label', count ? 'Notes, ' + count + ' saved' : 'Notes');
    });
  }

  function setupReviewPanel(wrap) {
    if (wrap.dataset.reviewReady === 'true') return;
    const nav = wrap.querySelector('.cbt-question-nav');
    if (!nav) return;
    wrap.dataset.reviewReady = 'true';

    const bar = document.createElement('div');
    bar.className = 'cbt-review-bar';
    const summary = document.createElement('span');
    const open = makeButton('cbt-review-open', 'Rà soát bài');
    open.setAttribute('aria-expanded', 'false');
    bar.append(summary, open);

    const panel = document.createElement('section');
    panel.className = 'cbt-review-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Rà soát bài');
    const header = document.createElement('header');
    const title = document.createElement('strong');
    title.textContent = 'Rà soát đáp án';
    const close = makeButton('cbt-review-close', '×');
    close.setAttribute('aria-label', 'Đóng bảng rà soát');
    header.append(title, close);
    const filters = document.createElement('div');
    filters.className = 'cbt-review-filters';
    const grid = document.createElement('div');
    grid.className = 'cbt-review-grid';
    const empty = document.createElement('p');
    empty.className = 'cbt-review-empty';
    const filterDefinitions = [
      ['unanswered', 'Chưa làm'],
      ['flagged', 'Đã đánh dấu'],
      ['all', 'Tất cả']
    ];
    let activeFilter = 'unanswered';

    const filterButtons = new Map(filterDefinitions.map(([key, label]) => {
      const button = makeButton('cbt-review-filter', label);
      button.dataset.reviewFilter = key;
      button.addEventListener('click', () => {
        activeFilter = key;
        renderReview();
      });
      filters.append(button);
      return [key, button];
    }));
    panel.append(header, filters, grid, empty);
    wrap.prepend(bar, panel);

    function sourceButtons() {
      return [...nav.querySelectorAll('[data-nav-number]')]
        .sort((left, right) => Number(left.dataset.navNumber) - Number(right.dataset.navNumber));
    }

    function filterMatches(button) {
      if (activeFilter === 'unanswered') return !button.classList.contains('is-answered');
      if (activeFilter === 'flagged') return button.classList.contains('is-flagged');
      return true;
    }

    function renderReview() {
      const buttons = sourceButtons();
      const unanswered = buttons.filter(button => !button.classList.contains('is-answered')).length;
      const flagged = buttons.filter(button => button.classList.contains('is-flagged')).length;
      summary.textContent = unanswered + ' chưa làm · ' + flagged + ' đã đánh dấu';
      const counts = { unanswered, flagged, all: buttons.length };
      filterDefinitions.forEach(([key, label]) => {
        const filterButton = filterButtons.get(key);
        filterButton.textContent = label + ' (' + counts[key] + ')';
        filterButton.classList.toggle('is-active', activeFilter === key);
        filterButton.setAttribute('aria-pressed', activeFilter === key ? 'true' : 'false');
      });

      const matches = buttons.filter(filterMatches);
      grid.replaceChildren(...matches.map(sourceButton => {
        const number = sourceButton.dataset.navNumber;
        const button = makeButton('cbt-review-question', number);
        button.classList.toggle('is-answered', sourceButton.classList.contains('is-answered'));
        button.classList.toggle('is-flagged', sourceButton.classList.contains('is-flagged'));
        button.setAttribute('aria-label', sourceButton.getAttribute('aria-label') || 'Câu ' + number);
        button.addEventListener('click', () => {
          sourceButton.click();
          panel.hidden = true;
          open.setAttribute('aria-expanded', 'false');
        });
        return button;
      }));
      empty.hidden = matches.length > 0;
      empty.textContent = 'Không có câu phù hợp với bộ lọc này.';
    }

    function closePanel() {
      panel.hidden = true;
      open.setAttribute('aria-expanded', 'false');
    }

    open.addEventListener('click', () => {
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      open.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      if (willOpen) renderReview();
    });
    close.addEventListener('click', closePanel);
    const observer = new MutationObserver(renderReview);
    observer.observe(nav, { subtree: true, attributes: true, attributeFilter: ['class', 'aria-label'] });
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
    renderReview();
  }

  function installTools() {
    syncStorageScope();
    document.querySelectorAll(rootSelector).forEach(ensureRootKey);
    document.querySelectorAll('.cbt-question-nav-wrap').forEach(setupReviewPanel);
    installNoteLaunchers();
    renderAllAnnotations();
  }

  document.addEventListener('mouseup', event => {
    if (event.target.closest('.cbt-annotation-toolbar, .cbt-note-panel, mark[data-annotation-id]')) return;
    window.setTimeout(() => {
      const data = selectionData();
      if (!data) {
        hideActionToolbar();
        return;
      }
      const range = window.getSelection().getRangeAt(0);
      showSelectionToolbar(data, range.getBoundingClientRect());
    }, 0);
  });

  document.addEventListener('click', event => {
    const mark = event.target.closest('mark[data-annotation-id]');
    if (mark) {
      event.preventDefault();
      event.stopPropagation();
      const annotation = state.annotations.find(item => item.id === mark.dataset.annotationId);
      if (annotation) showExistingToolbar(annotation, mark.getBoundingClientRect());
      return;
    }
    if (!event.target.closest('.cbt-annotation-toolbar')) hideActionToolbar();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      hideActionToolbar();
      closeNotePanel();
    }
    const mark = event.target.closest?.('mark[data-annotation-id]');
    if (mark && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      const annotation = state.annotations.find(item => item.id === mark.dataset.annotationId);
      if (annotation) showExistingToolbar(annotation, mark.getBoundingClientRect());
    }
  });

  const contentObserver = new MutationObserver(records => {
    const needsInstall = records.some(record => [...record.addedNodes].some(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      return node.matches?.(rootSelector + ', .cbt-question-nav-wrap, .writing-exam-header')
        || node.querySelector?.(rootSelector + ', .cbt-question-nav-wrap, .writing-exam-header');
    }));
    if (needsInstall) window.requestAnimationFrame(installTools);
  });
  contentObserver.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => {
    contentObserver.disconnect();
    syncStorageScope();
    saveState();
  }, { once: true });
  installTools();
}());

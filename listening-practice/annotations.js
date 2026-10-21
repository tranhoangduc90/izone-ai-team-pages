(function bootAnnotations() {
  'use strict';
  // Nhận phần chữ được chọn trong Reading; lưu vị trí, trích dẫn và nội dung Note
  // vào đúng học viên/lần làm bài. Khi không còn quyền làm ở tab này, chỉ đóng công cụ.
  // Thuật toán Range/text offset và kiểu Highlight/Note kế thừa Term Test 2.
  const bridge=window.ReadingInteractionBridge;
  // App nạp module bất đồng bộ; đợi cầu nối sẵn sàng rồi mới gắn công cụ chọn chữ.
  if(!bridge){window.addEventListener('reading-interaction-ready',bootAnnotations,{once:true});return;}
  const rootSelector='.cbt-reading-passage, .cbt-reading-questions';
  const excludedTextSelector='button,input,select,textarea,script,style,[contenteditable=true],.cbt-annotation-toolbar,.cbt-note-panel,.cbt-blank-number,.cbt-question-number,.cbt-choice-letter,.cbt-paragraph-label';
  const state={get annotations(){const attempt=bridge.current();if(!attempt)return [];return attempt.annotations ||= [];}};
  let activeScope=bridge.scope();
  function syncStorageScope(){const next=bridge.scope();if(next===activeScope)return false;activeScope=next;hideActionToolbar();closeNotePanel();return true;}
  function saveState(){return bridge.save();}
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
    return 'reading';
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

  function fallbackQuestionNumbers() { return bridge.questionIds().map(Number); }

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
    if(!bridge.writable())return null;
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
    const quote = textNodes(root).map(node=>node.data).join('').slice(start,end).replace(/\s+/g,' ').trim();
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
  let existingMode=false;

  function hideActionToolbar() {
    actionToolbar.hidden = true;
    actionToolbar.replaceChildren();
    pendingSelection = null;
    existingMode=false;
  }

  function positionActionToolbar(rect) {
    actionToolbar.hidden = false;
    const left = Math.min(window.innerWidth - actionToolbar.offsetWidth - 10, Math.max(10, rect.left));
    const top = Math.max(10, rect.top - actionToolbar.offsetHeight - 10);
    actionToolbar.style.left = left + 'px';
    actionToolbar.style.top = top + 'px';
  }

  function addAnnotation(kind) {
    syncStorageScope();
    if (!pendingSelection || !pendingSelection.root.isConnected || !bridge.writable()) return;
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
    if(!saveState())return;
    hideActionToolbar();
    window.getSelection()?.removeAllRanges();
    renderAllAnnotations();
    if (kind === 'note') openNoteDetail(annotation.id);
  }

  function showSelectionToolbar(data, rect) {
    pendingSelection = data;
    existingMode=false;
    const highlight = makeButton('cbt-annotation-action', 'Highlight');
    const note = makeButton('cbt-annotation-action', 'Note');
    [highlight, note].forEach(button => button.addEventListener('pointerdown', event => event.preventDefault()));
    highlight.addEventListener('click', () => addAnnotation('highlight'));
    note.addEventListener('click', () => addAnnotation('note'));
    actionToolbar.replaceChildren(highlight, note);
    positionActionToolbar(rect);
  }

  function deleteAnnotation(id) {
    if(!bridge.writable())return;
    const index = state.annotations.findIndex(item => item.id === id);
    if (index < 0) return;
    state.annotations.splice(index, 1);
    saveState();
    hideActionToolbar();
    closeNotePanel();
    renderAllAnnotations();
  }

  function showExistingToolbar(annotation, rect) {
    existingMode=true;
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
  notePanel.className = 'cbt-note-panel cbt-linked-note-panel';
  notePanel.id = 'linked-notes-panel';
  notePanel.hidden = true;
  notePanel.setAttribute('aria-label', 'Notes');
  notePanel.innerHTML = [
    '<header><strong>Ghi chú theo đoạn</strong><button type="button" class="cbt-note-close" aria-label="Đóng ghi chú">×</button></header>',
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
    const root=annotationRoot(annotation);
    if(!root)return;
    bridge.showPane(root.classList.contains('cbt-reading-passage')?'passage':'questions');
    requestAnimationFrame(()=>root.querySelector('[data-annotation-id="'+CSS.escape(annotation.id)+'"]')?.scrollIntoView({block:'center',behavior:'auto'}));
  }

  function openNoteList(skill = '') {
    syncStorageScope();
    noteSkillFilter = skill;
    bridge.closeGeneralNotes();
    notePanel.hidden = false;
    const notes = state.annotations.filter(item => item.kind === 'note' && (!skill || item.skill === skill));
    const list = document.createElement('div');
    list.className = 'cbt-note-list';
    if (!notes.length) {
      const empty = document.createElement('p');
      empty.className = 'cbt-note-empty';
      empty.textContent = 'Chưa có ghi chú theo đoạn.';
      list.append(empty);
    }
    notes.forEach(annotation => {
      const button = makeButton('cbt-note-list-item', '');
      const quote = document.createElement('strong');
      const questionRef = questionRefForAnnotation(annotation);
      quote.textContent = (questionRef ? questionRef + ' · ' : '') + (annotation.quote || 'Selected text');
      const preview = document.createElement('span');
      preview.textContent = annotation.note || 'Chưa nhập nội dung';
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
    bridge.closeGeneralNotes();
    notePanel.hidden = false;
    const back = makeButton('cbt-note-back', '← Tất cả ghi chú');
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
    textarea.placeholder = 'Ghi lại ý hoặc từ cần nhớ…';
    textarea.value = annotation.note;
    const footer = document.createElement('footer');
    const saved = document.createElement('span');
    saved.textContent = 'Đã tự lưu cùng lần làm bài';
    const remove = makeButton('cbt-note-delete', 'Delete');
    footer.append(saved, remove);
    back.addEventListener('click', () => openNoteList(noteSkillFilter || annotation.skill));
    textarea.addEventListener('input', () => {
      if(!bridge.writable()){textarea.readOnly=true;return;}
      annotation.note = textarea.value.slice(0, 4000);
      saveState();
      saved.textContent = 'Đã tự lưu cùng lần làm bài';
    });
    remove.addEventListener('click', () => deleteAnnotation(annotation.id));
    noteContent.replaceChildren(back, quote, textarea, footer);
    goToAnnotation(annotation);
    textarea.focus();
  }


  function updateNoteLaunchers() {
    const notes=state.annotations.filter(item=>item.kind==='note');
    const launcher=document.querySelector('[data-action="notes"]');
    if(launcher)launcher.textContent=notes.length?'Notes ('+notes.length+')':'Notes';
    const host=document.querySelector('#notes-panel .homework-notes');
    if(!host)return;
    let list=host.querySelector('.cbt-note-list');
    if(!list){const title=document.createElement('h4');title.textContent='Ghi chú theo đoạn';host.append(title);list=document.createElement('div');list.className='cbt-note-list';host.append(list);}
    list.replaceChildren();
    if(!notes.length){const empty=document.createElement('p');empty.className='cbt-note-empty';empty.textContent='Chọn chữ trong bài đọc hoặc câu hỏi, rồi bấm Note.';list.append(empty);}
    for(const annotation of notes){
      const item=makeButton('cbt-note-list-item',''),quote=document.createElement('strong'),preview=document.createElement('span');
      quote.textContent=(annotation.questionRef?annotation.questionRef+' · ':'')+annotation.quote;
      preview.textContent=annotation.note||'Chưa nhập nội dung';item.append(quote,preview);
      item.addEventListener('click',()=>openNoteDetail(annotation.id));list.append(item);
    }
  }
  function installTools() {
    syncStorageScope();
    if(!bridge.writable()){hideActionToolbar();closeNotePanel();return;}
    document.querySelectorAll(rootSelector).forEach(ensureRootKey);
    renderAllAnnotations();
  }
  function inspectSelection() {
    const data=selectionData();
    if(!data){if(existingMode&&!actionToolbar.hidden)return;hideActionToolbar();return;}
    showSelectionToolbar(data,window.getSelection().getRangeAt(0).getBoundingClientRect());
  }
  let selectionTimer;
  document.addEventListener('selectionchange',()=>{clearTimeout(selectionTimer);selectionTimer=setTimeout(inspectSelection,80);});
  document.addEventListener('pointerup',event=>{
    if(event.target.closest('.cbt-annotation-toolbar,.cbt-note-panel,mark[data-annotation-id]'))return;
    setTimeout(inspectSelection,0);
  });
  document.addEventListener('click',event=>{
    const mark=event.target.closest('mark[data-annotation-id]');
    if(mark&&bridge.writable()){
      event.preventDefault();event.stopPropagation();
      const annotation=state.annotations.find(item=>item.id===mark.dataset.annotationId);
      if(annotation)showExistingToolbar(annotation,mark.getBoundingClientRect());
      return;
    }
    if(!event.target.closest('.cbt-annotation-toolbar'))hideActionToolbar();
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){hideActionToolbar();closeNotePanel();}
    const mark=event.target.closest?.('mark[data-annotation-id]');
    if(mark&&bridge.writable()&&['Enter',' '].includes(event.key)){event.preventDefault();const annotation=state.annotations.find(item=>item.id===mark.dataset.annotationId);if(annotation)showExistingToolbar(annotation,mark.getBoundingClientRect());}
  });
  document.addEventListener('scroll',hideActionToolbar,true);
  window.addEventListener('resize',hideActionToolbar);
  window.addEventListener('hashchange',()=>{hideActionToolbar();closeNotePanel();installTools();});
  const observer=new MutationObserver(records=>{
    if(!bridge.writable()){hideActionToolbar();closeNotePanel();return;}
    if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches?.(rootSelector)||node.querySelector?.(rootSelector)))))requestAnimationFrame(installTools);
  });
  observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
  window.ReadingAnnotations={install:installTools,refreshNotes:updateNoteLaunchers,closeNotePanel};
  installTools();
}());

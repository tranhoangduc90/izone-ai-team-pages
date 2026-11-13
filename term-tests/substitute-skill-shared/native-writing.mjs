// Pure presentation pinned from substitute-k56-shared/app.js.
// SHA-256 2bcbd89cde031cc3cf39a103489b1640fb4005407c4d2ebce483bf53118275d3
// Identity, timer, persistence and submission are provided by the skill controller.
export function mountNativeWriting({writingConfig,elements,state,onChange,onLayout}){
 const demoMode=false,localSaveStatus='Đã lưu trên thiết bị';
 const saveSession=()=>onLayout?.(state.writingLayout);
 const scheduleWritingSave=()=>onChange(state.drafts.writing,state.writingRevision);
 function countWords(value) {
    const normalized = String(value || '').trim();
    return normalized ? normalized.split(/\s+/u).length : 0;
  }
 function setupWritingExam() {
    const tasks = Array.from(writingConfig?.tasks || []);
    if (!tasks.length || !elements.writingWorkspace || !elements.writingTaskTabs) return;

    const panels = [];
    const tabs = [];

    function activateTask(index, focusEditor = false) {
      const safeIndex = Math.min(tasks.length - 1, Math.max(0, Number(index) || 0));
      const activeTask = tasks[safeIndex];
      state.writingLayout.activeTask = activeTask.id;
      panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== safeIndex; });
      tabs.forEach((tab, tabIndex) => {
        const active = tabIndex === safeIndex;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-current', active ? 'true' : 'false');
      });
      elements.previousWritingTask.disabled = safeIndex === 0;
      elements.nextWritingTask.disabled = safeIndex === tasks.length - 1;
      elements.writingTaskPosition.textContent = `Task ${safeIndex + 1} / ${tasks.length}`;
      saveSession();
      if (focusEditor) panels[safeIndex].querySelector('[data-writing-task]')?.focus();
    }

    tasks.forEach((task, index) => {
      const tab = makeWritingTab(task, index);
      const panel = makeWritingPanel(task);
      tab.addEventListener('click', () => activateTask(index, true));
      tabs.push(tab);
      panels.push(panel);
      elements.writingTaskTabs.append(tab);
      elements.writingWorkspace.append(panel);
    });

    function makeWritingTab(task, index) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'writing-task-tab';
      button.textContent = task.label || `Task ${index + 1}`;
      return button;
    }

    function makeWritingPanel(task) {
      const panel = document.createElement('section');
      panel.className = 'writing-task-panel';
      panel.dataset.writingTaskPanel = task.id;

      const split = document.createElement('div');
      split.className = 'writing-split';
      const initialSplit = Number(state.writingLayout.splits[task.id] || task.initialSplit || 50);

      const promptPane = document.createElement('article');
      promptPane.className = 'writing-prompt-pane';
      const promptHeader = document.createElement('header');
      promptHeader.className = 'writing-pane-header';
      const promptLabel = document.createElement('span');
      promptLabel.textContent = task.label;
      const promptTitle = document.createElement('strong');
      promptTitle.textContent = 'Đề bài';
      promptHeader.append(promptTitle);
      const promptBody = document.createElement('div');
      promptBody.className = 'writing-prompt-body';
      // Giữ outline cũ trong state/recovery; màn làm bài chỉ còn đề và bài viết.
      const guidance = document.createElement('p');
      guidance.className = 'writing-guidance';
      guidance.textContent = `You should spend about ${task.recommendedMinutes} minutes on this task.`;
      const instruction = document.createElement('p');
      instruction.className = 'writing-instruction';
      instruction.textContent = task.prompt;
      promptBody.append(guidance, instruction);
      if (task.followUp) {
        const followUp = document.createElement('p');
        followUp.className = 'writing-follow-up';
        followUp.textContent = task.followUp;
        promptBody.append(followUp);
      }
      if (task.image) {
        const figure = document.createElement('figure');
        figure.className = 'writing-task-figure';
        const image = document.createElement('img');
        image.src = task.image.src;
        image.alt = task.image.alt;
        figure.append(image);
        promptBody.append(figure);
      }
      const minimum = document.createElement('p');
      minimum.className = 'writing-minimum';
      minimum.textContent = `Write at least ${task.minimumWords} words.`;
      promptBody.append(minimum);
      promptPane.append(promptHeader, promptBody);

      const separator = document.createElement('button');
      separator.type = 'button';
      separator.className = 'writing-separator';
      separator.setAttribute('role', 'separator');
      separator.setAttribute('aria-orientation', 'vertical');
      separator.setAttribute('aria-label', `Kéo để đổi độ rộng đề và bài làm ${task.label}`);
      separator.setAttribute('aria-valuemin', '28');
      separator.setAttribute('aria-valuemax', '70');
      separator.title = 'Kéo ngang để đổi độ rộng hai khung';
      separator.innerHTML = '<span aria-hidden="true">⋮⋮</span>';

      const answerPane = document.createElement('section');
      answerPane.className = 'writing-answer-pane';
      const answerHeader = document.createElement('header');
      answerHeader.className = 'writing-pane-header';
      const answerLabel = document.createElement('span');
      answerLabel.textContent = task.label;
      const answerTitle = document.createElement('strong');
      answerTitle.textContent = 'Bài làm của bạn';
      answerHeader.append(answerTitle);
      const editor = document.createElement('textarea');
      editor.className = 'writing-editor';
      editor.dataset.writingTask = task.id;
      editor.value = state.drafts.writing[task.id] || '';
      editor.spellcheck = false;
      editor.autocomplete = 'off';
      editor.setAttribute('autocapitalize', 'off');
      editor.setAttribute('autocorrect', 'off');
      editor.setAttribute('aria-label', `Bài làm ${task.label}`);
      const editorMeta = document.createElement('footer');
      editorMeta.className = 'writing-editor-meta';
      const autosave = document.createElement('span');
      autosave.textContent = demoMode ? localSaveStatus
        : state.writingDirty ? 'Đang chờ lưu trên hệ thống...' : 'Tự lưu trên hệ thống';
      const wordCount = document.createElement('strong');
      wordCount.textContent = `${countWords(editor.value)} từ`;
      editorMeta.append(autosave, wordCount);
      editor.addEventListener('input', () => {
        state.drafts.writing[task.id] = editor.value;
        state.writingDirty = true;
        state.writingRevision += 1;
        wordCount.textContent = `${countWords(editor.value)} từ`;
        saveSession();
        scheduleWritingSave();
      });
      answerPane.append(answerHeader, editor, editorMeta);
      split.append(promptPane, separator, answerPane);
      panel.append(split);

      function applySplit(value) {
        const percentage = Math.min(70, Math.max(28, Math.round(Number(value) * 10) / 10));
        split.style.setProperty('--writing-left', `${percentage}%`);
        separator.setAttribute('aria-valuenow', String(Math.round(percentage)));
        state.writingLayout.splits[task.id] = percentage;
        saveSession();
      }

      separator.addEventListener('pointerdown', event => {
        separator.setPointerCapture(event.pointerId);
        separator.classList.add('is-dragging');
      });
      separator.addEventListener('pointermove', event => {
        if (!separator.hasPointerCapture(event.pointerId)) return;
        const bounds = split.getBoundingClientRect();
        applySplit((event.clientX - bounds.left) * 100 / bounds.width);
      });
      const stopDragging = event => {
        if (separator.hasPointerCapture(event.pointerId)) separator.releasePointerCapture(event.pointerId);
        separator.classList.remove('is-dragging');
      };
      separator.addEventListener('pointerup', stopDragging);
      separator.addEventListener('pointercancel', stopDragging);
      separator.addEventListener('keydown', event => {
        const current = Number(separator.getAttribute('aria-valuenow')) || initialSplit;
        if (event.key === 'ArrowLeft') applySplit(current - 2);
        else if (event.key === 'ArrowRight') applySplit(current + 2);
        else if (event.key === 'Home') applySplit(28);
        else if (event.key === 'End') applySplit(70);
        else return;
        event.preventDefault();

      });
      applySplit(initialSplit);
      return panel;
    }

    const initialIndex = Math.max(0, tasks.findIndex(task => task.id === state.writingLayout.activeTask));
    activateTask(initialIndex, false);
    elements.previousWritingTask.addEventListener('click', () => {
      const index = tasks.findIndex(task => task.id === state.writingLayout.activeTask);
      activateTask(index - 1, true);
    });
    elements.nextWritingTask.addEventListener('click', () => {
      const index = tasks.findIndex(task => task.id === state.writingLayout.activeTask);
      activateTask(index + 1, true);
    });
  }
 setupWritingExam();
 return {disable(){elements.writingWorkspace.querySelectorAll('textarea').forEach(e=>e.readOnly=true);},saveStatus(message){elements.writingWorkspace.querySelectorAll('.writing-editor-meta span').forEach(e=>e.textContent=message);}};
}
export function appendSanitizedWritingHtml(target, value) {
    const allowedTags = new Set([
      'p', 'div', 'span', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'br',
      'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'
    ]);
    const blockedTags = new Set([
      'script', 'style', 'template', 'iframe', 'object', 'embed', 'svg', 'math',
      'form', 'input', 'button', 'textarea', 'select', 'option', 'link', 'meta'
    ]);
    // Template giữ HTML nguồn bất hoạt; chỉ đưa các node đã lọc vào giao diện.
    // Bỏ thuộc tính thông thường trước, rồi dùng allowlist khi sao chép để chặn cả HTML méo dạng.
    const inertHtml = String(value || '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
      .replace(/<([a-z][a-z0-9-]*)(?:\s+(?:[^"'<>]|"[^"]*"|'[^']*')*)?\s*\/?>/gi, '<$1>');
    const parsed = document.createElement('template');
    parsed.innerHTML = inertHtml;

    const cloneSafeNode = node => {
      if (node.nodeType === 3) return document.createTextNode(node.textContent || '');
      if (node.nodeType !== 1) return null;
      const sourceTag = String(node.tagName || '').toLowerCase();
      if (blockedTags.has(sourceTag)) return null;
      const outputTag = /^h[1-6]$/.test(sourceTag)
        ? 'h5'
        : sourceTag === 'b'
          ? 'strong'
          : sourceTag === 'i'
            ? 'em'
            : allowedTags.has(sourceTag)
              ? sourceTag
              : null;
      const output = outputTag ? document.createElement(outputTag) : document.createDocumentFragment();
      for (const child of Array.from(node.childNodes || [])) {
        const safeChild = cloneSafeNode(child);
        if (safeChild) output.append(safeChild);
      }
      return output;
    };

    for (const child of Array.from(parsed.content.childNodes || [])) {
      const safeChild = cloneSafeNode(child);
      if (safeChild) target.append(safeChild);
    }
  }
export function appendSafeWritingFeedback(target, value, {preserveContent=false,linksAsText=false}={}) {
    const appendInline = (parent, source) => {
      const text = String(source || '');
      const tokenPattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;
      let cursor = 0;
      for (const match of text.matchAll(tokenPattern)) {
        if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
        if (match[1]) {
          const strong = document.createElement('strong');
          strong.textContent = match[1];
          parent.append(strong);
        } else if (match[2]) {
          const emphasis = document.createElement('em');
          emphasis.textContent = match[2];
          parent.append(emphasis);
        } else if(linksAsText) {
          parent.append(document.createTextNode(match[3]));
        } else {
          const link = document.createElement('a');
          link.href = match[4];
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.referrerPolicy = 'no-referrer';
          link.textContent = match[3];
          parent.append(link);
        }
        cursor = match.index + match[0].length;
      }
      if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
    };

    const cleaned = preserveContent ? String(value ?? '').replace(/\r/g,'') : cleanWritingFeedback(value || 'Chưa có nhận xét tổng hợp.');
    if (looksLikeWritingHtml(cleaned)) {
      appendSanitizedWritingHtml(target, cleaned);
      return;
    }

    const normalized = cleaned
      .replace(/[ \t]+(?=#{2,4}\s+\*\*)/g, '\n');
    const lines = normalized.split('\n');
    let index = 0;
    while (index < lines.length) {
      const rawLine = lines[index];
      const line = rawLine.trim();
      if (!line) {
        index += 1;
        continue;
      }
      const heading = preserveContent
        ? line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/)
        : line.match(/^(#{1,5})\s+(?:\*\*([^*]+)\*\*|([^#]+?))(?:\s+([\s\S]*))?$/);
      if (heading) {
        const title = document.createElement('h5');
        if(preserveContent)appendInline(title,heading[2]);
        else title.textContent = String(heading[2] || heading[3] || '').trim();
        target.append(title);
        if (heading[4]) {
          const paragraph = document.createElement('p');
          appendInline(paragraph, heading[4]);
          target.append(paragraph);
        }
        index += 1;
        continue;
      }

      const listItem = line.match(/^(?:([-*])|(\d+)\.)\s+(.+)$/);
      if (listItem) {
        const ordered = Boolean(listItem[2]);
        const list = document.createElement(ordered ? 'ol' : 'ul');
        while (index < lines.length) {
          const candidate = lines[index].trim().match(/^(?:([-*])|(\d+)\.)\s+(.+)$/);
          if (!candidate || Boolean(candidate[2]) !== ordered) break;
          const item = document.createElement('li');
          appendInline(item, candidate[3]);
          list.append(item);
          index += 1;
        }
        target.append(list);
        continue;
      }

      const paragraphLines = [line];
      index += 1;
      while (index < lines.length) {
        const candidate = lines[index].trim();
        if (!candidate) break;
        if (/^#{1,5}\s+/.test(candidate) || /^(?:[-*]|\d+\.)\s+/.test(candidate)) break;
        paragraphLines.push(candidate);
        index += 1;
      }
      const paragraph = document.createElement('p');
      appendInline(paragraph, paragraphLines.join(' '));
      target.append(paragraph);
    }
  }
export function looksLikeWritingHtml(value) {
    return /<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?>/i.test(String(value || ''));
  }
export function cleanWritingFeedback(value) {
    return String(value || '')
      .replace(/\r/g, '')
      .replace(/^.*\]\(https:\/\/(?:docs|drive)\.google\.com\/[^)]+\).*$/gim, '')
      .replace(/https:\/\/(?:docs|drive)\.google\.com\/\S+/gi, '')
      .replace(/^\s*\(?\s*Xem phân tích chi tiết[^\n]*\)?\s*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
export function createNativeWritingFeedback({writingConfig,state}){
function countWords(value) {
    const normalized = String(value || '').trim();
    return normalized ? normalized.split(/\s+/u).length : 0;
  }
function formatBand(value) {
    const band = Number(value);
    return Number.isFinite(band) ? String(band) : '—';
  }
function criterionTitle(code, taskNumber) {
    return {
      TA: 'Task Achievement',
      TR: 'Task Response',
      CC: 'Coherence & Cohesion',
      LR: 'Lexical Resource',
      GRA: 'Grammatical Range & Accuracy'
    }[code] || `Task 2 · ${code}`;
  }
function writingReportSummary(value) {
    const cleaned = cleanWritingFeedback(value);
    const markerIndex = cleaned.search(/Nhận xét từng tiêu chí/iu);
    if (markerIndex < 0) return cleaned;
    const separatorIndex = cleaned.lastIndexOf('---', markerIndex);
    const headingIndex = cleaned.lastIndexOf('#', markerIndex);
    const cutIndex = separatorIndex >= 0
      ? separatorIndex
      : headingIndex >= 0
        ? headingIndex
        : markerIndex;
    return cleaned.slice(0, cutIndex).trim();
  }
function writingCriterionConclusion(value) {
    const cleaned = cleanWritingFeedback(value);
    const marker = /^#{2,5}\s+(?:\*\*)?KẾT LUẬN(?:\*\*)?\s*$/im.exec(cleaned);
    return marker ? cleaned.slice(marker.index + marker[0].length).trim() : '';
  }
function writingCriterionSections(value) {
    const text = cleanWritingFeedback(value);
    if (!text) return [];
    const sections = [];
    let current = null;
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      const heading = line.match(/^#{2,5}\s+(?:\*\*)?(.+?)(?:\*\*)?\s*$/);
      const title = String(heading?.[1] || '').replace(/\*\*/g, '').trim();
      if (heading && /^\d+\.\s+/.test(title)) {
        if (current) sections.push({ title: current.title, body: current.body.join('\n').trim() });
        current = { title, body: [] };
        continue;
      }
      if (heading && /KẾT LUẬN/i.test(title)) {
        if (current) sections.push({ title: current.title, body: current.body.join('\n').trim() });
        current = null;
        break;
      }
      if (current) current.body.push(rawLine);
    }
    if (current) sections.push({ title: current.title, body: current.body.join('\n').trim() });
    return sections;
  }
function writingCriterionFallbackSummary(value) {
    const cleaned = cleanWritingFeedback(value);
    const beforeConclusion = cleaned.split(/^#{2,5}\s+(?:\*\*)?KẾT LUẬN/im)[0];
    return beforeConclusion
      .replace(/^#{1,5}\s+.*$/gm, '')
      .replace(/^\s*\*\*[^\n]*Band[^\n]*\*\*\s*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
function appendWritingComponent(parent, component, section, index, criterionCode, taskNumber) {
    const aspect = document.createElement('section');
    aspect.className = 'writing-component';
    const title = document.createElement('h5');
    title.textContent = section?.title || `${index + 1}. ${component?.label || component?.code || 'Khía cạnh'}`;
    aspect.append(title);

    const summaryValue = cleanWritingFeedback(component?.summary || section?.body || '');
    if (summaryValue) {
      const summary = document.createElement('div');
      summary.className = 'writing-component-summary writing-feedback-richtext';
      appendSafeWritingFeedback(summary, summaryValue);
      aspect.append(summary);
    }

    const detailValue = cleanWritingFeedback(component?.feedback || '');
    if (detailValue) {
      const detailId = `writingDetail${taskNumber}${criterionCode}${index}`;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'writing-component-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', detailId);
      toggle.textContent = 'Xem phân tích chi tiết và cách cải thiện';
      const detail = document.createElement('div');
      detail.id = detailId;
      detail.className = 'writing-component-detail writing-feedback-richtext';
      detail.hidden = true;
      appendSafeWritingFeedback(detail, detailValue);
      toggle.addEventListener('click', () => {
        const willOpen = detail.hidden;
        detail.hidden = !willOpen;
        toggle.setAttribute('aria-expanded', String(willOpen));
        toggle.textContent = willOpen
          ? 'Thu gọn phân tích chi tiết'
          : 'Xem phân tích chi tiết và cách cải thiện';
      });
      aspect.append(toggle, detail);
    }
    parent.append(aspect);
  }
function openWritingFeedback(taskResult) {
    const taskNumber = Number(taskResult?.taskNumber);
    const task = Array.from(writingConfig?.tasks || []).find(item => item.id === `task${taskNumber}`);
    if (!task) return;
    const essayValue = state.drafts.writing[task.id] || '';
    const dialog = document.createElement('dialog');
    dialog.className = 'writing-feedback-dialog';
    dialog.setAttribute('aria-labelledby', `writingFeedbackTitle${taskNumber}`);

    const shell = document.createElement('div');
    shell.className = 'writing-feedback-shell';
    const header = document.createElement('header');
    header.className = 'writing-feedback-header';
    const headerCopy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.textContent = `Kết quả ${task.label}`;
    const title = document.createElement('h2');
    title.id = `writingFeedbackTitle${taskNumber}`;
    title.textContent = `${task.label} · Band ${formatBand(taskResult.taskScore)}`;
    const meta = document.createElement('p');
    meta.textContent = `${Number(taskResult.wordCount || countWords(essayValue))} từ · Chấm theo 4 tiêu chí IELTS`;
    headerCopy.append(eyebrow, title, meta);
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'writing-feedback-close';
    closeButton.setAttribute('aria-label', 'Đóng bài chấm Writing');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => dialog.close());
    header.append(headerCopy, closeButton);

    const layout = document.createElement('div');
    layout.className = 'writing-feedback-layout';
    const sourcePane = document.createElement('section');
    sourcePane.className = 'writing-feedback-source';
    const promptTitle = document.createElement('h3');
    promptTitle.textContent = 'Đề bài';
    const prompt = document.createElement('p');
    prompt.className = 'writing-feedback-prompt';
    prompt.textContent = task.prompt || '';
    sourcePane.append(promptTitle, prompt);
    if (task.followUp) {
      const followUp = document.createElement('p');
      followUp.className = 'writing-feedback-prompt';
      followUp.textContent = task.followUp;
      sourcePane.append(followUp);
    }
    // Chỉ Task 1 có hình đề; Task 2 bỏ hoàn toàn phần ảnh, kể cả dữ liệu cũ có giá trị.
    if (taskNumber === 1 && (typeof task.image === 'object' ? task.image?.src : task.image)) {
      const image = document.createElement('img');
      image.src = typeof task.image === 'object' ? task.image.src : task.image;
      image.alt = typeof task.image === 'object' && task.image.alt
        ? task.image.alt
        : `Hình minh họa ${task.label}`;
      image.className = 'writing-feedback-image';
      sourcePane.append(image);
    }
    const reportSummary = writingReportSummary(taskResult.report);
    if (reportSummary) {
      const reportTitle = document.createElement('h3');
      reportTitle.textContent = 'Nhận xét tổng hợp';
      const report = document.createElement('div');
      report.className = 'writing-feedback-text writing-feedback-richtext';
      appendSafeWritingFeedback(report, reportSummary);
      sourcePane.append(reportTitle, report);
    }
    const essayTitle = document.createElement('h3');
    essayTitle.textContent = 'Bài viết của học viên';
    const essay = document.createElement('div');
    essay.className = `writing-feedback-essay${essayValue.trim() ? '' : ' is-empty'}`;
    essay.lang = 'en';
    essay.textContent = essayValue.trim() || 'Chưa có nội dung bài viết.';
    sourcePane.append(essayTitle, essay);
    const scorePane = document.createElement('section');
    scorePane.className = 'writing-feedback-scores';
    const scoreTitle = document.createElement('h3');
    scoreTitle.textContent = 'Nhận xét theo tiêu chí';
    scorePane.append(scoreTitle);
    for (const criterion of Array.from(taskResult.criteria || [])) {
      const card = document.createElement('article');
      card.className = 'writing-criterion-card';
      const criterionHeader = document.createElement('header');
      const criterionName = document.createElement('h4');
      criterionName.textContent = criterion.name || criterionTitle(criterion.code, taskNumber);
      const criterionScore = document.createElement('strong');
      criterionScore.textContent = `Band ${formatBand(criterion.bandScore)}`;
      criterionHeader.append(criterionName, criterionScore);
      card.append(criterionHeader);
      const components = Array.from(criterion.components || []);
      const sections = writingCriterionSections(criterion.feedback);
      const componentCount = Math.max(components.length, sections.length);
      if (componentCount) {
        const componentList = document.createElement('div');
        componentList.className = 'writing-component-list';
        for (let index = 0; index < componentCount; index += 1) {
          const section = sections[index] || (components.length === 1
            ? { body: writingCriterionFallbackSummary(criterion.feedback) }
            : null);
          appendWritingComponent(componentList, components[index], section, index, criterion.code, taskNumber);
        }
        card.append(componentList);
      } else {
        const feedback = document.createElement('div');
        feedback.className = 'writing-feedback-text writing-feedback-richtext';
        appendSafeWritingFeedback(feedback, writingCriterionFallbackSummary(criterion.feedback));
        card.append(feedback);
      }
      {
        const conclusion = writingCriterionConclusion(criterion.feedback);
        if (conclusion) {
          const conclusionBlock = document.createElement('div');
          conclusionBlock.className = 'writing-feedback-text writing-feedback-richtext';
          const conclusionTitle = document.createElement('h5');
          conclusionTitle.textContent = 'Kết luận và giới hạn điểm';
          conclusionBlock.append(conclusionTitle);
          appendSafeWritingFeedback(conclusionBlock, conclusion);
          card.append(conclusionBlock);
        }
      }
      scorePane.append(card);
    }
    layout.append(sourcePane, scorePane);
    shell.append(header, layout);
    dialog.append(shell);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    document.body.append(dialog);
    dialog.showModal();
  }
return {open:openWritingFeedback};
}

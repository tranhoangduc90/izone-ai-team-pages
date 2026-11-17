(() => {
  const testSlug = 'term-test-1';
  const classCode = 'IC2304';
  const query = new URLSearchParams(location.search);
  if (query.get('class')?.trim().toUpperCase() !== classCode || query.has('retakeGrant')) return;

  const endpoint = 'https://ducizone.ddns.net/webhook/k67-term1-standalone-writing-review-v1';
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  const codes = ['TR', 'CC', 'LR', 'GRA'];
  const formatScore = value => new Intl.NumberFormat('vi-VN', {minimumFractionDigits: 1}).format(value);
  let activeRequest;
  let review;
  let reopenButton;
  let requestedRef;
  let missingRef;

  const element = (tag, text = '', className = '') => {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  };

  function appendFeedback(target, text) {
    if (!text) return;
    if (!/<[a-z][^>]*>/i.test(text)) {
      target.append(element('p', text, 'standalone-writing-text'));
      return;
    }
    const template = document.createElement('template');
    template.innerHTML = text;
    const allowed = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'BLOCKQUOTE',
      'H3', 'H4', 'H5', 'H6', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
    const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'SVG', 'OBJECT', 'IMG', 'FORM', 'TEMPLATE']);
    function copy(from, to) {
      for (const child of from.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          to.append(document.createTextNode(child.textContent));
        } else if (child.nodeType === Node.ELEMENT_NODE && !blocked.has(child.tagName)) {
          if (allowed.has(child.tagName)) {
            const safe = element(child.tagName.toLowerCase());
            copy(child, safe);
            to.append(safe);
          } else {
            copy(child, to);
          }
        }
      }
    }
    copy(template.content, target);
  }

  function clear() {
    activeRequest?.abort();
    activeRequest = null;
    requestedRef = null;
    if (review?.open) review.close();
    review?.remove();
    reopenButton?.remove();
    review = null;
    reopenButton = null;
  }

  function show(result, picker) {
    review = element('dialog', '', 'panel result-panel standalone-writing-dialog');
    review.setAttribute('aria-labelledby', 'standaloneWritingHeading');
    const title = element('h2', result.studentName + ' · Writing Task 2');
    title.id = 'standaloneWritingHeading';
    const close = element('button', 'Đóng kết quả', 'button button-secondary');
    close.type = 'button';
    close.addEventListener('click', () => review?.close());
    reopenButton = element('button', 'Xem kết quả Writing', 'button button-secondary');
    reopenButton.type = 'button';
    reopenButton.addEventListener('click', () => review?.showModal());
    review.addEventListener('close', () => reopenButton?.focus());
    picker.after(reopenButton);
    const intro = element('p', 'Điểm Writing ' + formatScore(result.score) + '/9 · ' + result.wordCount + ' từ');
    const essay = element('p', result.essay, 'standalone-writing-text');
    essay.lang = 'en';
    review.append(close, title, intro, element('h3', 'Đề bài'), element('p', result.prompt, 'standalone-writing-text'),
      element('h3', 'Bài viết của em'), essay, element('h3', 'Nhận xét theo tiêu chí'));
    for (const criterion of result.criteria) {
      const card = element('details');
      card.append(element('summary', (({TR:'Đáp ứng đề bài', CC:'Mạch lạc và liên kết',
        LR:'Từ vựng', GRA:'Ngữ pháp'})[criterion.code]) + ' · ' + formatScore(criterion.bandScore)));
      appendFeedback(card, criterion.feedback);
      for (const component of criterion.components || []) {
        card.append(element('h4', component.label || component.code));
        appendFeedback(card, component.summary);
        appendFeedback(card, component.feedback);
      }
      review.append(card);
    }
    review.append(element('h3', 'Nhận xét tổng hợp'));
    appendFeedback(review, result.report);
    document.body.append(review);
    review.showModal();
  }

  async function open(studentRef, studentName, picker) {
    if (!uuid.test(studentRef) || picker?.value !== studentRef || missingRef === studentRef || navigator.onLine === false) return false;
    if (requestedRef === studentRef && review) {
      if (!review.open) review.showModal();
      return true;
    }
    clear();
    requestedRef = studentRef;
    const request = new AbortController();
    activeRequest = request;
    const timeout = setTimeout(() => request.abort(), 3500);
    try {
      const response = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({testSlug, classCode, studentRef, identityConfirmed:true}),
        cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer', signal:request.signal});
      if (activeRequest !== request || picker.value !== studentRef) return false;
      if (response.status === 404) missingRef = studentRef;
      if (!response.ok) return false;
      const data = await response.json();
      const result = data.result;
      if (activeRequest !== request || picker.value !== studentRef || !data.ok ||
          result?.testSlug !== testSlug || result.classCode !== classCode || result.taskNumber !== 2 ||
          result.studentRef !== studentRef || result.studentName !== studentName ||
          !Number.isFinite(result.score) || typeof result.essay !== 'string' || !Array.isArray(result.criteria) ||
          result.criteria.map(item => item.code).join() !== codes.join() ||
          !result.criteria.every(item => Number.isFinite(item.bandScore))) return false;
      show(result, picker);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
      if (activeRequest === request) activeRequest = null;
    }
  }

  document.addEventListener('change', event => {
    if (event.target.id === 'bootstrapStudent' && event.target.value !== requestedRef) clear();
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest('#bootstrap-change-remembered-student')) clear();
  }, true);
  window.addEventListener('pagehide', clear);
  window.K67_STANDALONE_WRITING = {open};
})();

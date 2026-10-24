// Presentation only: preserve the invoked Homework control across async redraws.
// No API calls, payload changes, storage writes or Test focus changes.
(() => {
  const enabled = () => document.documentElement.dataset.izoneTheme === 'master170'
    && document.body.dataset.m170Product === 'writing-flow' && document.body.dataset.kind === 'homework';
  let origin = null, frame = 0, restoring = false, manualAttempt = null, feedback = null;
  const classAttempts = new Map(), classMessages = new Map();
  const visible = element => element?.isConnected && !element.disabled && element.getClientRects().length
    && getComputedStyle(element).visibility !== 'hidden';
  const scope = () => JSON.stringify([location.hash, document.querySelector('#flow-views [data-view][aria-pressed="true"]')?.dataset.view,
    ...['flow-class','flow-teacher','flow-task-type','flow-stage-status','flow-list-status','flow-search','flow-search-scope','flow-date-from','flow-date-to']
      .map(id => [id,document.getElementById(id)?.value])]);
  function classControl(button) {
    const host = button?.closest('[data-m170-class-key]');
    const root = host?.closest('#flow-classes,#flow-class-coverage,#flow-mapping-coverage');
    if (!root || !host.dataset.m170ClassKey) return null;
    const label = button.textContent.trim();
    const action = /^Quét(?: lớp)? ngay$/.test(label) ? 'scan' : /^(Ghim lớp|Bỏ ghim)$/.test(label) ? 'pin' : null;
    return action && {classKey: host.dataset.m170ClassKey, classRoot: root.id, classAction: action};
  }
  function classHost(identity) {
    return [...(document.getElementById(identity.classRoot)?.querySelectorAll('[data-m170-class-key]') || [])]
      .find(e => e.dataset.m170ClassKey === identity.classKey);
  }
  function classButton(identity) {
    return [...(classHost(identity)?.querySelectorAll('button') || [])]
      .find(e => classControl(e)?.classAction === identity.classAction);
  }
  function releaseMirrors(attempt) {
    for (const button of attempt.mirrors) if (button.disabled) button.disabled = false;
    attempt.mirrors.clear();
  }
  function syncClassUI() {
    if (!enabled() || !visible(document.getElementById('flow-dashboard'))) {
      for (const attempt of classAttempts.values()) { releaseMirrors(attempt); attempt.observer.disconnect(); }
      classAttempts.clear(); classMessages.clear();
    }
    for (const [key, attempt] of classAttempts) {
      const pending = attempt.button.disabled;
      const message = attempt.button.dataset.m170ClassFeedback;
      if (message && attempt.scope === scope()) classMessages.set(key, {...attempt, message});
      if (pending) {
        attempt.started = true;
        for (const host of document.querySelectorAll('[data-m170-class-key]')) {
          if (host.dataset.m170ClassKey !== attempt.classKey) continue;
          for (const button of host.querySelectorAll('button')) {
            if (button !== attempt.button && classControl(button)?.classAction === 'scan' && !button.disabled) {
              button.disabled = true; attempt.mirrors.add(button);
            }
          }
        }
      } else if (attempt.started || !attempt.button.isConnected || attempt.scope !== scope()) {
        releaseMirrors(attempt); attempt.observer.disconnect(); classAttempts.delete(key);
      }
    }
    for (const [key, message] of classMessages) {
      if (!enabled() || message.scope !== scope()) { classMessages.delete(key); continue; }
      const host = classHost(message);
      if (!host) continue;
      let paragraph = host.querySelector('.m170-flow-class-feedback');
      if (!paragraph) { paragraph = document.createElement('p'); paragraph.className = 'm170-flow-class-feedback'; host.append(paragraph); }
      const success = message.message.startsWith('Đã xếp lớp ');
      if (paragraph.getAttribute('role') !== (success ? 'status' : 'alert')) paragraph.setAttribute('role', success ? 'status' : 'alert');
      if (paragraph.dataset.state !== (success ? 'success' : 'error')) paragraph.dataset.state = success ? 'success' : 'error';
      if (paragraph.textContent !== message.message) paragraph.textContent = message.message;
    }
    for (const paragraph of document.querySelectorAll('.m170-flow-class-feedback')) {
      const host = paragraph.closest('[data-m170-class-key]');
      const root = host?.closest('#flow-classes,#flow-class-coverage,#flow-mapping-coverage');
      if (!root || !classMessages.has(root.id + ':' + host.dataset.m170ClassKey)) paragraph.remove();
    }
    schedule();
  }
  function trackClassScan(button, identity) {
    const key = identity.classRoot + ':' + identity.classKey;
    classMessages.delete(key); classHost(identity)?.querySelector('.m170-flow-class-feedback')?.remove();
    const previous = classAttempts.get(key);
    if (previous) { releaseMirrors(previous); previous.observer.disconnect(); }
    delete button.dataset.m170ClassFeedback;
    const attempt = {...identity, button, scope: scope(), mirrors: new Set(), started: false};
    attempt.observer = new MutationObserver(syncClassUI);
    attempt.observer.observe(button, {attributes: true, attributeFilter: ['disabled','data-m170-class-feedback']});
    classAttempts.set(key, attempt);
    queueMicrotask(syncClassUI);
  }
  function remember(button) {
    if (!enabled() || !button) { origin = null; return; }
    if (button.matches('#flow-manual-form button[type="submit"]')) {
      origin = {element: button, manual: true, scope: scope()};
    } else if (classControl(button)) {
      const identity = classControl(button);
      origin = {element: button, ...identity, scope: scope()};
      if (identity.classAction === 'scan') trackClassScan(button, identity);
    } else {
      const row = button.closest('#flow-pairs tr[data-m170-focus-key]');
      origin = row && button.closest('.flow-actions')
        ? {element: button, key: row.dataset.m170FocusKey, label: button.textContent, scope: scope()} : null;
    }
    schedule();
  }
  function restore() {
    frame = 0;
    if (!origin) return;
    if (!enabled() || origin.scope !== scope() || !visible(document.getElementById('flow-dashboard'))) { origin = null; return; }
    if (document.activeElement !== document.body || !document.hasFocus()) return;
    const dialog = document.querySelector('dialog[open]');
    let target;
    if (origin.classKey) {
      if (dialog) return;
      target = classButton(origin);
      if (!target && !document.getElementById('flow-updated')?.textContent.startsWith('Đang ')) target = document.getElementById('flow-search-button');
    } else if (origin.manual) {
      if (dialog?.id !== 'flow-manual-dialog') { origin = null; return; }
      target = origin.element;
    } else {
      if (dialog) return;
      if (visible(origin.element)) target = origin.element;
      else {
        const row = [...document.querySelectorAll('#flow-pairs tr[data-m170-focus-key]')]
          .find(e => e.dataset.m170FocusKey === origin.key);
        if (row) target = [...row.querySelectorAll('.flow-actions button')].find(e => visible(e) && e.textContent === origin.label)
          || [...row.querySelectorAll('.flow-action-select,.flow-actions button')].find(visible);
        else if (!document.getElementById('flow-updated')?.textContent.startsWith('Đang ')) target = document.getElementById('flow-search-button');
      }
    }
    if (!visible(target)) return;
    origin.element = target;
    restoring = true;
    try { target.focus({preventScroll: true}); target.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'}); }
    finally { restoring = false; }
  }
  function schedule() { if (origin && !frame) frame = requestAnimationFrame(restore); }
  function removeFeedback() { feedback?.remove(); feedback = null; }
  function syncFeedback() {
    const dialog = document.getElementById('flow-manual-dialog');
    if (!enabled() || !dialog?.open) { removeFeedback(); manualAttempt = null; return; }
    if (!manualAttempt || manualAttempt.scope !== scope() || manualAttempt.button.disabled) return;
    const message = document.getElementById('flow-error')?.textContent || '';
    if (!message.startsWith('Chưa thêm được file:')) return;
    if (!feedback) {
      feedback = document.createElement('p'); feedback.className = 'm170-flow-manual-feedback'; feedback.setAttribute('role','alert');
      manualAttempt.button.before(feedback);
    }
    if (feedback.textContent !== message) feedback.textContent = message;
  }
  document.addEventListener('pointerdown', event => { if (!origin || event.target !== origin.element) origin = null; }, true);
  document.addEventListener('click', event => remember(event.target.closest?.('button')), true);
  document.addEventListener('submit', event => {
    if (event.target.id === 'flow-manual-form') {
      remember(event.submitter);
      if (enabled() && event.submitter) { manualAttempt = {button: event.submitter, scope: scope()}; removeFeedback(); }
    }
  }, true);
  document.addEventListener('focusin', event => { if (!restoring && origin && event.target !== origin.element && event.target !== document.body) origin = null; }, true);
  document.addEventListener('input', () => { origin = null; }, true);
  document.addEventListener('change', () => { origin = null; }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Tab') origin = null; }, true);
  window.addEventListener('hashchange', () => { origin = null; });
  new MutationObserver(() => { syncClassUI(); syncFeedback(); schedule(); }).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['disabled','hidden','open','data-kind']});
})();

// Preserve the recording control's focus through modal chains and table redraws.
// This presentation adapter never calls an API or changes a recording value.
(() => {
  if (document.body.dataset.m170Product !== 'recordings') return;
  let origin = null, pending = false, restoring = false, frame = 0;
  const selector = '[data-edit-id],button[data-action][data-id]';
  const control = element => element?.closest?.(selector);
  const visible = element => element && !element.disabled && element.getClientRects().length;
  function remember(element) {
    const target = control(element);
    if (!target || target.closest('dialog')) return false;
    origin = { element: target, id: target.dataset.editId || target.dataset.id,
      edit: target.hasAttribute('data-edit-id'), action: target.dataset.action };
    return true;
  }
  function restore() {
    frame = 0;
    if (!pending || !origin || document.activeElement !== document.body
        || !document.hasFocus() || document.querySelector('dialog[open]')) return;
    const candidates = [...document.querySelectorAll(selector)].filter(visible);
    const sameRecord = element => (element.dataset.editId || element.dataset.id) === origin.id;
    const target = visible(origin.element) && origin.element.isConnected ? origin.element
      : candidates.find(element => sameRecord(element)
          && element.hasAttribute('data-edit-id') === origin.edit
          && element.dataset.action === origin.action)
        || candidates.find(sameRecord) || document.getElementById('refreshButton');
    if (!visible(target)) return;
    restoring = true;
    try { target.focus({ preventScroll: true }); } finally { restoring = false; }
  }
  function schedule() { if (!frame && pending) frame = requestAnimationFrame(restore); }
  document.addEventListener('focusin', event => {
    if (restoring || event.target.closest('dialog') || event.target === document.body) return;
    pending = false;
    if (!remember(event.target)) origin = null;
  });
  document.addEventListener('pointerdown', event => {
    if (event.target.closest('dialog')) return;
    pending = false;
    if (!remember(event.target)) origin = null;
  }, true);
  document.addEventListener('change', event => { remember(event.target); }, true);
  document.addEventListener('close', event => {
    if (!(event.target instanceof HTMLDialogElement)) return;
    pending = Boolean(origin);
    schedule();
  }, true);
  new MutationObserver(schedule).observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden']
  });
})();

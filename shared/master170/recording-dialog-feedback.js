// Keep the native error beside the form that sent the request. No API or data writes.
(() => {
  if (document.documentElement.dataset.izoneTheme !== 'master170'
      || document.body.dataset.m170Product !== 'recordings') return;
  const contexts = new WeakMap();
  function clear(form) {
    const notice = form.querySelector('[data-m170-dialog-feedback]');
    if (notice) { notice.textContent = ''; notice.hidden = true; }
  }
  function invalidate(records) {
    for (const record of records) {
      if (!record.target.matches('#renameDialog, #playlistDialog')) continue;
      const form = record.target.querySelector('form');
      contexts.delete(form);
      clear(form);
    }
  }
  const observer = new MutationObserver(invalidate);
  for (const dialog of document.querySelectorAll('#renameDialog, #playlistDialog')) {
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }
  function current(context) {
    invalidate(observer.takeRecords());
    return context && context.dialog.open && contexts.get(context.form) === context
      && context.record.value === context.id;
  }
  window.recordingDialogFeedback = {
    begin(form) {
      invalidate(observer.takeRecords());
      const dialog = form.closest('dialog'), record = form.querySelector('input[type="hidden"]');
      if (!dialog?.open || !record) return;
      clear(form);
      const context = { form, dialog, record, id: record.value };
      contexts.set(form, context);
      return context;
    },
    error(context, message) {
      if (!current(context)) return;
      let notice = context.form.querySelector('[data-m170-dialog-feedback]');
      if (!notice) {
        notice = document.createElement('p');
        notice.dataset.m170DialogFeedback = '';
        notice.setAttribute('role', 'alert');
        context.form.querySelector('.dialog-actions').before(notice);
      }
      notice.textContent = message;
      notice.hidden = false;
    },
    finish(context, button) {
      requestAnimationFrame(() => {
        if (current(context) && document.activeElement === document.body
            && document.hasFocus() && button.isConnected && !button.disabled) {
          button.focus({ preventScroll: true });
          button.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        }
      });
    },
  };
})();

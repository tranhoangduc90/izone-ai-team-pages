(function () {
  'use strict';
  const query = new URLSearchParams(location.search);
  const config = window.TERM_TEST_CONFIG;
  if (!config || window.TERM_TEST_APP_CONFIG?.AUTH_MODE !== 'online-demo'
      || query.get('demo') !== 'exam' || query.get('grading') !== 'server') return;
  const suffix = query.get('grading') === 'server' ? ':server-grade' : '';
  const keys = ['RETAKE-LOBBY', 'K67A', 'K67B', 'K67C'].flatMap(namespace =>
    ['izone-test:', 'izone-test-ui:', 'izone-test-annotations:']
      .map(prefix => prefix + config.slug + ':' + namespace + suffix));
  const signalKey = 'izone-demo-reset:' + config.slug + ':RETAKE-LOBBY' + suffix;
  const root = document.getElementById('app');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'k56-reset-button';
  button.textContent = 'Reset dữ liệu';
  button.setAttribute('aria-haspopup', 'dialog');
  const dialog = document.createElement('dialog');
  dialog.className = 'k56-reset-dialog';
  dialog.setAttribute('aria-labelledby', 'k56ResetTitle');
  dialog.innerHTML = '<h2 id="k56ResetTitle">Reset dữ liệu?</h2><p class="k56-reset-summary"></p><p>Bài làm, thời gian, đánh dấu câu và Highlight/Note của lượt demo hiện tại sẽ bị xóa, không thể khôi phục. Các bài test khác giữ nguyên.</p><p class="k56-reset-error" role="alert" hidden></p><div class="k56-reset-actions"><button type="button" data-reset-cancel>Hủy</button><button type="button" data-reset-confirm>Reset và làm lại</button></div>';
  document.body.append(dialog);
  const confirm = dialog.querySelector('[data-reset-confirm]');
  const cancel = dialog.querySelector('[data-reset-cancel]');
  const error = dialog.querySelector('.k56-reset-error');
  function mount() {
    const header = root.querySelector('.topbar') || root.querySelector('header');
    if (header) {
      header.classList.add('k56-reset-header');
      if (button.parentElement !== header) header.append(button);
    }
  }
  mount();
  new MutationObserver(mount).observe(root, {childList:true, subtree:true});
  button.addEventListener('click', () => {
    error.hidden = true;
    confirm.disabled = false;
    dialog.querySelector('.k56-reset-summary').textContent = config.title + ' · Toàn bộ 3 lớp demo';
    dialog.showModal();
    cancel.focus();
  });
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => button.focus());
  function clearAndReload(broadcast) {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of keys) storage.removeItem(key);
      if (keys.some(key => storage.getItem(key) !== null)) throw new Error('STORAGE_NOT_CLEARED');
    }
    // Reset các tab cùng bài để bản nháp cũ không ghi trở lại dữ liệu vừa xóa.
    if (broadcast) localStorage.setItem(signalKey, String(Date.now()) + ':' + Math.random());
    const url = new URL(location.href);
    url.searchParams.delete('demoStudent');
    url.searchParams.delete('demoAttempt');
    url.searchParams.delete('class');
    url.searchParams.set('reset', '1');
    history.replaceState(null, '', location.href);
    location.replace(url.href);
  }
  confirm.addEventListener('click', () => {
    confirm.disabled = true;
    try { clearAndReload(true); }
    catch {
      error.textContent = 'Chưa reset được đầy đủ. Hãy cho phép lưu trữ của trang rồi thử lại.';
      error.hidden = false;
      confirm.disabled = false;
    }
  });
  window.addEventListener('storage', event => {
    if (event.key !== signalKey || !event.newValue) return;
    try { clearAndReload(false); }
    catch {
      if (!dialog.open) dialog.showModal();
      error.textContent = 'Lượt này đã được reset ở tab khác. Hãy đóng tab này để tránh dùng bài làm cũ.';
      error.hidden = false;
    }
  });
}());

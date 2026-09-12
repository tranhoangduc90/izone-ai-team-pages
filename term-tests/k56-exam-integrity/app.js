(function () {
  'use strict';

  let noticeTimer = 0;

  function showBlockedNotice() {
    let notice = document.querySelector('.k56-find-blocked-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.className = 'k56-find-blocked-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      document.body.append(notice);
    }
    notice.textContent = 'Tính năng tìm kiếm trong trang đã bị khóa trong thời gian làm bài.';
    notice.classList.add('is-visible');
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => notice.classList.remove('is-visible'), 2800);
  }

  function isFindShortcut(event) {
    const key = String(event.key || '').toLowerCase();
    const commandKey = event.ctrlKey || event.metaKey;
    return key === 'f3' || (commandKey && (key === 'f' || key === 'g'));
  }

  document.addEventListener('keydown', event => {
    if (!isFindShortcut(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showBlockedNotice();
  }, true);
}());

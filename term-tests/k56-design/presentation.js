/* Chỉ trình bày: không API, storage, deadline, submit hoặc nhân bản control. */
(() => {
  'use strict';
  if (!document.body.hasAttribute('data-k56-design')) return;
  const logo = new URL('./assets/izone-logo-color.png', document.currentScript.src).href;
  let lastOutsideFocus = document.activeElement;
  document.addEventListener('focusin', event => {
    if (!event.target.closest('dialog')) lastOutsideFocus = event.target;
  });

  function decorateHeader() {
    const header = document.querySelector('.topbar');
    if (!header || header.querySelector('.k56-brand')) return;
    const brand = document.createElement('span');
    brand.className = 'k56-brand';
    const image = document.createElement('img');
    image.src = logo;
    image.alt = 'IZONE · IELTS Chiến lược';
    brand.append(image);
    header.prepend(brand);
  }

  function decorateReadOnlyDialogs() {
    document.querySelectorAll('.attempt-review-dialog,.writing-feedback-dialog,.teacher-saved-progress-dialog').forEach(dialog => {
      if (dialog.dataset.k56Dialog) return;
      dialog.dataset.k56Dialog = 'true';
      const opener = lastOutsideFocus;
      let pressedOutside = false, releasedOutside = false, pointerId = null;
      const closeDialog = () => {
        // Bản lưu có timer riêng: dùng nút của owner để dọn đúng vòng đời.
        if (dialog.classList.contains('teacher-saved-progress-dialog')) dialog.querySelector('header button')?.click();
        else dialog.close();
      };
      const outside = event => {
        const rect = dialog.getBoundingClientRect();
        return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
      };
      dialog.addEventListener('pointerdown', event => {
        pressedOutside = event.isPrimary && event.button === 0 && outside(event);
        releasedOutside = false;
        pointerId = event.pointerId;
      }, true);
      dialog.addEventListener('pointerup', event => {
        releasedOutside = pressedOutside && pointerId === event.pointerId && outside(event);
        pressedOutside = false; pointerId = null;
      }, true);
      dialog.addEventListener('pointercancel', () => { pressedOutside = releasedOutside = false; pointerId = null; }, true);
      // Chặn listener click cũ coi nhả chuột ngoài sau chọn chữ là backdrop click.
      dialog.addEventListener('click', event => {
        if (event.target === dialog) {
          event.stopImmediatePropagation();
          if (releasedOutside) closeDialog();
        }
        releasedOutside = false;
      }, true);
      dialog.addEventListener('close', () => {
        if (opener?.isConnected && typeof opener.focus === 'function') opener.focus({preventScroll:true});
      }, {once:true});
    });
  }

  let scheduled = false;
  function update() {
    scheduled = false;
    decorateHeader(); decorateReadOnlyDialogs();
    document.querySelectorAll('.cbt-nav-legend').forEach(legend => {
      const text = 'Nền navy: đang chọn · Nền nhạt: đã làm · Gạch vàng: cần xem lại';
      if (legend.textContent !== text) legend.textContent = text;
    });
  }
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  });
  const observe = () => observer.observe(document.body, {childList:true,subtree:true});
  observe();
  window.addEventListener('pagehide', () => observer.disconnect());
  window.addEventListener('pageshow', () => { observe(); update(); });
  update();
})();

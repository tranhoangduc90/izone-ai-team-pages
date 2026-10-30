/* Chỉ trình bày Substitute: giữ nguyên control, handler, nháp và định danh.
   Mẫu: thanh công cụ native Term K67; không nạp/sửa engine của Term. */
(() => {
  const root = document.getElementById('app');
  if (!root || !/^substitute-test-[12]-k(?:56|67)$/.test(window.TERM_TEST_CONFIG?.slug || '')) return;
  document.body.dataset.substituteExamControls = 'k67';
  let frame = 0;
  const widths = new WeakMap();
  const navSize = new ResizeObserver(entries => {
    for (const {target: nav} of entries) {
      const old = widths.get(nav), width = nav.clientWidth;
      widths.set(nav, width);
      if (old !== undefined && old !== width) {
        const focused = nav.contains(document.activeElement) ? document.activeElement.closest('.cbt-question-button') : null;
        reveal({target: focused || nav.querySelector('.cbt-question-button.is-active')});
      }
    }
  });

  function arrange() {
    frame = 0;
    for (const skill of ['listening', 'reading']) {
      const form = document.getElementById(skill + 'View');
      if (!form) continue;
      const heading = form.querySelector('.cbt-test-heading');
      const controls = form.querySelector('.cbt-toolbar-controls');
      const actions = form.querySelector('.cbt-heading-actions');
      if (heading && controls && actions && controls.parentElement !== heading) heading.insertBefore(controls, actions);
      const audio = skill === 'listening' ? form.querySelector('.cbt-audio-card') : null;
      if (audio && heading && audio.parentElement !== heading) heading.insertBefore(audio, controls || actions);
      const count = window.TERM_TEST_CONFIG[skill]?.controls?.length;
      const title = document.getElementById(skill + 'Title');
      const label = (skill === 'listening' ? 'Listening' : 'Reading') + ' – ' + count + ' câu';
      if (title && count && title.textContent !== label) title.textContent = label;
      // Native K67 rút gọn Part; giữ phạm vi câu trong tên truy cập và tooltip.
      if (skill === 'listening') for (const button of form.querySelectorAll('.cbt-part-button')) {
        const full = button.textContent;
        const short = full.split(' · ')[0];
        if (/^Part \d+$/.test(short) && full !== short) {
          button.setAttribute('aria-label', full);
          button.title = full;
          button.textContent = short;
        }
      }
    }
    // K67 đã có bộ đo chiều cao native. Bổ sung cùng cách đo cho hai bài K56,
    // để hàng số câu không bị đẩy khỏi màn hình bởi min-height 680px cũ.
    if (window.TERM_TEST_CONFIG.slug.endsWith('-k56')) for (const form of root.querySelectorAll('#listeningView:not([hidden]),#readingView:not([hidden])')) {
      const top = form.getBoundingClientRect().top + window.scrollY;
      const height = Math.max(240, Math.floor(window.innerHeight - top - 12)) + 'px';
      if (form.style.getPropertyValue('--substitute-controls-height') !== height) form.style.setProperty('--substitute-controls-height', height);
      const nav = form.querySelector('.cbt-question-nav');
      if (nav && !widths.has(nav)) { widths.set(nav, nav.clientWidth); navSize.observe(nav); }
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(arrange); };
  const observer = new MutationObserver(schedule);
  observer.observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden']});
  const size = new ResizeObserver(schedule);
  size.observe(document.body);
  window.addEventListener('resize', schedule);
  // Hàng câu cuộn cục bộ; không cuộn trang hoặc hai vùng đề khi lấy focus.
  const reveal = event => {
    const button = event.target?.closest?.('.cbt-question-button');
    const nav = button?.closest('.cbt-question-nav');
    if (!nav) return;
    const b = button.getBoundingClientRect(), n = nav.getBoundingClientRect();
    if (n.width <= 0 || n.height <= 0) return;
    if (b.left < n.left) nav.scrollLeft -= n.left - b.left + 2;
    else if (b.right > n.right) nav.scrollLeft += b.right - n.right + 2;
  };
  root.addEventListener('focusin', reveal);
  arrange();
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    size.disconnect();
    navSize.disconnect();
    window.removeEventListener('resize', schedule);
    root.removeEventListener('focusin', reveal);
  }, {once: true});
})();

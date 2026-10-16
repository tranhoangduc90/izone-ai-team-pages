/* Nhận DOM của bộ thi production; chỉ gom nguyên node và đổi nhãn hiển thị.
   Không đổi API, storage, identity, thời gian, đáp án hoặc handler lưu/nộp.
   Khi mạng/lưu/audio lỗi, thông báo và nút phục hồi vẫn do bộ thi gốc quản lý. */
(() => {
  const root = document.getElementById('app');
  let queued = false;
  function arrange() {
    queued = false;
    for (const skill of ['listening', 'reading']) {
      const form = document.getElementById(skill + 'View');
      if (!form) continue;
      const heading = form.querySelector('.cbt-test-heading');
      const controls = form.querySelector('.cbt-toolbar-controls');
      const actions = form.querySelector('.cbt-heading-actions');
      if (heading && controls && actions && controls.parentElement !== heading) {
        heading.insertBefore(controls, actions);
      }
      const count = window.TERM_TEST_CONFIG?.[skill]?.controls?.length;
      const title = document.getElementById(skill + 'Title');
      const label = skill === 'listening' ? 'Listening' : 'Reading';
      if (title && count && title.textContent !== label + ' – ' + count + ' câu') {
        title.textContent = label + ' – ' + count + ' câu';
      }
      if (skill !== 'listening' || !heading) continue;
      for (const button of form.querySelectorAll('.cbt-part-button')) {
        const full = button.textContent;
        const short = full.split(' · ')[0];
        if (/^Part \d+$/.test(short) && full !== short) {
          button.setAttribute('aria-label', full);
          button.title = full;
          button.textContent = short;
        }
      }
      // Di chuyển cả card để giữ audio, volume và nút cứu audio gốc cùng handler.
      const card = form.querySelector('.cbt-audio-card');
      if (card && card.parentElement !== heading) heading.insertBefore(card, controls || actions);
    }
  }
  const observer = new MutationObserver(() => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(arrange);
    }
  });
  observer.observe(root, {subtree: true, childList: true});
  arrange();
  window.addEventListener('pagehide', () => observer.disconnect(), {once: true});
})();

(function () {
  'use strict';

  const query = new URLSearchParams(location.search);
  const classCode = String(query.get('class') || '').trim().toUpperCase();
  const testConfig = window.TERM_TEST_CONFIG;
  const appConfig = window.TERM_TEST_APP_CONFIG;
  const root = document.getElementById('app');
  if (classCode !== 'CODEXDEMO56' || !testConfig || !appConfig?.API_BASE_URL || !root) return;

  const signalKey = 'izone-demo-reset:class:CODEXDEMO56';
  const ownKey = /^(?:izone-test|izone-test-ui|izone-test-annotations|izone-demo-reset):(?:term-test-1-k56|term-test-2-k56|mini-test-k56):CODEXDEMO56(?::|$)/;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'k56-reset-button';
  button.textContent = 'Reset dữ liệu';
  button.disabled = false;
  button.title = 'Xóa lịch sử cả ba bài của toàn bộ lớp CODEXDEMO56';
  let resetting = false;

  function updateButton() {
    const header = root.querySelector('.topbar') || root.querySelector('header');
    if (header && button.parentElement !== header) {
      header.classList.add('k56-reset-header');
      header.append(button);
    }
    button.disabled = resetting;
  }

  function clearLocalAttemptData(generation) {
    for (const getStorage of [() => sessionStorage, () => localStorage]) {
      try {
        const storage = getStorage();
        const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
        for (const key of keys) if (ownKey.test(key)) storage.removeItem(key);
      } catch { /* Máy chủ vẫn đã reset nếu trình duyệt chặn storage. */ }
    }
    if (generation) {
      try { localStorage.setItem(signalKey, generation); } catch { /* Không tự gửi lại API. */ }
    }
  }

  function reloadFresh() {
    const url = new URL(location.href);
    url.searchParams.set('reset', '1');
    for (const name of ['attemptToken', 'examSessionToken', 'demoStudent', 'demoAttempt']) url.searchParams.delete(name);
    location.replace(url.href);
  }

  async function resetDemoClass() {
    if (resetting) return;
    if (!window.confirm('Xóa toàn bộ lịch sử Term Test 1, Term Test 2 và Mini Test của TẤT CẢ học viên CODEXDEMO56? Lớp thật, danh sách học viên, đề và điểm Portal giữ nguyên.')) return;

    resetting = true;
    window.K56_DEMO_RESETTING = true;
    button.disabled = true;
    button.textContent = 'Đang reset...';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${appConfig.API_BASE_URL}/api/term-tests/demo/reset-class`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode,
          confirmation: 'RESET_DEMO_CLASS'
        }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.message || `Lỗi HTTP ${response.status}`);
      if (payload.reset?.classCode !== classCode || payload.reset?.remaining !== 0 || !payload.reset?.generation) throw new Error('Phản hồi reset chưa xác nhận lớp demo đã sạch.');
      clearLocalAttemptData(payload.reset.generation);
      reloadFresh();
    } catch (error) {
      const message = error.name === 'AbortError'
        ? 'Máy chủ chưa xác nhận reset sau 30 giây. Không tự gửi lại; hãy tải lại trang và kiểm tra trước khi thử lại.'
        : `Không thể reset dữ liệu: ${error.message}`;
      window.alert(message);
      resetting = false;
      window.K56_DEMO_RESETTING = false;
      button.textContent = 'Reset dữ liệu';
      updateButton();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  button.addEventListener('click', resetDemoClass);
  new MutationObserver(updateButton).observe(root, { childList: true, subtree: true });
  window.addEventListener('storage', event => {
    if (event.key !== signalKey || !event.newValue) return;
    window.K56_DEMO_RESETTING = true;
    clearLocalAttemptData();
    reloadFresh();
  });
  window.addEventListener('pagehide', () => {
    if (window.K56_DEMO_RESETTING) clearLocalAttemptData();
  });
  updateButton();
}());

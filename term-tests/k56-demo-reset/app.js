(function () {
  'use strict';

  const query = new URLSearchParams(location.search);
  const classCode = String(query.get('class') || '').trim().toUpperCase();
  const testConfig = window.TERM_TEST_CONFIG;
  const appConfig = window.TERM_TEST_APP_CONFIG;
  const root = document.getElementById('app');
  if (classCode !== 'CODEXDEMO56' || !testConfig || !appConfig?.API_BASE_URL || !root) return;

  const suffix = query.get('grading') === 'server' ? ':server-grade' : '';
  const keys = ['izone-test:', 'izone-test-ui:', 'izone-test-annotations:']
    .map(prefix => `${prefix}${testConfig.slug}:CODEXDEMO56${suffix}`);
  const signalKey = `izone-demo-reset:${testConfig.slug}:CODEXDEMO56${suffix}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'k56-reset-button';
  button.textContent = 'Reset dữ liệu';
  button.disabled = true;

  function studentSelect() {
    return root.querySelector('#bootstrapStudent, #studentSelect');
  }

  function selectedStudent() {
    const select = studentSelect();
    const option = select?.selectedOptions?.[0];
    return select?.value ? { ref: select.value, name: option?.textContent?.trim() || 'học viên đã chọn' } : null;
  }

  function updateButton() {
    const header = root.querySelector('.topbar') || root.querySelector('header');
    if (header && button.parentElement !== header) {
      header.classList.add('k56-reset-header');
      header.append(button);
    }
    if (button.textContent !== 'Đang reset...') button.disabled = !selectedStudent();
  }

  function clearLocalAttemptData(broadcast) {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of keys) storage.removeItem(key);
    }
    if (broadcast) localStorage.setItem(signalKey, `${Date.now()}:${Math.random()}`);
  }

  async function resetSelectedStudent() {
    const student = selectedStudent();
    if (!student) return;
    if (!window.confirm(`Xóa toàn bộ dữ liệu ${testConfig.title} của ${student.name} để làm lại từ đầu?`)) return;

    button.disabled = true;
    button.textContent = 'Đang reset...';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${appConfig.API_BASE_URL}/api/term-tests/demo/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode,
          testSlug: testConfig.slug,
          studentRef: student.ref,
          confirmation: 'RESET_DEMO_STUDENT'
        }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.message || `Lỗi HTTP ${response.status}`);
      clearLocalAttemptData(true);
      location.reload();
    } catch (error) {
      const message = error.name === 'AbortError'
        ? 'Máy chủ chưa xác nhận reset sau 30 giây. Không tự gửi lại; hãy tải lại trang và kiểm tra trước khi thử lại.'
        : `Không thể reset dữ liệu: ${error.message}`;
      window.alert(message);
      button.textContent = 'Reset dữ liệu';
      updateButton();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  button.addEventListener('click', resetSelectedStudent);
  root.addEventListener('change', event => {
    if (event.target?.matches?.('#bootstrapStudent, #studentSelect')) updateButton();
  });
  new MutationObserver(updateButton).observe(root, { childList: true, subtree: true });
  window.addEventListener('storage', event => {
    if (event.key !== signalKey || !event.newValue) return;
    clearLocalAttemptData(false);
    location.reload();
  });
  updateButton();
}());

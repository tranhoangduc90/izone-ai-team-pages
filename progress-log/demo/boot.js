// Dữ liệu nhận vào: link cấp từ dashboard hoặc mã lượt thử còn hiệu lực.
// Việc chính: tạo/mở lại lượt thử, tự mở mọi phần cho giảng viên và cho làm lại trong kho riêng.
// Kết quả: tải cùng giao diện học viên với dữ liệu mẫu.
// Khi lỗi: hiện thông báo, không chuyển sang API thật.
const config = window.PROGRESS_LOG_CONFIG;
const notice = document.getElementById('notice');
const resetButton = document.getElementById('resetDemoButton');
const parameters = new URLSearchParams(window.location.hash.slice(1));
const grant = parameters.get('grant') || '';
const runToken = parameters.get('assignment') || '';

async function demoRequest(path, body, teacherToken = '') {
  const response = await fetch(`${config.API_BASE_URL}/api/demo/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-progress-log-demo': '1',
      ...(teacherToken ? { 'x-demo-teacher-token': teacherToken } : {}) },
    body: JSON.stringify(body), cache: 'no-store'
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'Bản thử chưa xử lý được yêu cầu.');
  return payload;
}

async function boot() {
  if (!grant && !runToken) throw new Error('Hãy mở bản thử từ dashboard giảng viên.');
  const payload = await demoRequest('runs', grant ? { grant } : { runToken });
  const run = payload.run;
  const storageKey = `progress-log-demo:teacher:${run.publicToken}`;
  let teacherToken = run.teacherToken || '';
  try {
    if (teacherToken) window.sessionStorage.setItem(storageKey, teacherToken);
    else teacherToken = window.sessionStorage.getItem(storageKey) || '';
  } catch { /* Trình duyệt chặn bộ nhớ tab: bài vẫn mở được. */ }
  const studentUrl = new URL(window.location.href);
  studentUrl.hash = new URLSearchParams({ assignment: run.publicToken }).toString();
  window.history.replaceState(null, '', studentUrl);
  if (teacherToken) {
    resetButton.hidden = false;
    // Mở phần trong lượt demo trước khi tải phiếu; lỗi hiện ở notice và dừng tải.
    await demoRequest('runs/open-blocks', {}, teacherToken);
    resetButton.addEventListener('click', async () => {
      resetButton.disabled = true;
      try {
        const next = await demoRequest('runs/reset', {}, teacherToken);
        try { window.sessionStorage.setItem(`progress-log-demo:teacher:${next.run.publicToken}`, next.run.teacherToken); }
        catch { /* Phiếu mới vẫn mở được. */ }
        window.history.replaceState(null, '', `#assignment=${encodeURIComponent(next.run.publicToken)}`);
        window.location.reload();
      } catch (error) { notice.textContent = error.message; resetButton.disabled = false; }
    });
  }
  await import('../app.js?rev=20261003-reference-production');
}

boot().catch(error => { notice.textContent = error.message; notice.classList.add('error'); });

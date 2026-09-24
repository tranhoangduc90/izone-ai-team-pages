const config = window.PROGRESS_LOG_CONFIG;
const notice = document.getElementById('notice');
const teacherLink = document.getElementById('demoTeacherLink');
const token = new URLSearchParams(window.location.hash.slice(1)).get('assignment') || '';

if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(token)) {
  notice.textContent = 'Link bản thử cần mã phiếu sau #assignment=.';
  notice.classList.add('error');
} else {
  try {
    const response = await fetch(`${config.API_BASE_URL}/api/demo/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-progress-log-demo': '1' },
      body: JSON.stringify({ sourceToken: token }), cache: 'no-store'
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'Không tạo được lượt thử.');
    const run = payload.run;
    const studentUrl = new URL(window.location.href);
    studentUrl.hash = new URLSearchParams({ assignment: run.publicToken }).toString();
    window.history.replaceState(null, '', studentUrl);
    const storageKey = `progress-log-demo:teacher:${run.publicToken}`;
    let teacherToken = run.teacherToken || '';
    try {
      if (teacherToken) window.sessionStorage.setItem(storageKey, teacherToken);
      else teacherToken = window.sessionStorage.getItem(storageKey) || '';
    } catch { /* Phiếu học viên vẫn dùng được khi trình duyệt chặn bộ nhớ tab. */ }
    if (teacherToken) {
      const teacherUrl = new URL('teacher.html', window.location.href);
      teacherUrl.hash = new URLSearchParams({ run: teacherToken }).toString();
      teacherLink.href = teacherUrl.toString();
      teacherLink.hidden = false;
    }
    await import('../app.js?rev=20260924-generic-demo-v1');
  } catch (error) {
    notice.textContent = error.message;
    notice.classList.add('error');
  }
}

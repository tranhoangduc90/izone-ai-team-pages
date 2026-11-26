const endpoint = 'https://izone-k56-login-reports.tranhoangduc90.workers.dev/v1/reports';
const access = new URLSearchParams(location.hash.slice(1)).get('case');
const scope = /^[A-Za-z0-9_-]{43}$/.test(access || '') ? access : null;

export function createAutoReport({ status, stop, notice, build, classCode }) {
  if (!scope) return { active: () => false, send: () => {} };
  let enabled = true;
  let revision = 0;
  const stopSignal = new AbortController();
  notice.hidden = false;
  stop.addEventListener('click', () => {
    enabled = false;
    stopSignal.abort();
    stop.hidden = true;
    status.textContent = 'Đã dừng gửi báo cáo. Bạn vẫn có thể xem kết quả trên máy.';
    history.replaceState(history.state, '', location.pathname + location.search);
  });
  async function send(data) {
    if (!enabled) return;
    const current = ++revision;
    const payload = JSON.stringify({ reportId: crypto.randomUUID(), build, classCode, ...data });
    status.textContent = 'Đang gửi báo cáo kỹ thuật…';
    for (const delay of [0, 1200, 3600]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (!enabled) return;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + scope },
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'error',
          keepalive: true,
          signal: AbortSignal.any([stopSignal.signal, AbortSignal.timeout(6500)]),
          body: payload
        });
        if (response.status === 204) {
          if (current === revision && enabled) status.textContent = 'Đã gửi báo cáo kỹ thuật.';
          return;
        }
        if (response.status === 401 || response.status === 403) {
          if (current === revision && enabled) status.textContent = 'Link gửi báo cáo đã hết hiệu lực. Bạn vẫn có thể xem báo cáo trên máy.';
          return;
        }
        if (response.status < 500 && response.status !== 429) break;
      } catch {
        if (!enabled) return;
      }
    }
    if (current === revision && enabled) {
      status.textContent = 'Chưa gửi được báo cáo. Bạn có thể tải hoặc sao chép ở bên dưới.';
    }
  }
  return { active: () => enabled, send };
}

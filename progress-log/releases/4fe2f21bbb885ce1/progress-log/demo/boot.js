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
const compact=window.parent!==window&&new URLSearchParams(location.search).get('view')==='worksheet';
if(compact)document.body.dataset.worksheetPreview='true';

async function demoRequest(path, body, teacherToken = '') {
  const response = await fetch(`${config.API_BASE_URL}/api/demo/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-progress-log-demo': '1',
      ...(teacherToken ? { 'x-demo-teacher-token': teacherToken } : {}) },
    body: JSON.stringify(body), cache: 'no-store'
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const trace=typeof payload?.traceId==='string'&&/^[a-f0-9-]{36}$/i.test(payload.traceId)?' Mã theo dõi '+payload.traceId+'.':'';
    throw Object.assign(new Error((payload?.message||'Bản thử chưa xử lý được yêu cầu.')+trace),{retryable:payload?.error!=='DEMO_SOURCE_MISMATCH'&&(response.status>=500||response.status===429)});
  }
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
    window.PROGRESS_LOG_CONFIG = Object.freeze({...config,DEMO_AUTO_STUDENT:true,DEMO_COMPACT_PREVIEW:compact});
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
  await import('/izone-ai-team-pages/progress-log/releases/4fe2f21bbb885ce1/progress-log/app.js');
}

boot().catch(error => {
  document.body.classList.remove('progress-starting');
  notice.textContent = error.message; notice.classList.add('error');
  if(compact&&error.retryable!==false){const retry=document.createElement('button');retry.type='button';retry.className='button';retry.textContent='Thử mở lại phiếu';retry.addEventListener('click',()=>location.reload());notice.append(' ',retry);}
});

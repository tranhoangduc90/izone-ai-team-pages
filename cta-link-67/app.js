import { parseDocLinks, checkedResults, requestBody } from './model.mjs';

const BASE = 'https://ducizone.ddns.net/operator/cta';
const labels = {
  queued: 'Đã gửi, đang xử lý',
  registered: 'Đã xác minh CTA',
  pending: 'Chưa thấy đăng ký CTA',
  source_not_found: 'Chưa tìm thấy bản nộp Classroom',
  source_ambiguous: 'Có nhiều bài nộp khớp',
  not_registered: 'Chưa thấy CTA đã xác minh',
  review: 'Cần đối soát CTA',
  legacy_owner: 'Lớp đang xử lý qua hệ thống cũ',
  invalid_url: 'Link không hợp lệ',
  duplicate: 'Link trùng',
  unknown: 'Cần đối soát'
};
const $ = (id) => document.getElementById(id);
let docs = [];
let rows = [];
let busy = false;

function setBusy(value) {
  busy = value;
  $('submit').disabled = value;
  $('check').disabled = value || !docs.length;
}
function notice(message, state = 'neutral') { $('notice').textContent = message; $('notice').dataset.state = state; }
function responseErrorMessage(error) {
  $('sign-in').hidden = error.status !== 401;
  if (error.status === 401) return 'Cần đăng nhập giảng viên IZONE.';
  if (error.status === 403) return 'Tài khoản này chưa có quyền vận hành CTA.';
  if (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message || '')) return 'Chưa kết nối được với hệ thống.';
  if (error instanceof SyntaxError) return 'Chưa đọc được phản hồi của hệ thống.';
  return error.message;
}
function render() {
  const box = $('results');
  box.replaceChildren();
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'result';
    item.dataset.state = row.status;
    const name = document.createElement('strong');
    name.textContent = row.docId || 'Dòng ' + row.line;
    const state = document.createElement('span');
    state.className = ['unknown', 'source_ambiguous', 'invalid_url'].includes(row.status) ? 'problem' : row.status === 'registered' ? 'good' : '';
    state.textContent = labels[row.status] || row.status;
    item.append(name, state);
    if (row.codes?.length) {
      const codes = document.createElement('div');
      codes.textContent = row.codes.join(' · ');
      item.append(codes);
    }
    box.append(item);
  }
  if (!rows.length) box.textContent = 'Chưa có file nào được gửi.';
}
async function request(action, batch) {
  $('sign-in').hidden = true;
  if (!(await window.IzoneTeacherSso.restore('k67-cta'))) {
    throw Object.assign(new Error('Cần đăng nhập giảng viên IZONE.'), { status: 401 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(BASE + '/' + action, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Izone-Csrf': '1' },
      body: requestBody(batch),
      signal: controller.signal
    });
    if (!response.ok) throw Object.assign(new Error('Hệ thống xử lý trả lỗi ' + response.status + '.'), { status: response.status });
    return checkedResults(await response.json(), batch);
  } finally { clearTimeout(timer); }
}
function unknownRows(batch) {
  return batch.map((doc) => ({ docId: doc.docId, status: 'unknown' }));
}
$('submit').addEventListener('click', async () => {
  if (busy) return;
  try {
    const parsed = parseDocLinks($('links').value);
    docs = parsed.docs;
    rows = parsed.errors;
    render();
    if (!docs.length) { notice('Không có link Docs hợp lệ để gửi.', 'error'); return; }
    setBusy(true);
    notice('Đang tìm bài nộp và gửi từng file vào hàng chờ…', 'pending');
    try { rows = [...parsed.errors, ...await request('submit', docs)]; notice('Đã nhận kết quả gửi. Bấm “Kiểm tra kết quả” để đọc lại trạng thái.'); }
    catch (error) { rows = [...parsed.errors, ...unknownRows(docs)]; notice(error.name === 'AbortError' ? 'Hết thời gian chờ; kiểm tra kết quả trước khi gửi lại.' : responseErrorMessage(error) + ' Kiểm tra kết quả trước khi gửi lại.', 'attention'); }
    render();
  } catch (error) { notice(error.message, 'error'); }
  finally { setBusy(false); }
});
$('check').addEventListener('click', async () => {
  if (busy || !docs.length) return;
  setBusy(true);
  notice('Đang đọc lại các CTA đã xác minh…', 'pending');
  try {
    const latest = await request('status', docs);
    const byId = new Map(latest.map((row) => [row.docId, row]));
    rows = rows.map((row) => row.status === 'duplicate' ? row : (byId.get(row.docId) || row));
    notice('Đã cập nhật trạng thái.');
    render();
  } catch (error) { notice((error.name === 'AbortError' ? 'Hết thời gian chờ; thử kiểm tra lại.' : responseErrorMessage(error)) + ' Trạng thái đang hiển thị chưa được cập nhật.', 'attention'); }
  finally { setBusy(false); }
});

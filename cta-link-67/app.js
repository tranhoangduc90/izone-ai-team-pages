import { parseDocLinks, checkedResults } from './model.mjs';
import { signedBody } from './auth.mjs';

const BASE = 'https://ducizone.ddns.net/webhook/cta-link-batch';
const labels = {
  queued: 'Đã gửi, đang xử lý',
  registered: 'Lark đã ghi nhận CTA',
  pending: 'Chưa thấy đăng ký CTA',
  source_missing: 'Chưa có bài nộp trong Lark',
  source_ambiguous: 'Có nhiều bài nộp khớp',
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
function notice(message) { $('notice').textContent = message; }
function render() {
  const box = $('results');
  box.replaceChildren();
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'result';
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
  const key = $('accessKey').value.trim();
  if (!key) throw new Error('Nhập mã truy cập nội bộ.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(BASE + '/' + action, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: await signedBody(batch, key),
      signal: controller.signal
    });
    if (response.status === 401 || response.status === 403) throw new Error('Mã truy cập không đúng hoặc chưa được cấp quyền.');
    if (!response.ok) throw new Error('Hệ thống xử lý trả lỗi ' + response.status + '.');
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
    if (!docs.length) { notice('Không có link Docs hợp lệ để gửi.'); return; }
    setBusy(true);
    notice('Đang tìm bài nộp và gửi từng file vào hàng chờ…');
    try { rows = [...parsed.errors, ...await request('submit', docs)]; notice('Đã nhận kết quả gửi. Bấm “Kiểm tra kết quả” để đọc lại trạng thái.'); }
    catch (error) { rows = [...parsed.errors, ...unknownRows(docs)]; notice(error.name === 'AbortError' ? 'Hết thời gian chờ; kiểm tra kết quả trước khi gửi lại.' : error.message + ' Kiểm tra kết quả trước khi gửi lại.'); }
    render();
  } catch (error) { notice(error.message); }
  finally { setBusy(false); }
});
$('check').addEventListener('click', async () => {
  if (busy || !docs.length) return;
  setBusy(true);
  notice('Đang đọc lại các đăng ký CTA trong Lark…');
  try {
    const latest = await request('status', docs);
    const byId = new Map(latest.map((row) => [row.docId, row]));
    rows = rows.map((row) => byId.get(row.docId) || row);
    notice('Đã cập nhật trạng thái.');
    render();
  } catch (error) { notice(error.name === 'AbortError' ? 'Hết thời gian chờ; thử kiểm tra lại.' : error.message); }
  finally { setBusy(false); }
});

import { createSessionStore } from '../term-tests/teacher/auth-session.js';

const config = window.TERM_TEST_APP_CONFIG || {};
const receiptId = new URL(location.href).searchParams.get('receipt') || '';
const validReceipt = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receiptId);
const store = createSessionStore({ apiBaseUrl: config.API_BASE_URL,
  clientId: config.GOOGLE_CLIENT_ID, getStorage: () => sessionStorage });
const $ = id => document.getElementById(id);
let idToken = '';

function notice(text) { $('notice').textContent = text; }
function addDetail(list, term, value) {
  const dt = document.createElement('dt'); dt.textContent = term;
  const dd = document.createElement('dd'); dd.textContent = value || '—';
  list.append(dt, dd);
}
function render(receipt) {
  $('assignment-title').textContent = receipt.title || 'Bài Speaking';
  const summary = $('summary'); summary.replaceChildren();
  addDetail(summary, 'Lớp', receipt.class_code);
  addDetail(summary, 'Học viên', receipt.student_name);
  addDetail(summary, 'Thời gian nộp', receipt.submitted_at
    ? new Date(receipt.submitted_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—');
  const parts = $('parts'); parts.replaceChildren();
  for (const [part, details] of Object.entries(receipt.links || {})) {
    const section = document.createElement('section'); section.className = 'part';
    const labels = { paraphrase: 'Luyện Paraphrase', speaking: 'Luyện Speaking',
      clarify_1: 'Làm rõ · Cấp 1', clarify_2: 'Làm rõ · Cấp 2',
      clarify_3: 'Làm rõ · Cấp 3', freestyle: 'Full câu Speaking · Freestyle' };
    const heading = document.createElement('h3'); heading.textContent = labels[part] || part;
    const link = document.createElement('a'); link.textContent = 'Mở hội thoại ChatGPT Share';
    if (/^https:\/\/chatgpt\.com\/share\/[a-z0-9-]+$/i.test(details.url || '')) {
      link.href = details.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    }
    const count = document.createElement('p'); count.textContent = `Số câu/chu trình được ghi nhận: ${details.questionCount ?? '—'}`;
    section.append(heading, link, count);
    if (details.typingWarning) {
      const flag = document.createElement('p'); flag.className = 'flag';
      flag.textContent = `${details.typingWarning.summary || 'Có cảnh báo về cách nhập.'} Học viên ${details.voiceConfirmed ? 'đã xác nhận luyện bằng giọng nói' : 'chưa xác nhận luyện bằng giọng nói'}.`;
      section.append(flag);
    }
    parts.append(section);
  }
  const processing = $('processing'); processing.replaceChildren();
  const labels = { write_doc: 'Ghi biên nhận vào Google Docs', grade_speaking: 'Chấm bài Speaking',
    doctor_analyze: 'Cập nhật Bác sĩ AI' };
  for (const [kind, state] of Object.entries(receipt.processing || {})) {
    const li = document.createElement('li');
    li.textContent = `${labels[kind] || kind}: ${state.status === 'done' ? 'Hoàn tất' : 'Đang xử lý'}`;
    processing.append(li);
  }
  $('login-panel').hidden = true;
  $('receipt-panel').hidden = false;
  notice('Đã tải bản chỉ đọc.');
}

async function load() {
  if (!validReceipt) { notice('Link xem bài không hợp lệ.'); return; }
  if (!idToken) { $('login-panel').hidden = false; notice('Đăng nhập Google để xem bài.'); return; }
  notice('Đang tải bài và kiểm quyền lớp…');
  const response = await fetch(`${config.API_BASE_URL}/api/speaking-homework/teacher/receipts/${receiptId}`,
    { headers: { Authorization: `Bearer ${idToken}` }, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    if (response.status === 401 || response.status === 403) { store.clear(); idToken = ''; }
    $('receipt-panel').hidden = true;
    $('login-panel').hidden = false;
    throw new Error(data.message || 'Chưa xem được bài. Kiểm tra quyền lớp hoặc thử lại sau.');
  }
  store.save(idToken);
  render(data.receipt);
}

function setupGoogle() {
  if (!config.GOOGLE_CLIENT_ID || !config.API_BASE_URL) {
    notice('Chưa cấu hình đăng nhập hoặc API.'); return;
  }
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.onload = () => {
    window.google.accounts.id.initialize({ client_id: config.GOOGLE_CLIENT_ID,
      auto_select: false, callback: async response => {
        idToken = response.credential || '';
        try { await load(); } catch (error) { notice(error.message); }
      } });
    window.google.accounts.id.renderButton($('google-sign-in'),
      { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with' });
  };
  script.onerror = () => notice('Không tải được đăng nhập Google.');
  document.head.append(script);
}

$('logout').addEventListener('click', () => {
  store.clear(); idToken = ''; $('receipt-panel').hidden = true;
  $('login-panel').hidden = false; notice('Đã đăng xuất.');
  window.google?.accounts?.id?.disableAutoSelect();
});

idToken = store.read();
if (idToken) load().catch(error => notice(error.message));
else { $('login-panel').hidden = validReceipt ? false : true; notice(validReceipt
  ? 'Đăng nhập Google để xem bài.' : 'Link xem bài không hợp lệ.'); }
setupGoogle();

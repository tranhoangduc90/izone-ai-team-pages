import { createTeacherSessionClient } from '../shared/teacher-session-client.js?startup=20261026-v1';

const config = window.TERM_TEST_APP_CONFIG || {};
const receiptId = new URL(location.href).searchParams.get('receipt') || '';
const receiptApi = new URL(location.href).searchParams.get('system') === 'independent'
  ? '/api/speaking-homework-independent' : '/api/speaking-homework';
const validReceipt = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receiptId);
const sessionClient = createTeacherSessionClient({ apiBaseUrl: config.API_BASE_URL,
  sessionPath: '/api/auth/session' });
const $ = id => document.getElementById(id);

function notice(text, state = 'info') { $('notice').textContent = text; $('notice').dataset.state = state; }
function showError(error) {
  const network = error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message || '');
  notice(network ? 'Chưa kết nối được để tải bài. Hãy kiểm tra mạng rồi thử lại.' : error.message,
    error.status ? 'error' : 'attention');
}
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
  const grade = $('grade-summary'); grade.replaceChildren();
  grade.hidden = !receipt.grade_summary;
  if (receipt.grade_summary) {
    const heading = document.createElement('h3'); heading.textContent = 'Tổng hợp bài luyện';
    const counts = document.createElement('p');
    counts.textContent = `Tổng số câu/chu trình được xác nhận: ${receipt.grade_summary.totalQuestions ?? '—'}.`;
    if (Object.values(receipt.links || {}).some(l => l.evidence?.countVerified === false)) {
      counts.textContent += ' Có phần được công nhận theo chatbot nhưng chưa xác minh số câu; tổng trên là giá trị đang lưu, chưa phản ánh đầy đủ khối lượng đã luyện.';
    }
    grade.append(heading, counts);
  }
  const parts = $('parts'); parts.replaceChildren();
  for (const [part, details] of Object.entries(receipt.links || {})) {
    const section = document.createElement('section'); section.className = 'part';
    const labels = { paraphrase: 'Luyện Paraphrase', speaking: 'Luyện Speaking',
      clarify_1: 'Làm rõ · Cấp 1', clarify_2: 'Làm rõ · Cấp 2',
      clarify_3: 'Làm rõ · Cấp 3', freestyle: 'Full câu Speaking · Freestyle',
      insert_middle: 'Chèn điểm giữa trong Speaking', benefit_harm: 'Lợi ích – Tác hại',
      reason_action: 'Lý do làm một việc', how_to_do: 'Cách làm một việc',
      comparison_direct: 'So sánh trực tiếp', comparison_extended: 'So sánh mở rộng' };
    const heading = document.createElement('h3'); heading.textContent = labels[part] || part;
    const link = document.createElement('a'); link.textContent = 'Mở hội thoại ChatGPT Share';
    if (/^https:\/\/chatgpt\.com\/share\/[a-z0-9-]+$/i.test(details.url || '')) {
      link.href = details.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    } else {
      link.textContent = 'Link hội thoại không hợp lệ';
    }
    const count = document.createElement('p'); count.textContent = part === 'benefit_harm'
      ? 'Đã nhận link; phần này không yêu cầu khối lượng luyện tập.'
      : `Số câu/chu trình được ghi nhận: ${details.questionCount ?? '—'}`;
    section.append(heading, link, count);
    if (details.evidence?.acceptanceBasis === 'chatbot_completion') {
      const basis = document.createElement('p');
      basis.textContent = 'Đã công nhận theo lời chatbot xác nhận hoàn thành. '
        + (details.evidence.countVerified === false ? 'Số câu chưa được xác minh. ' : '')
        + (details.evidence.completionEvidence?.quote || '');
      section.append(basis);
    }
    parts.append(section);
  }
  for (const practice of receipt.practice_links || []) {
    const section = document.createElement('section'); section.className = 'part';
    const heading = document.createElement('h3');
    heading.textContent = `${Number(practice.slot) <= 2 ? 'Bài bổ trợ bắt buộc' : 'Bài luyện thêm'} ${practice.slot}: ${practice.exerciseTitle || 'Bài cá nhân'}`;
    const link = document.createElement('a');
    link.textContent = 'Mở hội thoại ChatGPT Share';
    if (/^https:\/\/(?:www\.)?chatgpt\.com\/share\/[a-z0-9-]+$/i.test(practice.url || '')) {
      link.href = practice.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    } else link.textContent = 'Link hội thoại không hợp lệ';
    const status = document.createElement('p');
    status.textContent = practice.status === 'accepted'
      ? practice.analysisStatus === 'done' ? 'Đã nhận và phân tích lỗi.' : 'Đã nhận; đang phân tích lỗi.'
      : 'Chưa đạt yêu cầu.';
    section.append(heading, link, status);
    if (practice.evidence?.acceptanceBasis === 'chatbot_completion') {
      const basis = document.createElement('p');
      basis.textContent = 'Đã công nhận theo lời chatbot: ' + (practice.evidence.completionEvidence?.quote || 'Đã hoàn thành bài luyện.');
      section.append(basis);
    }
    parts.append(section);
  }
  const processing = $('processing'); processing.replaceChildren();
  const labels = { write_doc: 'Ghi biên nhận vào Google Docs', grade_speaking: 'Chấm bài Speaking',
    doctor_analyze: 'Cập nhật Bác sĩ AI', analyze_homework: 'Cập nhật Bác sĩ AI từ Homework',
    analyze_practice: 'Cập nhật Bác sĩ AI từ bài bổ trợ' };
  for (const [kind, state] of Object.entries(receipt.processing || {})) {
    const li = document.createElement('li');
    li.textContent = `${labels[kind] || kind}: ${state.status === 'done' ? 'Hoàn tất'
      : state.status === 'review' ? 'Cần kiểm tra lại' : state.status === 'failed' ? 'Cần thử lại' : 'Đang xử lý'}`;
    processing.append(li);
  }
  $('login-panel').hidden = true;
  $('receipt-panel').hidden = false;
  notice('Đã tải bản chỉ đọc.');
}

async function load() {
  if (!validReceipt) { notice('Link xem bài không hợp lệ.', 'error'); return; }
  notice('Đang tải bài và kiểm quyền lớp…');
  const response = await fetch(`${config.API_BASE_URL}${receiptApi}/teacher/receipts/${receiptId}`,
    { credentials: 'include', cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    $('receipt-panel').hidden = true;
    $('login-panel').hidden = false;
    const error = new Error(data.message || 'Chưa xem được bài. Kiểm tra quyền lớp hoặc thử lại sau.');
    error.status = response.status;
    throw error;
  }
  render(data.receipt);
}

function setupGoogle() {
  if (!config.GOOGLE_CLIENT_ID || !config.API_BASE_URL) {
    notice('Chưa cấu hình đăng nhập hoặc API.', 'error'); return;
  }
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.onload = () => {
    window.google.accounts.id.initialize({ client_id: config.GOOGLE_CLIENT_ID,
      auto_select: false, callback: async response => {
        try { await sessionClient.login(response.credential || ''); await load(); }
        catch (error) { showError(error); }
      } });
    window.google.accounts.id.renderButton($('google-sign-in'),
      { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with' });
  };
  script.onerror = () => notice('Không tải được đăng nhập Google.', 'error');
  document.head.append(script);
}

$('logout').addEventListener('click', async () => {
  try { await sessionClient.logout(); } catch { /* Giữ giao diện ở trạng thái đăng xuất nếu mạng lỗi. */ }
  $('receipt-panel').hidden = true;
  $('login-panel').hidden = false; notice('Đã đăng xuất.');
  window.google?.accounts?.id?.disableAutoSelect();
});

if (validReceipt) {
  sessionClient.restore().then(session => {
    if (session) return load();
    $('login-panel').hidden = false;
    notice('Đăng nhập Google để xem bài.', 'attention');
  }).catch(error => { $('login-panel').hidden = false; showError(error); });
} else notice('Link xem bài không hợp lệ.', 'error');
setupGoogle();

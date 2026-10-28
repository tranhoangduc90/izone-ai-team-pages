// Nhận kết quả do API đã xác minh; hiển thị căn cứ công nhận và việc cần làm.
// Không suy ra chưa đủ chỉ từ số đếm hoặc lỗi dịch vụ.
export function acceptanceMessage(link, fallback = 'Đã công nhận phần luyện này.') {
  if (link?.evidence?.acceptanceBasis === 'chatbot_completion') {
    return link.evidence.recoveryId
      ? 'Phần luyện này đã được công nhận lại sau khi kiểm tra. Chatbot đã xác nhận bạn hoàn thành; bạn không cần làm thêm phần này.'
      : 'Chatbot đã xác nhận bạn hoàn thành bài luyện này; bạn không cần làm thêm phần này.';
  }
  return fallback;
}
export function checkReason(link) {
  if (link?.evidence?.systemIssue === 'CATALOG_LINK_MISMATCH') return link.evidence.checkMessage;
  const code = link?.check_code;
  if (code === 'REUSED_CONVERSATION') return 'Hội thoại này đã dùng cho bài khác trong khóa. Hãy dùng hội thoại riêng của phần này.';
  if (code === 'EXERCISE_MISMATCH') return 'Hội thoại chưa khớp kỹ năng của bài đã chọn. Hãy kiểm tra tên bài và link đang gửi.';
  if (['CHECK_REVIEW_REQUIRED', 'CHECK_SERVICE_UNAVAILABLE', 'SHARE_UNAVAILABLE', 'SHARE_CONTENT_INVALID'].includes(code)) {
    return 'Link và tiến độ của bạn đã được giữ. Hãy nhấn Thử kiểm tra lại để hệ thống đọc lại hội thoại; bạn không cần làm lại bài hoặc tạo link mới vì lỗi này.';
  }
  if (link?.evidence?.checkMessage) return link.evidence.checkMessage;
  return 'Chưa xác nhận được đủ các bước của phần này. Link đã được giữ; hãy nhờ giảng viên kiểm tra nếu chatbot đã báo hoàn thành.';
}

export function technicalCheckFeedback(link) {
  if ((link?.check_status ?? link?.status) === 'accepted') return null;
  if (link?.retryable !== true && !['CHECK_REVIEW_REQUIRED', 'CHECK_SERVICE_UNAVAILABLE',
    'SHARE_UNAVAILABLE', 'SHARE_CONTENT_INVALID'].includes(link?.check_code)) return null;
  return { kind: 'warning', title: 'Hệ thống đang gặp lỗi', message: checkReason(link) };
}

// Chỉ đổi vùng thông báo khi nội dung đổi, giữ node/focus/bôi chọn qua polling.
export function renderCheckResult(element, kind, title, message) {
  const signature = JSON.stringify([kind, title, message]);
  if (element.dataset.checkSignature !== signature) {
    const strong = document.createElement('strong'); strong.textContent = title;
    const span = document.createElement('span'); span.textContent = message;
    element.replaceChildren(strong, span);
    element.className = `check-result is-${kind}`;
    element.dataset.checkSignature = signature;
  }
  element.hidden = false;
}

export function updateCheckControl(button, link, { changed = false, disabled = false } = {}) {
  button.dataset.confirmLabel ||= button.textContent.trim();
  const retryable = !changed && Boolean(technicalCheckFeedback(link));
  const pending = !changed && !retryable && (link?.check_status ?? link?.status) === 'pending';
  button.disabled = disabled || pending;
  const label = retryable ? 'Thử kiểm tra lại' : pending ? 'Đang kiểm tra…' : button.dataset.confirmLabel;
  if (button.textContent !== label) button.textContent = label;
}

export function updateSubmitControl({ ready, submitted, phase = 'idle', error = '', onSubmit }) {
  let card = document.getElementById('ready-submit-card');
  if (!card) {
    card = document.createElement('section');
    card.id = 'ready-submit-card'; card.className = 'completion-card';
    const content = document.createElement('div');
    card.setAttribute('role', 'status'); card.setAttribute('aria-live', 'polite');
    const title = document.createElement('h2'); title.id = 'submit-status-title';
    const message = document.createElement('p'); message.id = 'submit-status-message';
    const button = document.createElement('button');
    button.id = 'submit-homework'; button.type = 'button'; button.className = 'button button-primary';
    button.addEventListener('click', onSubmit);
    content.append(title, message); card.append(content, button);
    document.getElementById('completion-card').before(card);
  }
  card.hidden = !ready || submitted;
  const button = document.getElementById('submit-homework');
  const failed = phase === 'failed';
  button.hidden = !failed; button.disabled = !failed; button.textContent = 'Thử nộp lại';
  card.setAttribute('aria-busy', String(['sending', 'verifying'].includes(phase)));
  document.getElementById('submit-status-title').textContent = failed ? 'Chưa nộp xong'
    : phase === 'verifying' ? 'Đang kiểm tra trạng thái nộp bài…'
    : phase === 'waiting' ? 'Đang chờ kết nối để nộp lại…' : 'Đang nộp bài…';
  document.getElementById('submit-status-message').textContent = failed
    ? `${error ? error + ' ' : ''}Các hội thoại đã xác nhận vẫn được giữ. Hãy kiểm tra kết nối rồi thử nộp lại; nếu vẫn lỗi, hãy báo giảng viên.`
    : phase === 'sending' || phase === 'idle'
      ? 'Bạn đã xác nhận đủ các phần bắt buộc. Hệ thống đang lưu bài và tạo biên nhận.'
      : 'Tiến độ vẫn được giữ. Hệ thống sẽ kiểm tra biên nhận trước khi gửi lại.';
}

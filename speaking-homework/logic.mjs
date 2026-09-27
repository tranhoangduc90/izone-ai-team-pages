// Nhận link học viên dán vào và chuẩn hóa về đúng ChatGPT Share.
// Kết quả là URL dùng để đối chiếu, hoặc lý do cần sửa hiển thị ngay trên webapp.
export function parseShareUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { return { ok: false, reason: 'Hãy dán một đường link ChatGPT Share.' }; }
  if (url.protocol !== 'https:' || !['chatgpt.com', 'www.chatgpt.com', 'chat.openai.com'].includes(url.hostname)) {
    return { ok: false, reason: 'Link cần bắt đầu bằng https://chatgpt.com/share/.' };
  }
  if (/^\/c\//i.test(url.pathname)) {
    return { ok: false, reason: 'Đây là link /c/ chỉ mở trong tài khoản của bạn. Hãy tạo link bằng nút Chia sẻ trong ChatGPT.' };
  }
  if (!/^\/share\/[0-9a-z-]+\/?$/i.test(url.pathname)) {
    return { ok: false, reason: 'Hãy dùng link Chia sẻ hội thoại có dạng chatgpt.com/share/...' };
  }
  url.hostname = 'chatgpt.com';
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/$/, '');
  return { ok: true, url: url.toString() };
}

// Chỉ cho nút quay lại mở đúng một file Google Docs hoặc trang Classroom.
export function safeHomeworkUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    if (url.hostname === 'docs.google.com' && /^\/document\/d\/[A-Za-z0-9_-]+\/edit(?:\/|$)/.test(url.pathname)) return url.toString();
    if (url.hostname === 'classroom.google.com' && url.pathname !== '/') return url.toString();
  } catch { /* Link không hợp lệ: giữ nút vô hiệu. */ }
  return '';
}

// Email định kỳ chỉ xét bài hiện còn ở trạng thái Đã nộp và thiếu biên nhận hợp lệ.
// Bản thử dùng hàm này để giữ quy tắc nghiệp vụ nhưng không gửi email.
export function needsTeacherEmail(classroomState, accepted, alreadyNotified) {
  return classroomState === 'TURNED_IN' && !accepted && !alreadyNotified;
}

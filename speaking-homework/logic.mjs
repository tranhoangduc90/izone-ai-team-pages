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

// Bản thử tạo phản hồi giống hợp đồng của bước kiểm tra phía máy chủ.
// Khi nối n8n, giao diện sẽ nhận cùng ba loại: đạt, bị chặn, cần học viên xác nhận.
export function demoCheck(section, scenario) {
  const paraphrase = section === 'paraphrase';
  if (scenario === 'private') return { kind: 'blocked', title: 'Chưa mở được hội thoại', message: 'Link có thể chỉ tài khoản của bạn xem được. Hãy tạo lại link Chia sẻ và bấm Xác nhận lần nữa.' };
  if (scenario === 'used') return { kind: 'blocked', title: 'Hội thoại đã dùng cho bài khác', message: 'Link này đã được dùng để nộp Homework Lesson 1. Hãy luyện hội thoại mới cho Homework Lesson 2.' };
  if (scenario === 'reshare') return { kind: 'blocked', title: 'Cùng hội thoại đã nộp', message: 'Dù link Chia sẻ mới, hội thoại này đã được dùng cho Homework Lesson 1. Hãy luyện hội thoại mới.' };
  if (scenario === 'incomplete') return paraphrase
    ? { kind: 'blocked', title: 'Bạn cần luyện thêm 1 câu', message: 'Hội thoại hiện có 4/5 câu hỏi Paraphrase. Hãy quay lại ChatGPT luyện đủ 5 câu rồi tạo link Chia sẻ mới.' }
    : { kind: 'blocked', title: 'Chưa đủ bước luyện Speaking', message: 'Hội thoại có 3 câu hỏi, nhưng chỉ 1 câu được nói lại hoàn chỉnh sau góp ý. Hãy hoàn thành bước nói lại cho 2 câu còn thiếu.' };
  if (scenario === 'typing' && !paraphrase) return { kind: 'warning', title: 'Cần xác nhận cách bạn luyện nói', message: 'Ví dụ giả lập: từ “spekaing” xuất hiện 2 lần thay vì “speaking”. Đây có thể là lỗi gõ phím nhưng không chứng minh được bạn đã gõ. Nếu đã voice chat, hãy xác nhận bên dưới để vẫn nộp bài.' };
  if (scenario === 'error') return { kind: 'blocked', title: 'Chưa kiểm tra được link', message: 'Hệ thống đọc ChatGPT đang gặp lỗi. Hãy thử lại sau; bài của bạn chưa được nhận và lỗi này không bị coi là gian lận.' };
  return paraphrase
    ? { kind: 'pass', title: 'Đã kiểm tra Paraphrase', message: 'Hội thoại đạt tối thiểu 5 câu hỏi. Phần này đã sẵn sàng.' }
    : { kind: 'pass', title: 'Đã kiểm tra Full Speaking', message: 'Hội thoại có 3 câu hỏi với bước trả lời, nhận góp ý và nói lại hoàn chỉnh.' };
}

// Email định kỳ chỉ xét bài hiện còn ở trạng thái Đã nộp và thiếu biên nhận hợp lệ.
// Bản thử dùng hàm này để giữ quy tắc nghiệp vụ nhưng không gửi email.
export function needsTeacherEmail(classroomState, accepted, alreadyNotified) {
  return classroomState === 'TURNED_IN' && !accepted && !alreadyNotified;
}

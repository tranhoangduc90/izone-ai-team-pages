// Nhận đồng hồ máy chủ, dùng thời gian đã trôi để hiển thị hạn; backend quyết định nhận bài.
export function observeSubmissionWindow(value, observedAt) {
  return value ? { ...value, observedAt } : null;
}

export function windowCanSubmit(window, monotonicNow) {
  if (!window) return true;
  if (!window.canSubmit) return false;
  if (!window.effectiveClosesAt) return true;
  const serverNow = Date.parse(window.serverNow);
  const cutoff = Date.parse(window.effectiveClosesAt);
  if (!Number.isFinite(serverNow) || !Number.isFinite(cutoff)) return false;
  return serverNow + Math.max(0, monotonicNow - window.observedAt) < cutoff;
}

export function submissionWindowMessage(window, monotonicNow) {
  if (!window) return '';
  const count = Number(window.completeStudents) || 0;
  const cutoff = window.effectiveClosesAt;
  const date = cutoff && Number.isFinite(Date.parse(cutoff))
    ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short',
      timeStyle: 'short', hour12: false }).format(new Date(cutoff)) : null;
  if (!windowCanSubmit(window, monotonicNow)) {
    return `Phiếu đã khóa nhận bài${date ? ` từ ${date}` : ''}. Bài đã nộp được giữ nguyên; bạn vẫn xem được hành trình.`;
  }
  return date ? `Nhận bài đến ${date} (giờ Việt Nam). Đã có ${count} học viên nộp đủ.`
    : `Đã có ${count}/3 học viên nộp đủ. Phiếu khóa lúc 22:00 ngày học viên thứ ba nộp đủ; nếu người thứ ba nộp sau 22:00, phiếu khóa ngay sau bài đó.`;
}

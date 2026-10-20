// Nhận trạng thái phân tích từ máy chủ; tách công nhận bài và cập nhật Bác sĩ AI.
// Lỗi đã dừng không hiện đang chạy; thiếu dữ liệu không được tự nhận đã phân tích.
export function analysisStatus(status) {
  if (status === 'done') return { tone: 'pass', label: 'Đã phân tích', message: 'Bác sĩ AI đã cập nhật danh sách bài cần luyện.' };
  if (['review', 'cancelled', 'canceled'].includes(status)) return { tone: 'warning', label: 'Đã nhận bài · phân tích cần kiểm lại', message: 'Bài đã được nhận. Phân tích lỗi đã dừng và cần được kiểm lại; kết quả công nhận bài và biên nhận vẫn được giữ.' };
  if (status === 'failed') return { tone: 'loading', label: 'Đã nhận bài · đang thử phân tích lại', message: 'Bài đã được nhận. Bác sĩ AI đang thử phân tích lại; bạn không cần nộp lại bài.' };
  if (['pending', 'queued', 'running', 'processing'].includes(status)) return { tone: 'loading', label: 'Đã nhận bài · đang phân tích', message: 'Bài đã được nhận. Bác sĩ AI đang phân tích để cập nhật danh sách.' };
  return { tone: 'warning', label: 'Đã nhận bài · chưa có kết quả phân tích', message: 'Bài đã được nhận. Chưa có kết quả phân tích lỗi; biên nhận vẫn được giữ.' };
}

// Chỉ hỏi lại khi việc phân tích còn có thể chạy; review đã hết thử phải dừng polling.
export function analysisPending(status) {
  return ['pending', 'queued', 'running', 'processing', 'failed'].includes(status);
}

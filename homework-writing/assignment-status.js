// Cùng nhãn và điều kiện trạng thái cho GV/HV; đã sửa không đồng nghĩa đã đạt.
export const statusNames = { not_submitted: 'Chưa nộp', submitted: 'Đã nộp', graded: 'Đã chấm', returned: 'Đã trả lại', revised: 'HV đã sửa' };
export const statusColors = { not_submitted: 'neutral', submitted: '', graded: 'attention', returned: 'success', revised: 'attention' };
export function assignmentStatus(row) {
  const value = typeof row === 'string' ? row : row?.status;
  if (row?.revised || ['revision_received','revised'].includes(value)) return 'revised';
  if (row?.published || value==='returned') return 'returned';
  if (['graded', 'awaiting_teacher'].includes(value)) return 'graded';
  if (['submitted', 'accepted', 'grading','grading_failed'].includes(value)) return 'submitted';
  return 'not_submitted';
}
export const lesson3StatusNames = { submitted: 'Đã nhận bài · Chờ GV', returned: 'GV đã trả bài' };
export function lesson3Status(row) {
  const status = assignmentStatus(row);
  if (status === 'returned' || status === 'revised') return 'returned';
  if (status === 'submitted' || status === 'graded') return 'submitted';
  return '';
}
export const statusLabel = row => statusNames[assignmentStatus(row)];
export const statusColor = row => (typeof row==='string'?row:row?.status)==='grading_failed'?'error':statusColors[assignmentStatus(row)];
export const statusDetail = row => row?.status==='grading_failed'?'Chấm đang gặp lỗi · bài đã được giữ':row?.status === 'draft' ? 'Đang viết nháp' : assignmentStatus(row) === 'graded' ? 'Chờ GV duyệt và trả bài' : '';

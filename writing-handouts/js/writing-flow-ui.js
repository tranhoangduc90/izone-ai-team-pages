// Dữ liệu nhận vào: ngày từ API, cấu hình sắp xếp và độ rộng cột lưu trên trình duyệt.
// Việc chính: chuẩn hóa thành giá trị an toàn, có giới hạn và không phụ thuộc múi giờ của máy.
// Kết quả: biểu đồ không hiện Invalid Date; bảng nhớ độ rộng và gửi sort đúng allowlist backend.
// Khi dữ liệu hỏng: dùng mặc định hoặc nhãn “Ngày không hợp lệ”, không làm hỏng toàn dashboard.
export const defaultColumnWidths = Object.freeze({
  student: 180, class: 95, teacher: 170, file: 95, classroom: 190, trcc: 90,
  sourceStatus: 135, testProgress: 260, testOverall: 130,
  finished: 145, topic: 330, image: 110, created: 145,
  content: 430, lms: 110, attempts: 100, error: 170, actions: 125,
});

export const writingSortFields = Object.freeze([
  ['finished', 'Thời điểm xong'], ['created', 'Ngày tạo'], ['updated', 'Cập nhật gần nhất'],
  ['student', 'Học viên'], ['class', 'Lớp'], ['teacher', 'Giảng viên'],
  ['status', 'Trạng thái'], ['attempts', 'Số lần thử'],
]);

export function normalizeWritingDay(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1
    || probe.getUTCDate() !== day) return null;
  return match[0];
}

export function formatWritingDay(value) {
  const day = normalizeWritingDay(value);
  if (!day) return 'Ngày không hợp lệ';
  const [year, month, date] = day.split('-').map(Number);
  return `${date}/${month}/${year}`;
}

export function clampColumnWidth(value, fallback = 140) {
  const width = Number(value);
  return Number.isFinite(width) ? Math.min(640, Math.max(80, Math.round(width))) : fallback;
}

export function readColumnWidths(storage) {
  let saved = {};
  try { saved = JSON.parse(storage?.getItem('writing-flow:column-widths:v1') || '{}'); } catch { saved = {}; }
  return Object.fromEntries(Object.entries(defaultColumnWidths)
    .map(([key, fallback]) => [key, clampColumnWidth(saved?.[key], fallback)]));
}

export function saveColumnWidths(storage, widths) {
  try {
    storage?.setItem('writing-flow:column-widths:v1', JSON.stringify(widths));
    return true;
  } catch { return false; }
}

export function serializeSortRules(rules = []) {
  const allowed = new Set(writingSortFields.map(([key]) => key));
  const seen = new Set();
  return rules.slice(0, 3)
    .filter(rule => allowed.has(rule?.key) && ['asc', 'desc'].includes(rule?.direction)
      && !seen.has(rule.key) && seen.add(rule.key))
    .map(rule => `${rule.key}:${rule.direction}`).join(',');
}

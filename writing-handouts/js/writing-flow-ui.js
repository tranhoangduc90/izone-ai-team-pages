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

// Nhận vào: số gộp theo ngày từ backend, kể cả bản API cũ chỉ có completed_count.
// Việc chính: tách ba hoạt động và chuẩn hóa số để biểu đồ không hiện NaN.
// Trả ra: dữ liệu nhóm cột có nhãn dễ đọc, giữ ngày Việt Nam.
// Khi dữ liệu thiếu: hiển thị 0; ngày sai được ghi rõ, không tạo ngày giả.
export function dailyBreakdown(days = []) {
  const safeCount = value => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
  };
  return days.map(row => ({
    day: normalizeWritingDay(row.day),
    series: [
      { key: 'new', label: 'Chấm mới', count: safeCount(row.newly_graded_count) },
      { key: 'history', label: 'Ghi nhận kết quả cũ', count: safeCount(row.historical_count) },
      { key: 'delivered', label: 'Đã giao',
        count: safeCount(row.delivered_count ?? row.completed_count) },
    ],
  }));
}

// Nhận vào: điểm Test và kết quả từng tiêu chí do backend đã kiểm và lưu.
// Việc chính: chuẩn bị nhãn dễ đọc; không tự tính hoặc suy đoán điểm còn thiếu.
// Trả ra: các tiêu chí và thành phần để cửa sổ chi tiết hiển thị. Bài cũ đã
// khôi phục chỉ dẫn người xem về Google Docs, không hiện điểm lượt chấm sai.
export function summarizeWritingTestDetail(test) {
  if (!test || typeof test !== 'object') return null;
  const taskNumber = Number(test.task_number);
  if (test.result_origin === 'legacy_restored') {
    return { taskNumber, scoreLabel: null, criteria: [],
      message: 'Bài đã có kết quả cũ được khôi phục; xem nhận xét và điểm trong Google Docs.' };
  }
  const score = test.task_score == null ? null : Number(test.task_score);
  const criteria = (Array.isArray(test.criteria) ? test.criteria : []).map(item => ({
    title: `${item.criterion_code || 'Tiêu chí'} · ${item.name || item.criterion_code || 'Chưa có tên'}`
      + (item.band_score == null ? '' : ` · Band ${item.band_score}`),
    feedback: item.feedback || '',
    components: (Array.isArray(item.components) ? item.components : []).map(component => ({
      title: component.label || component.component_code || 'Thành phần chưa có tên',
      summary: component.summary || '',
      feedback: component.feedback || '',
    })),
  }));
  const count = criteria.reduce((total, item) => total + item.components.length, 0);
  const expected = taskNumber === 1 ? 9 : taskNumber === 2 ? 10 : null;
  return { taskNumber, scoreLabel: Number.isFinite(score) ? `Band ${score}` : null,
    criteria, message: criteria.length
      ? `${count}/${expected || '?'} thành phần đã lưu theo ${criteria.length}/4 tiêu chí.`
      : 'Chưa có nhận xét chi tiết theo tiêu chí trong database.' };
}

// Nhận vào: một dòng Test đã được backend đánh dấu là kết quả hiện hành hoặc
// kết quả cũ được khôi phục. Bài cũ có thể còn số thành phần của lượt chấm sai.
// Việc chính: chỉ hiện điểm và tiến độ mới khi chúng thực sự là kết quả hiện hành.
// Trả ra: nhãn ngắn cho bảng; nếu thiếu dữ liệu thì nói rõ phải xem Docs cũ.
export function summarizeWritingTestRow(row) {
  if (row?.source_type !== 'term_test') return null;
  const task = `Task ${row.task_number || '?'}`;
  if (row.result_origin === 'legacy_restored') {
    return { progress: `${task} · Kết quả cũ trong Docs`,
      overall: 'Xem điểm trong Docs cũ', lms: 'Không dùng' };
  }
  const expected = Number(row.task_number) === 1 ? 9 : 10;
  return {
    progress: `${row.test_config || 'Chưa rõ kỳ'} · ${task} · ${Number(row.component_count || 0)}/${expected} phần · `
      + (row.task_score == null ? 'chưa có điểm' : `Band ${row.task_score}`),
    overall: row.writing_score == null ? 'Chờ đủ Task' : `Band ${row.writing_score}`,
    lms: 'Không dùng',
  };
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

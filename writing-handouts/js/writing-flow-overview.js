// Số liệu và đối chiếu chỉ phục vụ giao diện; không sửa trạng thái bài trên máy chủ.
export function writingLocalDay(value) {
  if (value == null || value === '') return '';
  if (/^\d{4}-\d{2}-\d{2}$/u.test(String(value || ''))) return String(value);
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) : '';
}

export function defaultWritingRange(now = new Date()) {
  const to = writingLocalDay(now);
  return { from: new Date(Date.parse(to) - 6 * 86400000).toISOString().slice(0, 10), to };
}

export function withinWritingRange(value, from, to) {
  const day = writingLocalDay(value);
  // Giữ bài thiếu ngày để người vận hành vẫn có thể kiểm tra.
  return !day || ((!from || day >= from) && (!to || day <= to));
}

export function sourceIssueMatchesPair(issue, pair) {
  if (!issue.homework_file_id || issue.homework_file_id !== pair.homework_file_id) return false;
  for (const field of ['source_app_id', 'source_table_id', 'source_record_id', 'source_link_index', 'essay_slot']) {
    if (issue[field] != null && issue[field] !== '' && String(issue[field]) !== String(pair[field] ?? '')) return false;
  }
  return pair.status !== 'superseded' && !pair.skipped_at;
}

export function sourceIssueAlreadyDelivered(issue, pairs) {
  const matches = pairs.filter(pair => sourceIssueMatchesPair(issue, pair));
  return matches.length > 0 && matches.every(pair => pair.status === 'delivered'
    && !pair.historical_review_code
    && (pair.source_type === 'term_test' || Boolean(pair.lms_url)));
}

export function writingPeriodMetrics(days, reviews, issues) {
  const sum = key => days.reduce((total, day) => total + Number(day[key] || 0), 0);
  return {
    graded: sum('newly_graded_count'),
    delivered: days.reduce((total, day) => total + Number(day.delivered_count ?? day.completed_count ?? 0), 0),
    errors: new Set(reviews.map(row => row.pair_id)).size
      + issues.filter(issue => !reviews.some(pair => sourceIssueMatchesPair(issue, pair))).length,
  };
}

// Đọc hết các trang khi cần đếm. Con trỏ lặp hoặc giới hạn an toàn phải báo lỗi,
// không biến một phần kết quả thành tổng số đã xác nhận.
export async function collectWritingPairs(getPage, filters) {
  const rows = [];
  const seen = new Set();
  let page = {};
  for (let index = 0; index < 100; index += 1) {
    const response = await getPage({ ...filters, ...page, limit: 100 });
    const data = response.data;
    rows.push(...(data.pairs || []));
    if (!data.nextCursor && data.nextOffset == null) return rows;
    page = data.nextCursor || { offset: data.nextOffset };
    const key = JSON.stringify(page);
    if (seen.has(key)) throw new Error('Máy chủ trả lại cùng một trang dữ liệu.');
    seen.add(key);
  }
  throw new Error('Phạm vi quá lớn để tổng hợp. Hãy chọn khoảng ngày ngắn hơn.');
}

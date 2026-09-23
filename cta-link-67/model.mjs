// Nhận link Docs thô; trả Doc ID duy nhất và lỗi từng dòng, không gửi nội dung tài liệu.
export function parseDocLinks(raw) {
  const lines = String(raw || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 20) throw new Error('Dán từ 1 đến 20 link Google Docs, mỗi dòng một link.');
  const docs = [], errors = [], seen = new Set();
  lines.forEach((line, index) => {
    const match = /^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]{20,200})(?:\/|\?|#|$)/.exec(line);
    if (!match) { errors.push({ docId: '', line: index + 1, status: 'invalid_url' }); return; }
    if (seen.has(match[1])) { errors.push({ docId: match[1], line: index + 1, status: 'duplicate' }); return; }
    seen.add(match[1]); docs.push({ docId: match[1] });
  });
  return { docs, errors };
}

// Giữ đúng một kết quả cho mỗi Doc ID đã gửi; phản hồi thiếu hoặc thừa là không xác định.
export function checkedResults(payload, docs) {
  if (!payload?.ok || !Array.isArray(payload.results)) throw new Error('Hệ thống không trả kết quả hợp lệ.');
  const expected = new Set(docs.map((doc) => doc.docId));
  const seen = new Set();
  const results = payload.results.map((item) => {
    const id = String(item?.docId || '');
    if (!expected.has(id) || seen.has(id)) throw new Error('Kết quả không khớp danh sách Docs.');
    seen.add(id);
    return { docId: id, status: String(item.status || 'unknown'), codes: Array.isArray(item.codes) ? item.codes.map(String) : [] };
  });
  if (seen.size !== expected.size) throw new Error('Kết quả còn thiếu file.');
  return results;
}

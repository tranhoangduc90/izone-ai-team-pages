// Dữ liệu nhận vào: bản tổng hợp học viên, chi tiết phiên, Comment, artifacts từ vựng và tọa độ nhấp chuột trong dashboard.
// Việc chính: ghép dữ liệu bài theo cả hợp đồng Task 1/Task 2, lọc timeline, lấy bảng từ vựng và nhận biết cú nhấp ngoài popup.
// Kết quả: hộp chi tiết vẫn hiện bài đang làm kể cả khi API Comment lỗi hoặc backend trả các ô Task 1 ở cấp trên cùng.
// Khi lỗi: trả mảng rỗng hoặc giữ popup mở; không sửa bài làm hay dữ liệu học viên.
const task1ResponseKeys = ["overview", "body1", "body2", "draft1", "draft2"];

export function mergeTeacherStudentDetail(summary = {}, session = {}, teacherComments) {
  const responses = { ...(summary.responses || {}), ...(session.responses || {}) };
  for (const key of task1ResponseKeys) {
    if (typeof session[key] === "string") responses[key] = session[key];
  }
  return {
    ...summary,
    ...session,
    responses,
    sections: { ...(summary.sections || {}), ...(session.sections || {}) },
    teacherComments: Array.isArray(teacherComments) ? teacherComments : (summary.teacherComments || []),
  };
}

export function commentsForSection(comments = [], sectionKey = "") {
  return comments
    .filter((comment) => comment?.section === sectionKey)
    .slice()
    .sort((left, right) => {
      const byNumber = Number(right.commentNumber || 0) - Number(left.commentNumber || 0);
      if (byNumber) return byNumber;
      return Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0);
    });
}

export function normalizeVocabularyRows(value, bodyKey) {
  const hasBodyGroups = value && typeof value === "object" && !Array.isArray(value)
    && (Object.hasOwn(value, "body1") || Object.hasOwn(value, "body2"));
  const raw = hasBodyGroups ? value?.[bodyKey] : value;
  if (Array.isArray(raw)) {
    return raw
      .map((row) => ({
        idea: row?.idea || row?.meaning || row?.label || "",
        terms: row?.terms || row?.english || row?.words || "",
      }))
      .filter((row) => row.idea || row.terms);
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([idea, terms]) => ({
      idea,
      terms: Array.isArray(terms) ? terms.join(", ") : String(terms || ""),
    }));
  }
  return [];
}

export function latestVocabularyRows(comments = [], bodyKey = "") {
  const newestFirst = comments.slice().sort((left, right) => {
    const byTime = Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0);
    return byTime || Number(right.commentNumber || 0) - Number(left.commentNumber || 0);
  });
  for (const comment of newestFirst) {
    const artifacts = comment?.artifacts || {};
    const rows = normalizeVocabularyRows(artifacts.vocabulary || artifacts.vocabularyRows, bodyKey);
    if (rows.length) return rows;
  }
  return [];
}

export function technicalRecoveryMessage(canManage = false) {
  return canManage
    ? "Lượt chấm gặp lỗi kỹ thuật. Bài viết vẫn được lưu an toàn; bạn có thể xếp lại chính Comment này."
    : "Lượt chấm gặp lỗi kỹ thuật. Bài viết vẫn được lưu an toàn; hãy báo tài khoản quản trị để xếp chấm lại.";
}

export function isBackdropClick(event, rect) {
  if (!event || !rect) return false;
  return event.clientX < rect.left || event.clientX > rect.right
    || event.clientY < rect.top || event.clientY > rect.bottom;
}

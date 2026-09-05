// Nhận UUID đã nhớ và danh sách mới của bài; chỉ ghép bằng UUID chính thức.
// Không mang mã lớp riêng của bài cũ sang bài mới, không ghép theo tên học viên.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalize = (value) => String(value || "").trim().toLocaleLowerCase("vi");
export const classRefOf = (group) => group.classRef || group.ref || group.id || "";
export const studentRefOf = (student) => student.studentRef || student.ref || "";
export const officialStudent = (student) => Boolean(student && uuid.test(studentRefOf(student))
  && !student.provisional && !student.temporary && !student.requiresAccessCode);

export function classMatches(group, value) {
  return Boolean(normalize(value)) && [classRefOf(group), group.classCode, group.className, group.label, group.name]
    .some((item) => normalize(item) === normalize(value));
}

export function rosterGroups(roster = {}) {
  return (roster.classes || []).map((group) => ({ ...group,
    students: group.students || roster.studentsByClass?.[classRefOf(group)] || [],
  }));
}

export function allowedGroup(group, config) {
  return config?.enabled === true && Array.isArray(config.classCodes)
    && config.classCodes.some((code) => classMatches(group, code));
}

export function resolveRememberedStudent(groups, studentRef, requestedClass = "", config) {
  if (!uuid.test(studentRef || "")) return null;
  const requested = requestedClass ? groups.filter((group) => classMatches(group, requestedClass)) : groups;
  if (requestedClass && requested.length !== 1) return null;
  const matches = requested.flatMap((group) => allowedGroup(group, config)
    ? group.students.filter((student) => officialStudent(student) && studentRefOf(student) === studentRef)
      .map((student) => ({ classRef: classRefOf(group), studentRef, group, student }))
    : []);
  // 0 hoặc nhiều kết quả đều cần người học chọn; không lấy phần tử đầu của tập mơ hồ.
  return matches.length === 1 ? matches[0] : null;
}

export function memoryKey(apiBase, pageUrl) {
  const api = new URL(apiBase || "./", pageUrl);
  return `izone:remembered-writing-student:v1:${api.origin}${api.pathname.replace(/\/$/, "")}`;
}

// Bộ nhớ chỉ chứa version và UUID công khai. Lỗi JSON/quyền lưu trả trạng thái rõ;
// ứng dụng vẫn cho chọn thủ công và không lưu tên, mã truy cập hay phiên làm bài.
export function readMemory(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return { status: "empty", studentRef: "" };
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !uuid.test(value.studentRef || "")) return { status: "invalid", studentRef: "" };
    return { status: "ok", studentRef: value.studentRef };
  } catch { return { status: "unavailable", studentRef: "" }; }
}

export function writeMemory(storage, key, studentRef) {
  try {
    if (studentRef) {
      if (!uuid.test(studentRef)) return false;
      storage.setItem(key, JSON.stringify({ version: 1, studentRef }));
      return readMemory(storage, key).studentRef === studentRef;
    }
    storage.removeItem(key);
    return storage.getItem(key) === null;
  } catch { return false; }
}

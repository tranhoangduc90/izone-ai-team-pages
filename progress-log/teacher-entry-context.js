// Chỉ chọn phiếu trong dữ liệu máy chủ đã cấp quyền cho giảng viên.
// Không mở phiếu học viên, tạo attempt hay coi public token là giấy phép.
export function resolveTeacherAssignment(assignments, classes, href) {
  const url = new URL(href);
  const token = new URLSearchParams(url.hash.slice(1)).get('assignment') || '';
  if (!token) return null;
  const selected = assignments.find(item => item.public_token === token);
  if (!selected || !classes.some(item => String(item.class_id) === String(selected.class_id))) {
    throw new Error('Phiếu từ link này không còn được mở hoặc tài khoản chưa có quyền xem. Hãy kiểm tra lại link hoặc tài khoản Google.');
  }
  return selected;
}

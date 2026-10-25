import { allowedGroup, classMatches, classRefOf, memoryKey, officialStudent, readMemory,
  resolveRememberedStudent, rosterGroups, studentRefOf, writeMemory } from "./student-memory.js?v=20260905-memory-v3";

// Nhận form và roster mới, chọn sẵn đúng UUID và đồng bộ các tab chưa mở bài.
// Danh tính bài đang làm được giữ cố định; lỗi lưu hoặc lỗi xóa bộ nhớ sẽ được báo rõ.
export function installStudentMemory(options) {
  const { config, apiBase, roster, form, classSelect, studentSelect, refreshStudents,
    refreshAccessCode, resetIdentityFields = () => {}, resumeButton, workspace,
    workspaceActions, beforeSwitch, notice } = options;
  const groups = rosterGroups(roster);
  if (!groups.some((group) => allowedGroup(group, config))) return null;
  const key = memoryKey(apiBase, location.href);
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  const requested = new URLSearchParams(location.search).get("class")?.trim() || "";
  const label = document.createElement("label");
  label.className = "checkbox-row";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = "remember-student";
  checkbox.checked = true;
  label.append(checkbox, document.createTextNode("Ghi nhớ tôi trên thiết bị này"));
  const status = document.createElement("p");
  status.id = "remember-student-status";
  status.className = "muted";
  status.setAttribute("role", "status");
  const change = document.createElement("button");
  change.type = "button";
  change.className = "secondary";
  change.id = "change-remembered-student";
  change.textContent = "Đổi người học";
  form.querySelector('[type="submit"]').before(label, status, change);
  const changeActive = change.cloneNode(true);
  changeActive.id = "change-active-student";
  workspaceActions.append(changeActive);
  // Khôi phục bằng đúng danh tính đã chọn, không lấy bài gần nhất của người khác.
  resumeButton.hidden = true;
  let busy = false;
  let preference = true;
  let disabledBefore = [];
  let rememberThisOpen = false;
  let activeStudentRef = "";
  const selection = () => {
    const group = groups.find((item) => classRefOf(item) === classSelect.value);
    const matches = group?.students.filter((item) => studentRefOf(item) === studentSelect.value) || [];
    return { group, student: matches.length === 1 ? matches[0] : null };
  };
  const sync = () => {
    const { group, student } = selection();
    label.hidden = Boolean(group) && !allowedGroup(group, config);
    const temporary = (Boolean(student) && !officialStudent(student))
      || Boolean(form.querySelector('[id$="provisional-panel"]:not([hidden])'));
    checkbox.disabled = temporary || label.hidden || !storage;
    checkbox.checked = preference && !temporary;
    change.hidden = !studentSelect.value && !readMemory(storage, key).studentRef
      && !form.querySelector('[id$="provisional-panel"]:not([hidden])');
    status.textContent = temporary
      ? "Hồ sơ tạm chỉ dùng trong bài này, vẫn cần mã 4 số và chưa được ghi nhớ sang bài khác. Nếu đã có tên ở bài khác, hãy nhờ giảng viên đối soát."
      : "Bỏ tick nếu dùng máy chung. Chỉ chọn sẵn tên; bạn vẫn cần bấm Mở bài làm.";
  };
  const clearSelection = () => {
    if (busy) return false;
    const removed = writeMemory(storage, key, "");
    resetIdentityFields();
    studentSelect.value = "";
    refreshAccessCode();
    sync();
    status.textContent = removed ? "Đã quên lựa chọn trên thiết bị này. Hãy chọn người học."
      : "Không thể xóa ghi nhớ trong trình duyệt. Hãy kiểm tra cài đặt lưu dữ liệu.";
    studentSelect.focus();
    return removed;
  };
  const applyMemory = () => {
    const saved = readMemory(storage, key);
    const match = resolveRememberedStudent(groups, saved.studentRef, requested, config);
    resetIdentityFields();
    studentSelect.value = "";
    if (match) {
      classSelect.value = match.classRef;
      refreshStudents();
      studentSelect.value = match.studentRef;
    }
    refreshAccessCode();
    sync();
    if (match) status.textContent = "Đã chọn sẵn lớp và tên của bạn. Kiểm tra trước khi mở bài làm.";
    else if (saved.studentRef) status.textContent = "Chưa xác định được một lớp và hồ sơ phù hợp trong bài này. Hãy chọn lại.";
    else if (saved.status === "unavailable") status.textContent = "Trình duyệt chưa đọc được ghi nhớ. Bạn vẫn có thể chọn và làm bài.";
  };
  checkbox.addEventListener("change", () => { preference = checkbox.checked; });
  for (const select of [classSelect, studentSelect]) {
    select.addEventListener("change", () => { resetIdentityFields(); refreshAccessCode(); sync(); });
  }
  change.addEventListener("click", clearSelection);
  changeActive.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    workspace.inert = true;
    try {
      if (!(await beforeSwitch())) { notice("Chưa thể đổi người học. Hãy chờ xử lý hoặc lưu xong bài hiện tại."); return; }
      if (!writeMemory(storage, key, "")) { notice("Chưa thể xóa ghi nhớ. Bài hiện tại vẫn được giữ."); return; }
      location.reload();
    } catch { notice("Chưa thể đổi người học. Bài hiện tại vẫn được giữ."); }
    finally { workspace.inert = false; busy = false; }
  });
  // Tab đang làm bài không nhận danh tính khác; chỉ màn chọn tên được cập nhật.
  window.addEventListener("storage", (event) => {
    if (event.storageArea !== storage || (event.key !== key && event.key !== null)) return;
    if (activeStudentRef || !workspace.hidden) {
      if (readMemory(storage, key).studentRef !== activeStudentRef) notice("Lựa chọn ghi nhớ đã đổi ở tab khác. Bài này vẫn thuộc người học đang hiển thị. Dùng Đổi người học nếu cần chuyển.");
    } else if (!busy) applyMemory();
    else status.textContent = "Lựa chọn ghi nhớ đã đổi ở tab khác. Kiểm tra tên sau khi xử lý xong.";
  });
  if (requested) {
    const matches = groups.filter((group) => classMatches(group, requested));
    if (matches.length === 1) { classSelect.value = classRefOf(matches[0]); refreshStudents(); }
  }
  applyMemory();
  return {
    refresh: sync,
    // Dùng chung khóa cho mở phiên và tạo hồ sơ, tránh đổi lớp giữa lúc gửi yêu cầu.
    begin() {
      if (busy) return false;
      busy = true;
      rememberThisOpen = checkbox.checked && !checkbox.disabled;
      disabledBefore = [...form.elements].map((element) => [element, element.disabled]);
      for (const [element] of disabledBefore) element.disabled = true;
      return true;
    },
    complete(identity) {
      activeStudentRef = identity.studentRef;
      const { group, student } = selection();
      const eligible = allowedGroup(group || {}, config) && officialStudent(student)
        && classRefOf(group) === identity.classRef && studentRefOf(student) === identity.studentRef;
      const ok = writeMemory(storage, key, rememberThisOpen && eligible ? identity.studentRef : "");
      if (!ok) notice("Đã mở bài, nhưng trình duyệt chưa lưu được lựa chọn. Lần sau bạn có thể cần chọn lại.");
    },
    end() {
      for (const [element, disabled] of disabledBefore) element.disabled = disabled;
      disabledBefore = [];
      busy = false;
      sync();
    },
  };
}

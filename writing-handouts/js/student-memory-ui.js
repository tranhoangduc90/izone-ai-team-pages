import { allowedGroup, classMatches, classRefOf, memoryKey, officialStudent, readMemory,
  resolveRememberedStudent, rosterGroups, studentRefOf, writeMemory } from "./student-memory.js";

// Nhận form và roster của app hiện tại, thêm ghi nhớ tự nguyện và chọn sẵn đã kiểm.
// Không mở phiên tự động. Nếu trình duyệt không lưu được, báo ngay và giữ chọn thủ công.
export function installStudentMemory(options) {
  const { config, apiBase, roster, form, classSelect, studentSelect, refreshStudents,
    refreshAccessCode, resumeButton, workspace, workspaceActions, beforeSwitch, notice } = options;
  const groups = rosterGroups(roster);
  if (!groups.some((group) => allowedGroup(group, config))) return null;
  const key = memoryKey(apiBase, location.href);
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  const saved = readMemory(storage, key);
  const requested = new URLSearchParams(location.search).get("class")?.trim() || "";
  const label = document.createElement("label");
  label.className = "checkbox-row";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = "remember-student";
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
  // Mở bài bằng danh tính được chọn để khôi phục đúng phiên, không lấy bài gần nhất của người khác.
  resumeButton.hidden = true;
  let busy = false;
  let disabledBefore = [];
  let rememberThisOpen = false;
  const selection = () => {
    const group = groups.find((item) => classRefOf(item) === classSelect.value);
    const matches = group?.students.filter((item) => studentRefOf(item) === studentSelect.value) || [];
    return { group, student: matches.length === 1 ? matches[0] : null };
  };
  const sync = () => {
    const { group, student } = selection();
    label.hidden = !allowedGroup(group || {}, config);
    checkbox.disabled = !officialStudent(student) || label.hidden || !storage;
    if (checkbox.disabled) checkbox.checked = false;
    change.hidden = !studentSelect.value && !readMemory(storage, key).studentRef;
    status.textContent = student && !officialStudent(student)
      ? "Hồ sơ tạm vẫn cần mã truy cập; không ghi nhớ để chọn sang bài khác."
      : "Chỉ ghi nhớ trên thiết bị cá nhân. Bạn vẫn cần bấm Mở bài làm.";
  };
  const clearSelection = () => {
    const removed = writeMemory(storage, key, "");
    checkbox.checked = false;
    studentSelect.value = "";
    refreshAccessCode();
    sync();
    status.textContent = removed ? "Đã quên lựa chọn. Hãy chọn người học." : "Không thể xóa ghi nhớ trong trình duyệt. Hãy kiểm tra cài đặt lưu dữ liệu.";
    studentSelect.focus();
    return removed;
  };
  classSelect.addEventListener("change", () => { checkbox.checked = false; sync(); });
  studentSelect.addEventListener("change", () => { checkbox.checked = false; sync(); });
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
  // Query lớp có ưu tiên; chỉ điền ID có trong đúng roster mới trả về.
  if (requested) {
    const matches = groups.filter((group) => classMatches(group, requested));
    if (matches.length === 1) { classSelect.value = classRefOf(matches[0]); refreshStudents(); }
  }
  const match = resolveRememberedStudent(groups, saved.studentRef, requested, config);
  if (match) {
    classSelect.value = match.classRef;
    refreshStudents();
    studentSelect.value = match.studentRef;
    refreshAccessCode();
    checkbox.checked = true;
  }
  sync();
  if (match) status.textContent = "Đã chọn sẵn lớp và tên của bạn. Kiểm tra trước khi mở bài làm.";
  else if (saved.studentRef) status.textContent = "Chưa xác định được một lớp và hồ sơ phù hợp trong bài này. Hãy chọn lại.";
  else if (saved.status === "unavailable") status.textContent = "Trình duyệt chưa đọc được ghi nhớ. Bạn vẫn có thể chọn và làm bài.";

  return {
    // Khóa form khi mở phiên để bấm đôi hoặc đổi dropdown không đổi đích giữa request.
    begin() {
      if (busy) return false;
      busy = true;
      rememberThisOpen = checkbox.checked && !checkbox.disabled;
      disabledBefore = [...form.elements].map((element) => [element, element.disabled]);
      for (const [element] of disabledBefore) element.disabled = true;
      return true;
    },
    complete(identity) {
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
    },
  };
}

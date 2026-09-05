import test from "node:test";
import assert from "node:assert/strict";
import { memoryKey, readMemory, resolveRememberedStudent, writeMemory } from "../js/student-memory.js";

// Nhận roster và bộ nhớ giả; kiểm ghép đúng ID ở biên 0/1/nhiều và lỗi lưu.
// Không có dữ liệu thật hay mạng. Assertion báo rõ quy tắc bị vi phạm khi test lỗi.
const student = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const config = { enabled: true, classCodes: ["LOPTHU", "LOPKHAC"] };
const group = (classRef, className = "LOPTHU", students = [{ studentRef: student }]) => ({ classRef, className, students });
const resolve = (groups, requested = "", settings = config) => resolveRememberedStudent(groups, student, requested, settings);

test("Bài mới dùng mã lớp của roster mới", () => {
  assert.equal(resolve([group("new-class")]).classRef, "new-class");
});
test("0 hoặc nhiều lớp không tự chọn; link phân biệt được lớp", () => {
  assert.equal(resolve([]), null);
  const groups = [group("class-a"), group("class-b", "LOPKHAC")];
  assert.equal(resolve(groups), null);
  assert.equal(resolve(groups, " lopkhac ").classRef, "class-b");
});
test("Link sai hoặc không có học viên không được lấy lớp trong bộ nhớ", () => {
  assert.equal(resolve([group("a")], "KHONGCO"), null);
  assert.equal(resolve([group("a"), group("b", "LOPKHAC", [])], "LOPKHAC"), null);
});
test("Cùng tên và đổi thứ tự vẫn lấy đúng UUID", () => {
  const students = [{ studentRef: other, alias: "Cùng tên" }, { studentRef: student, alias: "Cùng tên" }];
  assert.equal(resolve([group("a", "LOPTHU", students)]).studentRef, student);
  assert.equal(resolve([group("a", "LOPTHU", students.reverse())]).studentRef, student);
});
test("Hồ sơ tạm, mã truy cập và ID hỏng không được tự nhận", () => {
  for (const flags of [{ provisional: true }, { temporary: true }, { requiresAccessCode: true }]) {
    assert.equal(resolve([group("a", "LOPTHU", [{ studentRef: student, ...flags }])]), null);
  }
  assert.equal(resolveRememberedStudent([group("a")], "bad-id", "", config), null);
});
test("Roster trùng hoặc query lớp mơ hồ không tự nhận", () => {
  assert.equal(resolve([group("a"), group("a")], "LOPTHU"), null);
  assert.equal(resolve([group("a", "LOPTHU", [{ studentRef: student }, { studentRef: student }])]), null);
});
test("Tắt cấu hình và lớp ngoài phạm vi giữ chọn thủ công", () => {
  assert.equal(resolve([group("a")], "", { ...config, enabled: false }), null);
  assert.equal(resolve([group("a")], "", { enabled: true, classCodes: [] }), null);
  assert.equal(resolve([group("a", "LOPNGOAI")]), null);
});
test("Phạm vi phát hành nhận đúng hai mã lớp CS có dấu chấm", () => {
  const release = { enabled: true, classCodes: ["CS.070626", "CS.160826"] };
  for (const className of release.classCodes) {
    assert.equal(resolve([group("scope-for-current-activity", className)], className.toLowerCase(), release).studentRef, student);
  }
  for (const className of ["IC2200", "CS", "CS.070626-extra", "CS.999999"]) {
    assert.equal(resolve([group("a", className)], className, release), null);
  }
});
test("Bộ nhớ chỉ chứa version/UUID, ghi lặp không nhân bản, xóa có readback", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  assert.equal(writeMemory(storage, "key", student), true);
  assert.equal(writeMemory(storage, "key", student), true);
  assert.equal(data.size, 1);
  assert.deepEqual(JSON.parse(data.get("key")), { version: 1, studentRef: student });
  assert.equal(writeMemory(storage, "key", ""), true);
  assert.equal(readMemory(storage, "key").status, "empty");
});

test("Toàn bộ lớp vẫn kiểm roster, lớp từ link và hồ sơ chính thức", () => {
  const global = { enabled: true, allClasses: true };
  for (const name of ["CS.070626", "IC2200", "LOP-MOI-2027"]) {
    assert.equal(resolve([group("new-scope", name)], name, global).studentRef, student);
  }
  assert.equal(resolve([group("a")], "LOP-SAI", global), null);
  assert.equal(resolve([group("a", "LOPTHU", [{ studentRef: other }])], "", global), null);
  assert.equal(resolve([group("a", "LOPTHU", [{ studentRef: student, temporary: true }])], "", global), null);
  assert.equal(resolve([group("a")], "", { ...global, enabled: false }), null);
  assert.equal(resolve([group("a")], "", { enabled: true, allClasses: "true" }), null);
});
test("Lỗi JSON, schema, read/write/delete và ghi im lặng đều không thành success", () => {
  for (const raw of ["{", '{"version":2}', '{"version":1,"studentRef":"bad"}']) {
    assert.equal(readMemory({ getItem: () => raw }, "key").studentRef, "");
  }
  const denied = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); }, removeItem() { throw Error("blocked"); } };
  assert.equal(readMemory(denied, "key").status, "unavailable");
  assert.equal(writeMemory(denied, "key", student), false);
  assert.equal(writeMemory(denied, "key", ""), false);
  assert.equal(writeMemory({ setItem() {}, getItem: () => null }, "key", student), false);
  assert.equal(readMemory(null, "key").status, "unavailable");
});
test("Hai app cùng API dùng chung key; API khác không chia sẻ", () => {
  const root = "https://example.test/writing-api/";
  assert.equal(memoryKey(root, "https://pages.test/writing/index.html"), memoryKey(root, "https://pages.test/writing/lesson.html"));
  assert.notEqual(memoryKey(root, "https://pages.test/"), memoryKey("https://example.test/other-api/", "https://pages.test/"));
});

test("Writing và Term/Progress chính thức chung sổ; bản demo giữ kho riêng", () => {
  const page = "https://tranhoangduc90.github.io/izone-ai-team-pages/";
  const key = memoryKey("https://ducizone.ddns.net/writing-api/", page);
  assert.equal(key, memoryKey("https://ducizone.ddns.net/mapping-api", page));
  assert.notEqual(key, memoryKey("https://ducizone.ddns.net/mapping-api-demo", page));
  assert.notEqual(key, memoryKey("https://other.test/mapping-api", page));
});

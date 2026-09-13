import assert from "node:assert/strict";
import test from "node:test";
import {
  classAvailable,
  dashboardUrl,
  sortHandoutsByWritingLesson,
  studentUrl,
} from "../js/library-core.js";

test("sortHandoutsByWritingLesson xếp đúng thứ tự buổi Writing", () => {
  const result = sortHandoutsByWritingLesson([
    { title: "B", lessonId: "lesson-02", writingLesson: 2 },
    { title: "A", lessonId: "lesson-01", writingLesson: 1 },
    { title: "C", lessonId: "lesson-03", writingLesson: 3 },
  ]);
  assert.deepEqual(result.map((item) => item.title), ["A", "B", "C"]);
});

test("classAvailable không phân biệt hoa thường", () => {
  assert.equal(classAvailable({ classes: ["CS.070626"] }, "cs.070626"), true);
  assert.equal(classAvailable({ classes: ["CS.070626"] }, "CS.160826"), false);
});

test("studentUrl tạo đúng route Task 1 và query lớp", () => {
  const url = studentUrl({ slug: "australian-destinations-1999-2009", studentPath: "./index.html" }, "CS.070626", "https://example.test/writing-handouts/library.html");
  assert.equal(url, "https://example.test/writing-handouts/index.html?task=australian-destinations-1999-2009&class=CS.070626");
});

test("dashboardUrl tạo đúng route dashboard dùng chung", () => {
  const url = dashboardUrl({ slug: "writing-task2-public-health-ban" }, "CS.160826", "https://example.test/writing-handouts/library.html");
  assert.equal(url, "https://example.test/writing-handouts/teacher.html?task=writing-task2-public-health-ban&class=CS.160826");
});

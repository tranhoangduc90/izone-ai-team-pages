import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sortHandoutsByWritingLesson } from "../js/library-core.js";

const root = new URL("../", import.meta.url);

test("danh mục chứa đủ 11 buổi Writing theo đúng thứ tự", async () => {
  const library = JSON.parse(await readFile(new URL("library.json", root), "utf8"));
  assert.equal(library.course.id, "speaking-writing-chuyen-sau");
  assert.deepEqual(library.course.classCodes, ["CS.070626", "CS.160826"]);
  assert.equal(library.handouts.length, 11);
  assert.deepEqual(
    sortHandoutsByWritingLesson(library.handouts).map((item) => item.lessonId),
    library.handouts.map((item) => item.lessonId),
  );
  assert.deepEqual(library.handouts.map((item) => item.writingLesson), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(new Set(library.handouts.map((item) => item.lessonId)).size, 11);
  assert.equal(library.handouts.some((item) => item.classes.includes("IC2200")), false);
  assert.ok(library.handouts.every((item) => [1, 2].includes(item.taskNumber)));
  assert.ok(library.handouts.every((item) => JSON.stringify(item.classes) === JSON.stringify(["CS.070626", "CS.160826"])));
});

test("mỗi mục thư viện khớp manifest công khai và chỉ dùng lớp của đúng khóa", async () => {
  const library = JSON.parse(await readFile(new URL("library.json", root), "utf8"));
  const allowedClasses = new Set(library.course.classCodes);
  for (const item of library.handouts) {
    const manifest = JSON.parse(await readFile(new URL(`manifests/${item.slug}.json`, root), "utf8"));
    assert.equal(manifest.activity.slug, item.slug);
    assert.equal(manifest.task.statement, item.statement);
    assert.ok(item.classes.length > 0);
    assert.ok(item.classes.every((classCode) => allowedClasses.has(classCode)));
  }
});

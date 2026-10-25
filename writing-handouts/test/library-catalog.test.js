import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sortHandoutsByWritingLesson } from "../js/library-core.js";

const root = new URL("../", import.meta.url);

test("danh mục chứa đủ 14 buổi Writing theo đúng thứ tự", async () => {
  const library = JSON.parse(await readFile(new URL("library.json", root), "utf8"));
  assert.equal(library.course.id, "speaking-writing-chuyen-sau");
  assert.deepEqual([...library.course.classCodes].sort(), ["CS.070724", "CS.280924", "CS.171124", "CS.221224", "CS.090225", "CS.300325", "CS.100825", "CS.071225", "CS.281225", "CS.070626", "CS.160826", "CS.181026"].sort());
  assert.equal(library.handouts.length, 14);
  assert.deepEqual(
    sortHandoutsByWritingLesson(library.handouts).map((item) => item.lessonId),
    library.handouts.map((item) => item.lessonId),
  );
  assert.deepEqual(library.handouts.map((item) => item.writingLesson), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  assert.equal(new Set(library.handouts.map((item) => item.lessonId)).size, 14);
  assert.equal(new Set(library.handouts.map((item) => item.slug)).size, 14);
  assert.equal(library.handouts.some((item) => item.classes.includes("IC2200")), false);
  assert.ok(library.handouts.every((item) => [1, 2].includes(item.taskNumber)));
  const shops = library.handouts.find((item) => item.slug === 'writing-task2-public-health-ban');
  const task2=library.handouts.filter(item=>item.taskNumber===2);
  assert.equal(task2.length,8);
  for(const item of task2){
    assert.deepEqual(item.classes,library.course.classCodes);
    assert.equal(item.studentPath,'../sw-task2-writing/index.html');
    assert.equal(item.dashboardPath,'../sw-task2-writing/teacher.html');
  }
  assert.ok(library.handouts.filter(item => item.taskNumber===1).every((item) => JSON.stringify(item.classes) === JSON.stringify(["CS.070626", "CS.160826"])));

  const lesson3 = library.handouts.find((item) => item.writingLesson === 3);
  const lesson11 = library.handouts.find((item) => item.writingLesson === 11);
  const lesson12 = library.handouts.find((item) => item.writingLesson === 12);
  const lesson13 = library.handouts.find((item) => item.writingLesson === 13);
  assert.equal(lesson3?.slug, "writing-task2-live-performances-at-home");
  assert.equal(lesson11?.slug, "writing-task2-economic-development-environment");
  assert.equal(lesson11?.type, "Writing Task 2 · Discuss both views");
  assert.equal(lesson12?.slug, "writing-task2-english-medium-instruction");
  assert.equal(lesson12?.type, "Writing Task 2 · Advantages outweigh disadvantages");
  assert.equal(lesson13?.slug, "average-earnings-by-sector-2000-2010");
  assert.equal(lesson13?.type, "Writing Task 1 · Biểu đồ cột và bảng");
  assert.equal(lesson13?.studentPath, "./index.html");
  const lesson14 = library.handouts.find((item) => item.writingLesson === 14);
  assert.equal(lesson14?.slug, "mobile-phone-market-share-1994-2004");
  assert.equal(lesson14?.type, "Writing Task 1 · Biểu đồ đường");
  assert.equal(lesson14?.studentPath, "./index.html");
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

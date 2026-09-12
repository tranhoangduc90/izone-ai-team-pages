import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sortHandoutsChronologically } from "../js/library-core.js";

const root = new URL("../", import.meta.url);

test("danh mục chỉ chứa 5 handout Speaking Writing chuyên sâu theo thời gian", async () => {
  const library = JSON.parse(await readFile(new URL("library.json", root), "utf8"));
  assert.equal(library.course.id, "speaking-writing-chuyen-sau");
  assert.deepEqual(library.course.classCodes, ["CS.070626", "CS.160826"]);
  assert.equal(library.handouts.length, 5);
  assert.deepEqual(
    sortHandoutsChronologically(library.handouts).map((item) => item.slug),
    library.handouts.map((item) => item.slug),
  );
  assert.equal(library.handouts.some((item) => item.classes.includes("IC2200")), false);
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

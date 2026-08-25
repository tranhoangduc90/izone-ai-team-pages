import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Dữ liệu nhận vào: manifest công khai của đề lawbreakers.
// Việc chính: kiểm đúng đề, hai thân bài, sáu phần và không để lộ dữ liệu riêng tư.
// Kết quả: lỗi hiển thị ngay trong npm test; không có dữ liệu nào được ghi ra ngoài.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "manifests", "writing-task2-lawbreakers-prison-alternatives.json");

test("lawbreakers handout matches the two-body Lesson 13 contract", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.schemaVersion, "lesson-handout.v1");
  assert.equal(manifest.activity.slug, "writing-task2-lawbreakers-prison-alternatives");
  assert.match(manifest.task.statement, /all lawbreakers should be put into prison/u);
  assert.deepEqual(manifest.bodies.map((body) => body.key), ["body1", "body2"]);
  assert.equal(manifest.sections.length, 6);
  assert.equal(manifest.sections.every((section) => section.requiredFields.length === 3), true);
  assert.equal(manifest.vocabulary.staticRows.length, 12);
  assert.equal(manifest.messages.checkAccepted,
    "Đã bắt đầu check... Hệ thống đang chấm phần này; em không cần nhấn lại.");
  assert.doesNotMatch(JSON.stringify(manifest), /credential|api.?key|student.?data|Bearer /iu);
});

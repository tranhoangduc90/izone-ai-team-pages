import test from "node:test";
import assert from "node:assert/strict";
import { commentsForSection, isBackdropClick, latestVocabularyRows, mergeTeacherStudentDetail, technicalRecoveryMessage } from "../js/teacher-detail-core.js";

test("teacher detail keeps summary data and normalizes both Task 1 and Task 2 responses", () => {
  const summary = {
    responses: { topic_sentence: "Summary topic", overview: "Summary overview" },
    sections: { draft: { status: "queued" }, overview: { status: "draft" } },
    teacherComments: [{ threadRef: "old" }],
  };
  const session = {
    responses: { topic_sentence: "Latest topic" },
    overview: "Latest overview",
    body1: "Latest body 1",
    sections: { overview: { status: "revision" } },
  };
  const merged = mergeTeacherStudentDetail(summary, session);
  assert.equal(merged.responses.topic_sentence, "Latest topic");
  assert.equal(merged.responses.overview, "Latest overview");
  assert.equal(merged.responses.body1, "Latest body 1");
  assert.equal(merged.sections.draft.status, "queued");
  assert.equal(merged.sections.overview.status, "revision");
  assert.deepEqual(merged.teacherComments, [{ threadRef: "old" }]);
});

test("teacher detail shows newest comments for only the selected section", () => {
  const comments = [
    { section: "body1_topic", commentNumber: 1, feedback: "Cần sửa" },
    { section: "body1_support1", commentNumber: 1, feedback: "Phần khác" },
    { section: "body1_topic", commentNumber: 2, feedback: "Đã đạt" },
  ];
  assert.deepEqual(commentsForSection(comments, "body1_topic").map((item) => item.feedback), ["Đã đạt", "Cần sửa"]);
});

test("teacher detail uses the newest vocabulary artifact for each body", () => {
  const comments = [
    { createdAt: "2026-08-14T01:00:00Z", artifacts: { vocabulary: { body1: [{ idea: "cũ", terms: "old" }] } } },
    { createdAt: "2026-08-14T02:00:00Z", artifacts: { vocabulary: { body1: [{ idea: "mới", terms: "new" }] } } },
  ];
  assert.deepEqual(latestVocabularyRows(comments, "body1"), [{ idea: "mới", terms: "new" }]);
  assert.deepEqual(latestVocabularyRows(comments, "body2"), []);
});

test("only a click outside the dialog rectangle is treated as a backdrop click", () => {
  const rect = { left: 100, right: 900, top: 50, bottom: 700 };
  assert.equal(isBackdropClick({ clientX: 20, clientY: 200 }, rect), true);
  assert.equal(isBackdropClick({ clientX: 200, clientY: 200 }, rect), false);
});

test("technical recovery message does not invent an AI retry count", () => {
  assert.equal(
    technicalRecoveryMessage(true),
    "Lượt chấm gặp lỗi kỹ thuật. Bài viết vẫn được lưu an toàn; bạn có thể xếp lại chính Comment này.",
  );
  assert.equal(
    technicalRecoveryMessage(false),
    "Lượt chấm gặp lỗi kỹ thuật. Bài viết vẫn được lưu an toàn; hãy báo tài khoản quản trị để xếp chấm lại.",
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseMarkdownBlocks } from "../js/markdown.js";

const VERSION = "20260818-numbering-v3";

test("comment đánh số trong dữ liệu LMS thật tiếp tục qua các đoạn giải thích", async () => {
  const fixture = JSON.parse(await readFile(new URL("../demo-lms-draft-result.json", import.meta.url), "utf8"));
  const comment = fixture.lmsResponse.essays.flatMap((essay) => essay.comments || [])
    .find((value) => /^1\./u.test(value));
  const blocks = parseMarkdownBlocks(comment);
  const lists = blocks.filter((block) => block.type === "list");
  assert.deepEqual(lists.map((block) => block.start), [1, 2, 3]);
  assert.deepEqual(lists.map((block) => block.items[0].text.split(":", 1)[0]), [
    "**Chẩn đoán", "**Chẩn đoán", "**Chẩn đoán",
  ]);
});

test("bản học viên và giảng viên cùng tải bộ Markdown đã sửa, không dùng cache cũ", async () => {
  const javascriptSources = await Promise.all([
    "../js/app.js",
    "../js/lesson-app.js",
    "../js/teacher-app.js",
    "../js/lms-draft-result.js",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const htmlSources = await Promise.all([
    "../index.html",
    "../lesson.html",
    "../teacher.html",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const source of javascriptSources) assert.match(source, new RegExp(VERSION));
  for (const source of javascriptSources) assert.match(source, new RegExp(`markdown\\.js\\?v=${VERSION}`));
  assert.match(htmlSources[0], /app\.js\?v=[^"]+/u);
  assert.match(htmlSources[1], /lesson-app\.js\?v=[^"]+/u);
  assert.match(htmlSources[2], /teacher-app\.js\?v=[^"]+/u);
});

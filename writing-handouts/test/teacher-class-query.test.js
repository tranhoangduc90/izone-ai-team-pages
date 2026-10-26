import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("teacher dashboard áp dụng class query trước khi hiển thị danh sách học viên", async () => {
  const source = await readFile(new URL("../js/teacher-app.js", import.meta.url), "utf8");
  const entry = await readFile(new URL("../teacher.html", import.meta.url), "utf8");
  assert.match(entry,/task1-ui-loader\.js\?v=/u);
  const html = entry + await readFile(new URL('../js/task1-ui-loader.js',import.meta.url),'utf8');
  assert.match(source, /import \{ classQuery, resolveClassRef \}/u);
  assert.match(source, /state\.requestedClass = classQuery\(location\.search\)/u);
  assert.match(source, /return refresh\(\)/u);
  assert.match(html, /teacher-app\.js\?v=20261024-master170-errors2/u);
});

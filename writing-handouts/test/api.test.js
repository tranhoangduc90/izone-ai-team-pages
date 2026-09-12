import test from "node:test";
import assert from "node:assert/strict";
import { parseRetryAfterMs } from "../js/api.js";

test("Retry-After accepts seconds and HTTP dates", () => {
  assert.equal(parseRetryAfterMs("12"), 12_000);
  assert.equal(parseRetryAfterMs("Thu, 01 Jan 2026 00:00:10 GMT", Date.parse("Thu, 01 Jan 2026 00:00:00 GMT")), 10_000);
  assert.equal(parseRetryAfterMs("invalid"), null);
});

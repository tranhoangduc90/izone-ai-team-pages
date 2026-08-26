import test from "node:test";
import assert from "node:assert/strict";
import { advanceLiveDemo, createLiveDemoState, demoMetrics, forceNextAiFailures } from "../js/teacher-demo-core.js";

test("live demo starts every queued AI job without a fixed four-job cap", () => {
  const state = createLiveDemoState();
  assert.equal(state.students.length, 40);
  const queuedBefore = demoMetrics(state).waiting;
  assert.ok(queuedBefore > 4);
  advanceLiveDemo(state);
  assert.equal(demoMetrics(state).running, queuedBefore);
});

test("a workflow failure unlocks immediately while database saves continue", () => {
  const state = createLiveDemoState();
  const attemptRef = forceNextAiFailures(state, 1);
  const original = state.jobs.find((job) => job.attemptRef === attemptRef);
  const savesBefore = state.totalDatabaseSaves;
  for (let index = 0; index < 4 && original.status !== "failed"; index += 1) advanceLiveDemo(state);
  assert.equal(state.jobs.filter((job) => job.attemptRef === attemptRef).length, 1);
  assert.equal(original.status, "failed");
  assert.equal(state.students[original.studentIndex].status, "technical_error");
  assert.ok(state.totalDatabaseSaves > savesBefore);
});

test("AI failure creates a recoverable technical error without a revision streak", () => {
  const state = createLiveDemoState();
  const attemptRef = forceNextAiFailures(state, 1);
  const job = state.jobs.find((item) => item.attemptRef === attemptRef);
  const student = state.students[job.studentIndex];
  const streakBefore = student.failStreak;
  for (let index = 0; index < 4 && job.status !== "failed"; index += 1) advanceLiveDemo(state);
  assert.equal(job.status, "failed");
  assert.equal(student.status, "technical_error");
  assert.equal(student.failStreak, streakBefore);
});

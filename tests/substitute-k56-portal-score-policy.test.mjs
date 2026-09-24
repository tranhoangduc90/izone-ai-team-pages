import assert from 'node:assert/strict';
import test from 'node:test';
import { SUBSTITUTE_TEST_2_MAX_SCORES, calculateRetakePolicy } from
  '../term-tests/substitute-test-2-k56-shared/retake-policy.mjs';

test('Substitute 2 K56 dùng điểm thô 40/40 và Writing 9 như cột ERP', () => {
  assert.deepEqual(SUBSTITUTE_TEST_2_MAX_SCORES,
    { listening: 40, reading: 40, writing: 9 });
});

test('điểm thi lại giữ bước nguyên cho Nghe/Đọc, 0,1 cho Writing và đúng ba tên cột', () => {
  const result = calculateRetakePolicy({
    firstAttempt: { listening: 20, reading: 22, writing: 5 },
    retakeActual: { listening: 30, reading: 32, writing: 7 },
    maxScores: SUBSTITUTE_TEST_2_MAX_SCORES,
  });
  assert.equal(result.policy, 'cap_55');
  assert.ok(result.portalAveragePct >= 55 && result.portalAveragePct <= 57);
  assert.ok(Number.isInteger(result.portalScores.listening));
  assert.ok(Number.isInteger(result.portalScores.reading));
  assert.ok(Number.isInteger(result.portalScores.writing * 10));
  assert.deepEqual(Object.keys(result.portalFields).sort(), [
    'Term Test 2 Listening (Thi lại)',
    'Term Test 2 Reading (Thi lại)',
    'Term Test 2 Writing (Thi lại)',
  ].sort());
  assert.throws(() => calculateRetakePolicy({
    firstAttempt: { listening: 20, reading: 22, writing: 5 },
    retakeActual: { listening: 30.5, reading: 32, writing: 7 },
    maxScores: SUBSTITUTE_TEST_2_MAX_SCORES,
  }));
});

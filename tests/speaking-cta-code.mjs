import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSpeakingCta } from '../speaking-homework/speaking-cta-code.js';

const lesson5 = '67-speaking-on_tap_lam_ro_diem_giua';
const lesson9 = '67-speaking-freestyle_on_tap';

test('the full CTA code determines the route and remains the assignment key', () => {
  assert.deepEqual(resolveSpeakingCta(`?assignmentCode=${lesson5}-clone&lesson=9`, 9), {
    status: 'valid', lesson: 5, code: `${lesson5}-clone`
  });
  assert.deepEqual(resolveSpeakingCta(`?assignmentCode=${lesson9}-clone&documentId=Docs9`, 5), {
    status: 'valid', lesson: 9, code: `${lesson9}-clone`
  });
  assert.deepEqual(resolveSpeakingCta(`?assignmentCode=${lesson5}`, 5), {
    status: 'valid', lesson: 5, code: lesson5
  });
});

test('ambiguous, unknown and incomplete document CTAs are rejected', () => {
  for (const search of [
    '?documentId=Docs5&lesson=5',
    `?assignmentCode=${lesson5}-clone-extra`,
    `?assignmentCode=${lesson5}&assignmentCode=${lesson5}-clone`
  ]) {
    assert.deepEqual(resolveSpeakingCta(search, 5), { status: 'invalid' });
  }
  assert.deepEqual(resolveSpeakingCta(`?assignmentCode=${lesson5}-clone-extra`, 2), { status: 'invalid' });
});

test('direct and unrelated entries keep their established routes', () => {
  assert.deepEqual(resolveSpeakingCta('', 5), { status: 'legacy' });
  assert.deepEqual(resolveSpeakingCta('?assignmentCode=67-speaking-lam_ro&documentId=Docs3', 3), { status: 'legacy' });
});

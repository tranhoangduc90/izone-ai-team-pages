// Nối kết quả Substitute vào cửa sổ mẫu. Máy chủ xác minh lượt đã nộp trước
// khi trả lời giải; chỉ dùng bài làm local khi định danh phản hồi khớp đủ.
(function () {
  'use strict';
  const slug = 'substitute-test-1-k67';
  let controller;
  const same = (a, b) => ['testSlug', 'classCode', 'studentRef', 'attemptToken'].every(k => a?.[k] === b?.[k]);
  function check(response, id) {
    if (!same(response.review?.identity, id)) throw Error('Lời giải không khớp người học hoặc lượt đã chọn.');
    return response;
  }
  function reset() { controller?.abort(); controller = null; window.K67_ANSWER_EXPLANATIONS?.reset(); }
  async function studentReview(id, result) {
    controller?.abort();
    const pending = controller = new AbortController();
    const untrack = window.SUBSTITUTE_STATE.track(pending), timer = setTimeout(() => pending.abort(), 20000);
    try {
      const response = await fetch('https://ducizone.ddns.net/teacher-login-preview-api/substitute-teacher-api/review/explanations', {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, cache: 'no-store', credentials: 'omit',
        body: JSON.stringify(id), signal: pending.signal });
      const value = await response.json();
      if (!response.ok) throw Error(response.status === 409 ? 'Lượt thi đã thay đổi. Hãy tải lại kết quả.' : 'Chưa tải được lời giải.');
      check(value, id);
      if (pending.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      for (const skill of ['listening', 'reading']) if (!value.review.result[skill]?.details?.length && result[skill]?.details?.length)
        value.review.result[skill] = structuredClone(result[skill]);
      return value;
    } finally { clearTimeout(timer); untrack(); if (controller === pending) controller = null; }
  }
  function attachStudent({ container, payload, identity, title }) {
    if (identity.testSlug !== slug || !identity.attemptToken || !payload.completed) return;
    window.K67_ANSWER_EXPLANATIONS?.attach({ container, payload, ...identity, title,
      reviewKey: JSON.stringify(identity), loadReview: () => studentReview(identity, payload.result) });
  }
  function attachTeacher({ container, identity, source, title, loadReview }) {
    if (identity.testSlug !== slug) return;
    const result = Object.fromEntries(['listening', 'reading'].map(skill => [skill,
      source?.[skill]?.availability === 'available' ? source[skill].section :
        { details: Array.from({ length: 40 }, (_, i) => ({ number: i + 1, studentAnswer: '', correctAnswer: '', result: 'unknown' })) }]));
    window.K67_ANSWER_EXPLANATIONS?.attach({ container, payload: { completed: true, result }, ...identity, title,
      answerLabel: 'Bài làm học viên', reviewKey: JSON.stringify(identity), loadReview: async () => check(await loadReview(), identity) });
  }
  window.addEventListener('substitute:stopped', reset);
  window.SUBSTITUTE_ANSWER_EXPLANATIONS = Object.freeze({ attachStudent, attachTeacher, reset });
}());

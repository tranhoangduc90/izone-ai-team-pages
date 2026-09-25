(function () {
  'use strict';

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
  const TEST_SLUG = 'substitute-test-2-k56';
  const PILOT_CLASS_ID = 1252; // Lớp IC2264; các lớp khác chưa được bật nhánh lưu bài này.

  function invalidReceipt() {
    throw new Error('Chưa xác nhận được phiếu bài Writing. Hãy thử lại hoặc liên hệ giáo viên.');
  }

  // Dữ liệu vào: phản hồi nguyên dạng từ cổng n8n sau khi máy chủ đọc phiếu theo tên.
  // Việc chính: kiểm đúng đề, Task, lượt và trạng thái rồi đổi sang cấu trúc giao diện đang dùng.
  // Kết quả: chỉ bài đã nộp hợp lệ mới có phần Nghe/Đọc/Writing; thiếu dữ liệu thì dừng rõ lỗi.
  function statusForPage(response) {
    if (!response || typeof response !== 'object' || typeof response.accepted !== 'boolean') invalidReceipt();
    if (!response.accepted) {
      if (response.status !== null) invalidReceipt();
      return { accepted: false };
    }
    const status = response.status;
    if (!status || typeof status !== 'object' || status.testSlug !== TEST_SLUG
      || status.taskNumber !== 1 || !UUID.test(String(status.attemptId || ''))
      || status.classId !== PILOT_CLASS_ID) invalidReceipt();

    // Lượt đã mở nhưng chưa nộp Writing không được hiện như một bài đang chấm.
    if (status.attemptStatus === 'open' && status.submissionId === null
      && status.submissionStatus === null) return { accepted: false };

    if (status.attemptStatus !== 'submitted'
      || !UUID.test(String(status.submissionId || ''))
      || typeof status.submittedEssay !== 'string' || !status.submittedEssay.trim()
      || !status.sectionResults?.listening || !status.sectionResults?.reading
      || typeof status.portalSyncStatus !== 'string') invalidReceipt();

    const state = status.submissionStatus;
    let grading;
    if (state === 'pending' || state === 'running') {
      if (status.result !== null || status.taskScore !== null) invalidReceipt();
      grading = { status: 'processing', ready: false, tasks: [] };
    } else if (state === 'needs_review') {
      grading = { status: 'needs_review', ready: false, tasks: [] };
    } else if (state === 'completed' || state === 'delivered') {
      const result = status.result;
      if (!result || result.taskNumber !== 1
        || !Number.isFinite(result.taskScore)
        || result.taskScore !== status.taskScore
        || !Array.isArray(result.criteria) || result.criteria.length !== 4) invalidReceipt();
      grading = { status: 'ready', ready: true, task1Score: result.taskScore,
        writingScore: result.taskScore, tasks: [result] };
    } else invalidReceipt();

    return { accepted: true, attemptId: status.attemptId,
      submissionId: status.submissionId, submittedEssay: status.submittedEssay,
      sections: status.sectionResults, grading,
      portalSync: { status: status.portalSyncStatus } };
  }

  // Dữ liệu vào: HTTP 202 của cổng nộp Writing.
  // Việc chính: chỉ nhận thông báo đã lưu khi có đủ mã lượt và mã phiếu từ máy chủ.
  // Kết quả: nếu không đủ, giao diện giữ bản nháp và không báo đã nộp.
  function submittedReceipt(response) {
    if (!response || response.accepted !== true
      || !UUID.test(String(response.attemptId || ''))
      || !UUID.test(String(response.submissionId || ''))) invalidReceipt();
    return response;
  }

  window.K56_SUBSTITUTE_DURABLE_RESPONSE = Object.freeze({ statusForPage, submittedReceipt });
})();

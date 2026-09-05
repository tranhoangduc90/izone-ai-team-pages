(function () {
  'use strict';

  // Cấu trúc đề Webtest 34 — chỉ khai báo các phần, KHÔNG chứa đáp án hay nội dung.
  // Nội dung câu hỏi nằm ở content (bản mẫu) hoặc do máy chủ cấp theo phiên.
  window.TERM_TEST_CONFIG = Object.freeze({
    slug: 'webtest-34',
    title: 'Webtest 34',
    intro: 'Bài kiểm tra 5 phần dành cho học viên khối 03–34.',
    demoClassCode: 'CODEXWEB34',
    durationSeconds: 120 * 60,
    parts: [
      { id: 'vocabulary', title: 'Vocabulary', maxPoints: 25, kind: 'listen-write' },
      { id: 'listening', title: 'Listening', maxPoints: 15, kind: 'mixed' },
      { id: 'pronunciation', title: 'Pronunciation', maxPoints: 10, kind: 'mixed' },
      { id: 'translation', title: 'Translation', maxPoints: 32, kind: 'typed', aiGraded: true },
      { id: 'writing', title: 'Writing/Speaking', maxPoints: 18, kind: 'typed', aiGraded: true }
    ]
  });
}());

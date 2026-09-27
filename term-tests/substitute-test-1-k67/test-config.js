(function () {
  'use strict';
  const range = (start, end, kind = 'text', options) => Array.from({ length: end - start + 1 }, (_, index) => ({ number: start + index, kind, ...(options ? { options } : {}) }));
  const letters = end => Array.from({ length: end.charCodeAt(0) - 64 }, (_, index) => String.fromCharCode(65 + index));
  window.TERM_TEST_CONFIG = Object.freeze({
    slug: 'substitute-test-1-k67', title: 'Substitute Test 1 · Khóa 67', intro: 'Làm bài trực tiếp trên nội dung đề. Mỗi kỹ năng được lưu và nộp độc lập.',
    listening: { title: 'Listening · 40 câu', durationSeconds: 1639, totalQuestions: 40, description: ['Bài nghe gồm 4 phần và 40 câu.', 'Audio chỉ phát sau khi hoàn thành bước nghe thử.', 'Không có thời gian kiểm tra riêng sau khi audio kết thúc.'], controls: [...range(1, 10), ...range(11, 15, 'select', letters('G')), ...range(16, 26, 'select', letters('C')), ...range(27, 30, 'select', letters('F')), ...range(31, 40)] },
    reading: { title: 'Reading · 3 passages · 40 câu', durationMinutes: 60, totalQuestions: 40, description: ['Bạn có 60 phút để hoàn thành 3 passages và 40 câu.', 'Passage và câu hỏi có khung cuộn riêng.', 'Hết giờ hệ thống tự nộp bài.'], controls: [...range(1, 6), ...range(7, 13, 'select', ['TRUE', 'FALSE', 'NOT GIVEN']), ...range(14, 19, 'select', letters('H')), ...range(20, 23, 'select', letters('E')), ...range(24, 26), ...range(27, 32, 'select', letters('D')), ...range(33, 36, 'select', letters('I')), ...range(37, 40, 'select', ['YES', 'NO', 'NOT GIVEN'])] },
    writing: { durationMinutes: 55, planningMinutes: 15, totalQuestions: 1 }
  });
}());

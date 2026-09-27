(function () {
  'use strict';

  const range = (start, end, kind = 'text', options) =>
    Array.from({ length: end - start + 1 }, (_, index) => ({
      number: start + index,
      kind,
      ...(options ? { options } : {})
    }));
  const letters = end =>
    Array.from({ length: end.charCodeAt(0) - 64 }, (_, index) => String.fromCharCode(65 + index));

  window.TERM_TEST_CONFIG = Object.freeze({
    slug: 'substitute-test-2-k56',
    title: 'Substitute Test 2 · Khóa 56',
    intro: 'Làm bài trực tiếp trên nội dung đề. Mỗi kỹ năng được lưu và nộp độc lập.',
    listening: {
      title: 'Listening · 40 câu',
      // Metadata MP3 nguồn: 1708.1469387755103 giây.
      durationSeconds: 1708.1469387755103,
      totalQuestions: 40,
      description: [
        'Bài nghe gồm 4 phần và 40 câu.',
        'Audio dài khoảng 28 phút 28 giây và chỉ phát sau khi hoàn thành bước nghe thử.',
        'Không có thời gian kiểm tra riêng sau khi audio kết thúc.'
      ],
      controls: [
        ...range(1, 10),
        ...range(11, 14, 'select', letters('C')),
        ...range(15, 20, 'select', letters('H')),
        ...range(21, 26, 'select', letters('C')),
        ...range(27, 40)
      ]
    },
    reading: {
      title: 'Reading · 3 passages · 40 câu',
      durationMinutes: 70,
      totalQuestions: 40,
      description: [
        'Bạn có 70 phút để hoàn thành 3 passages và 40 câu.',
        'Passage và câu hỏi có khung cuộn riêng.',
        'Hết giờ hệ thống tự nộp bài.'
      ],
      controls: [
        ...range(1, 5, 'select', letters('H')),
        ...range(6, 13),
        ...range(14, 19, 'select', letters('I')),
        ...range(20, 26, 'select', ['TRUE', 'FALSE', 'NOT GIVEN']),
        ...range(27, 31, 'select', letters('I')),
        ...range(32, 34),
        ...range(35, 40, 'select', letters('D'))
      ]
    },
    writing: {
      durationMinutes: 30,
      planningMinutes: 0,
      totalQuestions: 1
    }
  });
}());

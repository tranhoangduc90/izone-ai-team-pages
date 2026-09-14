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
    slug: 'substitute-test-1-k56',
    title: 'Substitute Test 1 · Khóa 56',
    intro: 'Làm bài trực tiếp trên nội dung đề. Mỗi kỹ năng được lưu và nộp độc lập.',
    listening: {
      title: 'Listening · 40 câu',
      // Metadata MP3 kiểm trực tiếp trên bản online: 1728.535488 giây.
      durationSeconds: 1728.535488,
      totalQuestions: 40,
      description: [
        'Bài nghe gồm 4 phần và 40 câu.',
        'Audio dài khoảng 28 phút 49 giây và chỉ phát sau khi hoàn thành bước nghe thử.',
        'Không có thời gian kiểm tra riêng sau khi audio kết thúc.'
      ],
      controls: [
        ...range(1, 15),
        ...range(16, 20, 'select', letters('G')),
        ...range(21, 34),
        ...range(35, 40, 'select', letters('H'))
      ]
    },
    reading: {
      title: 'Reading · 2 passages · 26 câu',
      durationMinutes: 40,
      totalQuestions: 26,
      description: [
        'Bạn có 40 phút để hoàn thành 2 passages và 26 câu.',
        'Passage và câu hỏi có khung cuộn riêng.',
        'Hết giờ hệ thống tự nộp bài.'
      ],
      controls: [
        ...range(1, 6),
        ...range(7, 13, 'select', ['TRUE', 'FALSE', 'NOT GIVEN']),
        ...range(14, 20, 'select', ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']),
        ...range(21, 26, 'select', ['TRUE', 'FALSE', 'NOT GIVEN'])
      ]
    },
    writing: {
      durationMinutes: 55,
      planningMinutes: 15,
      totalQuestions: 1
    }
  });
}());

(function () {
  'use strict';

  function range(start, end, control) {
    return Array.from({ length: end - start + 1 }, (_, index) => ({
      number: start + index,
      ...control
    }));
  }

  function letters(first, last) {
    const values = [];
    for (let code = first.charCodeAt(0); code <= last.charCodeAt(0); code += 1) {
      values.push(String.fromCharCode(code));
    }
    return values;
  }

  window.TERM_TEST_CONFIG = Object.freeze({
    slug: 'term-test-1-k56',
    title: 'Term Test 1 · Khóa 56',
    intro: 'Làm bài trực tiếp trên nội dung đề. Mỗi kỹ năng được lưu và nộp độc lập.',
    listening: {
      title: 'Listening · 40 câu',
      durationSeconds: 1848,
      totalQuestions: 40,
      description: [
        'Bài nghe gồm 4 phần và 40 câu.',
        'Audio chỉ phát sau khi đã tải đủ và học viên hoàn thành bước nghe thử.',
        'Câu 32 có hai ô; chỉ được 1 điểm khi cả hai ô đều đúng.'
      ],
      controls: [
        ...range(1, 17, { kind: 'text' }),
        ...range(18, 20, { kind: 'select', options: letters('A', 'E') }),
        ...range(21, 31, { kind: 'text' }),
        { number: 32, kind: 'pair', keys: ['32a', '32b'] },
        { number: 33, kind: 'text' },
        ...range(34, 36, { kind: 'select', options: letters('A', 'C') }),
        ...range(37, 40, { kind: 'select', options: letters('A', 'I') })
      ]
    },
    reading: {
      title: 'Reading · 2 passages · 26 câu',
      durationMinutes: 40,
      totalQuestions: 26,
      description: [
        'Bài Reading gồm 2 passages và 26 câu.',
        'Bạn có 40 phút; đồng hồ tiếp tục chạy nếu tải lại trang.',
        'Kiểm tra đúng giới hạn từ trước khi nộp.'
      ],
      controls: [
        ...range(1, 6, { kind: 'select', options: ['TRUE', 'FALSE', 'NOT GIVEN'] }),
        ...range(7, 13, { kind: 'text' }),
        ...range(14, 17, { kind: 'select', options: ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'] }),
        ...range(18, 20, { kind: 'text' }),
        ...range(21, 26, { kind: 'select', options: ['YES', 'NO', 'NOT GIVEN'] })
      ]
    },
    writing: {
      durationMinutes: 55,
      planningMinutes: 15,
      totalQuestions: 1
    }
  });
}());

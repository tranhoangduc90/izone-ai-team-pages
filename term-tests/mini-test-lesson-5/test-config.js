(function () {
  function letters(first, last) {
    const values = [];
    for (let code = first.charCodeAt(0); code <= last.charCodeAt(0); code += 1) {
      values.push(String.fromCharCode(code));
    }
    return values;
  }

  function range(start, end, control) {
    return Array.from({ length: end - start + 1 }, (_, index) => ({
      number: start + index,
      ...control
    }));
  }

  window.TERM_TEST_CONFIG = Object.freeze({
    slug: 'mini-test-lesson-5',
    title: 'Mini Test Buổi 5',
    intro: 'Chọn đúng họ tên, làm Listening trước rồi chuyển sang Reading. Hệ thống lưu và chấm bài ngay sau khi bạn hoàn tất Reading.',
    listening: {
      title: 'Listening - Câu 11–30',
      description: [
        'Câu 11–16 và 21–26: chọn A, B hoặc C.',
        'Câu 17–20: chọn nhãn bản đồ từ A đến G.',
        'Câu 27–30: chọn đáp án ghép nối từ A đến F.',
        'Nếu bỏ trống trên answer sheet, để trống câu đó.'
      ],
      controls: [
        ...range(11, 16, { kind: 'select', options: letters('A', 'C') }),
        ...range(17, 20, { kind: 'select', options: letters('A', 'G') }),
        ...range(21, 26, { kind: 'select', options: letters('A', 'C') }),
        ...range(27, 30, { kind: 'select', options: letters('A', 'F') })
      ]
    },
    reading: {
      title: 'Reading - Câu 14–26',
      description: [
        'Câu 14–19: chọn heading từ i đến vii.',
        'Câu 20–21 và 22–23: mỗi nhóm chọn hai đáp án từ A đến E; không xét thứ tự.',
        'Câu 24–26: nhập một từ tiếng Anh.',
        'Nếu bỏ trống trên answer sheet, để trống câu đó.'
      ],
      controls: [
        ...range(14, 19, { kind: 'select', options: ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'] }),
        ...range(20, 23, { kind: 'select', options: letters('A', 'E') }),
        ...range(24, 26, { kind: 'text' })
      ]
    }
  });
})();

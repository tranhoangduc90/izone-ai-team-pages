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
    slug: 'term-test-2',
    title: 'Term Test 2',
    listening: {
      title: 'Listening - Câu 1–40',
      description: [
        'Nhập đáp án Listening từ answer sheet giấy.',
        'Câu 1–10, 15–20 và 31–40: nhập từ/cụm từ hoặc số theo đáp án đã ghi.',
        'Câu 11–14 và 21–30: chọn chữ cái tương ứng.',
        'Nếu bỏ trống trên answer sheet, để trống câu đó.'
      ],
      controls: [
        ...range(1, 10, { kind: 'text' }),
        ...range(11, 14, { kind: 'select', options: letters('A', 'C') }),
        ...range(15, 20, { kind: 'text' }),
        ...range(21, 26, { kind: 'select', options: letters('A', 'H') }),
        ...range(27, 28, { kind: 'select', options: letters('A', 'C') }),
        ...range(29, 30, { kind: 'select', options: letters('A', 'E') }),
        ...range(31, 40, { kind: 'text' })
      ]
    },
    reading: {
      title: 'Reading - Câu 1–40',
      description: [
        'Nhập đáp án Reading từ answer sheet giấy.',
        'Câu 1–4, 8–13, 19–22 và 38–40: nhập từ tiếng Anh.',
        'Các câu còn lại: chọn đáp án trong danh sách.',
        'Câu 23–24 và 25–26 là hai nhóm đáp án không xét thứ tự; mỗi ô chọn một chữ cái.',
        'Nếu bỏ trống trên answer sheet, để trống câu đó.'
      ],
      controls: [
        ...range(1, 4, { kind: 'text' }),
        ...range(5, 7, { kind: 'select', options: ['TRUE', 'FALSE', 'NOT GIVEN'] }),
        ...range(8, 13, { kind: 'text' }),
        ...range(14, 18, { kind: 'select', options: letters('A', 'G') }),
        ...range(19, 22, { kind: 'text' }),
        ...range(23, 26, { kind: 'select', options: letters('A', 'E') }),
        ...range(27, 32, { kind: 'select', options: letters('A', 'D') }),
        ...range(33, 37, { kind: 'select', options: letters('A', 'E') }),
        ...range(38, 40, { kind: 'text' })
      ]
    }
  });
})();

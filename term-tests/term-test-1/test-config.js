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
    slug: 'term-test-1',
    title: 'Term Test 1',
    listening: {
      title: 'Listening - Câu 1–40',
      description: [
        'Nhập đáp án Listening từ answer sheet giấy.',
        'Câu 1–10 và 31–40: nhập từ/cụm từ theo đáp án đã ghi.',
        'Câu 11–30: chọn chữ cái tương ứng.',
        'Nếu bỏ trống trên answer sheet, để trống câu đó.'
      ],
      controls: [
        ...range(1, 10, { kind: 'text' }),
        ...range(11, 14, { kind: 'select', options: letters('A', 'C') }),
        ...range(15, 20, { kind: 'select', options: letters('A', 'J') }),
        ...range(21, 24, { kind: 'select', options: letters('A', 'E') }),
        ...range(25, 30, { kind: 'select', options: letters('A', 'H') }),
        ...range(31, 40, { kind: 'text' })
      ]
    },
    reading: {
      title: 'Reading - Câu 1–40',
      description: [
        'Nhập đáp án Reading từ answer sheet giấy.',
        'Câu 8–13 và 21–24: nhập từ tiếng Anh.',
        'Các câu còn lại: chọn đáp án trong danh sách.',
        'Câu 25–26 là một nhóm hai đáp án; mỗi ô chọn một chữ cái.',
        'Nếu bỏ trống trên answer sheet, để trống câu đó.'
      ],
      controls: [
        ...range(1, 7, { kind: 'select', options: ['TRUE', 'FALSE', 'NOT GIVEN'] }),
        ...range(8, 13, { kind: 'text' }),
        ...range(14, 20, { kind: 'select', options: ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'] }),
        ...range(21, 24, { kind: 'text' }),
        ...range(25, 26, { kind: 'select', options: letters('A', 'E') }),
        ...range(27, 30, { kind: 'select', options: letters('A', 'D') }),
        ...range(31, 34, { kind: 'select', options: letters('A', 'G') }),
        ...range(35, 40, { kind: 'select', options: letters('A', 'C') })
      ]
    }
  });
})();

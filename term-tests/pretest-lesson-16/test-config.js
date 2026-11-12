(function () {
  const letters = last => Array.from({ length: last.charCodeAt(0) - 64 }, (_, i) => String.fromCharCode(65 + i));
  const range = (from, to, control) => Array.from({ length: to - from + 1 }, (_, i) => ({ number: from + i, ...control }));
  const select = (from, to, last) => range(from, to, { kind: 'select', options: letters(last) });
  const text = (from, to) => range(from, to, { kind: 'text' });

  window.TERM_TEST_CONFIG = Object.freeze({
    slug: 'pretest-lesson-16',
    title: 'Pretest Buổi 16',
    listening: {
      title: 'Listening - Câu 21–40',
      description: [
        'Câu 21–24: mỗi nhóm chọn hai đáp án từ A đến E, không xét thứ tự.',
        'Câu 25–30: chọn chữ cái từ A đến H. Câu 31–40: nhập một từ tiếng Anh.',
        'Nếu bỏ trống trên answer sheet, để trống câu đó.'
      ],
      controls: [...select(21, 24, 'E'), ...select(25, 30, 'H'), ...text(31, 40)]
    },
    reading: {
      title: 'Reading - Câu 14–26',
      description: [
        'Câu 14–17: chọn đoạn từ A đến G. Câu 18–22: nhập một từ tiếng Anh.',
        'Câu 23–24 và 25–26: mỗi nhóm chọn hai đáp án từ A đến E, không xét thứ tự.',
        'Nếu bỏ trống trên answer sheet, để trống câu đó.'
      ],
      controls: [...select(14, 17, 'G'), ...text(18, 22), ...select(23, 26, 'E')]
    }
  });
})();

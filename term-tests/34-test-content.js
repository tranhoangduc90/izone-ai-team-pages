(function () {
  'use strict';

  // NỘI DUNG MẪU GIẢ LẬP — chỉ để chạy demo giao diện và luồng.
  // KHÔNG chứa đề hay đáp án thật của khóa 34. Câu thật sẽ được thay sau
  // qua nội dung từ máy chủ (theo phiên) hoặc bản content riêng không công khai.
  //
  // Ghi chú cấu trúc theo đề thật (để thay sau):
  // - Vocabulary 25: Ex1 nghe-chép 25 từ/cụm; Ex2 tranh-viết 25 từ.
  // - Listening 15: Part 1 order A–E (5); Part 2 table ONE WORD (5); Part 3 T/F (5).
  // - Pronunciation 10: Part 1 IPA→word (10); Part 2 word→IPA trắc nghiệm A/B/C (10).
  // - Translation 32: 8 câu Việt→Anh, AI chấm theo cấu trúc.
  // - Writing/Speaking 18: 3 câu tự luận, AI chấm theo cấu trúc checkbox.
  //
  // Bản public chỉ chứa prompt và cấu trúc; đáp án/rubric thật nằm ở server.

  const demoPicture = (label) =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120">` +
      `<rect width="180" height="120" fill="#eef2f7" rx="10"/>` +
      `<text x="90" y="66" font-size="17" text-anchor="middle" font-family="sans-serif" fill="#23456a">${label}</text>` +
      `</svg>`
    )}`;

  const content = {
    vocabulary: {
      title: 'Vocabulary · 25 từ',
      exercise1: {
        label: 'EXERCISE 1 · Nghe và viết từ/cụm từ (để dành nghĩa cho phần sau)',
        items: [
          { number: 1, hint: 'môi trường' },
          { number: 2, hint: 'đi ăn ngoài' }
        ]
      },
      exercise2: {
        label: 'EXERCISE 2 · Nhìn tranh và viết từ/cụm từ',
        items: [
          { number: 3, image: demoPicture('Hành lang'), hint: 'dãy hành lang trong trường' },
          { number: 4, image: demoPicture('Đi xe đạp'), hint: 'đi học bằng xe đạp' }
        ]
      }
    },

    listening: {
      title: 'Listening · 15 câu',
       description: 'Mỗi phần nghe có hướng dẫn riêng. Audio chính thức được cấp theo phiên thi.',
      part1: {
        label: 'Part 1 · American families today',
        instruction: 'Listen and order the sentences from A to E. (Sắp xếp câu A–E theo thứ tự nghe.)',
        sentences: [
          { letter: 'A', text: 'American families are changing from the way they used to be.' },
          { letter: 'B', text: 'Many US marriages end in divorce, and many people stay single.' },
          { letter: 'C', text: 'The changing family types.' },
          { letter: 'D', text: 'Working women are one reason traditional families are fewer.' },
          { letter: 'E', text: 'The main difference is that families are smaller.' }
        ]
      },
      part2: {
        label: 'Part 2 · My favourite teacher',
        instruction: 'Listen and complete the table. WRITE ONE WORD ONLY. (Điền MỘT TỪ cho mỗi chỗ trống.)',
        rows: [
          { label: 'Mr Lambert’s appearance', cells: ['dark hair', '(1) ______ legs', 'thick beard'] },
          { label: 'His teaching style', cells: ['brings energy', 'does not use (2) ______ in class'] },
          { label: 'An unforgettable lesson', cells: ['used a (3) ______ to teach “above”'] }
        ],
         gapAnswers: [{ number: 1 }, { number: 2 }, { number: 3 }]
      },
      part3: {
        label: 'Part 3 · I Spy',
        instruction: 'Listen and mark T (true) or F (false). (Nghe và chọn Đúng/Sai.)',
        items: [
           { number: 1, sentence: 'Betsy is Billy’s sister.' },
           { number: 2, sentence: 'The father suggests playing “I Spy”.' },
           { number: 3, sentence: 'The mother reminds Billy to use good manners.' }
        ]
      }
    },

    pronunciation: {
      title: 'Pronunciation · 20 từ',
      part1: {
        label: 'Part 1 · Viết từ cho phiên âm (provide the words for the phonetic transcript)',
        items: [
           { number: 1, ipa: '/ˈhʌzbənd/', hint: 'người chồng' },
           { number: 2, ipa: '/ɪkˈspekt/', hint: 'mong đợi' },
           { number: 3, ipa: '/ˈriːzn/', hint: 'lý do' }
        ]
      },
      part2: {
        label: 'Part 2 · Chọn phiên âm đúng cho từ (provide the phonetic transcript)',
        items: [
           { number: 4, word: 'prefer', options: ['/prɪˈfɜːr/', '/prɪˈfər/', '/preˈfɜːr/'] },
           { number: 5, word: 'women', options: ['/ˈwɪmən/', '/ˈwʊmən/', '/ˈwɪmɪn/'] },
           { number: 6, word: 'teacher', options: ['/ˈtɪtʃər/', '/ˈtiːtʃɜːr/', '/ˈtiːtʃər/'] }
        ]
      }
    },

    translation: {
      title: 'Translation · 8 câu',
      description: 'Dịch câu Việt sang Anh. Bài thật sẽ chấm bằng AI theo cấu trúc; bản demo chỉ hiện gợi ý cấu trúc cần dùng.',
      sentences: [
        { number: 1, vi: 'Gia đình truyền thống ở Việt Nam hiện nay ít hơn trước đây.', structures: ['THERE ARE MORE ... THAN EVER BEFORE', 'traditional families', 'in Vietnam'] },
        { number: 2, vi: 'Kết hôn bây giờ rất tốn kém.', structures: ['IT’S BECOMING ... TO', 'very expensive', 'get married (these days/nowadays)'] }
      ]
    },

    writing: {
      title: 'Writing/Speaking · 3 câu',
      description: 'Gõ câu trả lời cho mỗi câu hỏi. Bài thật sẽ chấm bằng AI theo các cấu trúc được gợi ý.',
      questions: [
        { number: 1, prompt: 'Bạn thích gia đình đông con hay ít con? Vì sao?', structures: ['prefer ... to ...', 'more fun', 'In addition, / Besides,'] },
        { number: 2, prompt: 'Trên chuyến xe buýt dài, bạn thường làm gì cho đỡ chán?', structures: ['particularly like', 'an interesting way', 'often / usually'] }
      ]
    }
  };

  window.TERM_TEST_DEMO_CONTENT = Object.freeze(content);
}());

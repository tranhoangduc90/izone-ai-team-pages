(function () {
  'use strict';

  // Cấu hình cho index.html (Khóa 34 · Phase 1 · Test 1).
  // Tách riêng khỏi HTML để dễ đổi endpoint/audio khi chuyển môi trường.

  const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  window.WEBTEST_34_PREVIEW_CONFIG = Object.freeze({
    // Backend Term Test dùng chung. Roster KHÔNG cần Google token
    // (xem ARCHITECTURE.md: "GET /api/term-tests/roster — không cần Google token").
    // Lưu ý: backend production chỉ cho phép origin GitHub Pages (CORS).
    API_BASE_URL: isLocalPreview ? '' : 'https://ducizone.ddns.net/mapping-api',
    // Assignment public token chỉ dùng cho fixture local; production truyền token
    // qua query `?assignment=<public-token>` sau khi assignment thật được phát hành.
    LEARNING_API_BASE_URL: isLocalPreview ? 'http://localhost:3000' : 'https://ducizone.ddns.net/mapping-api',
    LEARNING_PUBLIC_TOKEN: isLocalPreview ? 'e4006177-1ef7-453b-a3b7-4fff12889e8e' : '',
    TEST_SLUG: 'webtest-34',
    // Khi mở ở local (file/http server) backend chặn CORS nên trang tự dùng
    // roster mẫu bên dưới để minh họa luồng. Khi deploy lên GitHub Pages,
    // API_BASE_URL có giá trị và mã lớp thật sẽ gọi roster thật.
    ENABLE_DEMO_ROSTER_FALLBACK: isLocalPreview,

    // Audio của Khóa 34 · Phase 1 · Test 1.
    AUDIO: {
      // Bản nghe thử để học viên kiểm tra loa/âm lượng TRƯỚC khi bắt đầu phần nghe.
      soundcheck: {
        remote: 'https://pub-7406d9d7254a4ef7b5d1ad82edb9964b.r2.dev/Audiotest_webtest/soundcheck.mp3'
      },
      // Audio chính thức — mỗi phần phát ĐÚNG MỘT LẦN, không dừng/tua được.
      vocabulary: {
        remote: 'https://pub-7406d9d7254a4ef7b5d1ad82edb9964b.r2.dev/Audiotest_webtest/Test1_Vocab.mp3'
      },
      listening: {
        remote: 'https://pub-7406d9d7254a4ef7b5d1ad82edb9964b.r2.dev/Audiotest_webtest/Test1_Listening.mp3'
      }
    }
  });
}());

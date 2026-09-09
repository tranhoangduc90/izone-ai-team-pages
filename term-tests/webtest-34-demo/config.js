(function () {
  'use strict';

  // Cấu hình cho index.html (Khóa 34 · Phase 1 · Test 1).
  // Tách riêng khỏi HTML để dễ đổi endpoint/audio khi chuyển môi trường.
  // Local preview cũng gọi API production; token production chỉ nhận từ URL fragment.

  const productionApi = 'https://ducizone.ddns.net/mapping-api';

  window.WEBTEST_34_PREVIEW_CONFIG = Object.freeze({
    // Backend Term Test dùng chung. Roster KHÔNG cần Google token
    // (xem ARCHITECTURE.md: "GET /api/term-tests/roster — không cần Google token").
    API_BASE_URL: productionApi,
    LEARNING_API_BASE_URL: productionApi,
    LEARNING_TEST_TOKEN: '',
    TEST_SLUG: 'webtest-34',
    // Khi mở local, dùng test token production trong fragment `#test=<test-token>`.
    // Không dùng roster/assignment fixture local và không tự fallback sang dữ liệu mẫu.
    ENABLE_DEMO_ROSTER_FALLBACK: false,

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

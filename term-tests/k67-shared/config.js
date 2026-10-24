// Các trang Term Test/Mini Test K67 gọi backend riêng. Đề, giao diện và nháp
// vẫn dùng mã xử lý hiện hành; cấu hình K56 không phụ thuộc file này.
window.TERM_TEST_APP_CONFIG = Object.freeze({
  EXAM_JOURNAL_ENABLED: true,
  EXAM_JOURNAL_BUILD: 'exam-journal-production-20261024-r1',
  API_BASE_URL: 'https://ducizone.ddns.net:18869/term-mini-k67-api',
  AUTH_MODE: 'google',
  GOOGLE_CLIENT_ID: '235597750133-urmb86ktf5recnvvtbghf13bktfv5rkj.apps.googleusercontent.com'
});

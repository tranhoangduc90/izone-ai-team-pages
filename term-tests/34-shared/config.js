const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);

window.TERM_TEST_APP_CONFIG = Object.freeze({
  // Bản demo 34 chạy hoàn toàn tĩnh: không gọi máy chủ. Khi có API riêng cho
  // webtest-34, đổi API_BASE_URL và bỏ LOCAL_DEMO_ONLY.
  API_BASE_URL: isLocalPreview ? window.location.origin : 'https://ducizone.ddns.net/mapping-api-demo',
  AUTH_MODE: 'none',
  GOOGLE_CLIENT_ID: '',
  LOCAL_DEMO_ONLY: true
});

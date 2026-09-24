// Mọi request trên trang thử chỉ đến dịch vụ demo; bộ nhớ học viên thật được tắt.
const localPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
window.PROGRESS_LOG_CONFIG = Object.freeze({
  API_BASE_URL: localPreview ? 'http://127.0.0.1:8792' : 'https://ducizone.ddns.net/mapping-api-progress-log-demo',
  DEMO_MODE: true,
  STUDENT_MEMORY: Object.freeze({ enabled: false, allClasses: false }),
  GOOGLE_CLIENT_ID: ''
});

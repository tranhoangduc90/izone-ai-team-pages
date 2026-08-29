/**
 * Cấu hình production cho giao diện chấm Reading/Listening khóa 67.
 * Trang chỉ biết hai địa chỉ webhook; quyền Google Docs và dữ liệu chấm nằm trong n8n.
 */
window.GRADER_CONFIG = Object.freeze({
  startUrl: 'https://ducizone.ddns.net/webhook/cham-ngay-reading-listening-67',
  statusUrl: 'https://ducizone.ddns.net/webhook/tien-do-cham-reading-listening-67',
  minimumCompletionPercent: 80,
  pollEveryMs: 1300,
  timeoutMs: 240000,
});

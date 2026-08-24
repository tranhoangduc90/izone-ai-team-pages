/**
 * Cấu hình công khai cho giao diện chấm Reading/Listening 67.
 * Trang chỉ biết hai địa chỉ webhook; quyền Google Docs và dữ liệu chấm nằm trong n8n.
 */
window.GRADER_CONFIG = Object.freeze({
  startUrl: 'https://ducizone.ddns.net/webhook/cham-ngay-reading-listening-67-demo',
  statusUrl: 'https://ducizone.ddns.net/webhook/tien-do-cham-reading-listening-67-demo',
  pollEveryMs: 1300,
  timeoutMs: 240000,
});

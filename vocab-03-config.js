/**
 * Cấu hình công khai của trang Vocab 03 trên GitHub Pages.
 * Trang chỉ biết endpoint nhận yêu cầu; credential Google Docs và Lark nằm trong n8n.
 */
window.GRADER_CONFIG = Object.freeze({
  startUrl: 'https://ducizone.ddns.net/webhook/cham-ngay-vocab-03-pilot',
  statusUrl: 'https://ducizone.ddns.net/webhook/tien-do-cham-vocab-03-pilot',
  pollEveryMs: 1300,
  timeoutMs: 180000,
});

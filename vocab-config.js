/**
 * Cấu hình công khai cho trang chấm Vocab 03, 04 và 11.
 * Credential Google Docs và Lark chỉ nằm trong n8n.
 */
window.GRADER_CONFIG = Object.freeze({
  startUrl: 'https://ducizone.ddns.net/webhook/cham-ngay-vocab-03-pilot',
  statusUrl: 'https://ducizone.ddns.net/webhook/tien-do-cham-vocab-03-pilot',
  allowedHomeworks: Object.freeze([3, 4, 11]),
  pollEveryMs: 1300,
  timeoutMs: 180000,
});

// Dữ liệu nhận vào: source dashboard tĩnh, không có credential hay dữ liệu production.
// Việc chính: khóa contract khôi phục phiên bằng cookie và chiều cao tiêu đề trên desktop/mobile.
// Kết quả: reload/tab mới không cần Google ID token trong browser storage và vùng làm việc rộng hơn.
// Khi lỗi: test chỉ rõ contract phiên hoặc CSS nào bị thay đổi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const appSource = readFileSync(new URL('../ai-gateway-dashboard/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../ai-gateway-dashboard/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../ai-gateway-dashboard/styles.css', import.meta.url), 'utf8');
const sessionSource = readFileSync(new URL('../ai-gateway-dashboard/session-client.js', import.meta.url), 'utf8');

test('dashboard dùng session client riêng, khôi phục phiên trước Google Sign-In và không lưu token', () => {
  assert.match(html, /session-client\.js\?v=/);
  assert.match(appSource, /sessionClient\.restore\(\)/);
  assert.match(appSource, /sessionClient\.login\(credential\)/);
  assert.doesNotMatch(appSource + html, /localStorage|sessionStorage/);
  assert.doesNotMatch(appSource, /Authorization\s*:/);
});

test('tiêu đề có contract gọn riêng cho desktop và mobile', () => {
  assert.match(css, /\.topbar\s*\{[^}]*padding:\s*10px\s+clamp\(/s);
  assert.match(css, /\.brand h1\s*\{[^}]*font-size:\s*clamp\(22px,[^,]+,26px\)/s);
  assert.match(css, /@media \(max-width:700px\)[^{]*\{[\s\S]*?\.brand p\s*\{\s*display:none;/);
});

test('session client gửi cookie tự động, CSRF cho ghi và không gửi Authorization', async () => {
  const requests = [];
  const fetchMock = async (url, options = {}) => {
    requests.push({ url, options });
    return {
      ok:true,
      status: url.endsWith('/auth/session') && options.method === 'POST' ? 201 : 200,
      async json() { return { operator:{ email:'operator@example.test', name:'Người vận hành' } }; },
    };
  };
  const context = vm.createContext({ window:{ fetch:fetchMock }, fetch:fetchMock });
  vm.runInContext(sessionSource, context);
  const client = context.window.AIGatewaySessionClient.create({ baseUrl:'https://gateway.example.test/ai-gateway-dashboard' });

  await client.restore();
  await client.login('google-id-token-once');
  await client.request('/rotation-sessions', {
    method:'POST', headers:{ 'x-change-reason':'test', 'x-idempotency-key':'idempotency-key' }, body:{ worker_id:'vps_3' },
  });

  assert.equal(requests[0].options.credentials, 'include');
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[1].options.credentials, 'include');
  assert.equal(requests[1].options.headers['x-izone-csrf'], '1');
  assert.deepEqual(JSON.parse(requests[1].options.body), { credential:'google-id-token-once' });
  assert.equal(requests[2].options.headers['x-change-reason'], 'test');
  assert.equal(requests[2].options.headers['x-izone-csrf'], '1');
  assert.equal(Object.keys(requests[2].options.headers).some(name => name.toLowerCase() === 'authorization'), false);
});

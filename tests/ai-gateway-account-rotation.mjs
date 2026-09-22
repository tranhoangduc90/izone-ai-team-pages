// Dữ liệu nhận vào: source dashboard và API giả không chứa credential thật.
// Việc chính: kiểm nút mở màn hình bảo mật, payload giới hạn đúng máy và không nhận JSON trên GitHub Pages.
// Kết quả: dashboard chỉ xin ticket ngắn hạn rồi chuyển sang gateway; không lưu secret trong trang công khai.
// Khi lỗi: node:test chỉ rõ contract giao diện hoặc quyền riêng tư bị thay đổi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = readFileSync(new URL('../ai-gateway-dashboard/app.js', import.meta.url), 'utf8');
const sessionSource = readFileSync(new URL('../ai-gateway-dashboard/session-client.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../ai-gateway-dashboard/index.html', import.meta.url), 'utf8');

class Element {
  children = [];
  style = {};
  dataset = {};
  value = '';
  hidden = false;
  disabled = false;
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener() {}
  querySelectorAll() { return []; }
  set textContent(value) { this.children = [String(value)]; }
  get textContent() { return this.children.map(child => typeof child === 'string' ? child : child.textContent).join(' '); }
}

function dashboardContext() {
  const elements = new Map();
  const requests = [];
  let assignedUrl = '';
  const fetchMock = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/auth/session')) {
      return {
        ok: false, status: 401,
        async json() { return { error:{ code:'google_login_required' } }; },
      };
    }
    return {
      ok: true, status: 201,
      async json() { return { worker_id: 'vps_3', path: 'google-account', ticket: 'ticket-safe-012345678901234567890123456789' }; },
    };
  };
  const context = vm.createContext({
    window: {
      AI_GATEWAY_DASHBOARD_CONFIG: {
        API_BASE_URL: 'https://gateway.example.test/ai-gateway-dashboard',
        GOOGLE_CLIENT_ID: 'client.apps.googleusercontent.com',
      },
      addEventListener() {}, setTimeout() {},
      fetch: fetchMock,
      location: { assign(value) { assignedUrl = value; } },
    },
    document: {
      createElement: () => new Element(),
      createTextNode: value => String(value),
      getElementById: id => {
        if (!elements.has(id)) elements.set(id, new Element());
        return elements.get(id);
      },
      querySelector: () => new Element(),
    },
    fetch: fetchMock,
    crypto: webcrypto,
    URL,
    URLSearchParams,
    encodeURIComponent,
  });
  vm.runInContext(sessionSource, context);
  vm.runInContext(source, context);
  return { context, elements, requests, assignedUrl: () => assignedUrl };
}

test('Pages không còn ô nhập hoặc xử lý trực tiếp JSON credential', () => {
  assert.doesNotMatch(html, /id="credentialFile"|id="credentialJson"|id="uploadCredential"/);
  assert.doesNotMatch(source, /JSON\.parse\(await file\.text\(\)\)|uploadCredential|activateCredential/);
  assert.doesNotMatch(source + sessionSource + html, /localStorage|sessionStorage|BEGIN PRIVATE KEY/);
  assert.match(html, /JSON được nhập trên trang bảo mật của gateway/);
});

test('mỗi thẻ máy có nút Thay tài khoản Google', () => {
  const { context, elements } = dashboardContext();
  context.renderWorkers([
    { id:'vps_1', display_name:'Máy xử lý 1', billing_account_name:'Google 1', weight:4, max_concurrency:4, enabled:true },
    { id:'vps_3', display_name:'Máy xử lý 3', billing_account_name:'Google 3', weight:1, max_concurrency:4, enabled:true },
  ], { vps_1:.8, vps_3:.2 });
  const cards = elements.get('workers').children;
  assert.equal(cards.length, 2);
  assert.match(cards[0].textContent, /Thay tài khoản Google/);
  assert.equal(cards[1].children.at(-1).children[1].dataset.rotateWorker, 'vps_3');
});

test('nút thay tài khoản chỉ gửi worker_id rồi chuyển sang ticket trong fragment', async () => {
  const runtime = dashboardContext();
  vm.runInContext('state.authenticated = true', runtime.context);
  const button = { dataset:{ rotateWorker:'vps_3' }, disabled:false };
  await runtime.context.openAccountRotation({ currentTarget:button });
  const rotationRequest = runtime.requests.find(request => request.url.endsWith('/rotation-sessions'));
  assert.equal(rotationRequest.url, 'https://gateway.example.test/ai-gateway-dashboard/rotation-sessions');
  assert.deepEqual(JSON.parse(rotationRequest.options.body), { worker_id:'vps_3' });
  assert.equal(rotationRequest.options.credentials, 'include');
  assert.equal(rotationRequest.options.headers['x-izone-csrf'], '1');
  assert.doesNotMatch(rotationRequest.options.body, /private_key|credential/);
  const target = new URL(runtime.assignedUrl());
  assert.equal(target.origin, 'https://gateway.example.test');
  assert.equal(target.pathname, '/ai-gateway-dashboard/google-account');
  assert.match(target.hash, /^#ticket=/);
});

test('HTML dùng phiên bản tài nguyên mới để tránh trình duyệt giữ giao diện cũ', () => {
  assert.match(html, /session-client\.js\?v=20260922-dashboard-session-v1/);
  assert.match(html, /app\.js\?v=20260922-dashboard-vnd-v1/);
  assert.match(html, /styles\.css\?v=20260922-dashboard-session-v1/);
});

test('CSP cho phép đúng style hiện hành của Google Identity Services', () => {
  assert.match(html, /style-src[^;]*'sha256-RU4sU0AaS8IBGZx8XrGt\/pa9A5SLA3dQszGeqT5L3Kw='/);
  assert.doesNotMatch(html, /style-src[^;]*'unsafe-inline'/);
});

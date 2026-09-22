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
  const context = vm.createContext({
    window: {
      AI_GATEWAY_DASHBOARD_CONFIG: {
        API_BASE_URL: 'https://gateway.example.test/ai-gateway-dashboard',
        GOOGLE_CLIENT_ID: 'client.apps.googleusercontent.com',
      },
      addEventListener() {}, setTimeout() {},
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
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true, status: 201,
        async json() { return { worker_id: 'vps_3', path: 'google-account', ticket: 'ticket-safe-012345678901234567890123456789' }; },
      };
    },
    crypto: webcrypto,
    URL,
    URLSearchParams,
    encodeURIComponent,
  });
  vm.runInContext(source, context);
  return { context, elements, requests, assignedUrl: () => assignedUrl };
}

test('Pages không còn ô nhập hoặc xử lý trực tiếp JSON credential', () => {
  assert.doesNotMatch(html, /id="credentialFile"|id="credentialJson"|id="uploadCredential"/);
  assert.doesNotMatch(source, /JSON\.parse\(await file\.text\(\)\)|uploadCredential|activateCredential/);
  assert.doesNotMatch(source + html, /localStorage|sessionStorage|BEGIN PRIVATE KEY/);
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
  vm.runInContext("state.idToken = 'google-id-token-in-memory'", runtime.context);
  const button = { dataset:{ rotateWorker:'vps_3' }, disabled:false };
  await runtime.context.openAccountRotation({ currentTarget:button });
  assert.equal(runtime.requests.length, 1);
  assert.equal(runtime.requests[0].url, 'https://gateway.example.test/ai-gateway-dashboard/rotation-sessions');
  assert.deepEqual(JSON.parse(runtime.requests[0].options.body), { worker_id:'vps_3' });
  assert.doesNotMatch(runtime.requests[0].options.body, /private_key|credential/);
  const target = new URL(runtime.assignedUrl());
  assert.equal(target.origin, 'https://gateway.example.test');
  assert.equal(target.pathname, '/ai-gateway-dashboard/google-account');
  assert.match(target.hash, /^#ticket=/);
});

test('HTML dùng phiên bản tài nguyên mới để tránh trình duyệt giữ giao diện cũ', () => {
  assert.match(html, /app\.js\?v=20260922-google-account-wizard-v1/);
  assert.match(html, /styles\.css\?v=20260922-google-account-wizard-v1/);
});

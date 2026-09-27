/*
 * Dữ liệu nhận vào: source dashboard và dữ liệu Billing giả, không có credential hay dữ liệu production.
 * Việc chính: kiểm mọi vị trí tiền tệ đều dùng VND, làm tròn thành số nguyên và không quy đổi giá trị.
 * Kết quả: thẻ tài khoản, biểu đồ và phần tổng hợp cùng hiển thị hậu tố "đ".
 * Khi lỗi: test chỉ rõ nơi còn USD, còn số lẻ hoặc làm tròn sai.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../ai-gateway-dashboard/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../ai-gateway-dashboard/index.html', import.meta.url), 'utf8');

class Element {
  children = [];
  style = {};
  dataset = {};
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener() {}
  set textContent(value) { this.children = [String(value)]; }
  get textContent() {
    return this.children
      .map(child => typeof child === 'string' ? child : child.textContent)
      .join(' ');
  }
}

function dashboardContext() {
  const elements = new Map();
  const context = vm.createContext({
    window: {
      AI_GATEWAY_DASHBOARD_CONFIG: {},
      AI_GATEWAY_DASHBOARD_INITIAL_STATE: {},
      AIGatewaySessionClient: { create: () => ({}) },
      addEventListener() {},
      setTimeout() {},
    },
    document: {
      createElement: () => new Element(),
      getElementById: id => {
        if (!elements.has(id)) elements.set(id, new Element());
        return elements.get(id);
      },
    },
    URLSearchParams,
  });
  vm.runInContext(source, context);
  return { context, elements };
}

test('định dạng VND thành số nguyên theo quy tắc làm tròn gần nhất', () => {
  const { context } = dashboardContext();
  assert.equal(context.money(1768613.01), '1.768.613 đ');
  assert.equal(context.money(4397815.98), '4.397.816 đ');
  assert.equal(context.money(6951508.60), '6.951.509 đ');
  assert.equal(context.money(0), '0 đ');
  assert.equal(context.money(-99.6), '-100 đ');
  assert.equal(context.money('không hợp lệ'), '0 đ');
  assert.equal(context.money(Infinity), '0 đ');
});

test('source, nhãn biểu đồ và cache không còn contract USD', () => {
  assert.doesNotMatch(source + html, /US\$|\bUSD\b/);
  assert.match(html, /VND ước tính · xếp chồng theo tài khoản/);
  assert.match(html, /app\.js\?v=20260922-dashboard-vnd-v1/);
});

test('thẻ tài khoản và phần tổng hợp dùng cùng định dạng VND nguyên', () => {
  const { context, elements } = dashboardContext();
  context.renderBilling([{
    id: 'google_1',
    display_name: 'Tài khoản Google 1',
    initial_credit: 5000000,
    estimated_remaining: 1768613.01,
    credits_used: 2651570.82,
    expires_at: '2026-10-27T00:00:00.000Z',
    last_synced_at: '2026-09-22T06:55:08.000Z',
    sync_status: 'success',
  }]);
  const cardText = elements.get('billingAccounts').textContent;
  assert.match(cardText, /1\.768\.613 đ/);
  assert.match(cardText, /Đã dùng 2\.651\.571 đ/);
  assert.doesNotMatch(cardText, /US\$|\bUSD\b|,\d{1,2}\b|NaN|Infinity/);

  context.renderInsights({
    billing: [{
      date: '2026-09-22',
      account_id: 'google_1',
      account_name: 'Tài khoản Google 1',
      gross_cost: 2651570.82,
    }],
  });
  const insightText = elements.get('usageInsights').textContent;
  assert.match(insightText, /2\.651\.571 đ/);
  assert.doesNotMatch(insightText, /US\$|\bUSD\b|,\d{1,2}\b/);
});

test('trục biểu đồ chi phí hiển thị số nguyên với hậu tố đ', () => {
  const { context, elements } = dashboardContext();
  const labels = [];
  const gridStarts = [];
  const canvasContext = new Proxy({
    fillText: text => labels.push(String(text)),
    moveTo: x => gridStarts.push(x),
  }, {
    get(target, key) { return key in target ? target[key] : () => {}; },
  });
  elements.set('costChart', {
    width: 900,
    height: 300,
    getContext: () => canvasContext,
  });

  context.drawCostChart([{
    date: '2026-09-22',
    account_id: 'google_1',
    gross_cost: 2651570.82,
  }]);

  const currencyLabels = labels.filter(label => label.endsWith(' đ'));
  assert.equal(currencyLabels.length, 5);
  assert.ok(currencyLabels.every(label => !/,\d{1,2}\b/.test(label)));
  assert.ok(gridStarts.slice(0, 5).every(x => x >= 80));
  assert.doesNotMatch(labels.join(' '), /\$|\bUSD\b/);
});

// Dữ liệu nhận vào: trang rà chấm thử và dữ liệu công khai đã ẩn mã bài.
// Việc chính: kiểm việc tải tự động, cấu trúc 98 ca và đường gửi phản hồi.
// Kết quả: test thất bại nếu lộ mã bài, prompt riêng hoặc trang mất dữ liệu.
// Khi lỗi: Node in tên invariant hỏng; không chạm vào dữ liệu thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'progress-log-ic2305-grading-review');
const read = (name) => readFileSync(resolve(root, name), 'utf8');

test('một trang tự tải dữ liệu cùng nguồn và vẫn có bộ lọc', () => {
  const html = read('index.html');
  assert.match(html, /data-view="all"/);
  for (const view of ['all', 'same', 'different']) assert.match(html, new RegExp(`data-tab="${view}"`));
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /src="review\.js"/);
  assert.match(html, /href="styles\.css"/);
  assert.doesNotMatch(html, /type="file"|Chọn tệp JSON/);
  assert.match(html, /id="retry-load"/);
});

test('dữ liệu công khai đúng 98 ca, không mang định danh và prompt riêng', () => {
  const names = readdirSync(root);
  assert.deepEqual(names.sort(), ['README.md', 'data.json', 'favicon.svg', 'index.html', 'review.js', 'styles.css'].sort());
  const data = JSON.parse(read('data.json'));
  assert.equal(data.public_data, true);
  assert.equal(data.items.length, 98);
  assert.equal(Object.keys(data.questions).length, 6);
  assert.equal(data.items.filter((item) => item.gemini !== item.luna).length, 1);
  assert.equal(new Set(data.items.map((item) => item.key)).size, 98);
  for (const item of data.items) {
    assert.match(item.key, /^IC-[A-Za-z0-9_-]{7,12}$/);
    assert.deepEqual(Object.keys(item).sort(), ['answer', 'gemini', 'key', 'luna', 'question_key', 'session']);
  }
  for (const question of Object.values(data.questions)) {
    assert.deepEqual(Object.keys(question).sort(), ['labels', 'mode', 'question', 'title']);
  }
  assert.equal(/"criteria"|"paper"|"private_data"|"prompt_hash_short"|"student_id"|"student_name"/.test(read('data.json')), false, 'Không xuất trường riêng tư');
  assert.equal(/"key":\s*"[234]-(?:2|3|4|6|8)-\d+"/.test(read('data.json')), false, 'Không xuất mã ca gốc');
  assert.equal(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?<!\d)(?:\+?84|0)\d{8,10}(?!\d)/i.test(read('data.json')), false, 'Không xuất email hoặc số điện thoại');
  const js = read('review.js');
  assert.match(js, /fetch\('\.\/data\.json'/);
  assert.doesNotMatch(js, /file\.text\(\)|data-file|question\.criteria|item\.paper/);
  assert.match(js, /item\.answer/);
  assert.match(js, /textContent/);
});

test('gửi phản hồi qua Google Form chỉ có mã ca và ý kiến người rà', () => {
  const js = read('review.js');
  assert.match(js, /docs\.google\.com\/forms/);
  for (const field of ['caseKey', 'gemini', 'luna', 'human', 'reason']) assert.match(js, new RegExp(`FORM_FIELDS\\.${field}`));
  assert.doesNotMatch(js.slice(js.indexOf('function formLink'), js.indexOf('function card')), /item\.answer|question\.criteria/);
  assert.match(js, /reason\.focus\(\)/);
});

test('97 ca đồng thuận chỉ hiện một kết quả và một đánh giá, ca bất đồng vẫn hiện hai', async () => {
  class Element {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.dataset = {}; this.listeners = {}; this.value = ''; this.className = ''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    setAttribute() {}
    removeAttribute() {}
    get firstChild() { return this.children[0]; }
  }
  const elements = new Map();
  const tabs = ['all', 'different', 'same'].map((name) => { const tab = new Element('button'); tab.dataset.tab = name; return tab; });
  const stored = new Map();
  const document = {
    body: new Element('body'),
    createElement: (tag) => new Element(tag),
    createTextNode: (value) => ({textContent: value}),
    getElementById: (id) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    querySelectorAll: (selector) => selector === '[data-tab]' ? tabs : [],
  };
  const data = JSON.parse(read('data.json'));
  const firstConsensus = data.items.find((item) => item.gemini === item.luna);
  stored.set('ic2305:grading-review:v3', JSON.stringify({
    [firstConsensus.key]: {gemini: 'Đồng ý', luna: 'Không đồng ý', human: 'Sai'},
  }));
  runInNewContext(read('review.js'), {
    document, URL, setTimeout,
    localStorage: {getItem: (key) => stored.get(key) || null, setItem: (key, value) => stored.set(key, value)},
    fetch: async () => ({ok: true, json: async () => data}),
  });
  await new Promise((resolve) => setImmediate(resolve));
  const walk = (node, className) => [
    ...(node.className?.split(' ').includes(className) ? [node] : []),
    ...((node.children || []).flatMap((child) => walk(child, className))),
  ];
  const cards = elements.get('cards').children;
  assert.equal(cards.length, 98);
  for (const card of cards) {
    const disputed = card.className.includes('disputed');
    assert.equal(walk(card, 'grade').length, disputed ? 2 : 1);
    assert.equal(walk(card, 'choice-field').length, disputed ? 2 : 1);
  }
  const shared = cards.find((card) => !card.className.includes('disputed'));
  const choices = walk(shared, 'choice-field')[0].children.filter((node) => node.tag === 'label');
  assert.equal(choices.some((node) => node.children[0].checked), false);
  const link = walk(shared, 'send-button')[0];
  let blocked = false;
  link.listeners.click({preventDefault: () => { blocked = true; }});
  assert.equal(blocked, true);
  const agree = choices[0]?.children.find((node) => node.value === 'Đồng ý');
  assert.ok(agree);
  agree.listeners.change();
  const saved = JSON.parse(stored.get('ic2305:grading-review:v3'));
  const key = walk(shared, 'case-key')[0].textContent.split(' · ').at(-1);
  assert.equal(saved[key].gemini, 'Đồng ý');
  assert.equal(saved[key].luna, 'Đồng ý');
  const human = walk(shared, 'human-label')[0].children.find((node) => node.tag === 'select');
  human.value = 'Sai';
  human.listeners.change();
  blocked = false;
  link.listeners.click({preventDefault: () => { blocked = true; }});
  assert.equal(blocked, false);
  const form = new URL(link.href);
  assert.equal(form.searchParams.get('entry.1631772558'), 'Đồng ý');
  assert.equal(form.searchParams.get('entry.1902183348'), 'Đồng ý');
  assert.equal(form.searchParams.get('entry.2023912036'), key);
});

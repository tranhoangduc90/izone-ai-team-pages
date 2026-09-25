// Dữ liệu vào: trang và 98 bài công khai. Kiểm chấm từng ô, phản hồi đúng ô và riêng tư.
// Khi lỗi: test nêu bất biến hỏng; không gọi AI hoặc sửa bài làm thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {runInNewContext} from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'progress-log-ic2305-grading-review');
const read = (name) => readFileSync(resolve(root, name), 'utf8');
const data = JSON.parse(read('data.json'));

test('dữ liệu 98 bài có 308 kết luận từng ô từ đúng hai mô hình', () => {
  assert.equal(data.schema_version, 2);
  assert.equal(data.public_data, true);
  assert.equal(data.items.length, 98);
  assert.equal(Object.keys(data.questions).length, 6);
  assert.equal(new Set(data.items.map((item) => item.key)).size, 98);
  let slots = 0, differentSlots = 0, differentCases = 0;
  for (const item of data.items) {
    assert.match(item.key, /^IC-[A-Za-z0-9_-]{7,12}$/);
    assert.deepEqual(Object.keys(item).sort(), ['answer', 'gemini_parts', 'key', 'luna_parts', 'question_key', 'session']);
    const answers = Array.isArray(item.answer) ? item.answer : [item.answer];
    assert.equal(answers.length, data.questions[item.question_key].labels.length);
    for (const parts of [item.gemini_parts, item.luna_parts]) {
      assert.equal(parts.length, answers.length);
      assert.ok(parts.every((value) => typeof value === 'boolean'));
    }
    slots += answers.length;
    const differences = item.gemini_parts.filter((value, index) => value !== item.luna_parts[index]).length;
    differentSlots += differences;
    differentCases += differences > 0;
  }
  assert.equal(slots, 308);
  assert.equal(differentSlots, 30);
  assert.equal(differentCases, 16);
});

test('trang giữ dữ liệu riêng ngoài Git, tải tự động và ghi phản hồi theo ô', () => {
  assert.deepEqual(readdirSync(root).sort(), ['README.md', 'data.json', 'favicon.svg', 'index.html', 'review.js', 'styles.css'].sort());
  const html = read('index.html'), js = read('review.js'), raw = read('data.json');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /data-tab="different"/);
  assert.match(js, /fetch\('\.\/data\.json'/);
  assert.match(js, /slotKey = \(item, i\) => `\$\{item\.key\}#\$\{i \+ 1\}`/);
  assert.match(js, /FORM_FIELDS\.caseKey/);
  assert.doesNotMatch(raw, /"criteria"|"paper"|"private_data"|"prompt_hash_short"|"student_id"|"student_name"/);
  assert.doesNotMatch(raw, /"key":\s*"[234]-(?:2|3|4|6|8)-\d+"/);
  assert.doesNotMatch(raw, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?<!\d)(?:\+?84|0)\d{8,10}(?!\d)/i);
  assert.doesNotMatch(js, /question\.criteria|item\.paper|item\.answer.*searchParams/);
});

test('dữ liệu thiếu một kết luận bị từ chối và hiện nút thử lại', async () => {
  class Element {
    constructor() { this.children = []; this.dataset = {}; this.listeners = {}; this.value = ''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    get firstChild() { return this.children[0]; }
  }
  const elements = new Map();
  const document = {
    body: new Element(),
    createElement: () => new Element(),
    createTextNode: (value) => ({textContent: value}),
    getElementById: (id) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    querySelectorAll: () => [],
  };
  const invalid = structuredClone(data);
  invalid.items[0].luna_parts.pop();
  runInNewContext(read('review.js'), {
    document, URL, setTimeout,
    localStorage: {getItem: () => null, setItem: () => {}},
    fetch: async () => ({ok: true, json: async () => invalid}),
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(elements.get('file-status').textContent, /Kết luận từng ô sai cấu trúc/);
  assert.equal(elements.get('review-area').hidden, true);
  assert.equal(elements.get('retry-load').hidden, false);
});

test('mỗi ô hiện kết luận riêng; ô đồng thuận hiện một, ô bất đồng hiện hai', async () => {
  class Element {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.dataset = {}; this.listeners = {}; this.className = ''; this.value = ''; this.textContent = ''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    setAttribute() {}
    removeAttribute() {}
    querySelector(tag) { return this.children.find((child) => child.tag === tag); }
    get firstChild() { return this.children[0]; }
  }
  const elements = new Map();
  const tabs = ['all', 'different', 'same'].map((name) => { const tab = new Element('button'); tab.dataset.tab = name; tab.append(new Element('span')); return tab; });
  const stored = new Map();
  const document = {
    body: new Element('body'),
    createElement: (tag) => new Element(tag),
    createTextNode: (value) => ({textContent: value}),
    getElementById: (id) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    querySelectorAll: (selector) => selector === '[data-tab]' ? tabs : [],
  };
  runInNewContext(read('review.js'), {
    document, URL, setTimeout,
    localStorage: {getItem: (key) => stored.get(key) || null, setItem: (key, value) => stored.set(key, value)},
    fetch: async () => ({ok: true, json: async () => data}),
  });
  await new Promise((resolve) => setImmediate(resolve));
  const walk = (node, cls) => [
    ...(node.className?.split(' ').includes(cls) ? [node] : []),
    ...((node.children || []).flatMap((child) => walk(child, cls))),
  ];
  const cards = elements.get('cards').children;
  assert.equal(cards.length, 98);
  assert.equal(walk(elements.get('cards'), 'answer-row').length, 308);
  assert.equal(walk(elements.get('cards'), 'disputed-slot').length, 30);
  assert.equal(walk(elements.get('cards'), 'grade').length, 338);
  assert.equal(walk(elements.get('cards'), 'slot-feedback').length, 308);
  assert.equal(tabs[1].querySelector('span').textContent, '16');
  assert.equal(tabs[2].querySelector('span').textContent, '82');
  assert.match(elements.get('file-status').textContent, /30 ô của 16 bài/);
  const first = cards[0];
  assert.ok(first.className.includes('disputed'));
  const row = walk(first, 'disputed-slot')[0], feedback = walk(row, 'slot-feedback')[0];
  assert.equal(walk(row, 'grade').length, 2);
  const link = walk(feedback, 'send-button')[0];
  let blocked = false;
  link.listeners.click({preventDefault: () => { blocked = true; }});
  assert.equal(blocked, true);
  const fields = walk(feedback, 'choice-field');
  for (const field of fields) field.children.find((node) => node.tag === 'label').children.find((node) => node.tag === 'input').listeners.change();
  const human = walk(feedback, 'human-label')[0].children.find((node) => node.tag === 'select');
  human.value = 'Đúng'; human.listeners.change();
  blocked = false; link.listeners.click({preventDefault: () => { blocked = true; }});
  assert.equal(blocked, false);
  const form = new URL(link.href);
  assert.match(form.searchParams.get('entry.2023912036'), /^IC-[A-Za-z0-9_-]{7,12}#\d+$/);
  assert.equal(form.searchParams.get('entry.1631772558'), 'Đồng ý');
  assert.equal(form.searchParams.get('entry.1902183348'), 'Đồng ý');
});

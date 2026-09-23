import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Nhận điểm Writing giả từ hai bài Substitute và dựng thẻ kết quả.
// Kiểm đúng Task đã chấm, không mở feedback rỗng hoặc lấy nhầm bài K67.
class Element {
  children = []; listeners = {}; hidden = false; textContent = '';
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}
function harness(number, grading) {
  const shared = number === 1 ? 'substitute-k56-shared' : 'substitute-test-2-k56-shared';
  const source = readFileSync(new URL(`../term-tests/${shared}/app.js`, import.meta.url), 'utf8');
  const start = source.indexOf('  function renderWritingSubmission()');
  const end = source.indexOf('  function ', start + 20);
  assert.ok(start >= 0 && end > start);
  const target = new Element();
  const taskNumber = number === 1 ? 2 : 1;
  const task = { id: `task${taskNumber}`, label: `Writing Task ${taskNumber}` };
  let opened;
  const context = {
    writingConfig: { tasks: [task] },
    state: { writingSubmitted: true, result: { writing: { grading } } },
    elements: { writingSubmissionResult: target },
    document: { createElement: () => new Element() },
    formatBand: value => value == null ? '—' : String(value),
    openWritingFeedback: value => { opened = value; }
  };
  vm.runInNewContext(`${source.slice(start, end)}\nrenderWritingSubmission();`, context);
  const flatten = element => [element, ...element.children.flatMap(flatten)];
  return { nodes: flatten(target), opened: () => opened };
}

for (const number of [1, 2]) {
  const taskNumber = number === 1 ? 2 : 1;
  test(`Substitute K56 ${number}: thẻ mở đúng Writing Task ${taskNumber}`, () => {
    const task = { taskNumber, taskScore: 7.5, criteria: [{ code: 'TR', bandScore: 7, feedback: 'Synthetic' }] };
    const result = harness(number, { ready: true, writingScore: 7.5, tasks: [task] });
    const button = result.nodes.find(node => node.className === 'writing-score-card is-action');
    assert.ok(button);
    assert.equal(button.children[0].textContent, `Writing Task ${taskNumber}`);
    button.listeners.click();
    assert.equal(result.opened(), task);
  });
  test(`Substitute K56 ${number}: chưa có bài chấm thì không mở feedback giả`, () => {
    const result = harness(number, { ready: true, writingScore: 7.5, tasks: [] });
    const button = result.nodes.find(node => node.className === 'writing-score-card is-action');
    assert.equal(button.disabled, true);
    assert.equal(result.opened(), undefined);
  });
  test(`Substitute K56 ${number}: trạng thái chờ gọi đúng Task ${taskNumber}`, () => {
    const result = harness(number, { ready: false, status: 'processing' });
    assert.ok(result.nodes.some(node => node.textContent === `Đang chấm Task ${taskNumber}`));
  });
}

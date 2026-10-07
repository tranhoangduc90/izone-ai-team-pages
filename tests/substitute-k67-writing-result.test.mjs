import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../term-tests/substitute-k67-shared/app.js', import.meta.url), 'utf8');
const functionSource = source.slice(source.indexOf('  function renderWritingSubmission()'), source.indexOf('  function ', source.indexOf('  function renderWritingSubmission()') + 20));
class Element {
  children = []; listeners = {}; hidden = false; textContent = '';
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}
function render(grading, twoTaskWriting = false) {
  const target = new Element();
  let opened;
  const context = {
    twoTaskWriting,
    writingConfig: {tasks: twoTaskWriting ? [{id:'task1',label:'Writing Task 1'},{id:'task2',label:'Writing Task 2'}] : [{id: 'task2', label: 'Writing Task 2'}]},
    state: {writingSubmitted: true, result: {writing: {grading}}},
    elements: {writingSubmissionResult: target},
    document: {createElement: () => new Element()},
    formatBand: value => value == null ? '—' : String(value),
    openWritingFeedback: value => { opened = value; }
  };
  vm.runInNewContext(`${functionSource}\nrenderWritingSubmission();`, context);
  const all = element => [element, ...element.children.flatMap(all)];
  return {nodes: all(target), opened: () => opened};
}
test('K67 Task 2 result shows actual score and opens the exact returned task, not Task 1', () => {
  const task = {taskNumber: 2, taskScore: 8, criteria: [{code: 'TR', bandScore: 8, feedback: 'Synthetic feedback'}]};
  const result = render({ready: true, writingScore: 8, tasks: [task]});
  const button = result.nodes.find(node => node.className === 'writing-score-card is-action');
  assert.equal(button.children[0].textContent, 'Writing Task 2');
  assert.equal(button.children[1].textContent, 'Band 8');
  button.listeners.click();
  assert.equal(result.opened(), task);
  assert.ok(result.nodes.every(node => !node.textContent.includes('Task 1')));
});
test('K67 incomplete grading cannot open an undefined feedback result', () => {
  const result = render({ready: true, writingScore: 8, tasks: []});
  const button = result.nodes.find(node => node.className === 'writing-score-card is-action');
  assert.equal(button.disabled, true);
});
test('K67 pending status names Task 2', () => {
  const result = render({ready: false, status: 'processing'});
  assert.ok(result.nodes.some(node => node.textContent === 'Bài làm của học viên đang được chấm, kết quả sẽ hiện lại sau'));
});
test('K67 hai Task: từng nút mở đúng kết quả, tổng không lấy nhầm Task 2', () => {
  const tasks=[{taskNumber:2,taskScore:8},{taskNumber:1,taskScore:6}];
  const result=render({ready:true,writingScore:7,tasks},true);
  const buttons=result.nodes.filter(node=>node.className==='writing-score-card is-action');
  assert.deepEqual(buttons.map(b=>b.children[0].textContent),['Writing Task 1','Writing Task 2']);
  buttons[0].listeners.click();assert.equal(result.opened(),tasks[1]);
  buttons[1].listeners.click();assert.equal(result.opened(),tasks[0]);
  const total=result.nodes.find(n=>n.className==='writing-score-card is-overall');
  assert.equal(total.children[0].textContent,'Writing tổng');assert.equal(total.children[1].textContent,'Band 7');
});
test('K67 result title derives from this exam config instead of K56 template', () => {
  assert.doesNotMatch(source, /Substitute Test 2 · Khóa 56/);
  assert.match(source, /testTitle:.*testConfig\.title/s);
});

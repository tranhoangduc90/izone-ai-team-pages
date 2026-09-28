import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync('term-tests/k56-mini-shared/app.js', 'utf8');
const body = source.slice(source.indexOf('  function renderWritingSubmission('), source.indexOf('  function addSummaryCard('));

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.textContent = ''; this.hidden = false; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener() {}
}

const flatten = node => [node, ...node.children.flatMap(flatten)];

function render(grading) {
  const root = new Element('div');
  const context = vm.createContext({
    URL,
    document: { createElement: tag => new Element(tag) },
    writingConfig: { tasks: [{ id: 'task2' }] },
    elements: { writingSubmissionResult: root },
    state: { writingSubmitted: true, result: { writing: { grading } } },
    serverGradingMode: true,
    refreshWritingGrading() {}
  });
  vm.runInContext(body, context);
  context.renderWritingSubmission();
  return flatten(root);
}

test('Mini hiển thị Link LMS HTTPS và không lộ điểm Writing', () => {
  const nodes = render({ ready: true, status: 'ready', lmsUrl: 'https://ducizone.ddns.net/writing/shared/writing-essays/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/view?v=1', writingScore: 8, tasks: [{ taskNumber: 2, taskScore: 8 }] });
  const link = nodes.find(node => node.tag === 'a');
  assert.equal(link.href, 'https://ducizone.ddns.net/writing/shared/writing-essays/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/view?v=1');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(link.target, '_blank');
  assert.doesNotMatch(nodes.map(node => node.textContent).join(' '), /Điểm đoạn văn|Writing tổng|Band 8/);
});

test('Mini không mở link không an toàn, cũng không hiện điểm của bản chấm cũ', () => {
  for (const lmsUrl of ['javascript:alert(1)', 'http://example.edu/review', 'https://lms.example.edu/review/123', '']) {
    const nodes = render({ ready: true, status: 'ready', lmsUrl, writingScore: 7.5, tasks: [{ taskNumber: 2, taskScore: 7.5 }] });
    assert.equal(nodes.some(node => node.tag === 'a'), false);
    assert.match(nodes.map(node => node.textContent).join(' '), /Chưa có Link LMS/);
    assert.doesNotMatch(nodes.map(node => node.textContent).join(' '), /7\.5|Điểm đoạn văn|Writing tổng/);
  }
});

test('Mini đã chấm trước cập nhật vẫn có nút mở bản chấm lịch sử', () => {
  const nodes = render({ ready: true, status: 'ready', mode: 'legacy', writingScore: 7,
    tasks: [{ taskNumber: 2, taskScore: 7, criteria: [] }] });
  assert.equal(nodes.some(node => node.tag === 'button' && node.textContent === 'Xem bản chấm cũ'), true);
  assert.equal(nodes.some(node => node.tag === 'a'), false);
});

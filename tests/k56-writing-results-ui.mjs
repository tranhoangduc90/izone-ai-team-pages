// Kiểm owner thật renderResult: polling Writing không làm đóng hoặc thay bảng L/R đang xem.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.dataset = {}; this.open = false; this.textContent = ''; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  querySelectorAll(selector) { return this.children.filter(node => selector === 'details' && node.tag === 'details'); }
  addEventListener() {}
}

for (const module of ['k56-shared', 'k56-test2-shared', 'k56-mini-shared']) {
  const source = readFileSync(`${process.env.K56_SOURCE_ROOT || '.'}/term-tests/${module}/app.js`, 'utf8');
  const code = source.slice(source.indexOf('  function renderResult('), source.indexOf('  function portalNotice('));
  function fixture() {
    const elements = Object.fromEntries(['resultStudentName', 'resultMeta', 'summaryGrid', 'resultStatus', 'continueReadingFromResult', 'questionDetails', 'skillPerformanceSections'].map(key => [key, new Element()]));
    const state = { attemptToken: 'attempt-a' };
    const context = vm.createContext({ state, elements, demoMode: false, testConfig: { title: 'Fake test' },
      addSummaryCard: () => new Element(), sectionScoreText: () => 'Fixture score', renderWritingSubmission() {}, renderSkillPerformance: () => new Element(), stopWritingGradingPolling() {},
      renderDetailBlock: (title, rows) => { const node = new Element('details'); node.title = title; node.rows = rows; return node; } });
    vm.runInContext(code, context);
    const payload = { studentName: 'Học viên giả', className: 'CODEXDEMO56', writing: { grading: { ready: false } },
      result: { listening: { correct: 1, total: 10, details: [{ question: '1', answer: 'fake' }] }, reading: { correct: 2, total: 13, details: [] } } };
    return { elements, state, context, payload };
  }
  test(`${module}: cập nhật Writing giữ bảng L/R đang mở và bảng đang đóng độc lập`, () => {
    const f = fixture(); f.context.renderResult(f.payload);
    const [listening, reading] = f.elements.questionDetails.children;
    listening.open = true;
    f.context.renderResult(structuredClone(f.payload));
    assert.equal(f.elements.questionDetails.children[0].open, true, 'Polling làm đóng Listening');
    assert.equal(f.elements.questionDetails.children[1].open, false);
    assert.equal(f.elements.questionDetails.children[0], listening, 'Bảng không đổi phải giữ DOM/focus');
    reading.open = true; f.payload.writing.grading.ready = true;
    f.context.renderResult(f.payload);
    assert.ok(f.elements.questionDetails.children.every(node => node.open));
  });
  test(`${module}: dữ liệu L/R mới vẫn cập nhật, không mang trạng thái sang attempt khác`, () => {
    const f = fixture(); f.context.renderResult(f.payload); f.elements.questionDetails.children[0].open = true;
    f.payload.result.listening.details.push({ question: '2', answer: 'new' });
    f.context.renderResult(f.payload);
    assert.equal(f.elements.questionDetails.children[0].rows.length, 2);
    assert.equal(f.elements.questionDetails.children[0].open, true);
    f.state.attemptToken = 'attempt-b'; f.context.renderResult(f.payload);
    assert.equal(f.elements.questionDetails.children[0].open, false);
  });
  test(`${module}: thông báo chờ không có nút kiểm tra và không có điểm/LMS`, () => {
    const body = source.slice(source.indexOf('  function renderWritingSubmission('), source.indexOf('  function addSummaryCard('));
    for (const status of ['processing', 'review_required', 'awaiting_release']) {
      const root = new Element();
      const context = vm.createContext({ URL, document: { createElement: tag => new Element(tag) }, writingConfig: {},
        elements: { writingSubmissionResult: root }, state: { writingSubmitted: true, result: { writing: { grading: { ready: false, status } } } }, serverGradingMode: false });
      vm.runInContext(body, context); context.renderWritingSubmission();
      const flatten = node => [node, ...node.children.flatMap(flatten)]; const nodes = flatten(root);
      assert.ok(nodes.some(node => node.textContent === 'Phần Writing của bạn đang được giáo viên chấm điểm, kết quả sẽ được hiển thị sau'));
      assert.ok(!nodes.some(node => node.tag === 'button' || node.tag === 'a'));
      assert.doesNotMatch(nodes.map(node => node.textContent).join(' '), /Band \d|Kiểm tra kết quả ngay/);
    }
  });
  test(`${module}: chờ công bố dùng mốc server, qua 45 phút vẫn hẹn tải API sau 2 giờ`, () => {
    const start = source.indexOf('  function scheduleWritingGradingRefresh(');
    const end = source.indexOf('  function setWritingSaveStatus(', start);
    const now = Date.parse('2026-10-04T10:00:00Z'); const timers = [];
    const context = vm.createContext({ Date: class extends Date { static now() { return now; } },
      Number, demoMode: false, state: { writingSubmitted: true, serverTimeOffsetMs: 10_000,
        result: { writing: { grading: { ready: false, status: 'awaiting_release', availableAt: '2026-10-04T12:00:00Z' } } } },
      writingGradingPollTimer: 0, writingGradingPollStartedAt: now - 60 * 60 * 1000, writingGradingPollCount: 100,
      refreshWritingGrading() {}, startWritingGradingStream() {}, window: { setTimeout(callback, delay) { timers.push({ callback, delay }); return 1; } } });
    vm.runInContext(source.slice(start, end), context); context.scheduleWritingGradingRefresh();
    assert.equal(timers.length, 1); assert.equal(timers[0].delay, 7190000);
    context.scheduleWritingGradingRefresh(); assert.equal(timers.length, 1, 'Không tạo nhiều timer cùng lúc');
    timers[0].callback(); assert.equal(context.writingGradingPollTimer, 0);
    context.state.result.writing.grading.availableAt = '2026-10-04T09:00:00Z';
    context.scheduleWritingGradingRefresh();
    assert.equal(timers[1].delay, 8000, 'API lỗi sau hạn phải dùng backoff, không gọi mỗi giây');
    context.writingGradingPollTimer = 0; context.writingGradingPollStartedAt = now - 46 * 60 * 1000;
    context.scheduleWritingGradingRefresh(); assert.equal(timers.length, 2, 'Không retry vô hạn');
  });
}


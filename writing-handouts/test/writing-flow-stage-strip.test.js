import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(process.env.WRITING_STAGE_SOURCE_FILE
  || new URL('../js/writing-flow-v2.js', import.meta.url), 'utf8');
const stages = ['intake', 'precheck', 'main', 'critic', 'arbiter', 'render', 'deliver'];
function code(start, end) {
  const at = source.indexOf(start);
  assert.ok(at >= 0, start);
  return source.slice(at, source.indexOf(end, at));
}

test('Cập nhật tổng quan dựng lại thanh tiến trình từ số liệu hiện hành', () => {
  let renders = 0;
  const context = Object.fromEntries(['renderHeading', 'renderCounts', 'renderSummary',
    'renderClasses', 'renderPairs', 'renderDaily', 'renderStageQuick', 'setViewVisibility'].map(name => [name, () => {}]));
  context.renderJourney = () => { renders += 1; };
  context.baseView = () => 'overview';
  context.$ = () => ({ hidden: true });
  vm.runInNewContext(code('function renderAll()', '\nasync function loadPairs('), context);
  context.renderAll(); context.renderAll();
  assert.equal(renders, 2);
  context.baseView = () => 'main';
  context.renderAll();
  assert.equal(renders, 2, 'Tab khác không dựng lại thanh đang ẩn của Tổng quan');
});

test('Link từng bước mở và tải lại đúng bước cho Homework và Test', () => {
  const context = { location: {}, stages };
  vm.runInNewContext(code('function hashToView()', '\nconst stages ='), context);
  for (const kind of ['homework', 'test']) for (const stage of stages) {
    const view = (kind === 'test' ? 'test_' : '') + stage;
    context.location.hash = '#stage/' + kind + '/' + stage;
    assert.equal(context.hashToView(), view);
    assert.equal(context.viewToHash(view), context.location.hash);
  }
  context.location.hash = '#source'; assert.equal(context.hashToView(), 'intake');
  context.location.hash = '#test_review'; assert.equal(context.hashToView(), 'test_processing');
});

test('Danh sách từng bước gửi đúng stageKey sang API hiện có', () => {
  const context = { stages, baseView: () => '', $: () => ({ value: '' }) };
  vm.runInNewContext(code('function pairViewFilters()', '\nfunction renderColumnChoices('), context);
  for (const stage of stages) {
    context.baseView = () => stage;
    assert.equal(context.pairViewFilters().stageKey, stage);
  }
  context.baseView = () => 'processing'; assert.equal(context.pairViewFilters().view, 'unfinished');
  context.baseView = () => 'delivered'; assert.equal(context.pairViewFilters().view, 'delivered');
});

test('Thanh có bảy nút đúng số bài và mở đúng bước; loại bài đã bỏ qua', () => {
  const node = () => ({ children: [], dataset: {}, append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; } });
  for (const isTest of [false, true]) {
    const root = node(), opened = [];
    const context = { $: () => root, stages, document: { createElement: node },
      state: { counts: { stages: [{ stage_key: 'main', stage_status: 'pending', pair_count: 4 },
        { stage_key: 'main', stage_status: 'needs_review', pair_count: 2 },
        { stage_key: 'main', stage_status: 'pending', pair_count: 100, skipped: true }] } },
      stageNames: Object.fromEntries(stages.map(stage => [stage, stage])),
      testStageNames: Object.fromEntries(stages.map(stage => [stage, 'Test ' + stage])),
      isTestView: () => isTest, selectView: view => opened.push(view),
      makeText: (tag, text) => ({ tag, text }), actionButton: (text, click) => ({ ...node(), click }) };
    const counts = source.includes('function stageCounts(') ? code('function stageCounts(', '\nfunction renderStageQuick()') : '';
    vm.runInNewContext(counts + '\n' + code('function renderJourney()', '\nfunction setupV2Filters('), context);
    context.renderJourney();
    const list = root.children.find(item => item.className === 'flow-journey-grid');
    assert.equal(list.children.length, 7);
    const main = list.children[2].children[0];
    assert.equal(main.children[2].text, '6 bài ở bước');
    assert.equal(main.children[3].text, '2 cần kiểm tra');
    assert.equal(main.dataset.attention, 'true');
    list.children.forEach(item => item.children[0].click());
    assert.deepEqual(opened, stages.map(stage => (isTest ? 'test_' : '') + stage));
    assert.equal(root.children.length, 2, 'Chỉ khôi phục thanh bước, giữ phần tổng quan đã duyệt');
  }
});

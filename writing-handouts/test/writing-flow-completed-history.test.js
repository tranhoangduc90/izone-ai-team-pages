import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createTeacherApi } from '../js/api.js';

// Nhận vào: bộ lọc thật của hai dashboard và một bài đã xử lý trong lớp hoàn thành.
// Kiểm HTTP gửi đi và bài trả về; không gọi production hoặc dùng dữ liệu học viên.
for (const file of ['writing-flow.js', 'writing-flow-v2.js']) {
  const source = await readFile(new URL(`../js/${file}`, import.meta.url), 'utf8');
  const filterSource = source.slice(source.indexOf('function currentFilters('), source.indexOf('\nfunction renderColumnChoices'));
  for (const scenario of [
    { label: 'bài đã giao vẫn hiện khi lớp hoàn thành', view: 'delivered', classCode: '' },
    { label: 'mở lớp hoàn thành thấy cả bài đang cứu', view: 'completed_classes', classCode: 'IC999901' },
  ]) {
    test(`${file}: ${scenario.label}`, async t => {
      const calls = [];
      t.mock.method(globalThis, 'fetch', async url => {
        const request = new URL(url);
        calls.push(request);
        return new Response(JSON.stringify({ ok: true, pairs: request.searchParams.get('includeCompleted') === 'true'
          ? [{ pair_id: 'fixture-closed-class-pair', class_code: 'IC999901' }] : [] }), { status: 200 });
      });
      const context = {
        $: id => ({ value: id === 'flow-class' ? scenario.classCode : '' }),
        baseView: () => scenario.view, activeStage: () => '', activeSourceKind: () => 'test',
        serializeSortRules: () => '', stages: ['precheck', 'grade', 'render', 'deliver'],
        state: { sortRules: [] },
      };
      const filters = vm.runInNewContext(`${filterSource}\ncurrentFilters(pairViewFilters())`, context);
      const api = createTeacherApi('https://example.invalid/writing-api/');
      const result = await api.writingPairsPage(filters);
      assert.equal(result.data.pairs.length, 1, 'Không được giấu bài chỉ vì lớp đã hoàn thành');
      assert.equal(calls[0].searchParams.get('sourceKind'), 'test');
      assert.equal(calls[0].searchParams.get('classCode') || '', scenario.classCode);
    });
  }
  test(`${file}: lớp hoàn thành mở được bài và không có nút quét`, () => {
    const start = source.indexOf('function classCard(');
    const cardSource = source.slice(start, source.indexOf('\nfunction orderedClasses', start));
    const actions = [];
    let selected;
    const context = {
      state: { pinnedClasses: [] },
      document: { createElement: () => ({ dataset: {}, append() {} }) },
      makeText: () => ({}), formatTime: () => '—', statusNames: {},
      actionButton: (label, click) => { const action = { label, click }; actions.push(action); return action; },
      chooseClass: code => { selected = code; },
    };
    vm.runInNewContext(`${cardSource}\nclassCard({ class_code: 'IC999901', operational_state: 'completed' }, true)`, context);
    assert.deepEqual(actions.map(a => a.label), ['Xem bài lớp']);
    actions[0].click();
    assert.equal(selected, 'IC999901');
  });
}

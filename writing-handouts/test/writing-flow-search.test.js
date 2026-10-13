// Chạy đúng handler và hàm tải của trang, chỉ dùng API/DOM giả.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(process.env.WRITING_SEARCH_SOURCE_DIR
  ? path.join(process.env.WRITING_SEARCH_SOURCE_DIR, 'writing-flow-v2.js')
  : new URL('../js/writing-flow-v2.js', import.meta.url), 'utf8');

function functionCode(start, end) {
  const at = source.indexOf(start);
  return at < 0 ? '' : source.slice(at, source.indexOf(end, at));
}

for (const customRange of [false, true]) {
  test('Tìm kiếm mở mọi trạng thái và ' + (customRange ? 'giữ khoảng ngày đã chọn' : 'tra mọi ngày khi dùng kỳ mặc định'), () => {
    const link = 'https://docs.google.com/document/d/demo-document-0000000000001/edit?tab=t.demo';
    const nodes = { 'flow-search': { value: ' ' + link + ' ' },
      'flow-date-from': { value: '2026-10-07' }, 'flow-date-to': { value: '2026-10-13' } };
    const opened = [];
    const context = { state: { rangeIsDefault: !customRange }, $: id => nodes[id],
      isTestView: () => false, selectView: view => opened.push(view), refreshData() {} };
    const handler = source.match(/\$\('flow-search-button'\)\.addEventListener\('click', (.*?)\);/u)?.[1];
    assert.ok(handler, 'Trang phải có handler cho nút tìm kiếm');
    vm.runInNewContext(functionCode('function performSearch()', '\nfunction selectSourceWarningGroup(')
      + '\n(' + handler + ')();', context);
    assert.deepEqual(opened, ['search']);
    assert.equal(context.state.searchQuery, link);
    assert.equal(nodes['flow-date-from'].value, customRange ? '2026-10-07' : '');
    assert.equal(nodes['flow-date-to'].value, customRange ? '2026-10-13' : '');
  });
}

test('phản hồi tìm kiếm cũ về chậm không đổi bài và con trỏ của lần tìm mới', async () => {
  const replies = [];
  const state = { refreshGeneration: 1, pairs: [], nextCursor: null, nextOffset: null,
    api: { writingPairsPage: () => new Promise(resolve => replies.push(resolve)) } };
  const context = { state, currentFilters: extra => extra, pairViewFilters: () => ({}) };
  vm.runInNewContext(functionCode('async function loadPairs(', '\nasync function loadSourceIssues('), context);
  const old = context.loadPairs(true);
  state.refreshGeneration = 2;
  const current = context.loadPairs(true);
  replies[1]({ data: { pairs: [{ pair_id: 'current-pair' }], nextOffset: 100 } });
  await current;
  replies[0]({ data: { pairs: [{ pair_id: 'previous-pair' }], nextOffset: 200 } });
  await old;
  assert.equal(state.pairs[0].pair_id, 'current-pair');
  assert.equal(state.nextOffset, 100);
});

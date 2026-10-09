import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

// Nhận nhận xét giả giống lỗi live; giữ nội dung chuyên môn, bỏ riêng link điều hướng thừa.
for (const path of ['k56-shared/app.js', 'k56-test2-shared/app.js', 'teacher-k56/app.js']) {
  const source = fs.readFileSync(new URL('../term-tests/' + path, import.meta.url), 'utf8');
  const start = source.indexOf('function cleanWritingFeedback(');
  const end = source.indexOf('\n' + (!path.startsWith('teacher') ? '  ' : '') + 'function ', start + 1);
  const context = vm.createContext({});
  vm.runInContext(source.slice(start, end), context);
  test(path + ': bỏ fragment mã hóa hoặc thường trong link chi tiết, giữ chữ hai bên', () => {
    for (const href of ['%23ta_overview', '%23cc_referencing', './%23lr_range', '*%23gra_1*', '#tr_task_coverage']) {
      for (const join of ['\n', '\r\n', ' ']) {
        const input = `Nhận xét chuyên môn cần giữ.${join}[(Xem phân tích chi tiết và cách cải thiện Overview & Key Features)](${href})${join}Kết luận giới hạn điểm.`;
        const actual = context.cleanWritingFeedback(input);
        assert.match(actual, /Nhận xét chuyên môn cần giữ\./);
        assert.match(actual, /Kết luận giới hạn điểm\./);
        assert.doesNotMatch(actual, /Xem phân tích chi tiết|%23|\]\(#/);
      }
    }
    assert.equal(context.cleanWritingFeedback('[Xem phân tích chi tiết\nvà cách cải thiện](%23tr_task_coverage)'), '');
  });
  test(path + ': giữ link nội bộ không liên quan và điểm/nhận xét gốc', () => {
    const input = 'Band 6.5\nBài thiếu số liệu cụ thể.\n[Ví dụ trong bài](%23example)\n[Ví dụ thứ hai](#example)';
    assert.equal(context.cleanWritingFeedback(input), input);
  });
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const apps = ['k56-shared', 'k56-test2-shared', 'k56-mini-shared'];
for (const app of apps) {
  const source = fs.readFileSync(new URL('../term-tests/' + app + '/app.js', import.meta.url), 'utf8');
  const stageCode = source.slice(source.indexOf('  function setStage(stage) {'), source.indexOf('  function appendInstructions'));
  function stage({ cbt = false, studentRef = '', attemptToken = '', current = 'listening' } = {}) {
    const elements = Object.fromEntries(['identityView', 'loadingView', 'listeningView', 'listeningSavedView', 'readingView', 'writingPrepView', 'writingView', 'resultReadyView', 'resultView', 'studentSelect'].map(name => [name, { hidden: true, disabled: false }]));
    const context = {
      state: { studentRef, attemptToken }, demoMode: '', writingConfig: null,
      elements, views: Object.values(elements), progressSteps: [],
      stopWritingGradingPolling() {},
      document: { body: { classList: { contains: () => cbt } } },
      window: { scrollTo() {} }
    };
    vm.runInNewContext(stageCode + '\nsetStage(' + JSON.stringify(current) + ');', context);
    return elements;
  }
  test(app + ': Answer Sheet hiện định danh trước khi chọn học viên', () => {
    assert.equal(stage().identityView.hidden, false);
    assert.equal(stage().studentSelect.disabled, false);
  });
  test(app + ': sau nộp khóa học viên và vẫn hiện lớp ở Reading/kết quả', () => {
    for (const current of ['listening-saved', 'reading', 'result-ready', 'result']) {
      const elements = stage({ studentRef: 'synthetic-ref', attemptToken: 'synthetic-attempt', current });
      assert.equal(elements.identityView.hidden, false);
      assert.equal(elements.studentSelect.disabled, true);
    }
  });
  test(app + ': không đổi hành vi định danh CBT hoặc hiện lớp khi đang tải', () => {
    assert.equal(stage({ cbt: true }).identityView.hidden, true);
    assert.equal(stage({ cbt: true, studentRef: 'synthetic-ref' }).identityView.hidden, false);
    assert.equal(stage({ cbt: true, studentRef: 'synthetic-ref', current: 'result' }).identityView.hidden, true);
    assert.equal(stage({ current: 'loading' }).identityView.hidden, true);
  });
  test(app + ': dùng roster và lưu bài qua API, không phải Google Sheet', () => {
    assert.match(source, /\/api\/term-tests\/roster/);
    assert.match(source, /studentRef: state.studentRef/);
    assert.match(source, /\/listening`/);
    assert.match(source, /\/reading`/);
  });
}

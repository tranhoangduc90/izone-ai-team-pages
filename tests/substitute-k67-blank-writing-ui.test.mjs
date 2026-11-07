import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../term-tests/substitute-k67-shared/app.js', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../term-tests/substitute-test-2-k67-computer-based/bootstrap.js', import.meta.url), 'utf8');
const start = app.indexOf('      if(twoTaskWriting&&!automatic');
const end = app.indexOf('      const belowMinimum', start);
assert.ok(start > 0 && end > start);
const submitGuard = app.slice(start, end);

function checkSubmit({ allowed, automatic = false, task1 = '', task2 = '' }) {
  const effects = [];
  const first = { click: () => effects.push('tab1') };
  const second = { click: () => effects.push('tab2') };
  const context = {
    twoTaskWriting: true,
    automatic,
    window: { TERM_TEST_BOOTSTRAP: { blankWritingAllowed: allowed } },
    writingConfig: { tasks: [{ id: 'task1', label: 'Task 1' }, { id: 'task2', label: 'Task 2' }] },
    state: { drafts: { writing: { task1, task2 } } },
    elements: { writingTaskTabs: { children: [first, second] }, writingView: {
      querySelector: () => ({ focus: () => effects.push('focus') })
    } },
    showNotice: () => effects.push('notice')
  };
  const result = vm.runInNewContext(`(() => { ${submitGuard} return 'continue'; })()`, context);
  return { result, effects };
}

test('old two-Task sessions still block manual blank submission', () => {
  assert.deepEqual(checkSubmit({ allowed: false }).effects, ['tab1', 'notice', 'focus']);
  assert.deepEqual(checkSubmit({ allowed: undefined, task1: 'Text' }).effects, ['tab2', 'notice', 'focus']);
});

test('policy-enabled two-Task session permits both blank and one blank Task', () => {
  assert.deepEqual(checkSubmit({ allowed: true }).effects, []);
  assert.equal(checkSubmit({ allowed: true, task1: 'Text' }).result, 'continue');
  assert.match(app.slice(end, end + 650), /words: countWords\(state\.drafts\.writing\[task\.id\]\)/);
  assert.match(app.slice(end, end + 650), /window\.confirm\(message\)/);
});

test('automatic submission keeps its existing blank path', () => {
  assert.equal(checkSubmit({ allowed: false, automatic: true }).result, 'continue');
});

test('policy flag is bound to the validated Writing session and two-Task version', () => {
  assert.match(bootstrap, /blankWritingAllowed:session\.blankWritingAllowed===true/);
  assert.match(bootstrap, /blankWritingAllowed: twoTasks && state\.blankWritingAllowed === true/);
  assert.match(bootstrap, /session\.historyEpoch!==window\.SUBSTITUTE_STATE\.meta\.historyEpoch\)throw/);
});

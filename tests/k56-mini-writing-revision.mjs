import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync('term-tests/k56-mini-shared/app.js', 'utf8');
const body = source.slice(source.indexOf('  function applyWritingFromServer('), source.indexOf('  function scheduleWritingSave('));
function fixture() {
  const context = vm.createContext({ console, Date, Number, String, Boolean, Promise });
  vm.runInContext(`
    const state = {attemptToken:'00000000-0000-4000-8000-000000000002', drafts:{writing:{outline:'',task1:'draft',task2:''}},writingDirty:true,writingStarted:false,writingSubmitted:false};
    const writingConfig = {}, demoMode = '';
    let writingRevision = 3, writingSaveTimer = 0, writingRetryTimer = 0, writingSavePromise = Promise.resolve();
    const window = {clearTimeout(){}};
    const requests = [], scheduled = [];
    let response = {writing:{accepted:true,revision:3,started:true,task1:'draft',task2:''}};
    function apiRequest(path, options){requests.push({path,body:JSON.parse(options.body)});return Promise.resolve(response);}
    function syncWritingEditors(){} function saveSession(){} function setWritingSaveStatus(){}
    function scheduleWritingSave(delay){scheduled.push(delay);}
    ${body}
    globalThis.inspect = () => ({revision:writingRevision,dirty:state.writingDirty,task1:state.drafts.writing.task1,requests,scheduled});
  `, context);
  return context;
}

test('start/draft/submit gửi revision hợp lệ và đủ hai trường task', () => {
  const c = fixture();
  for (const action of ['start','draft','submit']) {
    const payload = vm.runInContext(`writingPayload('${action}')`, c);
    assert.equal(payload.revision, 3);
    assert.equal(payload.action, action);
    assert.equal(typeof payload.task1, 'string');
    assert.equal(typeof payload.task2, 'string');
  }
});
test('khôi phục revision từ server, không lùi khi đọc bản cũ', () => {
  const c = fixture();
  vm.runInContext("applyWritingFromServer({revision:12,task1:'saved',started:true},true);applyWritingFromServer({revision:4,task1:'saved',started:true},true)", c);
  assert.equal(c.inspect().revision, 12);
});
test('bản nháp Task 2 cũng được nhận diện, không mất khi server chưa có bài', () => {
  const c = fixture();
  vm.runInContext("state.drafts.writing.task1='';state.drafts.writing.task2='local task 2';state.writingDirty=false;applyWritingFromServer({revision:0})", c);
  assert.equal(vm.runInContext('state.drafts.writing.task2', c), 'local task 2');
  assert.equal(c.inspect().dirty, true);
});
test('server từ chối revision cũ: lấy bản server, không báo lưu thành công cho bản cũ', async () => {
  const c = fixture();
  vm.runInContext("response={writing:{accepted:false,revision:9,task1:'server draft',started:true}}", c);
  await vm.runInContext("saveWritingToServer('draft')", c);
  assert.equal(c.inspect().revision, 9);
  assert.equal(c.inspect().task1, 'server draft');
});
test('ack đến muộn không ghi đè chỉnh sửa mới trên máy', async () => {
  const c = fixture();
  vm.runInContext("let resolveResponse;apiRequest=(path,options)=>{requests.push({path,body:JSON.parse(options.body)});return new Promise(resolve=>resolveResponse=resolve)}", c);
  const pending = vm.runInContext("saveWritingToServer('draft')", c);
  await Promise.resolve(); await Promise.resolve();
  vm.runInContext("writingRevision=4;state.drafts.writing.task1='new local draft';resolveResponse(response)", c);
  await pending;
  assert.equal(c.inspect().task1, 'new local draft');
  assert.equal(c.inspect().dirty, true);
  assert.equal(c.inspect().scheduled.length, 1);
});
test('revision được lưu vào session và chỉ khôi phục số nguyên không âm an toàn', () => {
  assert.match(source, /writingDirty: state\.writingDirty,\s+writingRevision,/);
  assert.match(source, /Number\.isSafeInteger\(restoredSession\.writingRevision\)/);
  assert.match(source, /restoredSession\.writingRevision >= 0/);
});
test('cả bootstrap chính/dự phòng và answer sheet đều dùng revision cache mới', () => {
  for (const path of ['term-tests/mini-test-k56-computer-based/bootstrap.js','term-tests/mini-test-k56-computer-based/index.html','term-tests/mini-test-k56/index.html']) {
    const text = fs.readFileSync(path,'utf8');
    assert.match(text,/mini-writing-revision-v1/);
    assert.doesNotMatch(text,/app\.js\?[^'"\s]*20260910-audio-recovery-v1/);
  }
});

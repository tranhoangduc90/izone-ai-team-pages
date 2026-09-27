import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// Đầu vào: hàm submit thật của dashboard và một biểu mẫu giả giống sự kiện trình duyệt.
// Việc chính: cho sự kiện kết thúc trước khi API trả về, như khi người dùng bấm Thêm.
// Kết quả: kiểm lời báo thành công/thất bại và việc có tạo thêm nguồn trùng hay không.
// Khi lỗi: bài test chỉ ra chính xác lời báo sai; không gọi API hoặc sửa dữ liệu thật.
const source = await readFile(new URL('../js/writing-flow.js', import.meta.url), 'utf8');
const start = source.indexOf('async function submitManual(event)');
const end = source.indexOf('\nasync function handleCredential', start);
assert.ok(start >= 0 && end > start, 'Cần tìm được hàm submit của trang thật');
const functionSource = source.slice(start, end);

function harness(apiCall) {
  const messages = [];
  const button = { disabled: false };
  const form = { resetCount: 0, reset() { this.resetCount += 1; } };
  const dialog = { closeCount: 0, close() { this.closeCount += 1; } };
  const elements = {
    'flow-manual-kind': { value: 'homework' },
    'flow-manual-name': { value: 'Bài thử Homework' },
    'flow-manual-url': { value: 'https://docs.google.com/document/d/FIXTURE/edit' },
    'flow-manual-test-fields': { hidden: false },
    'flow-manual-dialog': dialog,
  };
  let eventActive = true;
  let apiCount = 0;
  let refreshCount = 0;
  const event = {
    preventDefault() {},
    submitter: button,
    get currentTarget() { return eventActive ? form : null; },
  };
  const context = {
    $: id => elements[id],
    state: { api: { addWritingManualSource: (...args) => { apiCount += 1; return apiCall(...args); } } },
    createRequestId: () => 'fixture-request-id',
    showError: (id, message) => messages.push({ id, message }),
    refreshData: async () => { refreshCount += 1; },
  };
  const submit = vm.runInNewContext(`${functionSource}\nsubmitManual`, context);
  return {
    event, button, form, dialog, elements, messages, submit,
    endEvent() { eventActive = false; },
    get apiCount() { return apiCount; },
    get refreshCount() { return refreshCount; },
  };
}

test('API thêm thành công sau khi sự kiện kết thúc vẫn báo đúng và không gửi lại', async () => {
  let completeApi;
  const pending = new Promise(resolve => { completeApi = resolve; });
  const page = harness(() => pending);
  const task = page.submit(page.event);
  page.endEvent();
  completeApi({ ok: true });
  await task;
  assert.equal(page.apiCount, 1);
  assert.equal(page.form.resetCount, 1);
  assert.equal(page.dialog.closeCount, 1);
  assert.equal(page.refreshCount, 1);
  assert.equal(page.button.disabled, false);
  assert.ok(page.messages.some(item => item.message?.startsWith('Đã thêm file.')));
  assert.ok(!page.messages.some(item => item.message?.startsWith('Chưa thêm được file:')));
});

test('API thêm thất bại giữ biểu mẫu để người dùng sửa và thử lại', async () => {
  const page = harness(async () => { throw new Error('API_STOP'); });
  const task = page.submit(page.event);
  page.endEvent();
  await task;
  assert.equal(page.apiCount, 1);
  assert.equal(page.form.resetCount, 0);
  assert.equal(page.dialog.closeCount, 0);
  assert.equal(page.refreshCount, 0);
  assert.equal(page.button.disabled, false);
  assert.ok(page.messages.some(item => item.message?.includes('API_STOP')));
});

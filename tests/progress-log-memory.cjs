// Dùng roster và API giả trong bộ nhớ; chặn toàn bộ mạng ngoài.
// Kiểm UUID dùng chung, xác nhận thủ công, đổi người an toàn và lỗi storage/draft.
async (page) => {
  const site = page.url().split('writing-handouts/')[0].replace(/\/$/, '');
  const base = site + '/progress-log/index.html?fixture=memory#assignment=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ids = {
    a: '11111111-1111-4111-8111-111111111111',
    b: '22222222-2222-4222-8222-222222222222',
    invalid: 'not-an-official-id', temporary: '33333333-3333-4333-8333-333333333333'
  };
  const key = 'izone:remembered-writing-student:v1:https://ducizone.ddns.net/writing-api';
  const ensure = (value, message) => { if (!value) throw Error(message); };
  const calls = { start: [], draft: [], submit: [] };
  const external = [], pageErrors = [];
  let failStart = false;
  const assignment = {
    assignmentId: 'assignment-fixture', sessionNumber: 1, title: 'Phiếu thử', definitionHash: 'fixture-hash',
    class: { classId: 'class-fixture', name: 'Lớp thử' },
    roster: [
      { studentRef: ids.a, name: 'Học viên A' }, { studentRef: ids.b, name: 'Học viên B' },
      { studentRef: ids.invalid, name: 'Hồ sơ không chính thức', provisional: true },
      { studentRef: ids.temporary, name: 'Hồ sơ tạm thử', provisional: true }
    ],
    definition: { blocks: [{ title: 'Ghi nhận', instructions: '', items: [
      { itemVersionId: 'item-1', prompt: 'Bạn học được gì?', interactionType: 'long_text', required: true, options: [] }
    ] }] }
  };
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.context().route('**/*', async route => {
    const request = route.request();
    const url = request.url();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (url.includes('/progress-log/config.js')) {
      return route.fulfill({ contentType: 'application/javascript', body: "window.PROGRESS_LOG_CONFIG=Object.freeze({API_BASE_URL:'https://ducizone.ddns.net/mapping-api',STUDENT_MEMORY:Object.freeze({enabled:true,allClasses:true})});" });
    }
    if (url.includes('/api/learning/assignments/open')) return json({ ok: true, assignment });
    if (url.includes('/api/learning/attempts/start')) {
      const body = request.postDataJSON(); calls.start.push(body);
      if (failStart) return json({ ok: false, message: 'Mở phiếu thử thất bại.' }, 503);
      return json({ ok: true, attempt: { attemptToken: `attempt-${body.studentRef}`, draftRevision: 0, draft: {}, identity: { studentName: body.studentRef === ids.a ? 'Học viên A' : 'Học viên B', className: 'Lớp thử', sessionNumber: 1 } } });
    }
    if (url.includes('/api/learning/attempts/draft')) {
      const body = request.postDataJSON(); calls.draft.push(body);
      return json({ ok: true, draft: { revision: body.revision } });
    }
    if (url.includes('/api/learning/attempts/submit')) { calls.submit.push(request.postDataJSON()); return json({ ok: true, receipt: { message: 'Đã nhận', attendanceStatus: 'self_confirmed', completeness: 'complete', nextAction: 'Xong' } }); }
    if (request.method() === 'GET' && url.startsWith(site + '/')) return route.continue();
    external.push(url);
    return route.abort();
  });
  const open = async () => {
    await page.goto(base);
    await page.locator('#studentSelect option[value="' + ids.a + '"]').waitFor({ state: 'attached', timeout: 3_000 }).catch(async () => {
      throw Error('Không nạp roster giả: ' + await page.locator('body').innerText());
    });
  };
  const start = async (ref = ids.a) => {
    await page.locator('#studentSelect').selectOption(ref);
    await page.locator('#chooseStudentButton').click();
    await page.locator('#confirmView').waitFor({ state: 'visible' });
    await page.locator('#confirmButton').click();
    await page.locator('#formView').waitFor({ state: 'visible' });
  };
  await open();
  ensure(await page.locator('#rememberStudent').isChecked(), 'Lần đầu chưa tick ghi nhớ trước khi chọn tên.');
  ensure(calls.start.length === 0, 'Lần đầu tự mở phiên.');
  await page.evaluate(([storageKey, ref]) => localStorage.setItem(storageKey, JSON.stringify({ version: 1, studentRef: ref })), [key, ids.a]);
  await page.reload();
  await page.locator('#studentSelect option[value="' + ids.a + '"]').waitFor({ state: 'attached' });
  ensure(await page.locator('#identityView').isVisible(), 'Chọn sẵn không được tự mở phiếu.');
  ensure(await page.locator('#studentSelect').inputValue() === ids.a, 'Không nhận UUID đã lưu từ khóa chung mapping/writing.');
  ensure(await page.locator('#rememberStudent').isChecked(), 'Tick ghi nhớ không mặc định bật.');
  await page.setViewportSize({ width: 390, height: 844 });
  ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Progress Log tràn ngang mobile.');
  await page.screenshot({ path: 'output/playwright/progress-memory-mobile.png', fullPage: true });
  await page.locator('#chooseStudentButton').click();
  ensure(await page.locator('#confirmView').isVisible(), 'Không giữ bước xác nhận tên.');
  const other = await page.context().newPage();
  await other.goto(base);
  await other.locator('#studentSelect option[value="' + ids.a + '"]').waitFor({ state: 'attached' });
  await other.evaluate(([storageKey, ref]) => localStorage.setItem(storageKey, JSON.stringify({ version: 1, studentRef: ref })), [key, ids.b]);
  await page.locator('#notice').filter({ hasText: 'tab khác' }).waitFor();
  failStart = true;
  await page.locator('#confirmButton').click();
  await page.locator('#notice').filter({ hasText: 'Mở phiếu thử thất bại' }).waitFor();
  ensure(await page.locator('#confirmView').isVisible(), 'Lỗi mở đã rời màn xác nhận.');
  failStart = false;
  await page.locator('#confirmButton').click();
  await page.locator('#formView').waitFor({ state: 'visible' });
  ensure(calls.start.length === 2 && calls.start.every(call => call.studentRef === ids.a), 'Tab khác đã đổi UUID trong lúc xác nhận/retry.');
  ensure(await page.evaluate(storageKey => localStorage.getItem(storageKey), key) === JSON.stringify({ version: 1, studentRef: ids.a }), 'localStorage lưu dữ liệu ngoài UUID/version.');
  await page.locator('textarea').fill('Bản nháp chỉ ở session.');
  ensure(await page.evaluate(() => Object.values(localStorage).every(value => !String(value).includes('Bản nháp chỉ ở session.'))), 'Câu trả lời bị lưu vào localStorage.');
  ensure(await page.evaluate(() => Object.values(sessionStorage).some(value => String(value).includes('Bản nháp chỉ ở session.'))), 'Bản nháp không nằm ở sessionStorage.');
  await page.locator('#submitButton').click();
  await page.locator('#resultView').waitFor({ state: 'visible', timeout: 3_000 }).catch(async () => {
    throw Error('Nộp fixture không xong: ' + await page.locator('#notice').innerText());
  });
  ensure(calls.draft.at(-1).attemptToken === `attempt-${ids.a}`, 'Tab khác đã đổi đích lưu của phiên đang mở.');
  await page.reload();
  await page.locator('#studentSelect option[value="' + ids.a + '"]').waitFor({ state: 'attached' });
  await page.locator('#changeRememberedStudent').click();
  ensure(await page.locator('#studentSelect').inputValue() === '', 'Đổi người trước khi mở không xóa lựa chọn.');
  ensure(await page.evaluate(storageKey => localStorage.getItem(storageKey), key) === null, 'Đổi người trước khi mở không xóa bộ nhớ chung.');
  await page.evaluate(([storageKey, ref]) => localStorage.setItem(storageKey, JSON.stringify({ version: 1, studentRef: ref })), [key, ids.invalid]);
  await page.reload();
  await page.locator('#studentSelect option[value="' + ids.a + '"]').waitFor({ state: 'attached' });
  ensure(await page.locator('#studentSelect').inputValue() === '', 'Hồ sơ không có UUID chính thức vẫn được chọn sẵn.');
  await page.evaluate(([storageKey, ref]) => localStorage.setItem(storageKey, JSON.stringify({ version: 1, studentRef: ref })), [key, ids.temporary]);
  await page.reload();
  await page.locator('#studentSelect option[value="' + ids.a + '"]').waitFor({ state: 'attached' });
  ensure(await page.locator('#studentSelect').inputValue() === '', 'UUID hồ sơ tạm vẫn được chọn sẵn.');
  await start(ids.b);
  await page.reload();
  await page.locator('#studentSelect option[value="' + ids.a + '"]').waitFor({ state: 'attached' });
  await page.locator('#studentSelect').selectOption(ids.b);
  await page.locator('#rememberStudent').uncheck();
  await page.locator('#chooseStudentButton').click();
  await page.locator('#confirmButton').click();
  await page.locator('#formView').waitFor({ state: 'visible' });
  ensure(await page.evaluate(storageKey => localStorage.getItem(storageKey), key) === null, 'Bỏ tick vẫn lưu UUID.');
  await page.evaluate(([storageKey, ref]) => localStorage.setItem(storageKey, JSON.stringify({ version: 1, studentRef: ref })), [key, ids.a]);
  await page.reload();
  await page.locator('#studentSelect option[value="' + ids.a + '"]').waitFor({ state: 'attached' });
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function () { throw new DOMException('Storage disabled', 'SecurityError'); };
    window.__restoreRemoveItem = () => { Storage.prototype.removeItem = original; };
  });
  await page.locator('#changeRememberedStudent').click();
  await page.locator('#rememberStudentStatus').filter({ hasText: 'Không thể xóa' }).waitFor();
  ensure(await page.locator('#studentSelect').inputValue() === ids.a, 'Lỗi xóa storage vẫn thay đổi lựa chọn.');
  await page.evaluate(() => window.__restoreRemoveItem());
  await other.close();
  ensure(external.length === 0, 'Fixture đã gọi mạng ngoài: ' + external.join(', '));
  ensure(pageErrors.length === 0, 'Trang phát sinh lỗi: ' + pageErrors.join(', '));
  return { outcome: 'success', checks: ['UUID dùng chung', 'xác nhận bận', 'draft sessionStorage', 'đổi người/lỗi storage/tab khác'] };
}

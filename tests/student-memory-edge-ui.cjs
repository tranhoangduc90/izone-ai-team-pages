// Nhận localhost Writing đã được phục vụ; mô phỏng roster, đăng ký tạm và mở phiên bằng dữ liệu giả.
// Kiểm các ca biên của ghi nhớ, PIN, đổi người học và lỗi API; không gọi dịch vụ bên ngoài.
// Chạy: playwright-cli -s=student-memory-edge run-code --filename tests/student-memory-edge-ui.cjs
// Khi lỗi: throw nêu rõ contract nào không đạt. Khi đạt: trả báo cáo có các ca đã kiểm.
async (page) => {
  const base = 'http://127.0.0.1:4187/writing-handouts/';
  const ensure = (ok, message) => { if (!ok) throw Error(message); };
  const ids = {
    official: '11111111-1111-4111-8111-111111111111',
    other: '22222222-2222-4222-8222-222222222222',
    temp: '33333333-3333-4333-8333-333333333333',
    existing: '44444444-4444-4444-8444-444444444444',
    classOne: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    classTwo: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  };
  const tasks = { task1: 'sample-task', task2: 'writing-task2-living-alone-development' };
  const selector = (type) => type === 'task1'
    ? { form: '#identity-form', group: '#class-id', student: '#student-name', workspace: '#workspace', error: '#identity-error',
      access: '#access-code', accessRow: '#access-code-row', panel: '#provisional-panel', name: '#provisional-name', pin: '#provisional-pin',
      confirm: '#provisional-pin-confirm', duplicate: '#duplicate-confirm', duplicateRow: '#duplicate-confirm-row', create: '#create-provisional',
      show: '#show-provisional', notice: '#network-notice', save: '#manual-save', change: '#change-remembered-student', activeChange: '#change-active-student' }
    : { form: '#lesson-identity-form', group: '#lesson-class', student: '#lesson-student', workspace: '#lesson-workspace', error: '#lesson-identity-error',
      access: '#lesson-access-code', accessRow: '#lesson-access-code-row', panel: '#lesson-provisional-panel', name: '#lesson-provisional-name', pin: '#lesson-provisional-pin',
      confirm: '#lesson-provisional-pin-confirm', duplicate: '#lesson-duplicate-confirm', duplicateRow: '#lesson-duplicate-confirm-row', create: '#lesson-create-provisional',
      show: '#lesson-show-provisional', notice: '#lesson-notice', save: '#lesson-save', change: '#change-remembered-student', activeChange: '#change-active-student' };
  const url = (type) => base + (type === 'task1' ? 'index.html' : 'lesson.html') + '?task=' + tasks[type];
  let registerMode = 'success', openMode = 'success', delayedRegistration = false, failSave = false;
  let pendingTemp = false, registrations = 0, openRequests = 0;
  const sessions = new Map(), errors = [], blocked = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept().catch(() => {}));
  await page.unrouteAll({ behavior: 'wait' });
  await page.context().unrouteAll({ behavior: 'wait' });
  await page.context().route('**/*', async route => {
    const request = route.request(), address = request.url();
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (!address.startsWith('http://127.0.0.1:4187/')) { blocked.push(address.split('?')[0]); return route.abort(); }
    if (address.endsWith('/config.json')) return send({ apiBase: 'http://127.0.0.1:4187/mock-writing/', studentMemory: { enabled: true, classCodes: ['LOP MOT', 'LOP HAI'] } });
    if (!address.includes('/api/v1/')) return route.continue();
    const path = address.split('/api/v1/')[1].split('?')[0];
    if (path.endsWith('/roster')) {
      const temporary = pendingTemp ? [{ studentRef: ids.temp, alias: 'Hồ sơ tạm giả', displayName: 'Hồ sơ tạm giả', provisional: true, requiresAccessCode: true }] : [];
      return send({ classes: [
        { classRef: ids.classOne, className: 'LOP MOT', students: [{ studentRef: ids.official, alias: 'Học viên giả' }, { studentRef: ids.other, alias: 'Người khác giả' }, ...temporary] },
        { classRef: ids.classTwo, className: 'LOP HAI', students: [] },
      ] });
    }
    if (path.endsWith('/provisional-students') && request.method() === 'POST') {
      registrations += 1;
      const payload = request.postDataJSON();
      ensure(/^\d{4}$/.test(payload.pin), 'Request đăng ký không gửi PIN bốn số.');
      ensure(typeof payload.requestId === 'string' && payload.requestId.length > 20, 'Request đăng ký không gửi requestId.');
      if (delayedRegistration) await page.waitForTimeout(250);
      if (registerMode === 'invalid') return send({ error: 'INVALID_STUDENT_NAME', message: 'Họ và tên không hợp lệ.' }, 400);
      if (registerMode === 'existing') return send({ error: 'PROVISIONAL_STUDENT_EXISTS', message: 'Đã có hồ sơ tạm cùng tên.', current: { studentRef: ids.existing, alias: 'Hồ sơ tạm đã có' } }, 409);
      if (registerMode === 'duplicate' && !payload.duplicateConfirmed) return send({ error: 'DUPLICATE_STUDENT_NAME', message: 'Đã có người cùng tên trong lớp.' }, 409);
      pendingTemp = true;
      return send({ ok: true, student: { studentRef: ids.temp, alias: 'Hồ sơ tạm giả', displayName: payload.displayName, provisional: true, requiresAccessCode: true } }, 201);
    }
    if ((path === 'sessions' || path === 'lesson-sessions') && request.method() === 'POST') {
      openRequests += 1;
      if (openMode !== 'success') {
        const status = Number(openMode);
        const error = status === 401 ? 'INVALID_ACCESS_CODE' : status === 423 ? 'ACCESS_CODE_LOCKED' : status === 409 ? 'SESSION_NOT_ALLOWED' : 'SESSION_NOT_ALLOWED';
        const message = status === 401 ? 'Mã 4 số không đúng.' : status === 423 ? 'Mã đang bị khóa.' : status === 409 ? 'Xung đột phiên thử.' : 'Học viên không thuộc lớp đang hoạt động.';
        return send({ error, message }, status);
      }
      const payload = request.postDataJSON();
      const ref = path + '_' + payload.classRef + '_' + payload.studentRef;
      sessions.set(ref, { sessionRef: ref, revision: 0, updatedAt: new Date().toISOString(), responses: {}, texts: {}, sections: {}, comments: [], attempts: [] });
      return send({ ok: true, session: { sessionRef: ref } }, 201);
    }
    const parts = path.split('/');
    if ((parts[0] === 'sessions' || parts[0] === 'lesson-sessions') && parts.length >= 2) {
      const ref = decodeURIComponent(parts[1]);
      ensure(sessions.has(ref), 'App đọc một phiên không do mock tạo.');
      if (request.method() === 'GET' && parts.length === 2) return send({ ok: true, session: sessions.get(ref) });
      if (parts[2] === 'live') return send({ ok: true });
      if (parts[2] === 'teacher-comments') return send({ ok: true, threads: [] });
      if (request.method() === 'PUT' && ['draft', 'responses'].includes(parts[2])) {
        if (failSave) return send({ message: 'Không lưu được bản giả.' }, 503);
        return send({ ok: true, session: sessions.get(ref) });
      }
    }
    throw Error('Mock chưa khai báo API: ' + path);
  });
  const reset = async () => {
    await page.goto(base + 'config.json');
    await page.evaluate(() => localStorage.clear());
    registerMode = 'success'; openMode = 'success'; delayedRegistration = false; failSave = false;
    pendingTemp = false; registrations = 0; openRequests = 0; sessions.clear();
  };
  const visit = async type => {
    await page.goto(url(type));
    const s = selector(type);
    await page.locator(s.group + ' option[value="' + ids.classOne + '"]').waitFor({ state: 'attached' });
  };
  const choose = async (type, student = ids.official) => {
    const s = selector(type);
    await page.locator(s.group).selectOption(ids.classOne);
    await page.locator(s.student).selectOption(student);
  };
  const fillRegistration = async (type, name = 'Tên giả') => {
    const s = selector(type);
    await page.locator(s.show).click();
    await page.locator(s.name).fill(name);
    await page.locator(s.pin).fill('2468');
    await page.locator(s.confirm).fill('2468');
  };
  const memory = () => page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('izone:remembered-writing-student:')));
  const checks = [];

  await reset(); await visit('task1'); await choose('task1');
  ensure(await page.locator('#remember-student').isChecked(), 'Ghi nhớ phải được chọn sẵn cho lớp/học viên hợp lệ.');
  await page.locator('#remember-student').uncheck();
  await page.locator('#class-id').selectOption(ids.classTwo); await page.locator('#class-id').selectOption(ids.classOne);
  await page.locator('#student-name').selectOption(ids.other); await page.locator('#student-name').selectOption(ids.official);
  ensure(!(await page.locator('#remember-student').isChecked()), 'Bỏ chọn ghi nhớ bị mất khi đổi lớp hoặc tên.');
  checks.push('Ghi nhớ chọn sẵn, bỏ chọn được giữ qua đổi lớp/tên');

  await reset(); await visit('task1'); await choose('task1'); await fillRegistration('task1');
  await page.screenshot({ path: 'output/playwright/student-memory-edge-provisional.png', fullPage: true });
  delayedRegistration = true;
  const taskOne = selector('task1');
  await page.locator(taskOne.create).click();
  ensure(await page.locator(taskOne.group).isDisabled() && await page.locator(taskOne.student).isDisabled(), 'Đăng ký tạm chưa khóa toàn bộ form danh tính.');
  await page.waitForTimeout(30);
  ensure(await page.locator(taskOne.group).inputValue() === ids.classOne, 'Lớp đổi trong lúc đăng ký đang chờ.');
  await page.locator(taskOne.student).waitFor({ state: 'attached' });
  await page.waitForTimeout(300);
  ensure(registrations === 1, 'Một lần đăng ký tạo nhiều request.');
  ensure(await page.locator(taskOne.student).inputValue() === ids.temp, 'Đăng ký xong không chọn hồ sơ tạm mới.');
  ensure(await page.locator('#remember-student').isDisabled() && !(await page.locator('#remember-student').isChecked()), 'Hồ sơ tạm bị ghi nhớ.');
  ensure(await page.locator(taskOne.accessRow).isVisible(), 'Hồ sơ tạm không yêu cầu PIN.');
  ensure((await memory()).length === 0, 'PIN hoặc UUID tạm bị ghi vào bộ nhớ trước khi mở.');
  checks.push('Đăng ký mới khóa form, chọn temp, không ghi nhớ và yêu cầu PIN');

  await reset(); await visit('task1'); await choose('task1'); registerMode = 'existing'; await fillRegistration('task1');
  await page.locator(taskOne.create).click(); await page.locator(taskOne.error).filter({ hasText: 'Đã có hồ sơ' }).waitFor();
  ensure(await page.locator(taskOne.student).inputValue() === ids.existing, 'Hồ sơ tạm đã tồn tại không được chọn để nhập PIN.');
  ensure(await page.locator(taskOne.pin).inputValue() === '' && await page.locator(taskOne.confirm).inputValue() === '', 'PIN vừa gõ bị giữ lại sau báo hồ sơ đã tồn tại.');
  ensure(await page.locator(taskOne.duplicateRow).isVisible(), 'Không hiển thị hướng dẫn trùng hồ sơ tạm.');
  checks.push('Hồ sơ tạm đã có: chọn UUID cũ, xóa PIN, không tạo bản trùng');

  await reset(); await visit('task2'); await choose('task2'); registerMode = 'duplicate'; const taskTwo = selector('task2'); await fillRegistration('task2');
  await page.locator(taskTwo.create).click(); await page.locator(taskTwo.duplicateRow).waitFor({ state: 'visible' });
  ensure(await page.locator(taskTwo.student).inputValue() === '', 'Đăng ký người mới vẫn giữ tên cũ và có thể mở nhầm bài.');
  await page.locator(taskTwo.duplicate).check(); await page.locator(taskTwo.create).click();
  await page.locator(taskTwo.accessRow).waitFor({ state: 'visible' });
  ensure(await page.locator(taskTwo.student).inputValue() === ids.temp, 'Xác nhận khác người cùng tên không tạo/chọn temp đúng.');
  checks.push('Tên trùng chính thức chỉ tạo sau xác nhận rõ');

  await reset(); await visit('task1'); await choose('task1'); await page.locator(taskOne.show).click();
  await page.locator(taskOne.name).fill('x'); await page.locator(taskOne.pin).fill('12'); await page.locator(taskOne.confirm).fill('12');
  await page.locator(taskOne.create).click(); ensure(registrations === 0, 'PIN sai định dạng vẫn gọi API.');
  await page.locator(taskOne.pin).fill('2468'); await page.locator(taskOne.confirm).fill('2468'); registerMode = 'invalid';
  await page.locator(taskOne.create).click(); await page.locator(taskOne.error).filter({ hasText: 'Họ và tên' }).waitFor();
  checks.push('Tên/PIN không hợp lệ trả lỗi kiểm soát');

  for (const status of [401, 423, 409, 404]) {
    await reset(); pendingTemp = true; await visit('task2'); await choose('task2', ids.temp);
    await page.locator(taskTwo.access).fill('2468'); openMode = String(status);
    await page.locator(taskTwo.form + ' button[type="submit"]').click();
    await page.locator(taskTwo.error).waitFor({ state: 'visible' });
    ensure(!(await page.locator(taskTwo.workspace).isVisible()), 'Lỗi mở ' + status + ' vẫn vào workspace.');
    ensure(await page.locator(taskTwo.student).isEnabled(), 'Lỗi mở ' + status + ' để khóa form.');
  }
  checks.push('Lỗi mở PIN/khóa/xung đột/roster đều giữ người ở setup');

  await reset(); await visit('task1'); await choose('task1'); await fillRegistration('task1');
  await page.locator(taskOne.group).selectOption(ids.classTwo);
  ensure(!(await page.locator(taskOne.panel).isVisible()) && await page.locator(taskOne.name).inputValue() === '' && await page.locator(taskOne.pin).inputValue() === '' && await page.locator(taskOne.confirm).inputValue() === '', 'Đổi lớp không dọn trạng thái đăng ký tạm.');
  await page.locator(taskOne.group).selectOption(ids.classOne); await fillRegistration('task1');
  await page.locator(taskOne.student).selectOption(ids.other);
  ensure(!(await page.locator(taskOne.panel).isVisible()) && !(await page.locator(taskOne.duplicate).isChecked()), 'Đổi tên không dọn panel/xác nhận tạm.');
  await fillRegistration('task1'); await page.locator(taskOne.change).click();
  ensure(await page.locator(taskOne.student).inputValue() === '' && !(await page.locator(taskOne.panel).isVisible()) && await page.locator(taskOne.name).inputValue() === '', 'Đổi người ở setup không dọn thông tin tạm.');
  await page.screenshot({ path: 'output/playwright/student-memory-edge-change-setup.png', fullPage: true });
  checks.push('Đổi lớp/tên/đổi người ở setup dọn PIN, panel và xác nhận');

  await reset(); pendingTemp = true; await visit('task2'); await choose('task2', ids.temp); await page.locator(taskTwo.access).fill('2468');
  await page.locator(taskTwo.pin).evaluate(node => node.value = '2468').catch(() => {});
  await page.locator(taskTwo.form + ' button[type="submit"]').click(); await page.locator(taskTwo.workspace).waitFor({ state: 'visible' });
  ensure(await page.locator(taskTwo.access).inputValue() === '' && await page.locator(taskTwo.pin).inputValue() === '' && await page.locator(taskTwo.confirm).inputValue() === '', 'Task 2 mở thành công còn PIN trong DOM.');
  checks.push('Task 2 mở thành công dọn toàn bộ PIN');

  await reset(); await visit('task1'); await choose('task1');
  const key = 'izone:remembered-writing-student:v1:http://127.0.0.1:4187/mock-writing';
  await page.evaluate(([storageKey, studentRef]) => {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, studentRef }));
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: JSON.stringify({ version: 1, studentRef }), storageArea: localStorage }));
  }, [key, ids.other]);
  await page.locator('#student-name').waitFor();
  ensure(await page.locator('#student-name').inputValue() === ids.other, 'Storage event không cập nhật form chưa mở.');
  await page.locator('#identity-form button[type="submit"]').click(); await page.locator('#workspace').waitFor({ state: 'visible' });
  await page.evaluate(([storageKey, studentRef]) => {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, studentRef }));
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: JSON.stringify({ version: 1, studentRef }), storageArea: localStorage }));
  }, [key, ids.official]);
  ensure(openRequests === 1 && (await page.locator('#student-label').textContent()).includes('Người khác'), 'Storage event đổi danh tính workspace đang mở.');
  checks.push('Storage event chỉ đổi form chưa mở, không đổi phiên đang làm');

  await reset(); await visit('task1'); await choose('task1');
  await page.locator('#identity-form button[type="submit"]').click(); await page.locator('#workspace').waitFor({ state: 'visible' });
  const draft = page.locator('#sections textarea').first();
  await draft.fill('Bản nháp giả phải ở lại đúng người khi lưu lỗi.');
  failSave = true; await page.locator('#change-active-student').click();
  await page.locator('#network-notice').filter({ hasText: 'Chưa thể đổi' }).waitFor();
  ensure(await page.locator('#workspace').isVisible() && await draft.inputValue() === 'Bản nháp giả phải ở lại đúng người khi lưu lỗi.', 'Lưu lỗi đã đổi hoặc mất bài của người hiện tại.');
  await page.screenshot({ path: 'output/playwright/student-memory-edge-save-failed.png', fullPage: true });
  checks.push('Lưu lỗi giữ nguyên người học và bản nháp đang làm');

  const denied = await page.context().newPage();
  const deniedErrors = [];
  denied.on('pageerror', error => deniedErrors.push(error.message));
  await denied.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('disabled', 'SecurityError'); } }); });
  await denied.goto(url('task2')); await denied.locator('#lesson-class').selectOption(ids.classOne);
  await denied.waitForFunction(() => !document.querySelector('#lesson-student')?.disabled);
  await denied.locator('#lesson-student').selectOption(ids.official);
  ensure(await denied.locator('#remember-student').isDisabled(), 'Storage bị chặn nhưng vẫn bật ghi nhớ.');
  await denied.locator('#lesson-identity-form button[type="submit"]').click(); await denied.locator('#lesson-workspace').waitFor({ state: 'visible' });
  ensure(deniedErrors.length === 0, 'Storage bị chặn làm lỗi JavaScript.'); await denied.close();
  checks.push('Trình duyệt chặn storage vẫn mở bài bình thường');

  ensure(blocked.length === 0, 'Test gọi ra ngoài: ' + blocked.join(', '));
  ensure(errors.length === 0, 'Lỗi JavaScript: ' + errors.join('; '));
  const report = { outcome: 'success', checks, registrations, openRequests, externalRequests: blocked.length, pageErrors: errors.length };
  return report;
}

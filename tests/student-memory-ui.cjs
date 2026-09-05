// Nhận source localhost, chạy hai app với lớp/học viên giả và API trong bộ nhớ.
// Chặn mọi yêu cầu ra ngoài. Kiểm UUID mở/lưu phiên, lỗi và ảnh desktop/mobile.
// Chạy bằng playwright-cli -s=student-memory run-code --filename tests/student-memory-ui.cjs.
// Khi lỗi, CLI báo lỗi kiểm thử; khi đạt, trang cuối hiển thị báo cáo có cấu trúc.
async (page) => {
  const base = 'http://127.0.0.1:4187/writing-handouts/';
  const ensure = (ok, message) => { if (!ok) throw Error(message); };
  await page.unrouteAll({ behavior: 'wait' });
  await page.context().unrouteAll({ behavior: 'wait' });
  const ids = {
    a: '11111111-1111-4111-8111-111111111111',
    b: '22222222-2222-4222-8222-222222222222',
    temp: '33333333-3333-4333-8333-333333333333',
    c1: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    c2: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    other: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  };
  let enabled = true, mode = 'normal', failOpen = false, failSave = false, delayOpen = false;
  const opened = [], writes = [], blocked = [], errors = [], sessions = new Map();
  const tasks = { task1: 'sample-task', task2: 'writing-task2-living-alone-development' };
  const url = (type, query = '') => base + (type === 'task1' ? 'index.html' : 'lesson.html') + '?task=' + tasks[type] + query;
  const selectors = (type) => type === 'task1'
    ? { form: '#identity-form', group: '#class-id', student: '#student-name', workspace: '#workspace', setup: '#setup-card', label: '#student-label' }
    : { form: '#lesson-identity-form', group: '#lesson-class', student: '#lesson-student', workspace: '#lesson-workspace', setup: '#lesson-setup', label: '#lesson-student-label' };
  page.on('pageerror', error => errors.push(error.message));
  await page.context().route('**/*', async route => {
    const request = route.request(), address = request.url();
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (!address.startsWith('http://127.0.0.1:4187/')) { blocked.push(address.split('?')[0]); return route.abort(); }
    if (address.endsWith('/config.json')) return send({ apiBase: 'http://127.0.0.1:4187/mock-writing/', studentMemory: { enabled, classCodes: ['LOPTHU', 'LOPKHAC'] } });
    if (!address.includes('/api/v1/')) return route.continue();
    const path = address.split('/api/v1/')[1].split('?')[0];
    if (path.endsWith('/roster')) {
      if (mode === 'roster-error') return send({ message: 'Không tải được danh sách thử.' }, 503);
      const isTask1 = path.includes(tasks.task1);
      const studentA = { studentRef: ids.a, alias: 'Học viên thử', name: 'Học viên thử', displayName: 'Học viên thử' };
      const studentB = { ...studentA, studentRef: ids.b };
      const students = mode === 'removed' ? [studentB] : [studentB, studentA,
        { studentRef: ids.temp, alias: 'Hồ sơ tạm thử', provisional: true, requiresAccessCode: true }];
      return send({ classes: [
        { classRef: isTask1 ? ids.c1 : ids.c2, className: 'LOPTHU', students },
        { classRef: ids.other, className: 'LOPKHAC', students: mode === 'multiple' ? [studentA] : [] },
      ] });
    }
    if (['sessions', 'lesson-sessions'].includes(path) && request.method() === 'POST') {
      const payload = request.postDataJSON();
      opened.push(payload);
      if (delayOpen) await page.waitForTimeout(250);
      if (failOpen) return send({ message: 'Chưa mở được phiên thử.' }, 503);
      const ref = [path, payload.activitySlug, payload.classRef, payload.studentRef].join('_');
      if (!sessions.has(ref)) sessions.set(ref, { sessionRef: ref, revision: 0, updatedAt: new Date().toISOString(), responses: {}, texts: {} });
      return send({ sessionRef: ref });
    }
    const parts = path.split('/');
    if (['sessions', 'lesson-sessions'].includes(parts[0]) && parts.length >= 2) {
      const ref = decodeURIComponent(parts[1]);
      ensure(sessions.has(ref), 'Truy cập phiên không được tạo từ fixture.');
      if (parts[2] === 'teacher-comments') return send({ threads: [] });
      if (parts[2] === 'live') return send({ ok: true });
      if (request.method() === 'GET' && parts.length === 2) return send(sessions.get(ref));
      if (request.method() === 'PUT' && ['draft', 'responses'].includes(parts[2])) {
        const payload = request.postDataJSON();
        writes.push({ ref, payload });
        if (failSave) return send({ message: 'Lưu thử thất bại.' }, 503);
        const previous = sessions.get(ref);
        const next = { ...previous, revision: previous.revision + 1, updatedAt: new Date().toISOString(),
          texts: { ...previous.texts, ...payload }, responses: payload.responses || previous.responses };
        sessions.set(ref, next);
        return send(next);
      }
    }
    throw Error('API chưa được mô phỏng: ' + path);
  });
  await page.goto(base + 'config.json');
  const reset = async () => {
    await page.goto(base + 'config.json');
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('izone-task1-practice', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'key' });
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction('drafts', 'readwrite');
          tx.objectStore('drafts').clear();
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    });
    opened.length = 0; writes.length = 0; sessions.clear();
    mode = 'normal'; failOpen = false; failSave = false; delayOpen = false;
  };
  const visit = async (type, query = '') => {
    await page.goto(url(type, query));
    await page.locator(selectors(type).group + ' option[value="' + (type === 'task1' ? ids.c1 : ids.c2) + '"]').waitFor({ state: 'attached' });
  };
  const memory = () => page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('izone:remembered-writing-student:')));
  const choose = async (type, student = ids.a) => {
    const s = selectors(type);
    await page.locator(s.group).selectOption(type === 'task1' ? ids.c1 : ids.c2);
    await page.locator(s.student).selectOption(student);
  };
  const open = async (type) => {
    await page.locator(selectors(type).form + ' button[type="submit"]').click();
    await page.locator(selectors(type).workspace).waitFor({ state: 'visible' });
  };
  await reset();
  await visit('task1');
  const baseline = await page.locator('#remember-student').count() === 0;
  const checks = [];
  for (const type of ['task1', 'task2']) {
    await visit(type);
    for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport);
      await page.screenshot({ path: 'output/playwright/student-memory-' + (baseline ? 'baseline' : 'after') + '-' + type + '-' + name + '.png', fullPage: true });
    }
  }
  if (!baseline) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await reset(); await visit('task1'); await choose('task1'); await open('task1');
    ensure((await memory()).length === 0, 'Ghi nhớ khi chưa chọn đồng ý.');
    checks.push('Không tự bật ghi nhớ');
    await reset(); await visit('task1'); await choose('task1'); await page.locator('#remember-student').check();
    delayOpen = true;
    await page.locator('#identity-form').evaluate(form => { form.dispatchEvent(new Event('submit', { cancelable: true })); form.dispatchEvent(new Event('submit', { cancelable: true })); });
    await page.locator('#workspace').waitFor({ state: 'visible' });
    ensure(opened.length === 1, 'Bấm đôi tạo nhiều phiên.');
    const saved = await memory();
    ensure(saved.length === 1 && saved[0][1] === JSON.stringify({ version: 1, studentRef: ids.a }), 'Bộ nhớ chứa dữ liệu thừa hoặc sai ID.');
    checks.push('Opt-in, chỉ UUID, bấm đôi một request');
    await visit('task2');
    ensure(await page.locator('#lesson-class').inputValue() === ids.c2, 'Mang classRef cũ sang Task 2.');
    ensure(await page.locator('#lesson-student').inputValue() === ids.a, 'Ghép nhầm người cùng tên khi roster đảo thứ tự.');
    ensure(opened.length === 1, 'Tự mở phiên khi mới vào trang.');
    await page.screenshot({ path: 'output/playwright/student-memory-prefilled.png', fullPage: true });
    await open('task2');
    ensure(opened.at(-1).classRef === ids.c2 && opened.at(-1).studentRef === ids.a, 'Mở sai hồ sơ đích.');
    await visit('task1');
    ensure(await page.locator('#student-name').inputValue() === ids.a, 'Không nhận lại Task 1.');
    checks.push('Task 1 ↔ Task 2, mã lớp khác, cùng tên/đảo thứ tự, không tự mở');
    mode = 'multiple'; await visit('task2');
    ensure(await page.locator('#lesson-student').inputValue() === '', 'Tự chọn khi có nhiều lớp.');
    await visit('task2', '&class=LOPTHU');
    ensure(await page.locator('#lesson-student').inputValue() === ids.a, 'Query không phân biệt được lớp.');
    mode = 'normal'; await visit('task2', '&class=LOPKHAC');
    ensure(await page.locator('#lesson-class').inputValue() === ids.other && await page.locator('#lesson-student').inputValue() === '', 'Bộ nhớ ghi đè lớp trong link.');
    await visit('task2', '&class=KHONGCOTHAT');
    ensure(await page.locator('#lesson-student').inputValue() === '', 'Query sai vẫn tự nhận người.');
    mode = 'removed'; await visit('task2');
    ensure(await page.locator('#lesson-student').inputValue() === '', 'Dùng ID đã mất khỏi roster.');
    checks.push('0/nhiều lớp, query đúng/sai/khác, hồ sơ không còn hợp lệ');
    mode = 'normal'; await visit('task2'); await page.locator('#change-remembered-student').click();
    ensure(await page.locator('#lesson-student').inputValue() === '' && (await memory()).length === 0, 'Đổi người không quên ID.');
    await choose('task2', ids.temp);
    ensure(await page.locator('#remember-student').isDisabled(), 'Cho nhớ hồ sơ tạm.');
    ensure(await page.locator('#lesson-access-code-row').isVisible(), 'Bỏ qua mã hồ sơ tạm.');
    checks.push('Đổi người và hồ sơ tạm');
    await reset(); await visit('task1'); await choose('task1'); await page.locator('#remember-student').check();
    failOpen = true;
    await page.locator('#identity-form button[type="submit"]').click();
    await page.locator('#identity-error').filter({ hasText: 'Chưa mở' }).waitFor();
    ensure((await memory()).length === 0 && await page.locator('#student-name').isEnabled(), 'Lỗi mở vẫn ghi nhớ hoặc khóa form.');
    failOpen = false; await open('task1');
    const essay = page.locator('#sections textarea').first();
    await essay.fill('Bản nháp giả cần giữ cho đúng học viên.');
    failSave = true;
    await page.locator('#change-active-student').click();
    await page.locator('#network-notice').filter({ hasText: 'Chưa thể đổi' }).waitFor();
    ensure(await page.locator('#workspace').isVisible() && (await memory()).length === 1, 'Lưu lỗi vẫn rời bài.');
    failSave = false; await page.locator('#change-active-student').click();
    await page.locator('#identity-form').waitFor({ state: 'visible' });
    ensure((await memory()).length === 0, 'Đổi người đang làm không quên.');
    ensure(writes.every(write => write.ref.endsWith(ids.a)), 'Lưu nháp sang người khác.');
    await choose('task1', ids.b); await open('task1');
    ensure(await page.locator('#sections textarea').first().inputValue() === '', 'Người sau nhận bài nháp người trước.');
    checks.push('Lỗi mở, lưu lỗi giữ bài, đổi người lưu đúng ID, bài người sau trống');
    await reset(); await visit('task2'); await choose('task2'); await page.locator('#remember-student').check(); await open('task2');
    const lessonEssay = page.locator('#lesson-bodies textarea').first();
    await lessonEssay.fill('Ý tưởng giả của học viên A cần giữ.');
    failSave = true;
    await page.locator('#change-active-student').click();
    await page.locator('#lesson-notice').filter({ hasText: 'Chưa thể đổi' }).waitFor();
    ensure(await lessonEssay.inputValue() === 'Ý tưởng giả của học viên A cần giữ.', 'Task 2 mất bài sau lỗi lưu.');
    failSave = false;
    await page.locator('#change-active-student').click();
    await page.locator('#lesson-identity-form').waitFor({ state: 'visible' });
    ensure(writes.every(write => write.ref.endsWith(ids.a)), 'Task 2 lưu sai người.');
    await choose('task2', ids.b); await open('task2');
    ensure(await page.locator('#lesson-bodies textarea').first().inputValue() === '', 'Task 2 mang bài người trước sang.');
    checks.push('Task 2 đổi người, lưu lỗi và bài viết tách theo UUID');
    await reset(); await visit('task1'); await choose('task1'); await page.locator('#remember-student').check(); await open('task1');
    const storedKey = (await memory())[0][0];
    await page.evaluate(key => localStorage.setItem(key, '{broken-json'), storedKey);
    await visit('task2');
    ensure(await page.locator('#lesson-student').inputValue() === '', 'JSON hỏng vẫn chọn người.');
    mode = 'roster-error';
    await page.goto(url('task2'));
    await page.locator('#lesson-summary').filter({ hasText: 'Không tải được' }).waitFor();
    ensure(await page.locator('#lesson-identity-form button[type="submit"]').isDisabled(), 'Roster lỗi vẫn cho mở bài.');
    mode = 'normal';
    const blockedPage = await page.context().newPage();
    const blockedErrors = [];
    blockedPage.on('pageerror', error => blockedErrors.push(error.message));
    await blockedPage.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } });
    });
    await blockedPage.goto(url('task2'));
    await blockedPage.locator('#lesson-class').selectOption(ids.c2);
    await blockedPage.locator('#lesson-student').selectOption(ids.a);
    ensure(await blockedPage.locator('#remember-student').isDisabled(), 'Trình duyệt chặn vẫn cho bật ghi nhớ.');
    await blockedPage.locator('#lesson-identity-form button[type="submit"]').click();
    await blockedPage.locator('#lesson-workspace').waitFor({ state: 'visible' });
    ensure(blockedErrors.length === 0, 'Chặn storage làm hỏng app.');
    await blockedPage.close();
    checks.push('JSON hỏng, roster lỗi, trình duyệt chặn ghi nhớ vẫn làm bài được');
    await reset(); await visit('task1'); await choose('task1'); await page.locator('#remember-student').check(); await open('task1');
    const otherTab = await page.context().newPage();
    await otherTab.goto(url('task2'));
    await otherTab.locator('#lesson-student').selectOption(ids.b);
    await otherTab.locator('#remember-student').check();
    await otherTab.locator('#lesson-identity-form button[type="submit"]').click();
    await otherTab.locator('#lesson-workspace').waitFor({ state: 'visible' });
    await page.locator('#sections textarea').first().fill('Bài tab A giữ đúng người dù tab B đổi ghi nhớ.');
    await page.locator('#manual-save').click();
    await page.locator('#save-state').filter({ hasText: 'Đã lưu lúc' }).waitFor();
    ensure(writes.at(-1).ref.endsWith(ids.a), 'Tab khác đổi danh tính của phiên đang làm.');
    ensure(JSON.parse((await memory())[0][1]).studentRef === ids.b, 'Tab B chưa ghi nhớ người mới.');
    await otherTab.close();
    checks.push('Hai tab khác người giữ đúng đích lưu phiên hiện tại');
    await reset(); enabled = false; await visit('task1');
    ensure(await page.locator('#remember-student').count() === 0, 'Cấu hình tắt vẫn đổi giao diện.');
    enabled = true;
    checks.push('Cấu hình tắt giữ giao diện gốc');
    const manifests = {
      task1: ['sample-task', 'pie-app-users-by-age', 'australian-destinations-1999-2009'],
      task2: ['writing-lesson13-young-leaders', 'writing-task2-practice-template', 'writing-task2-public-health-ban',
        'writing-task2-living-alone-development', 'writing-task2-lawbreakers-prison-alternatives',
        'writing-task2-public-health-spending', 'writing-task2-urban-crowding-traffic-congestion'],
    };
    for (const [type, slugs] of Object.entries(manifests)) {
      for (const slug of slugs) {
        tasks[type] = slug;
        await reset(); await visit(type); await choose(type); await page.locator('#remember-student').check(); await open(type);
        ensure(opened.at(-1).activitySlug === slug && opened.at(-1).studentRef === ids.a, 'Manifest mở sai bài hoặc người: ' + slug);
        await visit(type, '&class=LOPTHU');
        ensure(await page.locator(selectors(type).student).inputValue() === ids.a, 'Manifest không nhận lại người: ' + slug);
        ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Tràn ngang: ' + slug);
      }
    }
    checks.push('Mở và tải lại cả 10 manifest, giữ đúng đề và UUID');
    tasks.task2 = 'writing-task2-lawbreakers-prison-alternatives';
    await visit('task2', '&class=LOPTHU');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'output/playwright/student-memory-pilot-mobile.png', fullPage: true });
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Bản mobile tràn ngang.');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: 'output/playwright/student-memory-pilot-desktop.png', fullPage: true });
  }
  ensure(blocked.length === 0, 'Trang thử cố gọi dịch vụ ngoài.');
  ensure(errors.length === 0, 'Lỗi JavaScript: ' + errors.join('; '));
  const report = { outcome: 'success', baseline, checks, externalRequests: blocked.length, pageErrors: errors.length };
  await page.goto('about:blank');
  await page.evaluate(report => { document.body.textContent = JSON.stringify(report, null, 2); }, report);
  return report;
}

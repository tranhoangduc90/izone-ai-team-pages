// Chạy bằng playwright-cli run-code --filename sau khi mở teacher.html của bản cần kiểm.
// Mọi API và đăng nhập được thay bằng fixture cục bộ; không gửi dữ liệu hay thao tác ghi ra server thật.
// Kiểm các đề có manifest trên đích, hai lớp, cùng tên/khác UUID, ghép/xóa/hủy, lỗi, chỉ xem và mobile.
async (page) => {
  const base = page.url().split('teacher.html')[0];
  const surface = base.includes('/izone-writing-task1-practice/') ? 'legacy' : 'canonical';
  if (!base.includes('/writing-handouts/') && !base.includes('/izone-writing-task1-practice/')) throw Error('Sai đích kiểm thử.');
  const ensure = (condition, message) => { if (!condition) throw Error(message); };
  const source = '11111111-1111-4111-8111-111111111111';
  const fake = '22222222-2222-4222-8222-222222222222';
  const official = '33333333-3333-4333-8333-333333333333';
  const otherOfficial = '44444444-4444-4444-8444-444444444444';
  const classA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const classB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const baseStudent = { hasStarted: true, className: 'Lớp thử A', classRef: classA,
    sections: { overview: { status: 'passed' } }, responses: {}, progressPercent: 100,
    checkCount: 9, filledFields: 5, totalFields: 5, passedSectionCount: 3 };
  let students, pending, canManage, searches, writes, searchError = false;
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  // Chỉ trong trình duyệt thử và API giả: mô phỏng đồng ý/hủy hộp thoại để CLI không dừng giữa suite.
  await page.addInitScript(() => {
    window.__handoutConfirm = true;
    window.__handoutConfirmMessages = [];
    window.confirm = message => { window.__handoutConfirmMessages.push(message); return window.__handoutConfirm; };
  });
  await page.route('https://accounts.google.com/**', route => route.fulfill({
    contentType: 'application/javascript', body: `globalThis.google={accounts:{id:{initialize(o){this.options=o;},renderButton(el){const b=document.createElement('button');b.textContent='Đăng nhập thử';b.onclick=()=>this.options.callback({credential:'fixture-only'});el.append(b);}}}};`
  }));
  await page.route('https://ducizone.ddns.net/**', async route => {
    const [rawPath, query = ''] = route.request().url().split('?');
    const path = rawPath.replace(/^https:\/\/[^/]+/, '');
    const params = Object.fromEntries(query.split('&').filter(Boolean).map(part => part.split('=').map(value => decodeURIComponent(value.replace(/\+/g, ' ')))));
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.includes('/admin/live/activities/')) {
      const chosen = params.classRef;
      return send({ students: students.filter(s => !chosen || s.classRef === chosen), permissions: { canManage }, generatedAt: new Date().toISOString() });
    }
    if (/\/activities\/[^/]+\/provisional-students$/.test(path)) {
      const chosen = params.classRef;
      return send({ students: pending.filter(s => !chosen || s.classRef === chosen) });
    }
    if (path.endsWith('/official-students/search')) {
      searches.push({ q: params.q, exclude: params.excludeStudentRef, classRef: params.classRef || null });
      if (searchError) return send({ message: 'Lỗi tìm kiếm thử nghiệm' }, 503);
      if (params.q === 'Không có kết quả') return send({ students: [] });
      return send({ students: [
        { studentRef: otherOfficial, displayName: 'Học viên thử', classNames: ['Lớp thử D'] },
        { studentRef: official, displayName: 'Học viên thử', classNames: ['Lớp thử C'] }
      ] });
    }
    if (/\/provisional-students\/[^/]+\/(reconcile|delete)$/.test(path)) {
      if (!canManage) return send({ message: 'Không có quyền' }, 403);
      const ref = path.split('/').at(-2);
      const action = path.split('/').at(-1);
      const body = route.request().postDataJSON();
      writes.push({ action, ref, body });
      if (action === 'reconcile') {
        ensure(ref === source && body.officialStudentRef === official, 'Ghép nhầm UUID khi cùng tên.');
        students = students.map(s => s.studentRef === ref ? { ...s, provisional: false } : s);
      } else {
        ensure(ref === fake, 'Xóa nhầm hồ sơ thử.');
        students = students.filter(s => s.studentRef !== ref);
      }
      pending = pending.filter(s => s.studentRef !== ref);
      return send({ ok: true, reconciliationStatus: action === 'reconcile' ? 'matched' : 'deleted' });
    }
    errors.push('API ngoài fixture: ' + path);
    return route.abort();
  });
  const reset = () => {
    students = [
      { ...baseStudent, studentRef: source, displayName: 'Học viên thử', provisional: true },
      { ...baseStudent, studentRef: fake, displayName: 'Hồ sơ giả cần xóa', provisional: true },
      { ...baseStudent, classRef: classB, className: 'Lớp thử B', studentRef: otherOfficial, displayName: 'Học viên đối chứng' }
    ];
    pending = students.filter(s => s.provisional);
    searches = []; writes = []; canManage = true; searchError = false;
  };
  const slugs = ['pie-app-users-by-age','australian-destinations-1999-2009','writing-lesson13-young-leaders',
    'writing-task2-public-health-ban','writing-task2-living-alone-development','writing-task2-lawbreakers-prison-alternatives'];
  const tested = [], unavailable = [];
  for (const slug of slugs) {
    const manifest = await page.request.get(base + 'manifests/' + slug + '.json');
    if (manifest.status() === 404) { unavailable.push(slug); continue; }
    ensure(manifest.ok(), 'Không tải được manifest ' + slug);
    reset();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(base + 'teacher.html?task=' + slug + '&class=' + encodeURIComponent('Lớp thử A'));
    await page.getByRole('button', { name: 'Đăng nhập thử' }).click();
    await page.locator('#teacher-dashboard').waitFor({ state: 'visible' });
    ensure(await page.locator('#teacher-class').inputValue() === classA, 'Không chọn sẵn lớp.');
    const panel = page.getByRole('region', { name: 'Cần đối soát', exact: true });
    const row = panel.locator('article').filter({ has: page.getByText('Học viên thử · Lớp thử A', { exact: true }) });
    await row.getByRole('button', { name: 'Tìm trong database' }).click();
    await row.getByRole('status').filter({ hasText: 'Tìm thấy 2 hồ sơ.' }).waitFor();
    ensure(searches[0].exclude === source && searches[0].classRef === null, 'Tìm bị giới hạn theo lớp hoặc sai hồ sơ nguồn.');
    await row.getByRole('combobox').selectOption({ label: 'Học viên thử · Lớp thử C' });
    if (tested.length === 0) {
      await panel.screenshot({ path: 'output/playwright/reconciliation-desktop-' + surface + '.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      await panel.screenshot({ path: 'output/playwright/reconciliation-mobile-' + surface + '.png' });
      ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Giao diện tràn ngang trên mobile.');
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    await page.evaluate(() => { window.__handoutConfirm = false; });
    await row.getByRole('button', { name: 'Ghép hồ sơ', exact: true }).click();
    ensure(writes.length === 0, 'Hủy xác nhận vẫn gửi ghi.');
    await page.evaluate(() => { window.__handoutConfirm = true; });
    await row.getByRole('button', { name: 'Ghép hồ sơ', exact: true }).click();
    await row.waitFor({ state: 'detached' });
    ensure(students.find(s => s.studentRef === source).checkCount === 9, 'Bài bị đổi khi ghép.');
    const deleteRow = panel.locator('article').filter({ has: page.getByText('Hồ sơ giả cần xóa · Lớp thử A', { exact: true }) });
    await page.evaluate(() => { window.__handoutConfirm = false; });
    await deleteRow.getByRole('button', { name: 'Xóa hồ sơ tạm' }).click();
    ensure(writes.length === 1, 'Hủy xóa vẫn gửi ghi.');
    await page.evaluate(() => { window.__handoutConfirm = true; });
    await deleteRow.getByRole('button', { name: 'Xóa hồ sơ tạm' }).click();
    await panel.waitFor({ state: 'hidden' });
    ensure(writes.length === 2 && students.some(s => s.studentRef === otherOfficial), 'Ghi trùng hoặc sửa học viên khác.');
    ensure(await page.evaluate(() => window.__handoutConfirmMessages.length) === 4, 'Thiếu hộp xác nhận trước khi ghi.');
    tested.push(slug);
  }
  ensure(tested.length >= 5, 'Không kiểm đủ nhóm handout.');
  reset();
  await page.goto(base + 'teacher.html?task=' + tested[0]);
  await page.getByRole('button', { name: 'Đăng nhập thử' }).click();
  await page.locator('#teacher-dashboard').waitFor({ state: 'visible' });
  ensure(await page.locator('#teacher-class option').count() === 3, 'Link không có lớp phải cho chọn cả hai lớp.');
  const row = page.locator('#teacher-reconciliation-list article').filter({ has: page.getByText('Học viên thử · Lớp thử A', { exact: true }) });
  await row.getByRole('searchbox').fill('Không có kết quả');
  await row.getByRole('button', { name: 'Tìm trong database' }).click();
  await row.getByRole('status').filter({ hasText: 'Không tìm thấy' }).waitFor();
  ensure(await row.getByRole('button', { name: 'Ghép hồ sơ', exact: true }).isDisabled(), 'Kết quả rỗng vẫn cho ghép.');
  searchError = true;
  await row.getByRole('searchbox').fill('Học viên thử');
  await row.getByRole('button', { name: 'Tìm trong database' }).click();
  await row.getByRole('status').filter({ hasText: 'Lỗi tìm kiếm thử nghiệm' }).waitFor();
  reset(); canManage = false;
  await page.reload();
  await page.getByRole('button', { name: 'Đăng nhập thử' }).click();
  await page.locator('#teacher-dashboard').waitFor({ state: 'visible' });
  ensure(await page.getByRole('button', { name: 'Tìm trong database' }).count() === 0, 'Tài khoản chỉ xem có nút ghi.');
  ensure(await page.getByRole('button', { name: 'Xóa hồ sơ tạm' }).count() === 0, 'Tài khoản chỉ xem có nút xóa.');
  ensure(errors.length === 0, errors.join('; '));
  const report = { base, tested, unavailable, classQuery: true, globalSearch: true,
    sameNameUuid: true, cancel: true, merge: true, delete: true, empty: true, apiError: true, readOnly: true, responsive: true, pageErrors: errors.length };
  await page.goto('about:blank');
  await page.unrouteAll({ behavior: 'wait' });
  page.off('pageerror', onError);
  // CLI có thể nhường điều khiển khi thấy hộp thoại; đọc lại báo cáo này để xác nhận toàn bộ suite đã kết thúc.
  await page.evaluate(report => { document.title = 'Kiểm thử handout hoàn tất'; document.body.textContent = JSON.stringify(report); }, report);
}

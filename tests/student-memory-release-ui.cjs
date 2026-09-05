// Nhận trang config.json của bản cần kiểm trong trình duyệt riêng.
// Giữ cấu hình/source thật, thay mọi API học viên bằng dữ liệu giả trước khi mở app.
// Kiểm lớp CS và lớp khác, nhớ xuyên bài và đúng UUID; lỗi trả assertion.
async (page) => {
  const base = page.url().split('writing-handouts/')[0] + 'writing-handouts/';
  if (!/^https?:\/\/(127\.0\.0\.1:4187|tranhoangduc90\.github\.io)\//.test(base)) throw Error('Sai đích kiểm.');
  const ensure = (condition, message) => { if (!condition) throw Error(message); };
  await page.unrouteAll({ behavior: 'wait' });
  await page.context().unrouteAll({ behavior: 'wait' });
  const configResponse = await page.request.get(base + 'config.json', { headers: { 'Cache-Control': 'no-cache' } });
  ensure(configResponse.ok(), 'Không đọc được cấu hình phát hành.');
  const config = await configResponse.json();
  ensure(config.studentMemory?.enabled === true, 'Tính năng chưa bật.');
  ensure(config.studentMemory.allClasses === true, 'Chưa mở cho toàn bộ lớp.');
  const studentRef = '11111111-1111-4111-8111-111111111111';
  const classRefs = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
  const nextRefs = ['cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'];
  const opened = [], unexpected = [], pageErrors = [], consoleErrors = [];
  let outside = false;
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.context().route('**/*', async route => {
    const request = route.request(), address = request.url();
    const send = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (address.includes('/api/v1/')) {
      const path = address.split('/api/v1/')[1].split('?')[0];
      if (path.endsWith('/roster')) {
        const next = path.includes('writing-task2-public-health-ban');
        return send({ classes: (outside ? ['IC2200'] : ['CS.070626', 'CS.160826']).map((className, index) => ({
          classRef: (next ? nextRefs : classRefs)[index], className,
          students: [{ studentRef, alias: 'Học viên kiểm thử', name: 'Học viên kiểm thử', displayName: 'Học viên kiểm thử' }],
        })) });
      }
      if (path === 'lesson-sessions' && request.method() === 'POST') {
        opened.push(request.postDataJSON());
        return send({ sessionRef: 'fixture-release-session' });
      }
      if (path === 'lesson-sessions/fixture-release-session') return send({ sessionRef: 'fixture-release-session', revision: 0, responses: {}, updatedAt: '2026-09-05T00:00:00Z' });
      if (path.endsWith('/teacher-comments')) return send({ threads: [] });
      if (path.endsWith('/live')) return send({ ok: true });
      unexpected.push(path);
      return route.abort();
    }
    if (address.startsWith(base) || address.split('?')[0] === new URL('../shared/student-memory.js', base).href) return route.continue();
    unexpected.push(address.split('?')[0]);
    return route.abort();
  });
  await page.goto(base + 'config.json');
  const checks = [];
  for (const [index, className] of ['CS.070626', 'CS.160826'].entries()) {
    await page.evaluate(() => localStorage.clear());
    const address = base + 'lesson.html?task=writing-task2-public-health-spending&class=' + className;
    await page.goto(address);
    await page.locator('#remember-student').waitFor({ state: 'attached' });
    ensure(await page.locator('#lesson-class').inputValue() === classRefs[index], 'Không chọn đúng lớp từ link.');
    ensure(await page.locator('#lesson-student').inputValue() === '', 'Tự đoán tên lần đầu.');
    await page.locator('#lesson-student').selectOption(studentRef);
    await page.locator('#remember-student').check();
    await page.locator('#lesson-identity-form button[type="submit"]').click();
    await page.locator('#lesson-workspace').waitFor({ state: 'visible' });
    ensure(opened.at(-1).classRef === classRefs[index] && opened.at(-1).studentRef === studentRef, 'Mở sai người/lớp.');
    const requestCount = opened.length;
    await page.goto(address);
    await page.locator('#remember-student').waitFor({ state: 'attached' });
    ensure(await page.locator('#lesson-student').inputValue() === studentRef, 'Không nhớ khi mở lại.');
    ensure(opened.length === requestCount, 'Tự mở phiên khi tải trang.');
    await page.setViewportSize(index === 0 ? { width: 1280, height: 900 } : { width: 390, height: 844 });
    await page.screenshot({ path: 'output/playwright/student-memory-cs-' + index + (base.startsWith('https:') ? '-live' : '-local') + '.png', fullPage: true });
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Tràn ngang màn hình.');
    await page.goto(base + 'lesson.html?task=writing-task2-public-health-ban&class=' + className);
    await page.locator('#remember-student').waitFor({ state: 'attached' });
    ensure(await page.locator('#lesson-class').inputValue() === nextRefs[index] && await page.locator('#lesson-student').inputValue() === studentRef, 'Sang đề khác không tìm lại đúng lớp/người.');
    await page.goto(base + 'lesson.html?task=writing-task2-public-health-spending');
    await page.locator('#remember-student').waitFor({ state: 'attached' });
    ensure(await page.locator('#lesson-student').inputValue() === '', 'Học hai lớp nhưng không có query vẫn tự chọn.');
    await page.goto(address);
    await page.locator('#remember-student').waitFor({ state: 'attached' });
    await page.locator('#lesson-identity-form button[type="submit"]').click();
    await page.locator('#lesson-workspace').waitFor({ state: 'visible' });
    if (index === 0) await page.screenshot({ path: 'output/playwright/student-memory-before-change.png' });
    await page.locator('#change-active-student').click();
    await page.locator('#lesson-setup #remember-student').waitFor({ state: 'visible' });
    ensure(await page.locator('#lesson-class').inputValue() === classRefs[index], 'Đổi người làm mất lớp trong link.');
    ensure(await page.locator('#lesson-student').inputValue() === '', 'Đổi người xong vẫn còn người cũ.');
    if (index === 0) await page.locator('#lesson-setup').screenshot({ path: 'output/playwright/student-memory-after-change.png' });
    checks.push(className + ': lần đầu, ghi nhớ, mở lại, xuyên đề, nhiều lớp, desktop/mobile');
  }
  outside = true;
  await page.goto(base + 'lesson.html?task=writing-task2-lawbreakers-prison-alternatives&class=IC2200');
  await page.locator('#lesson-class option[value="' + classRefs[0] + '"]').waitFor({ state: 'attached' });
  await page.locator('#remember-student').waitFor({ state: 'attached' });
  ensure(await page.locator('#remember-student').isChecked(), 'IC2200 chưa được ghi nhớ mặc định.');
  await page.evaluate(ref => localStorage.setItem('izone:remembered-writing-student:v1:https://ducizone.ddns.net/writing-api', JSON.stringify({ version: 1, studentRef: ref })), studentRef);
  await page.reload();
  await page.locator('#remember-student').waitFor({ state: 'attached' });
  ensure(await page.locator('#lesson-student').inputValue() === studentRef, 'IC2200 không nhận bộ nhớ chung.');
  checks.push('IC2200: tick sẵn và chọn đúng UUID từ bộ nhớ chung');
  ensure(unexpected.length === 0, 'Có yêu cầu ngoài fixture: ' + unexpected.join('; '));
  ensure(pageErrors.length === 0 && consoleErrors.length === 0, 'Có lỗi trình duyệt: ' + [...pageErrors, ...consoleErrors].join('; '));
  const report = { outcome: 'success', target: base, checks, mockedSessionRequests: opened.length, unexpectedRequests: unexpected.length, pageErrors: pageErrors.length, consoleErrors: consoleErrors.length };
  await page.goto('about:blank');
  await page.evaluate(value => { document.body.textContent = JSON.stringify(value, null, 2); }, report);
  return report;
}

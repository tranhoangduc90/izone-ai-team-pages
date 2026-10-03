/*
 * Dữ liệu nhận vào: trang teacher-k56 trên server fixture cục bộ và JSON E-02 hoàn toàn giả.
 * Việc chính: chặn mọi request ngoài localhost, trả dữ liệu API giả rồi kiểm hai nhánh quyền ở 360×800.
 * Kết quả: trả số đo đã kiểm; khi chữ tràn, sai quyền hoặc thiếu dữ liệu, lệnh Playwright báo lỗi.
 * Chạy từ trang about:blank bằng playwright-cli run-code --filename; không gọi API thật hay ghi Portal.
 */

async page => {
  const base = 'http://127.0.0.1:4177';
  const response = await page.request.get(`${base}/tests/fixtures/k56-teacher-e02.json`);
  if (!response.ok()) throw new Error(`Không đọc được fixture E-02: HTTP ${response.status()}`);
  const fixture = await response.json();
  let denied = false;
  const blockedExternal = [];
  const jsonResponse = (body, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  });

  // Chặn mạng ngoài server thử; các tuyến API giả được khai báo sau nên được ưu tiên.
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(`${base}/`)) return route.continue();
    blockedExternal.push(`${route.request().method()} ${url.split('?')[0]}`);
    return route.abort();
  });
  await page.route('**/mapping-api-k56/api/auth/session', route => route.fulfill(jsonResponse({
    ok: true,
    reviewer: { displayName: 'Giảng viên kiểm thử' }
  })));
  await page.route('**/mapping-api-k56/api/term-tests/teacher/options', route => route.fulfill(
    jsonResponse(denied ? fixture.denied.options : fixture.allowed.options, denied ? 403 : 200)
  ));
  await page.route('**/mapping-api-k56/api/term-tests/teacher/results*', route => route.fulfill(
    jsonResponse(fixture.allowed.results)
  ));
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.google={accounts:{id:{initialize(){},renderButton(){},disableAutoSelect(){}}}};'
  }));

  await page.setViewportSize({ width: 360, height: 800 });
  const target = `${base}/term-tests/teacher-k56/?class=fixture-long-vietnamese-class&test=term-test-1`;
  const measure = async () => page.evaluate(() => {
    const title = document.querySelector('#overviewTitle');
    const notice = document.querySelector('#notice');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      overviewTitle: title?.textContent.trim(),
      titleOverflow: title ? title.scrollWidth > title.clientWidth + 1 : null,
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      notice: notice?.textContent.trim(),
      noticeRole: notice?.getAttribute('role'),
      accessVisible: !document.querySelector('#accessView')?.hidden,
      dashboardVisible: !document.querySelector('#dashboardView')?.hidden
    };
  });

  // Nhánh được cấp quyền phải hiển thị đủ tên lớp, không tràn và có dashboard.
  await page.goto(target, { waitUntil: 'networkidle' });
  await page.waitForSelector('#dashboardView:not([hidden])');
  const allowed = await measure();
  const className = fixture.allowed.options.classes[0].name;
  if (allowed.viewport.width !== 360 || allowed.viewport.height !== 800
      || !allowed.overviewTitle?.includes(className)
      || allowed.titleOverflow !== false || allowed.pageOverflow
      || !allowed.dashboardVisible || allowed.accessVisible) {
    throw new Error(`E-02 được cấp quyền không đạt: ${JSON.stringify(allowed)}`);
  }

  // Nhánh bị từ chối phải báo rõ quyền, giữ màn hình đăng nhập và ẩn dashboard.
  denied = true;
  await page.goto(`${target}&fixture=denied`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#accessView:not([hidden])');
  const rejected = await measure();
  if (rejected.viewport.width !== 360 || rejected.viewport.height !== 800
      || rejected.noticeRole !== 'status'
      || !rejected.notice?.includes(fixture.denied.options.message)
      || rejected.pageOverflow || !rejected.accessVisible || rejected.dashboardVisible) {
    throw new Error(`E-02 bị từ chối không đạt: ${JSON.stringify(rejected)}`);
  }

  const unexpectedApi = blockedExternal.filter(item => item.includes('/mapping-api-k56/api/'));
  if (unexpectedApi.length) throw new Error(`E-02 có API không được giả lập: ${unexpectedApi.join(', ')}`);
  return { status: 'passed', allowed, rejected, blockedExternalCount: blockedExternal.length };
}

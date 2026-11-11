// Đi từ landing thật tới bootstrap thật; chỉ dùng dữ liệu giả, chặn mọi hệ thống ngoài.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, serve } from './helpers/k56-design-fixture.mjs';

const studentRef = '11111111-1111-4111-8111-111111111111';
const demoRef = '22222222-2222-4222-8222-222222222222';
const realClass = 'IC9999';
const demoClass = 'CODEXDEMO56';
const identityKey = 'izone:student-identity:v1';

test('mở demo và chọn tên demo không thay danh tính, nháp hoặc gắn thiết bị của học viên lớp thật', async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const evidence = [];
  try {
    for (const slug of ['term-test-1-k56', 'term-test-2-k56', 'mini-test-k56']) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const calls = [], errors = [], failedAssets = [];
      const bindings = new Map([[`${realClass}:${studentRef}`, { deviceId: 'fixture-student-device', studentRef, classCode: realClass }]]);
      const bindingBefore = structuredClone([...bindings]);
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) failedAssets.push({ url: response.url(), status: response.status() }); });
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === new URL(server.base).origin) return route.continue();
        if (url.hostname === 'accounts.google.com') return route.fulfill({ contentType: 'text/javascript', body: 'window.google={accounts:{id:{initialize(){},renderButton(){}}}};' });
        let body = {}; try { body = request.postDataJSON() || {}; } catch {}
        const api = body.route || url.pathname;
        calls.push({ path: url.pathname, api, method: request.method(), body });
        if (api.endsWith('/api/auth/session')) return route.fulfill({ json: { ok: true } });
        if (api.endsWith('/teacher/options')) return route.fulfill({ json: { ok: true, reviewer: { displayName: 'Giảng viên giả' }, classes: [{ name: realClass }] } });
        if (api.includes('/roster')) {
          const code = url.searchParams.get('class');
          return route.fulfill({ json: { ok: true, class: { name: code }, students: [{ ref: code === demoClass ? demoRef : studentRef, name: code === demoClass ? 'Học viên demo giả' : 'Học viên thật giả lập' }] } });
        }
        if (/\/(student-identity|attempt\/prepare|session\/prepare)$/.test(api)) {
          if (body.classCode && body.studentRef) bindings.set(`${body.classCode}:${body.studentRef}`, { deviceId: 'fixture-teacher-device', studentRef: body.studentRef, classCode: body.classCode });
          return route.fulfill({ status: 503, json: { ok: false, message: 'Fixture đã ghi nhận chuẩn bị demo; dừng trước audio.' } });
        }
        if (api.includes('/api/')) return route.fulfill({ json: { ok: true, serverNow: new Date().toISOString() } });
        return route.abort();
      });
      try {
        // Query giả có tên và token để bắt việc vô tình chuyển chúng sang bài demo.
        await page.goto(`${server.base}term-tests/k56-demo/?class=${realClass}&test=${slug}&mode=lis_first&studentRef=${studentRef}&demoStudent=${studentRef}#fixture-private-fragment`);
        await page.locator('#classSelect').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#classSelect').inputValue(), realClass);
        const protectedKeys = [identityKey, `izone-test:${slug}:${realClass}`, `izone-test-ui:${slug}:${realClass}`, 'izone:remembered-writing-student:v1:https://ducizone.ddns.net/writing-api'];
        const before = await page.evaluate(({ protectedKeys, studentRef }) => {
          const record = JSON.stringify({ version: 1, identity: { authority: 'erp-contact', id: '900001' }, revision: 'fixture_revision_12345678', updatedAt: new Date().toISOString(), studentRef });
          for (const storage of [localStorage, sessionStorage]) for (const key of protectedKeys) storage.setItem(key, record);
          return protectedKeys.map(key => ({ key, local: localStorage.getItem(key), session: sessionStorage.getItem(key) }));
        }, { protectedKeys, studentRef });
        assert.equal(await page.locator('#openExam').textContent(), 'Mở bài DEMO');
        await page.locator('#openExam').click();
        await page.waitForURL(`${server.base}term-tests/${slug}-computer-based/?class=${demoClass}&mode=lis_first`);
        const demoUrl = new URL(page.url());
        assert.equal(demoUrl.searchParams.size, 2);
        assert.equal(demoUrl.hash, '');
        await page.locator(`#bootstrapStudent option[value="${demoRef}"]`).waitFor({ state: 'attached' });
        assert.equal(await page.locator('#bootstrapStudent').inputValue(), '', 'Không tự khôi phục tên học viên thật khi mở demo');
        assert.equal(await page.locator(`#bootstrapStudent option[value="${studentRef}"]`).count(), 0);
        await page.locator('#bootstrapStudent').selectOption(demoRef);
        await page.locator('#confirmIdentity').click();
        await page.locator('#bootstrapNotice').filter({ hasText: 'Fixture đã ghi nhận' }).waitFor();
        const after = await page.evaluate(protectedKeys => protectedKeys.map(key => ({ key, local: localStorage.getItem(key), session: sessionStorage.getItem(key) })), protectedKeys);
        assert.deepEqual(after, before);
        assert.deepEqual(bindings.get(`${realClass}:${studentRef}`), bindingBefore[0][1]);
        assert.equal(bindings.get(`${demoClass}:${demoRef}`)?.deviceId, 'fixture-teacher-device', 'Ca kiểm phải đi tới chuẩn bị học viên demo');
        assert.ok(calls.filter(call => /\/(student-identity|attempt\/prepare|session\/prepare)$/.test(call.api)).every(call => call.path.includes('/mapping-api-demo/') && call.body.classCode === demoClass && call.body.studentRef === demoRef));
        assert.equal(calls.filter(call => call.path.includes('/mapping-api-k56/') && !/\/api\/auth\/session$|\/teacher\/options$/.test(call.path)).length, 0);
        assert.deepEqual(errors, []);
        evidence.push({ slug, protectedStorageEntries: protectedKeys.length * 2, deviceBindingBefore: bindingBefore[0][1], deviceBindingAfter: bindings.get(`${realClass}:${studentRef}`), demoPreparationObserved: true, realExamApiCalls: 0 });
      } catch (error) {
        console.error(JSON.stringify({ slug, errors, failedAssets, calls, body: (await page.locator('body').innerText()).slice(0, 3000) }));
        throw error;
      } finally { await context.close(); }
    }
    const directory = resolve(process.env.K56_DEMO_EVIDENCE || 'output/playwright/k56-open-demo');
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'identity-readback.json'), JSON.stringify({ checkedAt: new Date().toISOString(), boundary: 'Frontend thật + API gắn thiết bị giả; không chứng nhận database production', evidence }, null, 2));
  } finally { await browser.close(); await server.close(); }
});

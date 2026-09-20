/* Kiểm hợp đồng phiên dài hạn bằng fetch giả; không gọi Google/API thật và không dùng dữ liệu học viên. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeacherSessionClient, teacherSessionRequestOptions } from '../shared/teacher-session-client.js';

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('đổi Google credential lấy cookie máy chủ mà không đưa credential vào URL hoặc storage', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return response(201, { ok: true, reviewer: { email: 'teacher@example.invalid' } });
  });
  const client = createTeacherSessionClient({ apiBaseUrl: 'https://api.example.invalid/mapping-api', sessionPath: '/api/auth/session' });
  await client.login('google-credential-for-test-only');
  assert.equal(calls[0].url, 'https://api.example.invalid/mapping-api/api/auth/session');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { credential: 'google-credential-for-test-only' });
  assert.doesNotMatch(calls[0].url, /credential/u);
});

test('khôi phục bằng cookie và coi 401 là chưa có phiên', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return response(401, { ok: false, error: 'UNAUTHORIZED' });
  });
  const client = createTeacherSessionClient({ apiBaseUrl: 'https://api.example.invalid/writing-api/', sessionPath: 'api/v1/auth/session' });
  assert.equal(await client.restore(), null);
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.cache, 'no-store');
});

test('request ghi và logout luôn có cổng chống CSRF', async t => {
  const write = teacherSessionRequestOptions({ method: 'POST', headers: { 'content-type': 'application/json' } });
  assert.equal(write.credentials, 'include');
  assert.equal(write.headers.get('x-izone-csrf'), '1');
  assert.equal(teacherSessionRequestOptions().headers.has('x-izone-csrf'), false);

  let logoutOptions;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    logoutOptions = options;
    return response(200, { ok: true });
  });
  const client = createTeacherSessionClient({ apiBaseUrl: 'https://api.example.invalid/mapping-api', sessionPath: '/api/auth/session' });
  await client.logout();
  assert.equal(logoutOptions.method, 'DELETE');
  assert.equal(logoutOptions.credentials, 'include');
  assert.equal(logoutOptions.headers.get('x-izone-csrf'), '1');
});

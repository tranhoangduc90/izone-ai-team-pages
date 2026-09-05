import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../progress-log/', import.meta.url);

async function source(name) {
  return readFile(new URL(name, root), 'utf8');
}

test('trang học viên giữ token trong fragment và có đủ năm trạng thái chính', async () => {
  const [html, app] = await Promise.all([source('index.html'), source('app.js')]);
  assert.match(html, /Content-Security-Policy/);
  for (const id of ['identityView', 'confirmView', 'formView', 'resultView', 'errorView']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /window\.location\.hash/);
  assert.doesNotMatch(app, /searchParams\.get\(['"]assignment/);
  assert.match(app, /readMemory\(studentMemory\.storage/);
  assert.match(app, /writeMemory\(studentMemory\.storage/);
  assert.match(app, /sessionStorage/);
  assert.match(app, /identityConfirmed:\s*true/);
  assert.match(app, /draftRevision/);
  assert.match(app, /identityConfirmed:\s*true/);
  assert.match(app, /changeRememberedStudent/);
  assert.match(html, /id="rememberStudent"/);
});

test('giao diện không dùng API dựng HTML nguy hiểm', async () => {
  const scripts = `${await source('app.js')}\n${await source('teacher.js')}`;
  assert.doesNotMatch(scripts, /\.innerHTML\s*=/);
  assert.doesNotMatch(scripts, /insertAdjacentHTML|document\.write|\beval\s*\(|new Function/);
  assert.match(scripts, /replaceChildren/);
});

test('trang giảng viên chỉ soạn từ thư viện và override phải có lý do', async () => {
  const [html, app] = await Promise.all([source('teacher.html'), source('teacher.js')]);
  assert.match(html, /id="questionLibrary"/);
  assert.match(html, /id="attendanceReason"[^>]+minlength="3"/);
  assert.match(app, /\/teacher\/question-library/);
  assert.match(app, /\/teacher\/reflection-forms\/publish/);
  assert.match(app, /operationId:\s*crypto\.randomUUID\(\)/);
  assert.match(app, /url\.hash = new URLSearchParams/);
  assert.match(html, /PHÂN TÍCH CỦA HỆ THỐNG/);
  assert.match(html, /LỜI NHẮN THẬT TỪ GIẢNG VIÊN/);
  assert.match(app, /student\.latestReport/);
});

test('không nhúng dữ liệu riêng tư hay credential vào bundle', async () => {
  const files = await Promise.all(['config.js', 'app.js', 'teacher.js', 'index.html', 'teacher.html'].map(source));
  const bundle = files.join('\n');
  assert.doesNotMatch(bundle, /BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY/);
  assert.doesNotMatch(bundle, /(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*['"][^'"]+/i);
  assert.doesNotMatch(bundle, /erp_student|student_contact_id|email\s*[:=]/i);
});

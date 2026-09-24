import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import vm from 'node:vm';
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

test('frontend local vẫn trỏ tới API production thay vì same-origin backend', async () => {
  const configSource = await source('config.js');
  const sandbox = { window: { location: { hostname: '127.0.0.1' } } };
  vm.runInNewContext(configSource, sandbox, { filename: 'progress-log/config.js' });
  assert.equal(sandbox.window.PROGRESS_LOG_CONFIG.API_BASE_URL, 'https://ducizone.ddns.net/mapping-api');
});

test('giao diện không dùng API dựng HTML nguy hiểm', async () => {
  const scripts = `${await source('app.js')}\n${await source('teacher.js')}\n${await source('journey.js')}`;
  assert.doesNotMatch(scripts, /\.innerHTML\s*=/);
  assert.doesNotMatch(scripts, /insertAdjacentHTML|document\.write|\beval\s*\(|new Function/);
  assert.match(scripts, /replaceChildren/);
});

test('trang giảng viên chỉ soạn từ thư viện và override phải có lý do', async () => {
  const [html, app, css] = await Promise.all([source('teacher.html'), source('teacher.js'), source('teacher.css')]);
  assert.ok(html.indexOf('id="dashboardTab"') < html.indexOf('id="createTab"'));
  assert.match(html, /id="createPanel" hidden/);
  assert.match(app, /switchPanel\('dashboard'\)/);
  assert.match(html, /class="topbar teacher-header"/);
  assert.match(css, /\.teacher-shell \.card/);
  assert.match(html, /id="questionLibrary"/);
  assert.match(html, /id="attendanceReason"[^>]+minlength="3"/);
  assert.match(app, /\/teacher\/question-library/);
  assert.match(app, /\/teacher\/reflection-forms\/publish/);
  assert.match(app, /attendanceOperationId = crypto\.randomUUID\(\)/);
  assert.match(app, /operationId:\s*state\.attendanceOperationId/);
  assert.match(app, /url\.hash = new URLSearchParams/);
  assert.match(html, /PHÂN TÍCH CỦA HỆ THỐNG/);
  assert.match(html, /LỜI NHẮN THẬT TỪ GIẢNG VIÊN/);
  assert.match(app, /student\.latestReport/);
  assert.match(html, /id="copyStudentJourneyLinkButton"/);
  assert.match(app, /\/teacher\/student-progress-links/);
  assert.match(app, /payload\.link\.studentRef !== student\.studentRef/);
  assert.match(html, /id="openStudentFormButton"/);
  assert.match(html, /id="copyCurrentLinkButton"/);
  assert.match(html, /id="draftDialog"/);
  assert.match(app, /\/teacher\/live-drafts/);
  assert.match(app, /payload\.live\.assignmentId !== assignmentId/);
  assert.match(app, /document\.hidden/);
  assert.match(app, /8_000/);
  assert.match(app, /portalSyncQueued/);
  assert.match(app, /student\.portalSync\?\.status/);
  assert.match(html, /id="attendanceSyncHint"/);
  assert.match(app, /student\.checkpoints.*some\(item => item\.blockId === block\.blockId\)/);
  assert.match(app, /draftAnswers\[item\.itemVersionId\]/);
  assert.match(app, /Phần \$\{index \+ 1\}: \$\{stateLabel\}/);
  assert.match(app, /void loadDashboard\(\{ quiet: true \}\)/);
});

test('câu Writing 1 điền từ trong bốn câu, vẫn lưu đủ tám ô và yêu cầu điền hết', async () => {
  const [html, app, css] = await Promise.all([source('index.html'), source('app.js'), source('styles.css')]);
  assert.match(html, /Progress Log · Khóa 56/);
  assert.doesNotMatch(html, /VIỆC TIẾP THEO/);
  assert.doesNotMatch(app, /nextActionResult/);
  assert.match(app, /layoutType === 'numbered_short_texts'/);
  assert.match(app, /responseCount/);
  assert.match(app, /value\.every\(entry/);
  assert.match(app, /numbered-text-row/);
  assert.match(app, /SENTENCE_COMPLETION_LAYOUTS/);
  assert.match(app, /Task Response:/);
  assert.match(app, /Coherence and Cohesion:/);
  assert.match(app, /Lexical Resource:/);
  assert.match(app, /Grammatical Range and Accuracy:/);
  assert.match(app, /templates\.reduce\(\(count, line\) => count \+ line\.parts\.length - 1, 0\) !== expected/);  assert.match(app, /document\.createElement\('textarea'\)/);
  assert.match(app, /input\.className = 'sentence-blank'/);
  assert.match(app, /resizeSentenceBlank\(input\)/);
  assert.match(app, /group\.querySelectorAll\('textarea'\)/);
  assert.match(app, /Math\.max\(30, control\.scrollHeight\)/);
  assert.match(app, /item\.interactionConfig\.responseLabels/);
  assert.match(css, /\.question-number/);
  assert.match(css, /\.numbered-text-group/);
  assert.match(css, /\.sentence-row/);
  assert.match(css, /\.sentence-blank/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /#identityView #sessionLabel \{ font-size: 14px/);
  assert.match(css, /#identityView #classLabel \{ margin-top: 9px; color: var\(--ink\); font-size: 16px/);
  assert.match(html, /styles\.css\?rev=20260921-session3-v1/);
  assert.match(css, /--canvas: #f7f5ef/);
  assert.match(css, /--red: #db3e4b/);
});

test('hành trình dùng link cá nhân trong fragment và chỉ mở timeline khi học viên yêu cầu', async () => {
  const [html, app] = await Promise.all([source('journey.html'), source('journey.js')]);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /id="timeline" hidden/);
  assert.match(html, /PHÂN TÍCH|TỔNG KẾT GẦN NHẤT/);
  assert.match(html, /LỜI NHẮN TỪ GIẢNG VIÊN/);
  assert.match(app, /window\.location\.hash/);
  assert.match(app, /history\.replaceState/);
  assert.match(app, /\/student\/course-journey/);
  assert.match(app, /referrerPolicy:\s*'no-referrer'/);
  assert.doesNotMatch(app, /searchParams\.get\(['"]access/);
});

test('không nhúng dữ liệu riêng tư hay credential vào bundle', async () => {
  const files = await Promise.all([
    'config.js', 'app.js', 'teacher.js', 'journey.js', 'index.html', 'teacher.html', 'journey.html'
  ].map(source));
  const bundle = files.join('\n');
  assert.doesNotMatch(bundle, /BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY/);
  assert.doesNotMatch(bundle, /(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*['"][^'"]+/i);
  assert.doesNotMatch(bundle, /erp_student|student_contact_id|email\s*[:=]/i);
});

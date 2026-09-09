import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const read = path => fs.readFileSync(new URL('../term-tests/' + path, import.meta.url), 'utf8');
// Kiểm dây nối công khai; các ca đồng hồ/lưu thật được kiểm thêm qua API và trình duyệt với dữ liệu giả.
test('chỉ Task 1 có ảnh trong đề, xem bài và kết quả của học viên/giảng viên', () => {
  const app = read('shared/app.js');
  assert.match(app, /if \(task\.id === 'task1' && task\.image\?\.src\)/);
  assert.match(app, /if \(taskNumber === 1 && \(typeof task\.image/);
  assert.match(read('shared/attempt-review.js'), /if \(task\.id === 'task1' && task\.image\?\.src\)/);
  assert.match(read('teacher/app.js'), /if \(taskNumber === 1 && imageUrl\)/);
});
test('hai trang CBT nạp dàn ý; 5/10 phút độc lập và không trộn vào bài chấm', () => {
  for (const slug of ['term-test-1', 'term-test-2']) assert.match(read(slug + '-computer-based/index.html'), /shared\/writing-planning\.css/);
  const bootstrap = read('term-test-2-computer-based/bootstrap.js');
  assert(bootstrap.indexOf("loadScript('../shared/writing-planning.js") < bootstrap.indexOf("loadScript('../shared/app.js"));
  const plan = read('shared/writing-planning.js');
  assert.match(plan, /id === 'task1' \? 5 : 10/);
  assert.match(plan, /Math\.min\(Date\.parse\(plan\.deadlineAt/);
  assert.match(plan, /attemptToken: state\.attemptToken/);
  const app = read('shared/app.js');
  const payload = app.slice(app.indexOf('  function writingPayload('), app.indexOf('  async function saveWritingToServer('));
  assert.doesNotMatch(payload, /outline|writingPlanning/);
  assert.match(app, /writingPlanning: state\.writingPlanning/);
  assert.match(app, /Promise\.race\(/);
});
test('audio phục hồi theo mốc nghe và lỗi mạng không bị báo nhầm thành lỗi autoplay', () => {
  const bootstrap = read('term-test-2-computer-based/bootstrap.js');
  const enhance = read('term-test-2-computer-based/enhance.js');
  assert.match(bootstrap, /heardSeconds:\s*savedHeardSeconds/);
  for (const marker of ['listeningResumeAtSeconds', 'session/audio-progress', "addEventListener('waiting'", "addEventListener('stalled'", 'term-test:listening-timing-updated']) assert(enhance.includes(marker) || bootstrap.includes(marker), marker);
  assert.match(enhance, /await reportAudioProgress\('recovered'\)\.catch\(\(\) => null\)/);
  assert.match(enhance, /AbortSignal\.timeout\(8000\)/);
});
test('phản hồi đầy đủ của cả hai Term Test được giữ nguyên cấu trúc chuyên môn', () => {
  assert.match(read('shared/app.js'), /\['term-test-1', 'term-test-2'\]\.includes\(testConfig\.slug\)/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../progress-log/', import.meta.url);

async function functionSource(file, name, next) {
  const source = await readFile(new URL(file, root), 'utf8');
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(next, start);
  assert.ok(start >= 0 && end > start, `Không tìm thấy ${name} trong ${file}`);
  return source.slice(start, end);
}

test('dashboard chỉ ghi số buổi một lần khi tiêu đề phiếu đã có số buổi', async () => {
  const source = await functionSource('teacher.js', 'assignmentLabel', 'function refreshAssignmentSelect');
  const label = vm.runInNewContext(`${source}\nassignmentLabel`, {});
  const item = { class_name: 'IC2305', session_number: 4, title: 'Buổi 4 - Listening 1 + Speaking 2' };
  assert.equal(label(item), 'IC2305 · Buổi 4 · Listening 1 + Speaking 2');
  assert.equal(label({ ...item, title: 'Listening 1 + Speaking 2' }), 'IC2305 · Buổi 4 · Listening 1 + Speaking 2');
  assert.equal(label({ ...item, title: 'Buổi 40 - Listening 1' }), 'IC2305 · Buổi 4 · Buổi 40 - Listening 1');
  assert.equal(label({ ...item, title: 'Buổi 4' }), 'IC2305 · Buổi 4');
  assert.equal(label({ class_name: 'IC2304', session_number: 2, title: 'Progress Log · IC2304 · Buổi 2' }), 'IC2304 · Buổi 2 · Progress Log');
  assert.equal(label({ class_name: 'IC2304', session_number: 2, title: 'Progress Log · Buổi 20' }), 'IC2304 · Buổi 2 · Progress Log · Buổi 20');
});

test('nhận xét trên hành trình học viên không lặp số buổi', async () => {
  const source = await functionSource('journey.js', 'renderJourney', 'async function start');
  const box = () => ({ textContent: '', hidden: false });
  const elements = Object.fromEntries([
    'journeyStudentName', 'journeyClassName', 'attendedCount', 'submittedCount', 'reportCount',
    'latestSpeakingFeedback', 'latestSpeakingFeedbackScope', 'latestSpeakingFeedbackText',
    'timelineCount', 'reportHistory', 'journeyView'
  ].map(key => [key, box()]));
  elements.sessionList = { replaceChildren() {} };
  elements.reportList = { replaceChildren() {} };
  const render = vm.runInNewContext(`${source}\nrenderJourney`, {
    elements, renderLatestReport() {}, buildSession() { return {}; }, buildReport() { return {}; }
  });
  render({
    student: { name: 'Học viên giả' }, class: { name: 'IC2305' },
    summary: { attendedSessions: 0, submittedComplete: 0, availableReports: 0, totalSessions: 1 },
    latestReport: null, reports: [], sessions: [{
      sessionNumber: 4, title: 'Buổi 4 - Listening 1 + Speaking 2',
      teacherSessionFeedback: { noteText: 'Nhận xét thử', sentAt: '2026-09-24T00:00:00Z' }
    }]
  });
  assert.equal(elements.latestSpeakingFeedbackScope.textContent, 'Buổi 4 · Listening 1 + Speaking 2');
});

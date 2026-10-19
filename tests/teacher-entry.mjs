import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherEntryUrl } from '../shared/teacher-entry.js';
import { resolveTeacherAssignment } from '../progress-log/teacher-entry-context.js';

test('Lối GV giữ bài/lớp, chỉ chuyển entry qua fragment và không chuyển token phiên học viên', () => {
  const token = 'a'.repeat(43);
  const location = { href: `https://example.test/p/reading-practice/?documentId=doc-fixture&class=IC2304#login?entry=${token}&sessionToken=private` };
  const out = new URL(teacherEntryUrl({ product: 'reading', code: 'fixture-code', location, storage: { getItem: () => null } }));
  assert.equal(out.pathname, '/p/reading-practice/teacher-progress.html');
  assert.equal(out.searchParams.get('class'), 'IC2304');
  assert.equal(out.searchParams.get('code'), 'fixture-code');
  assert.equal(out.search.includes(token), false);
  assert.equal(out.hash, '#entry=' + token);
  assert.equal(out.href.includes('sessionToken'), false);
});

test('Thiết bị chặn kho hoặc entry sai vẫn có lối GV, không ghi/xóa nháp', () => {
  const location = { href: 'https://example.test/p/listening-practice/?documentId=fixture#login' };
  const storage = { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Không được ghi'); } };
  const out = new URL(teacherEntryUrl({ product: 'listening', location, storage }));
  assert.equal(out.hash, '');assert.equal(out.searchParams.get('documentId'), 'fixture');
});

test('Handout dùng dashboard hiện có, giữ đúng đề/lớp và không chuyển bí mật học viên', () => {
  const writing = new URL(teacherEntryUrl({product:'writing',teacherPath:'./teacher.html',location:{href:'https://example.test/writing-handouts/lesson.html?task=fixture-task&class=IC2305#session=private'}}));
  assert.equal(writing.pathname,'/writing-handouts/teacher.html');
  assert.equal(writing.searchParams.get('task'),'fixture-task');
  assert.equal(writing.searchParams.get('class'),'IC2305');
  assert.equal(writing.hash,'');assert.equal(writing.href.includes('private'),false);
  const bax = new URL(teacherEntryUrl({product:'handout67',teacherPath:'./teacher.html',context:{class:'IC2304'},location:{href:'https://example.test/writing-handouts/lesson9/'}}));
  assert.equal(bax.pathname,'/writing-handouts/lesson9/teacher.html');
  assert.equal(bax.searchParams.get('class'),'IC2304');
});

test('Progress Log chuyển public token qua fragment và chỉ chọn phiếu sau kiểm quyền', () => {
  const token='20000000-0000-4000-8000-000000000001';
  const href=teacherEntryUrl({product:'progress-log',teacherPath:'./teacher.html',location:{href:`https://example.test/progress-log/#assignment=${token}&attemptToken=private`}});
  const url=new URL(href);assert.equal(url.hash,'#assignment='+token);assert.equal(url.search.includes(token),false);assert.equal(href.includes('private'),false);
  const assignments=[{assignment_id:'older',public_token:token,class_id:'1124'},{assignment_id:'newer',public_token:'another-token',class_id:'1125'}];
  assert.equal(resolveTeacherAssignment(assignments,[{class_id:'1124'}],href).assignment_id,'older');
  assert.throws(()=>resolveTeacherAssignment(assignments,[{class_id:'1125'}],href),/chưa có quyền/);
  assert.throws(()=>resolveTeacherAssignment([],[],href),/không còn/);
  assert.equal(resolveTeacherAssignment(assignments,[],'https://example.test/progress-log/teacher.html'),null);
});

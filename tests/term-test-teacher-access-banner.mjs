/*
 * Dữ liệu nhận vào: metadata quyền của một lớp do backend trả về.
 * Xử lý: kiểm cách chọn lớp từ URL, nhãn trong dropdown và thông báo quyền quản trị.
 * Kết quả: admin biết rõ đang xem lớp nào bằng quyền gì; giảng viên không nhận cảnh báo sai.
 * Khi lỗi: test dừng trước phát hành và nêu đúng hợp đồng giao diện bị vi phạm.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildClassAccessNotice,
  classOptionLabel,
  selectRequestedClass
} from '../term-tests/teacher/model.js';

test('admin không phụ trách lớp nhận thông báo rõ lớp và lý do được xem', () => {
  const notice = buildClassAccessNotice({
    name: 'IC2213',
    accessMode: 'admin_override',
    isAssignedTeacher: false
  });
  assert.deepEqual(notice, {
    title: 'Đang xem bằng quyền quản trị viên',
    message: 'Bạn có quyền xem lớp IC2213 vì là quản trị viên, nhưng không phải giảng viên phụ trách lớp này.'
  });
  assert.equal(classOptionLabel({ name: 'IC2213', accessMode: 'admin_override' }), '🛡 IC2213');
});

test('giảng viên hoặc admin đồng thời phụ trách lớp không nhận cảnh báo sai', () => {
  assert.equal(buildClassAccessNotice({
    name: 'IC2304',
    accessMode: 'assigned_teacher',
    isAssignedTeacher: true
  }), null);
  assert.equal(classOptionLabel({ name: 'IC2304', accessMode: 'assigned_teacher' }), 'IC2304');
});

test('lớp yêu cầu trong URL phải khớp quyền; không âm thầm đổi sang lớp đầu tiên', () => {
  const classes = [
    { id: '2304', name: 'IC2304' },
    { id: '2213', name: 'IC2213' }
  ];
  assert.equal(selectRequestedClass(classes, 'ic2213')?.name, 'IC2213');
  assert.equal(selectRequestedClass(classes, '2213')?.name, 'IC2213');
  assert.equal(selectRequestedClass(classes, 'IC9999'), null);
  assert.equal(selectRequestedClass(classes, '')?.name, 'IC2304');
});

test('metadata lỗi hoặc thiếu tên lớp không làm giao diện tạo thông báo sai', () => {
  assert.equal(buildClassAccessNotice(null), null);
  assert.equal(buildClassAccessNotice({ name: '', accessMode: 'admin_override' }), null);
  assert.equal(buildClassAccessNotice({ name: '<img src=x>', accessMode: 'assigned_teacher' }), null);
  assert.equal(classOptionLabel({ name: '<img src=x>', accessMode: 'admin_override' }), '🛡 <img src=x>');
});

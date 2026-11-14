const scenes = [
  ['Mở lớp và đúng buổi', '35 giây', 'Giảng viên tìm lớp, chọn buổi và nhìn thấy toàn bộ các phần trong phiếu.'],
  ['Mở hoạt động', '30 giây', 'Tôi mở phần Listening khi muốn lớp làm. Phần Speaking vẫn chờ, nên lớp làm theo nhịp của buổi học.'],
  ['Học viên vào phiếu', '30 giây', 'Đây là màn của Hoàng Anh. Em thấy đúng lớp, buổi và phần Listening vừa được mở.'],
  ['Ghi lại việc học', '50 giây', 'Em chọn Friday và viết vì sao mình nhầm. Giảng viên có cả đáp án lẫn lời giải thích của em.'],
  ['Nộp một phần', '35 giây', 'Hệ thống đã nhận phần Listening và ghi nhận tham gia. Speaking vẫn chưa mở ở thời điểm này.'],
  ['Theo dõi tiến độ lớp', '35 giây', 'Giảng viên thấy ngay Hoàng Anh đã nộp phần 1, chưa bắt đầu phần 2 và Progress Log đã nhận bài.'],
  ['Xác định câu cần chữa', '45 giây', 'Chuyển đến cuối buổi, sau khi lớp đã làm cả Speaking. Có 5 trên 8 học viên trả lời sai câu này. Đây là chỗ đáng dừng lại để chữa.'],
  ['Đọc câu trả lời từng người', '40 giây', 'Mở danh sách và lọc nhóm sai. Hoàng Anh đã chọn Friday, tức ngày ban đầu.'],
  ['Gửi lời nhận xét', '45 giây', 'Đọc lại lời em viết rồi gửi một việc cụ thể để em luyện ở lần tới.'],
  ['Học viên nhận phản hồi', '40 giây', 'Hoàng Anh đọc đúng lời giảng viên vừa gửi và có thể mở lại buổi 7 để đọc đầy đủ.'],
  ['Nhìn lại qua nhiều buổi', '45 giây', 'Hành trình giữ tổng quan kỹ năng và từng bài. Mở thử buổi 6 để xem lại câu trả lời cũ.'],
  ['Chốt hành trình học', '20 giây', 'Giảng viên biết cần giúp ở đâu. Học viên có bài đã làm và lời hướng dẫn để quay lại. Tiếp theo là cách giảng viên chuẩn bị các bài tập.'],
  ['Soạn một câu trắc nghiệm', '55 giây', 'Về vai giảng viên và vào Kho cá nhân. Chọn Trắc nghiệm, điền câu hỏi và các lựa chọn, đánh dấu đáp án đúng rồi lưu nháp.'],
  ['Nhập thêm câu hỏi bằng AI', '45 giây', 'Dùng câu hỏi và đáp án đã có. AI chuyển nội dung thành câu trắc nghiệm trong bộ soạn để giảng viên xem lại.'],
];

const list = document.getElementById('scenes');
const position = document.getElementById('position');
let starts = [];
for (const [index, [title, time, words]] of scenes.entries()) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.textContent = title + ' · ' + time;
  button.disabled = true;
  button.addEventListener('click', () => {
    if (Number.isInteger(starts[index])) {
      opener?.postMessage({ type: 'progress-log-jump', step: starts[index] }, location.origin);
    }
  });
  const note = document.createElement('p');
  note.textContent = words;
  item.append(button, note);
  list.append(item);
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== opener || event.data?.type !== 'progress-log-position') return;
  const { step, total, sceneStarts, label, error } = event.data;
  if (sceneStarts?.length !== scenes.length) return;
  starts = sceneStarts;
  const index = starts.findLastIndex(start => step > start);
  for (const [i, item] of [...list.children].entries()) {
    item.firstChild.disabled = false;
    item.firstChild.setAttribute('aria-current', String(i === Math.max(0, index)));
  }
  position.textContent = error || 'Nhịp ' + step + '/' + total + (label ? ' · ' + label : '');
});
opener?.postMessage({ type: 'progress-log-position-request' }, location.origin);

# Demo hành trình học viên Writing Task 2 khóa 7+

Mở `index.html` hoặc URL GitHub Pages của thư mục. Người xem dùng **Next/Previous**, hai phím mũi tên, thanh chọn chặng hoặc danh sách bước để xem từ đầu buổi học đến lúc nộp homework và nhận điểm.

Demo dùng bài làm, lời thoại, thời gian và điểm giả định. Các nút trong màn học viên chuyển tới màn tiếp theo của kịch bản; không lưu bài, gọi AI, nộp lên hệ thống thật hoặc dùng dữ liệu học viên thật. URL có `#buoc=N` để chia sẻ một bước và tải lại đúng bước đó.

## Nội dung

- Dàn ý toàn bài trên lớp, chốt B rồi A và X, bài chứng minh dùng khi cần.
- Giảng viên can thiệp theo độ quen thuộc và tốc độ của từng người; lớp tám người tiếp tục tự làm với hỗ trợ AI.
- Bài huy động từ vựng và một thân bài hoàn chỉnh trên lớp.
- Brainstorm sáu topic ở nhà, phản hồi ý trùng và câu hỏi trợ giúp khi bí.
- Viết full, nộp bài, trạng thái chờ, điểm và bốn tiêu chí; theo dõi tiến bộ, TR/CC và chữa từng câu.
- Tự sửa, nộp bản chỉnh và giữ riêng điều kiện làm bài khi dự báo năng lực thi.

## Cách hoạt động

`app.js` nhận số bước từ URL, lấy dữ liệu minh họa của bước tương ứng rồi hiển thị màn học viên cùng vai trò ba bên. Next/Previous đổi số bước và cập nhật URL. Khi URL không hợp lệ, demo về bước đầu. `style.css` sắp màn theo chiều rộng thiết bị, giữ nút điều hướng ở cuối màn hình. Không có phần máy chủ hoặc kết nối tới hệ thống chấm bài.

## Kiểm trước phát hành

Chạy file kiểm trình duyệt `tests/mvp-writing7-demo.mjs` với Playwright có sẵn. Bộ kiểm đi toàn hành trình, quay lại, tải lại/deep link, các nút trong màn, các câu feedback, màn 390 px và lỗi console/network. Kết quả QA riêng của task được giữ ngoài repo.

Quay lui: revert commit thêm riêng thư mục demo và file kiểm của task; không thay các route Writing, Term Test hoặc Progress Log hiện có.

# Giao diện chung Writing 67

Lesson 5 và Lesson 7 dùng cùng hai mẫu HTML, cùng bộ điều khiển và nguyên bộ CSS của Lesson 5. `loader.mjs` đọc mã lesson từ route rồi lấy định nghĩa công khai ở API Handout67. Nó điền đề/nhãn bằng text, sau đó nạp app học viên hoặc giảng viên.

Đề, rubric và lớp được đăng ký ở file riêng tư của backend, không đặt bản thứ hai trong frontend. Trang mới chỉ cần entrypoint mỏng với `data-activity="lessonN"`, `data-view="student"` hoặc `teacher` và cùng tài nguyên. Giữ CSP; phần `connect-src 'self'` cần cho việc tải mẫu chung.

Màu, font, layout, mở bước, Edit, góp ý và responsive kế thừa Lesson 5. Đề dài có thể làm vùng nội dung cao hơn. Không fork HTML trang đầy đủ, JS/CSS hay workflow theo lesson.

## Giao diện Reading xám sáng–đỏ

Từ 17/10/2026, bốn route HV/GV Lesson 5/7 bật `data-handout-theme="reading"`, cùng nạp `reading-theme.css` và font Nunito Sans tự lưu trong `speaking-homework/fonts/`. Màn GV nạp thêm `reading-teacher.css`. Mỗi selector của theme giới hạn theo thuộc tính này; các demo/lesson khác không tự đổi màu khi dùng lại app.

Nền trang xám sáng, thẻ trắng, nút navy; logo góc trái là chữ IZONE đỏ theo Term Test K67. Màu trạng thái lấy từ dữ liệu/DOM hiện có: đỏ dịu cho cần sửa/lỗi/cần hỗ trợ, xanh lá cho đã thông qua, navy nhạt cho đang làm/chờ chấm, xám cho chưa làm/chưa mở. Ô có chữ không tự được tính đạt; trạng thái trao đổi đã xử lý không đổi kết quả chấm.

Theme không thay `client.mjs`, điều kiện mở bước, API, rubric hoặc quyền. Các stylesheet do `features.mjs` nạp muộn vẫn giữ nguyên; selector của theme có phạm vi đủ rõ để màu hiển thị nhất quán sau khi mở bài, Edit và trao đổi. Khi thay mẫu HTML hoặc lời hướng dẫn dùng chung, tăng phiên bản loader và tài nguyên bị tác động để tránh cache cũ.

Khi kiểm thay đổi theme, chạy bộ test Handout67 tại `lesson5-demo`, `lesson5-thu`, `lesson5`, rồi kiểm trình duyệt trên cả hai lesson với CSP nguyên vẹn. Các ca quan trọng gồm lưu/reload/đổi người, B–A–X và mở ý 2, Edit, lịch sử, góp ý/trả lời, lỗi lưu/xung đột, trạng thái chờ/lỗi/đạt và bảng cuộn bên trong khung ở mobile. Quay lui riêng commit giao diện; giữ bài làm và database.

Phải chuyển API/registry tương thích trước khi phát hành trang. Nếu cấu hình chưa có hoặc mạng lỗi, loader hiện lời tải lại và không mở nhầm Lesson 5. Bài làm đã ghi vẫn nằm ở backend.

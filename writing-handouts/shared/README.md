# Giao diện chung Writing 67

Lesson 5 và Lesson 7 dùng cùng hai mẫu HTML, cùng bộ điều khiển và nguyên bộ CSS của Lesson 5. `loader.mjs` đọc mã lesson từ route rồi lấy định nghĩa công khai ở API Handout67. Nó điền đề/nhãn bằng text, sau đó nạp app học viên hoặc giảng viên.

Đề, rubric và lớp được đăng ký ở file riêng tư của backend, không đặt bản thứ hai trong frontend. Trang mới chỉ cần entrypoint mỏng với `data-activity="lessonN"`, `data-view="student"` hoặc `teacher` và cùng tài nguyên. Giữ CSP; phần `connect-src 'self'` cần cho việc tải mẫu chung.

Màu, font, layout, mở bước, Edit, góp ý và responsive kế thừa Lesson 5. Đề dài có thể làm vùng nội dung cao hơn. Không fork HTML trang đầy đủ, JS/CSS hay workflow theo lesson.

Phải chuyển API/registry tương thích trước khi phát hành trang. Nếu cấu hình chưa có hoặc mạng lỗi, loader hiện lời tải lại và không mở nhầm Lesson 5. Bài làm đã ghi vẫn nằm ở backend.

# Master170 — demo từng dạng

Mở index.html qua HTTP. Danh sách và mã tiêu chí trong manifest.json. Các demo dùng renderer/styles hiện hành, dữ liệu giả; không đăng ký lesson hoặc gọi API bài làm. Reading Homework prototype chỉ nhận hai phản hồi giả và từ chối fetch khác; Listening Homework dùng preview hiện có, góp ý mô phỏng. Không dùng các demo làm bằng chứng SSO/AI/Docs hoặc tiêu chí184đều đạt.

## Bản sửa R2 — 29/10/2026, chờ Đức duyệt

- Dùng cách phân câu T/F/NG: bỏ viền trái/phải và góc bo của khung câu, giữ đường kẻ mảnh giữa câu. Giữ viền của từng lựa chọn để thao tác chọn rõ ràng.
- Matching giữ hai khung: câu hỏi và bank. Bank có đệm 16px; chuyển xuống dưới khi pane không đủ rộng. Không dựa riêng vào chiều rộng cửa sổ.
- Bài đọc, tiêu đề, nội dung câu hỏi có đệm 16–24px. Summary có word bank cũng bỏ khung câu thừa nhưng giữ bank.
- Mỗi dạng thực chiến có ít nhất hai số câu. Hai demo chọn hai đáp án có hai stem, tổng bốn số câu, để thấy đường phân cách.
- Reading Table dùng cùng renderer/cấu trúc ô và cách hiển thị của Listening Table được Đức chọn. Tên dạng hiển thị rõ Reading/Listening.
- `review.css` chỉ áp dụng trong gallery; không được nhập vào bài học viên trước khi Đức duyệt. R1 DOCX và ảnh cũ là snapshot lịch sử, không phải bằng chứng R2 đã được duyệt.

Kiểm: `node --test tests/master170-reference.test.mjs`; probe hình học chỉ đọc tại `tests/fixtures/master170-demo-layout-probe.mjs`. Phải kiểm bank bằng vùng chữ bên trong và kích thước pane, không chỉ kiểm tràn toàn trang. Không dùng gallery để chứng minh chấm AI, lưu nháp, SSO hay Homework Docs.

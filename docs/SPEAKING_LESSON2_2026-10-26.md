# Homework Speaking Lesson 2 — bản chỉnh ngày 26/10/2026

Nội dung: Paraphrase ít nhất 5 câu hỏi; Freestyle 2 câu có trả lời, góp ý và trả lời lại. Hai hội thoại riêng, không có bài bổ trợ bắt buộc. Theo lựa chọn của Đức, ẩn cả Bác sĩ AI và luyện thêm trên trang Lesson 2, trước/sau nộp và khi tải lại. Dữ liệu cá nhân đã lưu trên máy chủ được giữ.

Trang tiếp tục là `speaking-homework/index.html`, mã `67-speaking-paraphrase`, dùng bộ nhận diện, xác nhận, tiến độ Docs, tự nộp và đăng nhập giảng viên chung hiện hành. Không tạo lesson/backend/assignment mới hoặc chấm lại bài cũ.

## Phạm vi mã và kiểm chứng

- `index.html`: hướng dẫn 2 câu, ẩn mục Doctor và đổi phiên bản bộ nạp.
- `lesson-2-live.js`: hướng dẫn đúng 2 câu; không tải danh sách Doctor hoặc hiện luyện thêm.
- `presentation.js`: không tạo liên kết điều hướng tới mục đã ẩn; đổi phiên bản riêng engine Lesson 2.
- Các test Lesson 2 và Doctor cập nhật theo yêu cầu mới; journey kiểm thêm Lesson 3–4 để bảo toàn consumer dùng chung.

Đã kiểm cục bộ với API giả: journey Lesson 2–4 tại 390/768/1440px (9 ca), Lesson 2 legacy desktop/mobile, 17 ca tự nộp/mất phản hồi, 16 ca Doctor hiện/ẩn theo trạng thái cũ. Cùng regression Lesson 2 thất bại trên base vì hiển thị 3 câu và đạt trên bản sửa. Bốn ca HTTP/chính sách/parser đạt. Đã mở xem ảnh Lesson 2 desktop/mobile: font Source Sans 3, hai phần, không có bổ trợ và không tràn ngang.

Đây không phải bằng chứng học viên thật hoàn tất checker AI, Docs hoặc Classroom. Không thử nộp thay học viên; không sửa phiên giảng viên/worker/API. Trạng thái phát hành cần cập nhật theo đọc lại public sau khi được phép push/merge.

## Cấu hình và quay lại

Ngưỡng máy chủ nằm trong database, cần cùng gói migration `202610260806_speaking_lesson2_two_freestyle.sql` của repo mapping-database. Chỉ sửa template và part `speaking` của mã Lesson 2; giữ Paraphrase 5, bổ trợ 0 và bài/receipt cũ. Cấu hình khác dự kiến hoặc snapshot web đang mở với ngưỡng cũ sẽ dừng để đối chiếu.

Quay giao diện bằng revert đúng gói Pages. Quay ngưỡng bằng migration bù có kiểm scope và backup cấu hình, không restore bài làm/receipt hoặc chạy lại migration lịch sử. Nâng ngưỡng trở lại không tự vô hiệu hóa bài đã được công nhận.

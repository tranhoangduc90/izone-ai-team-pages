# Nộp bài bổ trợ IC2314

Trang nhận link chia sẻ ChatGPT và gửi đúng ba trường của form Bác sĩ AI dùng Lark: lớp, họ tên, bài luyện tập. Không nhúng hoặc tải danh sách học viên công khai.

- Link chung: `bo-tro/?class=IC2314`.
- Link cá nhân thêm `#student=<tên đã mã hóa URL>`. Trang điền sẵn tên rồi xóa phần này khỏi thanh địa chỉ.
- Học viên xem bài được đề xuất và kết quả trong bảng luyện tập cá nhân do giáo viên gửi.
- Phản hồi nhận yêu cầu chưa chứng minh AI xử lý xong. Khi mất phản hồi, trang giữ link để người dùng kiểm tra bảng trước khi gửi lại.

Kiểm hợp đồng gửi bài bằng `node --test tests/bo-tro-contract.mjs`. Kiểm trên trình duyệt cần chặn request tới webhook để không tạo bài giả trong Lark thật.

Trang hiện chỉ hỗ trợ IC2314. Các lớp khác cần được tạo bảng, bộ lọc, phân loại khóa và kiểm lại trước khi mở.

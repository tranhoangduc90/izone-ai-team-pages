# Progress Log — Thẻ 22–23

Trạng thái: đã xây và kiểm trong môi trường thử; chưa phát hành production.

## Hành vi mới

- Kho cá nhân: Sửa bài mở bản hiện hành của cùng phiếu. Lưu và xuất bản lại không sinh thêm dòng; những lần giao trước giữ phiên bản đã giao.
- Phiếu đã giao: Nguồn phản ánh Kho chung/Kho cá nhân của lần giao. Ẩn Lịch sử thu hồi tại màn này và chi tiết kho; dữ liệu thu hồi được giữ.
- Bộ soạn: bỏ khối Lớp, buổi và nguồn sao chép cùng dòng trạng thái nháp trùng. Thanh tiêu đề tiếp tục thể hiện trạng thái lưu.
- Xuất bản: chỉ rõ các ô còn thiếu bằng thông báo đỏ “Cần bổ sung thông tin này”, giữ nội dung đang soạn và đưa con trỏ tới lỗi đầu.
- AI: đổi nhãn thành “Tạo bài tập bằng AI”, cập nhật hướng dẫn và ví dụ ba câu trong placeholder. Ô nhập vẫn rỗng; giữ tuyến mô hình, nhận dạng dạng câu, cảnh báo thiếu key và cơ chế thử lại hiện hành.
- Hành trình lớp: bỏ thông tin nguồn/thời điểm đọc thông thường, số hồ sơ lịch sử ở đầu trang, cụm “phiếu có phản hồi” và Đối chiếu nhãn gốc. Cảnh báo dữ liệu/lịch chưa đọc đủ vẫn hiển thị.
- Speaking: Học viên → Nhận xét của giảng viên → Tự nhận xét của học viên. Hiện đầy đủ mọi nhận xét đã công bố theo buổi mới trước, mỗi lỗi tự nhận xét một dòng, số lần giảm dần.
- Bấm tên mở khung hai nửa cùng bố cục Kết quả/Nhận xét cá nhân; màn hẹp chuyển một cột. Có trước/sau theo danh sách lọc hiện hành.
- Chi tiết dùng bốn kỹ năng và quy tắc Test của màn học viên Thẻ 20. Điểm Task Writing mở kết quả chỉ đọc bằng phiên giảng viên, được API kiểm lại đúng lớp/người/bản.

## Kiểm chứng

- Chrome: màn giảng viên thật với API fixture cách ly; bảng Speaking đầy đủ, chia đôi, màn 390 px, liên kết Writing, đổi người, đóng/mở và ba lần làm mới giữ DOM/vị trí đọc.
- Chrome + API thật + hai kho PGlite cách ly: soạn → xuất bản → xem thử → giao hai lớp giả → sửa/lưu/xuất bản lại; còn một phiếu trong kho, hai lần giao giữ form version cũ, không phát sinh bài nộp hoặc công việc Portal ở kho nguồn.
- Hồi quy học viên Thẻ 20: chọn/nhớ/đổi người, Journey chung/riêng, Test L/R mới nhất riêng, Writing chỉ đọc và cập nhật nền.
- Khôi phục đăng nhập giảng viên: còn phiên, thiếu/hết phiên, 403, lỗi dịch vụ/thử lại. Fixture cập nhật để mô tả endpoint danh sách bản xuất bản đã có.
- API và PostgreSQL nhiều kết nối được kiểm riêng trong repository backend; không giao bài cho lớp thật.

Giới hạn kiểm: `demo/build-pages.mjs --check` báo HTML xem thử chưa đồng bộ cả ở base `7f7f746` và bản mới. Đây là chênh lệch đã có giữa bộ sinh và HTML xem thử đang dùng; gói này giữ HTML/bố cục xem thử hiện hành, chỉ cập nhật cache. Luồng xem thử thực tế đã qua test Chrome + API cách ly ở trên.

## Phát hành

API tương thích và migration phải lên trước giao diện. Cache được cập nhật xuyên HTML → loader → import, gồm trang xem thử và Writing result. Backend của kho xem thử hiện hành được giữ; không cần thay runtime demo cho gói thay đổi màn giảng viên này.

Chỉ đánh dấu production sau khi đọc lại asset thật, Chrome thật và dữ liệu/phiên bản cũ. Kiểm môi trường giả không thay bằng chứng Portal thật.

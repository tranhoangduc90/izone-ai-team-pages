# Progress Log — Thẻ 24

Trạng thái: đã triển khai trên nhánh riêng và kiểm môi trường cách ly; chưa tích hợp main hoặc phát hành production.

Nguồn: [Thẻ 24 và các ảnh mẫu](https://docs.google.com/document/d/1EsEOC6CP6Cl9EOLIXmOwaJIy7ckEbBnWJjEsg5tQwPw/edit?tab=t.l1kl33rj3faj). Ba quyết định đã chốt: chọn buổi theo ngày Việt Nam từ hôm nay; giữ nhận xét đã gửi cho đến khi gửi lại; nháp theo tài khoản mở được trên thiết bị khác.

## Hành vi

- Sau chọn lớp/tên, vào tổng quan với H1 **Progress log**, tên và lớp. Bỏ tab Buổi học và số liệu phụ được chỉ định; đường dẫn phiếu vẫn giữ lối quay về.
- **Buổi học sắp tới** lấy ngày gần nhất từ lịch đã xác nhận, kể cả buổi chưa giao phiếu. Không thay bằng bài cũ chưa xong. Không có lịch, hết lịch, chưa mở, đã khóa và đã nộp có trạng thái riêng; máy chủ quyết định quyền làm. Chỉ thao tác chủ động mới bắt đầu phiếu.
- Danh sách buổi tăng dần trong lưới: 6 cột ở 1860 px, 4 ở 1440, 2 ở 768, 1 ở 390. Giữ thẻ trắng, vạch navy cho buổi sắp tới, màu kèm chữ trạng thái theo ảnh mẫu.
- L/R chỉ bỏ khóa/ngày trên dòng nguồn của Dạng cần cải thiện. Quy tắc Test mới nhất riêng từng kỹ năng, điểm 0 và Task Writing chỉ đọc giữ nguyên. Đổi Đọc đủ thành **Xem thêm**.
- Giảng viên xem bốn thẻ kỹ năng cùng renderer và kiểu chữ với học viên, giữ panel hai nửa. Writing bỏ riêng cột Mini Test, sắp xếp/lọc Term 1–2 theo định danh cũ. L/R vẫn có Mini.
- Bỏ đúng cảnh báo lịch cần đối chiếu được yêu cầu và hai dòng phụ BẢN LƯU GẦN NHẤT/Đã nộp lúc ở Kết quả. Lỗi tải, quyền và trạng thái bài thật vẫn giữ.
- **Lưu nháp** chỉ lưu cho tài khoản đang soạn. **Gửi cho học viên** có thể dùng ngay, công bố nguyên tử và dọn đúng nháp của người gửi. Menu **⋮ / Lựa chọn khác** có Chỉnh sửa, Xóa; Xóa cần xác nhận, giữ audit và nháp của người khác.
- Xung đột giữ chữ, yêu cầu đọc bản hiện hành trước khi thử lại. Thử lại thao tác mất phản hồi dùng cùng operation ID; replay cũ đọc lại trạng thái mới. Đổi người/đóng panel không nhận response sang người khác.
- Cập nhật nền giữ DOM, vùng đọc và bôi chọn khi dữ liệu không đổi. Chuyển lựa chọn từ cổng trong cùng tab có hạn hai phút, đúng lớp/người và bị vô hiệu sau đăng xuất; bỏ tick ghi nhớ vẫn xem được trong lượt hiện tại.

## Kiểm chứng

- Chrome 156 thật, API nhận xét/router/service/SQL thật trong fixture riêng: hai thiết bị, nháp/sửa/gửi thẳng, 409, 503, mất phản hồi sau commit, replay sau cập nhật khác, chuyển người khi gửi chậm, hủy/xác nhận Xóa và audit. Không tạo attempt, submission, attendance event hoặc outbox job ở fixture nhận xét.
- Ba nhịp 30 giây thật phía học viên và ba nhịp 8 giây thật phía giảng viên; không tăng tốc timer, không tắt polling. Giữ node, focus/bôi chọn và vị trí đọc. Ảnh desktop/mobile đã xem và đối chiếu ảnh nguồn.
- Hồi quy Thẻ 20/22–23, Writing chỉ đọc, nộp phần độc lập, chữa phần cuối, lưu/đăng xuất/khôi phục, lỗi JSON/SSE và lớp ngoài thí điểm. Các fixture cũ được bổ sung endpoint đọc nháp và cập nhật theo luồng đã duyệt.
- Backend có kiểm riêng PostgreSQL 16 nhiều kết nối bằng quyền learning_api; gồm hai người lưu/gửi, 20 retry và rollback. Toàn bộ nhóm learning/auth được chạy; những ca gián đoạn do backlog SSH/cấp role fixture được chạy lại, giữ cả log lỗi và log bổ sung. Không coi kiểm fixture là Portal thật đã được xác minh.

Bộ sinh HTML demo có chênh lệch đã biết từ trước Thẻ 24. Giữ HTML xem thử hiện hành, chỉ sửa đúng markup Thẻ 24 và chuỗi cache HTML → boot → app/import; không tái tạo toàn bộ demo để che chênh lệch này. Luồng demo được kiểm qua Chrome cách ly.

## Phát hành

API/migration tương thích lên trước Pages. API chỉ thêm hai bảng nháp/audit và bốn endpoint, giữ endpoint gửi/ẩn cũ. Bản chạy có overlay của các việc khác: áp patch đúng hai module nhận xét/routes lên image hiện hành, kiểm chỉ hai hash source đổi, giữ cấu hình/mount/network và đăng nhập chung 90/365 ngày. Student/demo tiếp tục dùng hợp đồng Journey hiện có, không cần thay runtime demo cho gói này.

Trước phát hành: sao lưu, kiểm danh mục backup, snapshot các hàng cũ; sau phát hành đọc lại hash asset, Chrome thật ở chế độ chỉ đọc, trạng thái API và dữ liệu cũ. Không giao/nộp/chấm lớp thật. Quay lui runtime/Pages khi cần; giữ bảng nháp/audit và dữ liệu hợp lệ mới, không restore dump cũ hoặc drop bảng để quay code. Quyền push không thay quyền tích hợp main và production; chờ duyệt đúng gói phát hành.

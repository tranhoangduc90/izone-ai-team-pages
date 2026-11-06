# Substitute Test 1 Reading · thi lại IC2311

Trang học viên: `./` · Trang giảng viên: `teacher.html`.

Chỉ IC2311, 26 câu, 40 phút. Điểm thi lại thay **Term Test 1 Reading /26**. Giao diện hai passage, hai vùng cuộn, màu/font, 26 nút câu hỏi, cờ, cỡ chữ và Highlight/Note được giữ từ Substitute gốc. Các bổ sung là chuẩn bị offline, đồng hồ, trạng thái lưu/đồng bộ và biên nhận.

Học viên chọn đúng tên → xác nhận → chờ tải/kiểm đủ tài nguyên → Bắt đầu Reading. Khi đã Sẵn sàng, có thể bắt đầu và làm hết bài khi mất mạng. Đáp án/ghi chú lưu trên thiết bị. Tải lại hoặc mở lại cùng trình duyệt giữ đáp án và thời gian còn lại; 40 phút vẫn trôi khi đóng trang.

Nộp khi mất mạng sẽ khóa bài và báo **chờ đồng bộ**, chưa báo nộp thành công. Khi kết nối lại, giữ/mở lại trang để hệ thống gửi và nhận biên nhận. Không xóa dữ liệu trình duyệt trước xác nhận. Trang đã đóng không thể tự gửi nền. Nếu máy chủ chưa xử lý hoặc timeout, hàng chờ giữ nguyên; không phải làm lại bài.

Nếu chưa tải đủ đề, tài nguyên sai hash hoặc cả hai kho không ghi được, nút bắt đầu không mở. Lỗi giờ hệ thống hoặc lượt/owner thay đổi giữ bài và yêu cầu giảng viên đối soát, không tự reset 40 phút hoặc ghi đè lượt khác.

Nội dung/điều khiển lấy từ `substitute-test-1-k56-computer-based` và cấu hình Substitute Test 1 K56; grading và key chỉ ở backend. `vendor/` ghim đúng tài nguyên gốc, không nạp controller Listening/Writing hay API cũ. Manifest SHA-256 được tạo từ byte LF trùng blob Git; phải tạo lại khi đổi asset. Service worker chỉ kiểm soát thư mục này và giữ build hiện tại trong lượt đang thi.

Backend và hướng dẫn log/Portal/quay lui: `services/reading-retake/README.md` trong repository điều phối. Danh sách 18 học viên và cấu hình kết nối không lưu ở repository Pages.

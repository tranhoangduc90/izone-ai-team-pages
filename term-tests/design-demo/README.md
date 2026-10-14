# Hai bản demo Term Test 2 IC2200

- `/term-tests/design-demo/`: bản sạch. Luôn mở/reload từ phòng chờ Listening, khóa đủ 19 token preset Reading · xám sáng–đỏ, không panel/nút Điều hướng demo hoặc Màu giao diện. Không đọc màu/query đã lưu; bản thử đi tiếp bằng nút nghiệp vụ Listening → Reading → Writing → kết quả.
- `/term-tests/design-lab/`: bản thử đầy đủ. Giữ chọn phiên bản đề trống/bài thật đã chấm, người học/màn, thu/mở điều hướng, bảng màu, mọi preset và tự cuộn/highlight vùng chỉnh.

Cả hai dùng cùng host/iframe/renderer, audio và API demo công khai cố định Term Test 2 IC2200. `real.html` là alias ở mỗi route. Không fork trang thi thật, đổi API/database, tạo lượt thi hoặc ghi điểm học viên. Bài thử ở RAM; bài thật ở lab chỉ đọc; Writing thử không gửi chấm AI.

`theme.js` là nguồn chung của preset và 19 token; `theme.css` áp dụng chúng trên mọi màn, kể cả nhận xét. Bản sạch không nạp `real-controls.js`, `color-lab.js/css` hoặc `color-locator.js`. Lab chỉ có entry HTML riêng, nạp cùng asset qua đường tương đối. Theme độc lập với giao diện thử màu.

Từ 14/10/2026, chỉ bản sạch nạp `clean-audio.js/css`: đồng hồ 8 px và thanh âm lượng cạnh tiêu đề Listening. Từ bản sửa cùng ngày, audio tự phát từ click Bắt đầu ở phòng chờ, chạy liên tục, không có nút phát/tạm dừng/nghe lại. Audio giữ vị trí khi đổi Part; lab giữ nguyên player native ở hàng riêng.

Giữ test adapter/lobby, kiểm hai route, theme không bị query/Storage tác động, hành trình nghiệp vụ và đọc lại sau Pages build. Quay lui bằng revert commit frontend; không có deploy backend trong gói này.

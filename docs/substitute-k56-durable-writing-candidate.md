# Ứng viên mở lại Writing Substitute 2 khóa 56

Ngày kiểm: 24/09/2026. Đây là thay đổi trên branch, **chưa phát hành**. Cờ `DURABLE_WRITING_ENABLED` không có trong cấu hình trang đang phục vụ nên mặc định tắt; giao diện và đường API cũ không đổi.

Khi bật có kiểm soát, trang gửi Writing tới cổng mới, chỉ báo đã nhận sau khi backend lưu phiếu. Học viên chọn lại tên có thể đọc lại bài Writing, Listening, Reading và kết quả từ phiếu đã lưu, kể cả trên thiết bị khác. Nếu thiếu một phần, trang không tự điền điểm 0; bài cần kiểm tra thì dừng hỏi lại và báo giáo viên. Đổi tên trên cùng thiết bị xóa dữ liệu người trước khỏi trạng thái giao diện trước khi tải người sau.

Các vùng lưu trên trình duyệt của bài, bố cục và ghi chú được tách bằng hậu tố `:durable-writing`; bản cũ không bị ghi đè. Cờ bật mà thiếu `DURABLE_WRITING_API_BASE_URL` hợp lệ sẽ báo lỗi và **không quay về cổng cũ**. Cổng mới hiện chỉ thiết kế thử cho IC2264; DEMO vẫn theo nhánh cũ. Cổng public và bộ chấm chưa được triển khai, nên không bật cờ cho học viên.

Kiểm thử: `node --test tests/substitute-k56-durable-writing.test.mjs` và nhóm `tests/substitute*.mjs`. Ca mới kiểm khôi phục đúng ba phần, thiếu phiếu/dữ liệu, không hiện 0, đổi tên không lộ kết quả cũ và cách ly vùng lưu. Trước phát hành cần thử trình duyệt thật trên link ứng viên, nộp bài giả đầu-cuối, kiểm Portal đúng lớp/cột, kiểm rollback và quan sát sau chuyển tuyến. Chọn tên không xác thực con người; người biết tên và lớp có thể xem bài theo chính sách đã được Đức chọn.

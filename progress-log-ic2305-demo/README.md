# Demo Progress Log IC2305 · buổi 2

Đây là bản mô phỏng độc lập của hai giao diện đang dùng: [học viên](./index.html) và [giảng viên](./teacher.html). Giao diện dùng cùng CSS với webapp hiện hành để người xem nhận ra thao tác quen thuộc. Trang demo không gọi API, không đăng nhập, không ghi database hay Portal. Tên và câu trả lời đều là dữ liệu ẩn danh được viết riêng cho demo, không phải bài làm thật.

## Dữ liệu khởi đầu

- 18 học viên minh họa: 15 đã nộp đủ, 1 đang nhập và 2 chưa bắt đầu.
- Sáu câu hỏi của **ENTRANCE TICKET • WRITING 1**, chia thành ba phần đúng cấu trúc buổi 2.
- 15 bài nộp mẫu có câu trả lời đầy đủ. Câu 3 đúng 15/15 và câu 5 đúng 10/15 để minh họa cách xem kết quả trắc nghiệm; đây là **dữ liệu mô phỏng**, không phải bản sao bài của học viên thật.
- Nhận định cấp lớp chưa được phát hành. Dashboard giữ trạng thái “chưa có đủ dữ liệu phân tích được phát hành”, không bịa báo cáo AI.

## Trải nghiệm trong 5 phút

1. Mở giao diện giảng viên. Quan sát 15 đã nộp đủ, 3 chưa nộp; bấm **Xem bài nộp** của học viên 01, xem câu trả lời và dấu đúng/chưa đúng của câu trắc nghiệm.
2. Bấm **Xem đang gõ** của học viên 16, rồi mở phiếu học viên trong tab khác. Chọn học viên 16 để tiếp tục phần 1 đã điền dở, hoặc học viên 17 để làm từ đầu.
3. Nhập câu trả lời; dashboard cập nhật sau khi bản demo lưu. Bấm **Nộp phần và tiếp tục** qua ba phần, rồi **Nộp phiếu & điểm danh**. Dashboard chuyển từ 15 sang 16 bài nộp đủ.
4. Ở dashboard, đổi **Phần 2** thành “Chưa mở” để thử việc học viên phải chờ giảng viên; mở lại để đi tiếp. Thử **Điều chỉnh** điểm danh, nhập lý do và lưu. Portal thật không thay đổi.
5. Bấm **Đặt lại dữ liệu demo ban đầu** để quay về 15/0/3 và diễn lại từ đầu.

Hai tab trên **cùng trình duyệt/cùng thiết bị** dùng chung dữ liệu demo qua `localStorage`; mỗi người mở ở thiết bị khác sẽ có một bản dữ liệu độc lập. Điều này khác môi trường production, nơi database giúp nhiều thiết bị thấy cùng lớp. Bộ nhớ demo có khóa riêng, không trùng bộ nhớ chọn tên hay bài nháp của webapp thật.

Tab **Tạo phiếu** trong demo chỉ cho xem sáu câu đã phát hành và mở bản xem trước. Tạo phiếu mới, xác thực Google, đồng bộ Portal, chấm/AI thật và báo cáo định kỳ không được mô phỏng như thao tác thành công. Các chức năng đó vẫn thuộc webapp production.

## Kiểm tra local

Chạy máy chủ tĩnh tại thư mục gốc repo, rồi mở `/progress-log-ic2305-demo/` và `/progress-log-ic2305-demo/teacher.html`. Không mở file HTML bằng `file://` nếu muốn kiểm hai tab cùng chia sẻ dữ liệu. Chạy `node --test tests/progress-log-ic2305-demo.mjs` để kiểm cấu trúc dữ liệu và ranh giới không gọi API thật.

# Progress Log — thực hiện Thẻ 20

Nguồn: [Thẻ 20](https://docs.google.com/document/d/1EsEOC6CP6Cl9EOLIXmOwaJIy7ckEbBnWJjEsg5tQwPw/edit?tab=t.rwdcujktviu3) và kế hoạch DOCX đã duyệt. Chốt thêm: học viên chọn lớp/tên và nhớ trên thiết bị; kết quả Writing đầy đủ chỉ đọc mở ngay qua quyền Progress Log, không cần phiên Term Test cũ. Listening/Reading chọn Test mới nhất riêng từng kỹ năng.

| Yêu cầu | Thực hiện |
|---|---|
| R01–R03 | Cổng học viên phục hồi danh tính trước khi hiện chọn tên; hai lối Danh sách buổi học/Hành trình của em; giữ preset Thủy Geologica/navy/đỏ. |
| R04–R08 | Hàng buổi học gọn; Câu trả lời của em; tên và nút quay lại lớn; tiêu đề buổi và điểm câu đã chấm gộp dưới tên. Số tự báo không biến thành điểm chấm. |
| R09 | Đăng xuất lưu nháp trước khi quên danh tính; bảo vệ trang cũ khi quay lại lịch sử. Bỏ lối Giảng viên trên trang học viên. |
| R10–R13 | Tổng quan không lặp tên; bỏ biểu đồ/count phía học viên; giữ phép tính cũ; hiển thị Test thực có; phân tích mới nhất riêng L/R theo thời gian bài thi. Không dùng ngày nhập Portal để chọn bài mới nhất. |
| R14–R15 | Speaking đặt nhận xét giảng viên trên tự nhận xét, không hiện khối giảng viên trống; bỏ tần suất hiển thị và Cách thống kê phía học viên. Phía giảng viên giữ hiện trạng. |
| R16–R17 | Writing bỏ Mini Test; Term Test chỉ điểm từng Task và link kết quả đầy đủ chỉ đọc. Giữ 0 khác thiếu/chờ chấm/cần kiểm tra. |

Trang Writing riêng không nhận token làm bài thi, không có nút nhập/nộp/chấm lại; API kiểm Journey, lớp, UUID học viên, mã bài và bản kết quả hiện hành. Chỉ lấy run hoàn tất được bản chấm cuối trỏ tới. Nhận xét HTML lọc phần có thể chạy mã.

Các nhịp cập nhật không thay toàn bộ danh sách khi chỉ một nhận xét đổi: giữ nguyên các hàng/khối khác, vị trí cuộn, focus và bôi chọn. Đổi học viên thì xóa dữ liệu của người trước.

## Bằng chứng local

- 9/9 ca Thẻ 20: desktop/mobile, nhớ/đăng xuất, lỗi/thử lại, Task 1 điểm 0, Task 2, sai chủ, Writing chỉ đọc; ba nhịp 30 giây thật trên cả Journey chung và riêng.
- 15/15 hồi quy giao diện liên quan; 8 tình huống danh tính dùng chung đã kiểm riêng.
- 33/33 kiểm SQL/HTTP/database liên quan và kiểm cú pháp backend đạt.
- Chrome plugin đã thao tác bản local bằng dữ liệu giả; đã kiểm viewport 390/720/1440 và focus bàn phím. Không coi viewport 720 là bằng chứng zoom trình duyệt 200% thật.
- Đã kiểm bổ sung 42/42 ca PostgreSQL trên database thử riêng, không có mạng ngoài; gồm cả 39 ca thiếu fixture trước đó và ba ca HTTP Portal mô phỏng. Một fixture thiếu bảng grading run đã bổ sung và nhóm liên quan kiểm lại đạt. Các nhóm chạy ở hai môi trường được báo riêng.

Để có điểm hiện hành, API cần nối chỉ đọc kho Test K56/K67; runtime cũ chỉ nối kho lịch sử. Cấu hình và rollback ở repo backend `ops/releases/progress-log-the20-20261030/`. Demo giữ database riêng. Quyền Git và quyền production tách biệt: push nhánh task chưa đồng nghĩa bản đang dùng đã được phát hành.

## Kiểm dữ liệu thật và phát hành

API thật, API demo và Pages đã phát hành qua PR backend #122/#123 và frontend #375. Hai nguồn Test có role SELECT riêng, không có quyền ghi. So sánh bài, điểm và lượt làm trước/sau không có thay đổi. Đã sửa bộ chọn lớp để nhận cả nhãn khóa lịch sử/null; Mini K56 chỉ hiện một lần khi có cả nguồn thi và Portal. Bump toàn chuỗi cache của các module Thẻ 20.

Các lớp có phiếu Progress Log hiện chưa có kết quả Writing đủ điểm từng Task để kiểm trọn luồng bằng dữ liệu thật. Trang Writing và quyền truy cập đã kiểm SQL/HTTP + Chrome trên dữ liệu giả, đồng thời truy vấn chỉ đọc hai Task thật ở nguồn K67. Không tạo phiếu/lượt làm mới để lấp khoảng trống kiểm này.

Kiểm mạng chậm: lịch vẫn giữ giới hạn 15 giây; sau khi lịch mở, pha đọc chi tiết nhiều buổi có tối đa 60 giây riêng và vẫn hủy khi đổi người/rời màn. Ca giả lập lịch 6 giây cùng ba lô chi tiết 4 giây/lô đã đạt.

Kiểm mobile phát hiện backdrop-filter của topbar giữ thanh điều hướng fixed bên trong header, che nút Đăng xuất. Đã bỏ hiệu ứng này riêng mobile, giữ thanh điều hướng ở đáy viewport và kiểm điểm bấm trúng nút trước khi kiểm đăng xuất/quay lại.

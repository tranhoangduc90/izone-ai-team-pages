# So sánh ba font đúng nguồn và ba cách phối màu

Demo độc lập: cùng nội dung, cỡ chữ, độ đậm, giãn dòng và bề rộng. Ba font đại diện giao diện: Reading dùng Nunito Sans; K56 dùng Segoe UI thực tế trên Chrome/Windows; mẫu Thủy dùng Geologica. So font: ba font trên một bảng màu. So màu: ba bảng màu trên một font. Xem rộng: đổi cả font và màu trong một bản. Ba ngữ cảnh học viên/đọc dài/bảng và biểu mẫu. Nội dung và tên học viên đều giả lập.

Nút thử và ô nhập chỉ thay đổi bộ nhớ trang; tải lại sẽ xóa nội dung gõ thử. Tham số URL giữ cách xem, ngữ cảnh, font, màu và mức phóng chữ; mỗi tab độc lập. Không gọi API học tập, không áp lựa chọn lên sản phẩm khác. Link cũ chưa có theme vẫn dùng Reading; font=inter/georgia chuyển sang segoe để dùng font giao diện K56 đã xác minh.

Nunito Sans và Geologica dùng WOFF2 biến thiên 400–700, bộ ký tự Latin và tiếng Việt, được tải từ [Google Fonts](https://fonts.google.com/) ngày 22/10/2026. Giấy phép OFL đi kèm từng family trong thư mục fonts. Không sửa file font. Nguồn: [Nunito Sans](https://fonts.google.com/specimen/Nunito+Sans), [Geologica](https://fonts.google.com/specimen/Geologica).

Segoe UI dùng font cài sẵn, dò qua FontFace local("Segoe UI"); không sao chép hoặc phát hành lại tệp font hệ thống. Nếu máy không có font, cột báo rõ font dự phòng để tránh đánh giá nhầm. Đã đo trực tiếp tab K56 ngày 22/10: tiêu đề Segoe UI Bold, nút/ô chọn Segoe UI Black. CSS K56 đặt Inter đầu danh sách nhưng font thực ở phòng chờ là Segoe UI; Georgia chỉ được chỉ định cho bài đọc/Writing. Demo giữ cùng weight 400–700 để so family; không mô phỏng toàn bộ độ đậm của K56 gốc. Inter và Georgia đã bỏ khỏi bộ chọn; tài nguyên cũ giữ nguyên nhưng không được dùng trong bản so sánh hiện hành.

Màu Reading giữ đủ 19 vai trò. K56 ánh xạ từ term-tests/k56-shared/styles.css và term-test-1-k56-computer-based/styles.css: nền xám xanh, đầu vùng navy chuyển sắc, nút xanh dương. Mẫu Thủy ánh xạ từ preset progress-log-thuy-v1 ngày 20/10: nền xám, tiêu đề xanh đậm, nút đỏ, nền chọn hồng nhạt. Giữ màu chữ phụ gốc #647482 để so đúng mẫu, dù có cặp tương phản chưa đạt trong báo cáo trước. Các màu trạng thái không có token riêng trong nguồn được ánh xạ theo cùng vai trò, không tuyên bố sao chép mọi selector của sản phẩm gốc.

Thanh điều khiển so sánh giữ màu trung tính và font hệ thống; chỉ phần giao diện mẫu đổi. Cỡ chữ, bo góc, khoảng cách và bố cục giữ chung; đây là so cách phối màu, không clone giao diện từng sản phẩm.

Kiểm: mở desktop/mobile, xác nhận font thực dùng và ký tự tiếng Việt, ba bản cùng nội dung/style ngoài font, đổi đủ ba ngữ cảnh, đổi cách xem/font/cỡ chữ, thử gõ/chọn/lưu/xóa, tải lại và link có tham số. Thay đổi chỉ trong thư mục này, không sửa CSS dùng chung hoặc hành trình của sản phẩm đang chạy.

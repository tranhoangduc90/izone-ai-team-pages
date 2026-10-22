# So sánh bốn font và ba cách phối màu

Demo độc lập: cùng nội dung, cỡ chữ, độ đậm, giãn dòng và bề rộng. Bốn font: Nunito Sans, Geologica, Inter, Georgia. Ba bảng màu: Reading, K56 và mẫu Thủy. So font: bốn font trên một bảng màu. So màu: ba bảng màu trên một font. Xem rộng: đổi cả font và màu trong một bản. Ba ngữ cảnh học viên/đọc dài/bảng và biểu mẫu. Nội dung và tên học viên đều giả lập.

Nút thử và ô nhập chỉ thay đổi bộ nhớ trang; tải lại sẽ xóa nội dung gõ thử. Tham số URL giữ cách xem, ngữ cảnh, font, màu và mức phóng chữ; mỗi tab độc lập. Không gọi API học tập, không áp lựa chọn lên sản phẩm khác. Link cũ chưa có theme vẫn dùng Reading.

Font WOFF2 biến thiên 400–700, bộ ký tự Latin và tiếng Việt, được tải từ [Google Fonts](https://fonts.google.com/) ngày 22/10/2026. Giấy phép OFL đi kèm từng family trong thư mục fonts. Không sửa file font. Nguồn: [Nunito Sans](https://fonts.google.com/specimen/Nunito+Sans), [Geologica](https://fonts.google.com/specimen/Geologica), [Inter](https://fonts.google.com/specimen/Inter).

Georgia dùng font cài sẵn; kiểm sự hiện diện bằng FontFace với local("Georgia"), không sao chép hoặc phát hành lại font. Theo yêu cầu bổ sung đầy đủ tiếng Việt, font Gelasio (OFL, lưu trong trang) bổ sung những ký tự Georgia không có; nhãn và chân trang ghi rõ đây là bộ ghép Georgia + Gelasio. Nguồn thiết kế Gelasio: [SorkinType/Gelasio](https://github.com/SorkinType/Gelasio), mô tả tương thích metrics với Georgia ở Regular/Bold. Không tuyên bố hình dáng hai font giống hệt hoặc đã sửa Georgia. Kiểm trên máy này cho thấy Georgia thiếu nhiều ký tự Việt ghép dấu; kiểm cmap của Georgia + Gelasio và font thực ở các chuỗi thử để xác nhận không rơi về font ngoài bộ ghép. Georgia có nét thường/đậm, cỡ đậm trung gian chọn nét gần nhất.

Màu Reading giữ đủ 19 vai trò. K56 ánh xạ từ term-tests/k56-shared/styles.css và term-test-1-k56-computer-based/styles.css: nền xám xanh, đầu vùng navy chuyển sắc, nút xanh dương. Mẫu Thủy ánh xạ từ preset progress-log-thuy-v1 ngày 20/10: nền xám, tiêu đề xanh đậm, nút đỏ, nền chọn hồng nhạt. Giữ màu chữ phụ gốc #647482 để so đúng mẫu, dù có cặp tương phản chưa đạt trong báo cáo trước. Các màu trạng thái không có token riêng trong nguồn được ánh xạ theo cùng vai trò, không tuyên bố sao chép mọi selector của sản phẩm gốc.

Thanh điều khiển so sánh giữ màu trung tính và font hệ thống; chỉ phần giao diện mẫu đổi. Cỡ chữ, bo góc, khoảng cách và bố cục giữ chung; đây là so cách phối màu, không clone giao diện từng sản phẩm.

Kiểm: mở desktop/mobile, xác nhận font thực dùng và ký tự tiếng Việt, ba bản cùng nội dung/style ngoài font, đổi đủ ba ngữ cảnh, đổi cách xem/font/cỡ chữ, thử gõ/chọn/lưu/xóa, tải lại và link có tham số. Thay đổi chỉ trong thư mục này, không sửa CSS dùng chung hoặc hành trình của sản phẩm đang chạy.

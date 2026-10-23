# Giao diện production K67

## Font và bảng màu ngày 23/10/2026

Các entry K67 nạp cuối `master170-font-colors.css`: Source Sans 3 tự host (thường/nghiêng,
variable 200–900) và màu theo vai trò master #170 v1.0. Lớp này chỉ đổi họ chữ và màu;
giữ Questions 20 px, mọi cỡ/độ đậm/giãn dòng, layout, wordmark, màu dẫn chứng đã lưu,
DOM, handler và hành vi thi hiện có. Không nhập thang chữ, khoảng cách hay component master.
Khóa 56, Substitute, cổng demo chung 56/67 và các design demo lịch sử không nạp lớp này.

Đường lui của riêng lần đổi font/màu: bỏ link `master170-font-colors.css` khỏi chín entry
K67 hoặc revert commit tương ứng. Giữ toàn bộ các lớp trình bày cũ dưới đây; không xóa
storage, reset học viên hoặc restore database. Kiểm font/màu và bất biến trình bày bằng
`node --test tests/k67-master170-font-colors.mjs`; nhóm này cũng nằm trong regression K67.

Font thường giữ nguyên asset của master. Font nghiêng cùng bản 3.052 lấy từ
[Adobe Source Sans](https://github.com/adobe-fonts/source-sans/tree/87b37a2daaed80fcb8e8ccb0085c4d72ddade12e/WOFF2/VF),
giấy phép đi cùng trong `assets/SourceSans3-LICENSE.md`.

Áp dụng giao diện Reading · xám sáng–đỏ đã duyệt cho Term Test 1/2 và Mini Test, cả CBT và phiếu đáp án, cả Listening trước và Reading trước. Chỉ các entry đã nạp lớp này chịu ảnh hưởng.

Các trang dùng lại CSS `design-demo/skin.css`, `design-demo/theme.css` và `design-full/native.css` của bản demo đã duyệt. `theme.css` có sẵn đủ 19 token Reading trong `:root`; thuộc tính HTML `data-lab-option="reading"` kích hoạt các ánh xạ màu còn lại. Không nạp mã bảng màu, host demo hoặc bộ mô phỏng dữ liệu.

`design-demo/presentation.js` chỉ trình bày và di chuyển node gốc: nhóm hướng dẫn–câu hỏi, nhận diện, màu trạng thái lưu, công cụ đối chiếu trên màn hẹp. `appearance.js` gom toolbar/audio gốc và rút nhãn Part; `appearance.css` đặt số cột Mini đúng số câu, giữ phiếu Mini hai cột desktop. Những node có handler được di chuyển nguyên, không tạo bản sao để thay thế.

Không nạp `design-full/native.js`, `launch.js` hoặc adapter lịch sử/thử bài: chúng có định tuyến API/danh tính demo. Production giữ nguyên cấu hình, exam-order, bootstrap, audio-loader, app, enhance, interaction-tools, attempt-review và mọi đường lưu/nộp/chấm/phục hồi. Không đổi kho nháp, phiên, thứ tự thi, thời lượng hoặc dữ liệu đã có.

Đầu vào của lớp trình bày là DOM và cấu hình số câu đang chạy. Kết quả là cách sắp xếp/màu/chữ mới trên cùng bộ thi. Lỗi mạng, lưu bài hoặc phát audio vẫn hiện thông báo và cách xử lý của bộ thi gốc. Bỏ các link CSS/JS bổ sung và thuộc tính trình bày tại sáu entry để quay lui; không khôi phục database hoặc xóa bài.

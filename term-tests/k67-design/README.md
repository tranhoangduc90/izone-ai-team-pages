# Giao diện production K67

Áp dụng giao diện Reading · xám sáng–đỏ đã duyệt cho Term Test 1/2 và Mini Test, cả CBT và phiếu đáp án, cả Listening trước và Reading trước. Chỉ các entry đã nạp lớp này chịu ảnh hưởng.

Các trang dùng lại CSS `design-demo/skin.css`, `design-demo/theme.css` và `design-full/native.css` của bản demo đã duyệt. `theme.css` có sẵn đủ 19 token Reading trong `:root`; thuộc tính HTML `data-lab-option="reading"` kích hoạt các ánh xạ màu còn lại. Không nạp mã bảng màu, host demo hoặc bộ mô phỏng dữ liệu.

`design-demo/presentation.js` chỉ trình bày và di chuyển node gốc: nhóm hướng dẫn–câu hỏi, nhận diện, màu trạng thái lưu, công cụ đối chiếu trên màn hẹp. `appearance.js` gom toolbar/audio gốc và rút nhãn Part; `appearance.css` đặt số cột Mini đúng số câu, giữ phiếu Mini hai cột desktop. Những node có handler được di chuyển nguyên, không tạo bản sao để thay thế.

Không nạp `design-full/native.js`, `launch.js` hoặc adapter lịch sử/thử bài: chúng có định tuyến API/danh tính demo. Production giữ nguyên cấu hình, exam-order, bootstrap, audio-loader, app, enhance, interaction-tools, attempt-review và mọi đường lưu/nộp/chấm/phục hồi. Không đổi kho nháp, phiên, thứ tự thi, thời lượng hoặc dữ liệu đã có.

Đầu vào của lớp trình bày là DOM và cấu hình số câu đang chạy. Kết quả là cách sắp xếp/màu/chữ mới trên cùng bộ thi. Lỗi mạng, lưu bài hoặc phát audio vẫn hiện thông báo và cách xử lý của bộ thi gốc. Bỏ các link CSS/JS bổ sung và thuộc tính trình bày tại sáu entry để quay lui; không khôi phục database hoặc xóa bài.

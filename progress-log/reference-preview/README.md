# Bản xem thử Progress Log theo giao diện mẫu

Lát đầu để duyệt giao diện: bảng giảng viên, lịch khóa học, câu sai nhiều, đúng/sai từng học viên và góc nhìn hành trình học viên. Dùng trực tiếp asset CSS đã có của `progress-log-567-demo`, bổ sung CSS trong trang riêng. Chưa thay route phiếu và dashboard đang vận hành; bộ soạn và thao tác ghi mở bằng link đến hệ hiện có.

Trang công khai mặc định dùng dữ liệu hoàn toàn giả, ghi rõ “Dữ liệu minh họa”. Chọn **Dữ liệu lớp của tôi** để khôi phục phiên hoặc đăng nhập Google bằng module phiên giảng viên dùng chung, rồi đọc dữ liệu thuộc quyền lớp hiện hành. Không lưu tên, bài làm, credential hoặc kết quả thật vào localStorage, sessionStorage hoặc mã nguồn. Chọn **Dùng dữ liệu minh họa** xóa dữ liệu thật đang hiển thị; không đăng xuất phiên dùng chung của các tab khác.

Thống kê dùng API `question-analytics` hiện có: một bài hiện hành mỗi học viên, lần chấm hợp lệ theo backend; câu mở, tự khai, điều kiện ẩn và câu không chấm không biến thành sai. Mẫu số tỷ lệ là câu đã chấm, không phải sĩ số. Xếp câu theo số học viên sai, rồi tỷ lệ sai; tổng từng người chỉ cộng những phiếu trong phạm vi đã chọn. Không gọi AI hoặc xử lý hàng chờ.

Số buổi lấy từ kế hoạch lớp, không lấy từ số phiếu. Buổi chưa tạo Progress Log và buổi Test chưa có kết quả đều là bình thường. Lớp chưa chốt kế hoạch chỉ hiện mốc có bằng chứng từ API.

Phạm vi đối chiếu ngoại hình của lát này: khung đầu trang, hero, card điều khiển, bốn chỉ số, roster và card phân tích theo asset mẫu; thêm thanh xem thử, tab vận hành, dữ liệu thật và bảng thống kê theo yêu cầu mới. Không tuyên bố toàn bộ luồng phiếu, báo cáo bốn kỹ năng và wizard đã khớp 100%; các lát đó còn tiếp tục sau vòng duyệt xem thử.

Kiểm cục bộ: `node --test --test-concurrency=1 tests/progress-log-reference-preview.mjs`. Full nhóm Progress Log discovery toàn bộ `.mjs/.cjs` tên `progress-log-*`, trừ `progress-log-live-smoke.cjs` là smoke production cần URL riêng. Lượt cuối: 43/43, không skip. Ca Chrome kiểm 390/768/1440, drilldown, 31 buổi, dữ liệu trống, quyền chỉ đọc, thu hồi quyền và response cũ đến muộn.

Rollback: revert commit thêm đường dẫn này; không có migration, thay API, ghi điểm danh hoặc sửa dữ liệu. Bản xem thử cần giảng viên đăng nhập trên đúng origin GitHub Pages để cookie của hệ hiện hành được gửi theo cấu hình đã có.

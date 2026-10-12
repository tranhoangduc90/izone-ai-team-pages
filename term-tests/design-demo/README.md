# Demo Term Test 2 · IC2200

Entry công khai giữ nguyên `/term-tests/design-demo/`. `real.html` là alias; URL `exam.html` cũ chuyển về entry mới. Demo Term Test 1, Mini Test và toàn bộ fixture minh họa cũ đã bỏ theo yêu cầu.

## Hai phiên bản

- **Làm thử đề trống:** nội dung thật được tải ngay khi mở trang; bài thử chỉ ở RAM. Reading/Listening gọi bộ chấm hiện hành qua endpoint chỉ đọc, không tạo attempt hay ghi điểm. Writing thử không gửi chấm AI.
- **Xem bài đã chấm:** chọn bài đã nộp của IC2200; dùng đúng đáp án, bài viết và lần chấm được final result tham chiếu. Tất cả điều khiển nộp/lưu bài thật bị khóa.
- Demo mở trực tiếp, không đăng nhập hoặc tạo phiên Google. API chỉ phục vụ phạm vi IC2200/Term Test 2. Không nhúng đề, đáp án, bài làm, nhận xét hoặc token học viên vào source/Pages. Đổi bài hoặc đóng trang hủy yêu cầu cũ và gỡ iframe chứa dữ liệu.

## Bảng màu

Xanh sương mặc định, tiếp theo Sage dịu, Kem cát và Tím xám. Chỉ bộ màu được lưu lâu dài trong localStorage. Chọn trường màu tự cuộn vùng đang chỉnh vào màn hình và vẽ viền tạm thời; hoạt động cả trong hộp nhận xét. Trên điện thoại bảng thu thành dải chỉnh màu. Không tạo đáp án/cờ giả nếu màn chưa có trạng thái cần tìm.

## Ranh giới triển khai

Tái dùng renderer `../shared/` và `../term-test-2-computer-based/`; các trang thi thật không nạp adapter hoặc lớp màu demo. `real-runtime.js` giữ dữ liệu RAM và chặn các API ghi; `real-host.js` là cầu nối demo tới `/api/term-tests/teacher/design-demo`.

API mới phải được phát hành trước entry Pages. Không có migration database. Quay lui frontend bằng revert commit; quay lui API bằng image/config đã sao lưu. Các kiểm tra cần thiết: scope cố định, tải dữ liệu không cần phiên, lineage lần chấm, bài trống không ghi dữ liệu, audio thật, đọc thực tế trên desktop/mobile và bảng màu tự cuộn.

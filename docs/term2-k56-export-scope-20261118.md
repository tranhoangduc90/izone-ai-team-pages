# Xuất bài Term Test 2 K56 và giữ lượt qua đổi bản

HTML tải về giữ nháp Reading, Task 1 và đáp án của thao tác cục bộ đã được thay bằng tiến độ chính thức. Bản tải không mang theo toàn bộ attempt token, exam session token, owner ID hoặc permit. Bản ghi cục bộ vẫn giữ định danh để khôi phục và gửi lại đúng lượt.

Term 2 dùng runtime `runtime-parallel-entry-v2.mjs` đã dùng ở Term 1, với profile Term 2 giữ nguyên. Gói bất biến `listening-report-v4` thêm wrapper riêng và cập nhật shell ở nền khi khôi phục lượt đang làm. Lỗi cập nhật ghi `offline_shell_update_failed` và giữ bài đang mở. Giao thức nộp, storage key, deadline, audio và backend không đổi; các tệp v3 nguyên byte.

## Kiểm đã chạy

- Ca runtime dùng thao tác thật `acceptOfficialProgress` để giữ đáp án thua lượt chính thức, kiểm HTML đã bỏ scope nhưng không sửa dữ liệu nguồn. Bản nền trượt đúng assertion scope; bản sửa đạt.
- Bảy ca unit/hash đạt, gồm bốn hồi quy Term 1, manifest v3 còn khớp và manifest v4 đủ 201 tài nguyên.
- Trình duyệt Edge cách ly: shell lạnh v4; nhánh báo rè/loa ngoài với nút ổn định; Reading F5 offline giữ nháp và mốc giờ.
- Trình duyệt từ shell v3 đang làm: nâng v4, F5 offline giữ cùng scope/nháp/deadline, thao tác tải hai HTML thật chứa Reading và Task 1 nhưng không mang scope, rồi mất ACK Writing đọc lại đúng một receipt.

Ca browser dùng API giả, thao tác giữ lại được cài vào fixture và audio ngắn ở 1×; không thay bằng chứng SQL native, audio đủ thời lượng, Portal hay thiết bị học viên. Lượt warm đầu trượt do phép chờ đọc global trong lúc điều hướng; đã sửa phép chờ và chạy lại riêng ca đó đạt. Không tính lượt runner lỗi thành sản phẩm lỗi hoặc ca đạt.

## Phát hành và quay lại

Canonical `index.html` trỏ bootstrap v4; manifest build `7ff75dd6f62c8b203a792b2112382372bc436761302bb8a23719126e967c1d30`. Sau Pages publish, đọc hash của đủ 201 URL thực và canonical entry. Đọc health K56 chuẩn cổng 443 để xác nhận API vẫn giữ bản đã kiểm. Không ghi dữ liệu học viên để thử phát hành.

Nếu cần quay entry, phục hồi canonical HTML của commit cha rồi phát Pages, giữ toàn bộ tệp v3/v4 và bài cục bộ/biên nhận hiện có. Không xóa cache, reset SQL hoặc quay backend. Lượt đã giữ shell v4 vẫn tiếp tục được; gói v3 giữ giới hạn xuất scope đã nêu nên ưu tiên sửa tiến thay vì dùng rollback đó lâu dài.

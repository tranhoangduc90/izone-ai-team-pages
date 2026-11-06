# Writing khóa 56: bỏ ô Dàn ý

Đức duyệt triển khai và phát hành ngày 06/11/2026 theo năm ảnh minh họa. Bỏ khối nhập Dàn ý ở Term Test 1/2, Mini Test và Substitute Test 1/2; giữ hai cột Đề bài – Bài làm, đề/biểu đồ, bài viết, tổng thời gian và dữ liệu cũ.

| Bài | Writing | Tổng thời gian giữ nguyên |
|---|---|---:|
| Term Test 1 K56 | Task 2 | 55 phút |
| Term Test 2 K56 | Task 1 | 30 phút |
| Mini Test K56 | Đoạn văn | 15 phút |
| Substitute Test 1 K56 | Task 2 | 55 phút |
| Substitute Test 2 K56 | Task 1 | 30 phút |

## Phạm vi và bảo toàn

Năm engine K56 chỉ bỏ phần tạo `writing-outline-card` và đổi dòng chuẩn bị thành tổng thời gian. Cơ chế đọc/lưu/snapshot/revision/xung đột/phục hồi, payload và dữ liệu outline cũ giữ nguyên. Dàn ý cũ vẫn có thể xuất hiện ở bản phục hồi chỉ đọc. Không sửa cấu hình thời gian, bộ đếm, tự nộp, backend, database, điểm hoặc đề.

Cache `outline=20261106-v1` đi qua tám HTML entry, năm bootstrap và mọi đường nạp chính/demo của app tương ứng. Các app/helper K67 không đổi. Quay lui bằng revert commit frontend của gói này; không restore dữ liệu hoặc chấm lại bài.

## Kiểm chứng

Nền source: `13fb721783ca0d2e5d5a14fadd47fbf02324ad93`.

- `k56-no-outline-browser.mjs`: RED 5/5 trên giao diện trước sửa vì còn ô; GREEN 5/5 sau sửa. Chrome chạy đủ năm route, khôi phục bài cũ, sửa/lưu local/reload, giữ outline cũ và deadline/start, ba nhịp nền không thay editor hoặc vùng chọn. Mạng ngoài fixture bị chặn.
- `k56-no-outline-cache.mjs` và `k56-release-cache.mjs`: 14/14 đạt. Mô phỏng cache fresh trước thay đổi trên năm CBT và ba answer sheet, xác nhận app mới thực sự được nạp; nội dung/cấu hình đề không đổi so với base.
- `term-writing-save-clients.cjs`: đủ bảy client đạt; tổng 88 ca con về ACK, retry, conflict, pending, bản mới/bản cũ và phục hồi. `term-writing-save-ui.cjs` mặc định cũng đạt 16/16 (trùng client shared, không cộng vào coverage riêng).
- `writing-submit-contract.mjs`, `term-mini-cache-graph.mjs`, `k56-writing-timer-ui.mjs`, `substitute-writing-status-compact.test.mjs`: 50/50 đạt.
- `term-mini-existing-results-browser.mjs`: 12/12 đạt, gồm giấy/CBT và hai thứ tự của ba Term/Mini K56.
- `substitute-submit-browser.mjs` với kho fixture RAM: bốn Substitute đạt, gồm hai K56; lỗi HTTP/phản hồi rỗng/mất ACK giữ bài, nhấn lặp không tạo lần nộp trùng, reload giữ kết quả. Không AI/Portal write.

Hai test mới bảo vệ hai rủi ro riêng: hành vi nhìn thấy và dữ liệu qua reload; bản mới không bị cache cũ che. Dùng renderer và đường nạp thật, không thêm hook/test flag vào production. Chúng bổ sung các ca cũ vốn giữ ô outline hoặc chỉ kiểm lưu dữ liệu.

Nhóm VM cũ `k56-term-outline-regression`, `k56-mini-outline-recovery`, `k56-mini-writing-revision`, `k56-test2-writing-revision` có 54 ca thất bại trên cả trước và sau sửa: fixture thiếu `appConfig`, hai ca còn kỳ vọng revision bootstrap cũ. Không sửa hoặc bỏ assertion để báo xanh; không coi nhóm này là bằng chứng đạt. Luồng lưu/phục hồi được kiểm bằng Chrome ở các nhóm trên. Không tuyên bố toàn repository xanh.

Ảnh/log ở worktree `output/playwright/k56-no-outline/` và `output/no-outline/`; đều dùng dữ liệu giả. Chưa kiểm bằng bài học viên thật trên thiết bị riêng; không nộp/chấm/reset bài thật để kiểm giao diện.

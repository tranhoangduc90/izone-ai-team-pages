# Rà năm lỗi static Term/Mini K67 — 29/10/2026

Cả năm lỗi tái hiện trên nền `c6bc39231ef3b231d720a021b95e3b2daa472ab2`.
Chúng dừng ở assertion ghim mã phát hành cũ, trước các assertion chức năng.
Không phát hiện lỗi sản phẩm từ năm lỗi này; thay đổi hiện tại chỉ sửa test.

| Ca lỗi ban đầu | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| Bốn entry nạp revision kết quả trực tiếp/phục hồi lượt | Đòi các mã `20261007-mini-login-v1`, `20261016-audio-reading-v1` đã bị thay thế | Kiểm bốn entry trỏ đúng shared app/CBT bootstrap và bootstrap có đường phục hồi lượt |
| Sáu entry có bản reliability và đủ tài nguyên | Đòi app/bootstrap `?rev=` cũ, trong khi app dùng `?v=20261023-submit-v1`, bootstrap dùng `?v=20261024-cf512-1` | Đọc URL thực, kiểm tồn tại mọi tài nguyên local và có mã cache trên script/style |
| CBT xác nhận tên/lớp trước prepare | Dừng ở URL bootstrap `?rev=20261017-pages-audio-v1` | Giữ kiểm tên/lớp, nhánh hủy, thứ tự xác nhận trước lưu/prepare; bỏ ngày trùng ở ca danh tính |
| Answer sheet xác nhận trước lưu/nối lượt | Dừng ở shared app `?rev=20261007-mini-login-v1` | Giữ kiểm xác nhận trước đổi danh tính/lưu/nối lượt; mô tả đúng phạm vi chọn tay |
| Dùng chung guard/revision/retry | URL app cũ và mẫu gọi enhance chưa tính `cbtAssetUrl`/query mới | Giữ deadline guard, draft revision, khoảng retry và tránh hai guard cùng chạy; nhận diện loader hiện hành |

Mã phiên bản chính xác tiếp tục được kiểm tại `tests/term-mini-cache-graph.mjs`.
Bổ sung kiểm bản submission của `enhance.js` vào cùng nơi đó; không bỏ kiểm cache.
Không đổi runtime, API, deadline, dữ liệu bài hoặc điểm.

## Bằng chứng

- Trước sửa: hai file lỗi có 3/8 ca đạt, đúng 5 ca lỗi nêu trên.
- Sau sửa: toàn bộ nhóm static trong manifest Term 67 đạt **111/111**, không skip.
- Chrome cách ly: **88/88** ca lưu Writing của bảy app đạt, qua bảy runner con.
- Chrome cách ly, HTML/JS thật và API giả: bốn entry Term 1/2 answer sheet/CBT đều hiện đúng tên/lớp; chưa xác nhận và hủy xác nhận không gửi yêu cầu mở lượt; xác nhận gửi đúng một yêu cầu, đúng UUID/lớp.
- Bản thử riêng: **8/8** mutation bị đúng ca kiểm bắt lỗi — cache bootstrap cũ, thiếu CSS, bỏ xác nhận CBT, bỏ xác nhận answer sheet, tắt deadline guard, cache enhance cũ, entry trỏ nhầm engine, mất endpoint kết quả trực tiếp. Trước và sau hoàn nguyên bản thử đều 26/26 đạt. Không mutation vào worktree sản phẩm hay production.

## Giới hạn và phát hiện ngoài năm lỗi

Không tuyên bố toàn bộ browser manifest đạt. Runner cũ `tests/term-student-memory-ui.cjs` vẫn thất bại ở kỳ vọng prefill UUID từ kho legacy. Runner đó cấp khóa Writing cũ, thiếu giả lập migration/`student-identity` và kỳ vọng popup trước resume cho người đã được nhớ; giao diện hiện dùng danh tính ERP chung và có đường tự khôi phục đã xác minh. Chưa sửa runner legacy trong gói năm lỗi static này.

Kiểm bốn entry ở trên chứng minh đường chọn tay và ranh giới request với API giả; không chứng minh Google, ERP, audio hoặc lưu DB production. Không gọi chấm AI hay tạo bài thi thật trong lần rà này.

# Audit Term Test, Mini Test và Substitute Test khóa 56

Ngày: 23/09/2026. Phạm vi: source Pages tại branch task, test cục bộ với dữ liệu giả và readback backend đã ghi trong kế hoạch dự án. **Chưa thay đổi hoặc chạy thử production.** Đây là báo cáo audit, không phải chứng nhận bài thi và chấm Writing đang hoạt động end-to-end.

## Vì sao 52 ca K67 chưa đủ

Manifest K67 cũ chỉ gom 13 file/52 ca từ 9 task; trong repo còn các regression K67 Substitute riêng cho reset nhiều tab, Writing Task 2, bố cục, câu hỏi và roster. Ngoài ra, K56 có ba bài Term/Mini với số câu, thời lượng, quy tắc ghi nhớ học viên khác K67 và hai bài Substitute đi qua webhook riêng. Chạy 52 ca K67 chỉ bảo vệ K67, không kiểm được định tuyến và kết quả K56.

Đã đối chiếu lịch sử các task K67/K56 liên quan tới định danh, Mini Test, audio, nộp bài nhiều Task, kết quả Writing bất đồng bộ, phiên giáo viên, thi bù, chống dồn tải và lần gom regression ngày 21/09. Nguồn nổi bật: `01a03717-fb16-71f3-a6f3-9b1705809854`, `01a037b8-87c1-7e11-81e0-00b21d946497`, `01a0476a-7677-7890-a054-8a269a202201`, `01a04869-c6df-7e71-8d0c-98add8911de6`, `01a06982-a496-79a2-93b8-e128b589101a`, `01a08330-ba1d-7582-9e1a-29b15886baf0`, `01a090a7-24d1-7ac3-ba13-c3c477166d0f`, `01a090d0-a082-7cd3-9010-4afab602209d`, `01a0947f-7332-7001-b7b4-a18a5e55c44e`, `01a09ebc-fd18-7e43-807c-3232ac819192`, `01a0b3d6-cabe-7651-ba2c-65741f7dd028`, `01a0bc8f-5fbd-78b3-bbdf-2deb3e19ffb8`, `01a0c4bb-bbc1-7f33-963f-9a63c749714a`. Đã rà 403 session Codex cục bộ, lọc 38 session có từ khóa và đọc sâu các task trực tiếp. Kiểm 45 Pages worktree có HEAD từ 25/08/2026; không có file test Term/Mini/Substitute nào ở đó mà thiếu ở repo hiện hành. Không có quyền chứng minh đã thấy mọi task của đồng nghiệp/host khác. Git history của Substitute là nguồn bổ sung cho những thay đổi không có session cục bộ.

## Chọn regression K67 có điều chỉnh

| Nguồn K67 | Áp dụng cho K56/Substitute | Ngoại lệ |
| --- | --- | --- |
| Xác nhận tên/lớp, định danh và không lộ dữ liệu | Dùng cho ba Term/Mini K56; kiểm khóa lưu theo slug ở cả năm bài | K56 cố ý chọn học viên thủ công, không sao chép quy tắc “ghi nhớ học viên” của K67 |
| Audio khôi phục, mất mạng, phát lại | Dùng cho ba Term/Mini; kiểm MP3 đã phát hành của năm bài | Không khẳng định hash trùng MP3 nguồn riêng tư ngoài Git |
| Writing revision, kết quả bất đồng bộ, fallback | Dùng cho ba Term/Mini; thêm kiểm thẻ điểm đúng Task cho Substitute 1/2 | Không lấy số Task và công thức điểm K67 áp cho K56 |
| Substitute reset nhiều tab, storage bị chặn | Chuyển thành sáu ca riêng cho Substitute K56 1/2 | K67 dùng reset có version; K56 chỉ kiểm namespace hiện hành |
| Bố cục matching, roster gateway, không có đáp án/secret | Giữ K67 làm bảo vệ không ảnh hưởng; kiểm gateway và cấu hình K56 riêng | Listening retake K67 là sản phẩm khác, không đồng nhất với Substitute K56 |

Lệnh chạy: `node scripts/run-k56-product-audit.mjs --all`; có thể chọn `--k56`, `--substitute`, `--k67` hoặc `--list`. Manifest ghi rõ hai test cũ phụ thuộc source/audio riêng ngoài Git nên chưa nằm trong suite tự động; thay thế phần tài nguyên công khai bằng `k56-published-audio-audit.mjs`. Dữ liệu test mới đều là dữ liệu giả.

## Kết quả audit source hiện tại

Mốc audit trên base `435019d`: **217 ca, 214 đạt, 3 đỏ, 0 skip** trên 45 file. Sau sửa trong branch, suite mở rộng đạt **221/221, 0 skip** (23/09/2026). Đây là kết quả source/test giả, **không** xác nhận backend nhiều lớp hay production; cổng phát hành vẫn `not_ready`.

1. **P0 – định tuyến sai lớp K56 thật.** Ba cấu hình Term Test 1, Term Test 2, Mini Test chỉ nhận `IC2264` là lớp thật; hai lớp K56 đang học `IC2175`/`IC2180` (đã kiểm `course_id=4` trong ERP ngày 23/09) rơi vào `mapping-api-demo`. Test mới `k56-product-matrix-audit.mjs` đỏ trên source trước sửa. `IC2181`/`IC2207` thuộc `course_id=5`, không được dùng làm fixture K56. Không đổi frontend đơn độc: backend K56 hiện chỉ map một lớp, cần mở backend/cohort trước và chặn mã không hợp lệ ở server.
2. **P1 – Substitute 1/2 hiện nút feedback không có nội dung khi gói `ready=true` thiếu Task.** Cả hai app tạo nút vẫn bấm được; `openWritingFeedback(undefined)` không mở nội dung. Hai ca `substitute-k56-writing-result-audit.mjs` đỏ; ca đối ứng K67 đã có guard. Đây là lỗi chịu đựng phản hồi bất thường, chưa chứng minh API thật đang trả gói thiếu Task.
3. **Khoảng trống chưa kiểm được:** chấm Writing end-to-end K56 nhiều lớp, job đúng attempt khi chấm xen kẽ, hồi phục webhook, ghi Portal đúng cột, tải đồng thời K56+K67, và trạng thái thật của hai gateway Substitute. Source/backend live lệch Git nên test trên Git hiện chưa đại diện đầy đủ production. Riêng Pages, ngày 23/09 đã đọc lại 7/7 file văn bản K56 và 3/3 MP3 trên URL công khai, khớp Git sau chuẩn hóa xuống dòng; hai test `k56-backup-pages.mjs` và `k56-local-source-parity.mjs` đã chuyển sang hash production, không cần source riêng và được đưa lại vào bộ audit. Backend vẫn cần parity trên bản thử trước phát hành.

Các điểm đạt trong phạm vi source/test giả: ma trận số câu của năm bài (40/26/1, 40/40/1, 10/13/1, 40/26/1, 40/40/1), audio công khai, demo reset tách bài và nhiều tab, hai gateway Substitute giữ route/query/body và báo lỗi HTTP, Writing Task đúng khi dữ liệu đầy đủ, K67 guard 52 ca và các ca Substitute K67 ngoài manifest cũ. “Đạt” ở đây chỉ nói test cục bộ; không xác nhận n8n, AI, database, Portal hay UI production.

## Cổng đóng audit

- Sửa source trong branch riêng; ba ca đỏ phải GREEN trên head và RED trên base. Không sửa test để né lỗi.
- K56 backend: lấy baseline live đã đối chiếu, thêm test API/DB với hai lớp K56 xen kẽ, lớp ngoài khóa, retry/callback trùng, Portal thiếu cột/điểm cũ. Chạy full backend suite cùng frontend suite và review diff.
- Chỉ sau bản thử an toàn và duyệt production riêng mới pilot một lớp thật, đọc lại DB/Portal/UI; theo dõi backlog và lỗi trước khi mở rộng. Không dùng kết quả test tĩnh làm cam kết tốc độ chấm bài.

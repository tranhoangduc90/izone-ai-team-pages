# Giữ bài và xác nhận nộp Term/Mini K56–K67

Áp dụng cho Term 1, Term 2 và Mini của hai khóa, gồm các entry đang dùng app chung và thi bù Listening K67. Mục tiêu là hủy nộp vẫn làm tiếp; phản hồi rỗng không thành đã nộp; mất phản hồi sau lưu được đối soát đúng bài.

## Hành vi dùng chung

- Bốn app giữ nguyên storage key và dữ liệu cũ. Gói nộp chưa rõ kết quả được giữ trong `pendingSubmissions` của đúng phiên/người.
- Chỉ L/R đi qua `shared/section-submission.mjs`. Writing giữ hợp đồng revision, xung đột và snapshot hiện có.
- Khi phản hồi thiếu xác nhận, client gọi `POST /api/term-tests/:testSlug/submission-status`. Route này chỉ đọc bài đã có, không mở phiên, chấm hoặc gửi điểm.
- Retry dùng lại mã gửi và nội dung cũ. Một biên nhận khác người/lượt/generation/nội dung không được áp vào trang.
- Audio K67 chỉ dừng sau sự kiện xác nhận đã nộp. Controller K56 v2, review K67 120 giây và K56 0 giây giữ nguyên.

## Thêm bài mới

1. Khai đúng khóa, lớp, số câu, Task, thời gian, thang điểm, mode và các entry thực sự hỗ trợ.
2. Dùng app/controller đã ghim của khóa. Không copy handler cũ bỏ phần kiểm xác nhận.
3. Kiểm API Listening/Reading trả `ok: true`, token lượt hợp lệ và trạng thái hoàn tất đúng thứ tự. Reading trước phải có `examMode: read_first` và `readingSubmitted: true` khi L chưa xong.
4. Kiểm backend đọc đúng schema/profile, giữ token/generation và guard chủ audio. Không dùng endpoint đọc kết quả có tác dụng chấm/đồng bộ để phục hồi mất phản hồi.
5. Chạy ca hủy, nộp trắng/thiếu/đủ, lỗi HTTP, HTTP 200 rỗng, mất phản hồi sau commit, bấm lặp, reload/retry, đổi người và deadline.
6. Kiểm riêng nội dung/đáp án/audio/quyền/đích điểm; demo không ghi Portal. Giấy và thi máy giữ chính sách riêng, ghi N/A khi một mode không hỗ trợ.
7. Trước phát hành, đối chiếu consumer/cache revision, backup và hash từng bài/điểm; sau phát hành đọc lại asset/runtime và dữ liệu cũ. Không restore dump cũ vào kho đang dùng để quay code.

8. Bài mới cần đăng ký slug trong allowlist của cả module canonical K67 và module release API, kiểm parity hai bản; copy giao diện không tự mở route phục hồi. Reading chỉ cần quyền token lượt phù hợp; guard chủ audio chỉ áp dụng Listening K67. Yêu cầu đổi thời gian rà K56 ở issue #117 là việc riêng chưa được gói này chốt; giá trị 0 giây là baseline quan sát, không cấm yêu cầu thay đổi đã được duyệt sau này.

## Bảo toàn qua các lần sửa tiếp

Đọc [hồ sơ đầy đủ, 44 chức năng và giới hạn kiểm](https://github.com/tranhoangduc90/izone-AI-team/blob/main/docs/TERM_MINI_THANH_QUA_VA_BAO_TOAN_2026-10-23.md). Giữ các nhóm `term-mini-submission-contract`, `term-mini-pending-storage`, `term-mini-cache-graph`, `term-mini-submit-browser`, `term-mini-reading-submit-browser` và `term-mini-existing-results-browser` trong manifest K67/K56. Khi thêm slug hoặc đổi owner, mở rộng cấu hình ca kiểm cho bài đó; không xóa hoặc nới kỳ vọng chỉ để suite xanh. Các kiểm Writing/audio/identity/order hiện hành vẫn có phạm vi riêng.

Khi thay đổi API/controller/shared, kiểm cả nơi gọi và nơi nhận dữ liệu. Giữ receipt cũ nguyên trạng và ghi rõ revision/môi trường; chỉ dùng lại bằng chứng còn hiệu lực, chạy phần thiếu hoặc bị ảnh hưởng. Trước phát hành có dữ liệu, đối soát từng ID/hash bài/nháp/điểm và phân loại ghi mới hợp lệ. Không nộp/chấm/reset bài học viên để tạo fixture; quay code phải giữ mọi bài mới.

## Chạy kiểm

`node --test tests/term-mini-submission-contract.mjs` kiểm các điều kiện nhận xác nhận và phục hồi, bằng state giả trong bộ nhớ.

`node tests/term-mini-submit-browser.mjs` chạy handler Listening/controller thật trong DOM với media/API giả. `node tests/term-mini-reading-submit-browser.mjs` kiểm handler Reading của sáu bài và hai thứ tự. Các runner lưu JSON chi tiết vào thư mục bằng chứng; exit khác 0 nghĩa là còn lỗi hoặc lỗi harness.

Đây là ca hồi quy riêng của nộp bài. Hành trình toàn trang, danh tính, Writing, audio và SQL/HTTP phải dùng thêm bộ kiểm hiện hành của đúng consumer. Mock không thay kiểm PostgreSQL, production asset hoặc điểm ở Portal.

Backend canonical và script ghép đúng nền live nằm trong repository `izone-classroom-mapping-review`, thư mục `backend/ops/releases/term-mini-submit-20261023`. Không dựng lại toàn backend từ một nhánh khác chỉ để thêm route này.

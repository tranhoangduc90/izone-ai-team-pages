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

## Chạy kiểm

`node --test tests/term-mini-submission-contract.mjs` kiểm các điều kiện nhận xác nhận và phục hồi, bằng state giả trong bộ nhớ.

`node tests/term-mini-submit-browser.mjs` chạy handler Listening/controller thật trong DOM với media/API giả. `node tests/term-mini-reading-submit-browser.mjs` kiểm handler Reading của sáu bài và hai thứ tự. Các runner lưu JSON chi tiết vào thư mục bằng chứng; exit khác 0 nghĩa là còn lỗi hoặc lỗi harness.

Đây là ca hồi quy riêng của nộp bài. Hành trình toàn trang, danh tính, Writing, audio và SQL/HTTP phải dùng thêm bộ kiểm hiện hành của đúng consumer. Mock không thay kiểm PostgreSQL, production asset hoặc điểm ở Portal.

Backend canonical và script ghép đúng nền live nằm trong repository `izone-classroom-mapping-review`, thư mục `backend/ops/releases/term-mini-submit-20261023`. Không dựng lại toàn backend từ một nhánh khác chỉ để thêm route này.

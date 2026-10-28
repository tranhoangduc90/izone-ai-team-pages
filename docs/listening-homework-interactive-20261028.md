# Listening Homework Lesson 2 — tích hợp giao diện đã duyệt

Nguồn hình thức là demo Scandinavian Studies đã duyệt ngày 28/10/2026, PR334. Bản thật dùng cùng preset Listening thực chiến, Mục 1–22, ô điền inline, lựa chọn trực tiếp, chọn dẫn chứng, transcript theo phần và popup đối chiếu. Bỏ Nghe toàn bài. Dictation không mở transcript; hai phần phân tích tự mở đúng ngữ cảnh. Dock và hai vùng làm việc được giới hạn trong khung trên desktop; màn hẹp giữ dock và chuyển vùng.

## Phạm vi và dữ liệu

Frontend controller vẫn gọi API Listening Homework riêng. Giữ shared student identity, teacher SSO, CAS/mutation/request ID, snapshot bất biến, chấm từng ý và outbox Homework Docs. Không đổi backend, rubric/version, database, Worker/catalog hoặc workflow CTA ở lần tích hợp này. Route `lesson-2.html` và mã `67-listening-02` tiếp tục tương thích với URL canonical theo tên audio.

`interactive-workspace.mjs` quản lý giao diện; `answer-codec.mjs` chuyển ô con về cùng 22 ID cũ. Metadata phục hồi ô/MCQ nằm trong annotations và chỉ dùng nếu tái tạo đúng answer. Bài tự do cũ giữ nguyên văn, không đoán cách tách; người học có thể chọn dùng các ô tương tác, vẫn xem lại bản trước chuyển. Nháp demo không nhập vào bài thật.

Góp ý lấy từ kết quả server và câu trả lời snapshot. Mục thiếu một trong ba ý hiện 2/3, sửa/nộp lại theo cùng luồng; popup không lấy nháp hiện tại làm câu trả lời đã nộp. Đọc nền dùng khóa người/lượt/kết quả, giữ DOM và vùng đang đọc khi không đổi. Bản cache đã lưu xong không được coi là nháp bẩn khi server có bản mới hơn; bản thực sự chưa lưu hoặc mất ACK vẫn được giữ và không vượt CAS.

## Kiểm chứng

- RED trên bản thật cũ: 22 textarea lớn, thiếu inline/radio/transcript. GREEN bằng entry thật và backend SQL cách ly, hai danh tính giả, teacher fixture và provider fixture: nhập, chọn dẫn chứng, mất ACK, nộp/worker, sửa/nộp lại, lịch sử, reset, bài cũ, chỉ xem, desktop/mobile. Ba lần đọc server không thay DOM/cuộn/selection. Có kiểm dock desktop và 390/320/768px cùng màn ngang 844px.
- `node --test tests/listening-homework-answer-codec.test.mjs tests/audio-clock-skew.test.mjs`: 9/9. Suite backend `listening-homework67.test.js`: 12/12. Backend không sửa; fixture provider chỉ chứng minh orchestration.
- AI thật Gemini 3.5 Flash: hai nhóm, sáu mục mỗi nhóm với serialization mới. Đúng nghĩa/không dấu đạt; S4 thiếu ý đạt 2/3, đảo phủ định S8 và chiều so sánh S19 bị bác. Bằng chứng AI giữ private, không nằm trong Pages.
- Audio qua native manifest: nguồn chính lỗi → MP3 Pages thật, đồng hồ nhanh/chậm một ngày → Cloudflare thật, nghe lại không tải lại, native 403 không gọi CDN/fallback. Có lớp relay CORS ở fixture localhost; hậu kiểm public/Chrome ghi riêng.
- Google Docs thật với explicit owner giả và database local riêng: đăng ký CTA, lưu/nộp/worker và bốn job đều verified; đọc lại hyperlink canonical và trạng thái đạt 22/22. Text ngoài dòng Listening được quản lý giữ nguyên. Đây là Docs thử, không phải bằng chứng đã giao Homework cho cả lớp.
- Runtime production đọc trước phát: image `izone-listening-homework67:25fc8828ac9d`, code canonical/version V2, studentsOpen=true, 10 lớp; bảng draft/attempt/job/binding đều 0. Không tạo/nộp/chấm lượt học viên thật để kiểm.

## Hậu kiểm và quay lại

Sau Pages build cần so file public với commit, mở URL thật/console/đường giảng viên và CTA thử. Chưa coi các ca Chrome responsive là kiểm iPhone/Safari thật. Không nhận đã quan sát học viên thật nộp bài.

Quay lại bằng revert gói frontend này, giữ nguyên database, nháp, lịch sử, phiên và Docs. Bộ chuyển giữ answer string theo contract cũ để runtime cũ vẫn đọc được. Skill Listening Homework được cập nhật trong repo điều phối riêng, tuân thủ cổng Git của repo đó.

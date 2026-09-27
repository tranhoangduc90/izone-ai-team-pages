# Thử nghiệm Homework Lesson 3 · IC2304

Ngày 27/09/2026. Phạm vi nghiệm thu: `large_phased`; đợt đầu là một file mẫu và một lớp, sau đó mới nhân bản. Đây là kế hoạch xây dựng và đối chiếu, chưa xác nhận bản triển khai production.

## 1. Kết quả người dùng nhìn thấy

- Học viên mở CTA trong Google Doc Lesson 3. Link truyền `documentId`, `class=IC2304`, `assignmentCode=67-speaking-lam_ro`. Trang tự chọn lớp từ link, tải học viên của đúng lớp và chỉ yêu cầu chọn tên. Nếu đã bật “Ghi nhớ tôi trên thiết bị này”, trang thử dùng mã học viên đã nhớ để mở thẳng bài; backend vẫn kiểm mã đó thuộc lớp/bài của Doc ID.
- Nội dung luyện tập lấy từ [bản cũ](https://docs.google.com/document/d/1aICX9jWLFADkEyauBok3TjqsfpylsyQKgEXiBJDZ0lI/edit?tab=t.0): **bốn link riêng** theo lựa chọn của Đức. Làm rõ cấp 1 (`https://ducizone.short.gy/lam_ro_lv1`) có đủ Danh từ, Động từ, Tính từ, mỗi phần ít nhất một câu hỏi; cấp 2 (`https://ducizone.short.gy/lam_ro_lv2`) ít nhất hai câu; cấp 3 (`https://ducizone.short.gy/lam_ro_lv3`) ít nhất hai câu; Freestyle (`https://ducizone.short.gy/freestyle`) có hai chu trình hỏi, trả lời, góp ý, nói lại. Giữ đầy đủ hình hướng dẫn chia sẻ hội thoại và lưu ý dùng micro. Mỗi phần cần một hội thoại riêng.
- Khi toàn bộ link bắt buộc đạt, API tạo biên nhận và hai việc độc lập: ghi Docs, chấm/đánh giá hội thoại. Writer chỉ ghi vào ô vàng ngay dưới “TÌNH TRẠNG NỘP BÀI SPEAKING”: `Đã nộp bài thành công - giảng viên nhấn vào link này để xem chi tiết.` Chỉ cụm `link này` gắn URL giảng viên chứa receipt ID. Writer đọc lại đúng ô, đúng link, đúng receipt trước khi báo hoàn tất.
- Giảng viên mở link, đăng nhập Google theo cơ chế Term Test, được backend kiểm quyền lớp, rồi xem bản chỉ đọc: học viên, bài, các link ChatGPT Share đã xác nhận, số câu/chu trình, cảnh báo voice và lời xác nhận, trạng thái chấm. Người không có quyền không được nhận thông tin học viên.
- Khu Bác sĩ AI bên dưới dùng danh mục 67. Giữ nhóm `Chờ luyện/Đã luyện`, xếp nhóm cần luyện theo `Số lần đề xuất` giảm dần, hiện 5 bài đầu và có “Xem tất cả”. Hai ô luyện bổ trợ được kiểm riêng; lượt hợp lệ tăng `Số lần luyện` đúng một lần. Quy tắc mở lại theo mốc 5 ngày giữ như workflow hiện tại, chưa áp dụng đề án active 1–2 bài.

## 2. Mẫu, phạm vi và rollback

| Nguồn | Phạm vi đọc | Phần giữ | Phần đổi |
| --- | --- | --- | --- |
| [Docs cũ](https://docs.google.com/document/d/1aICX9jWLFADkEyauBok3TjqsfpylsyQKgEXiBJDZ0lI/edit?tab=t.0) | Tab `t.0`, đọc cấu trúc 27/09 | Bốn nội dung luyện, ngưỡng, bảy hình, link chatbot | Hướng dẫn chuyển sang webapp; không ghi link trực tiếp trong bốn bảng cũ |
| [Docs mới](https://docs.google.com/document/d/1hx2XF1bJtNCZZXbwo8PyAlYHFwY4udsDmiqhEwqrA18/edit?tab=t.0) | Tab `t.0`, revision trước sửa đã lưu trong biên bản | CTA xanh đậm, mã bài bên dưới, tiêu đề và ô trạng thái vàng | Gắn hyperlink CTA và writer điền ô vàng khi có receipt thật |
| Webapp hiện có | Worktree `codex/speaking-submission-demo-20260916` | Hình hướng dẫn, kiểm Share, hộp thoại, ghi nhớ mã học viên | Tải roster/API thật, Lesson 3, Bác sĩ AI, trạng thái bền |

Trước sửa Docs, tạo bản sao hoặc snapshot đủ để phục hồi; dùng `requiredRevisionId` khi batch update. Không sửa bản cũ. Nếu liên kết hoặc bảng bị sai, dùng bản sao để phục hồi cấu trúc, và giữ backend feature flag tắt. Không xóa dữ liệu bài đã nhận.

## 3. Nguồn chuẩn và định danh

1. Bảng đăng ký `assignment_document` ghép Doc ID với assignment ID/class ID/mã bài. Mã lớp trong URL chỉ để chọn sẵn; backend không tin query để cấp quyền.
2. Roster lấy `student_mapping_review.public_id` đã duyệt và `erp_class_membership_snapshot`. Học viên chọn theo mã ổn định, không theo tên; tên trùng vẫn ra hai lựa chọn phân biệt bằng mã học viên.
3. Dấu nhớ browser dùng cơ chế `shared/student-memory.js` của Term Test/Writing. Mở lại không cần query `class`, nhưng vẫn phải gửi Doc ID và mã học viên cho backend kiểm.
4. Link nội dung được chuẩn hóa về `chatgpt.com/share/<id>`. Sau khi đọc hội thoại thật, lưu dấu vân tay nội dung. Đối chiếu chống dùng lại trong khóa khi chốt bằng ràng buộc duy nhất ở DB, đồng thời chặn cùng một hội thoại giữa các phần.
5. Receipt bất biến theo học viên + bài + Doc ID; outbox riêng cho ghi Docs và chấm. Mất phản hồi sau ghi Docs phải đọc lại ô vàng và link trước retry.
6. URL giảng viên chỉ chứa receipt UUID, không chứa token học viên. Quyền lớp được kiểm lại sau Google login. Backend trả dữ liệu chỉ đọc.

## 4. Trình tự làm

1. Định nghĩa bốn phần Lesson 3 và ngưỡng kiểm riêng đã được Đức chốt; kiểm Level 1 theo cả ba loại từ, không chỉ đếm tổng ba câu.
2. Đăng ký `IC2304`, `assignmentCode`, Classroom courseWork ID và Doc ID mẫu vào database mapping sau migration đã được review. Không suy courseWork ID từ tiêu đề Docs.
3. Nối frontend với API: mở bài, chọn học viên/ghi nhớ, xác nhận từng link, tải lại nháp, hoàn tất, danh sách Bác sĩ AI và hai ô luyện bổ trợ. Giữ câu chữ/hình của Docs cũ.
4. Nối worker kiểm Share và workflow n8n với hàng chờ/receipt. Worker phải báo rõ link chết, link riêng tư, thiếu khối lượng, trùng bài, dấu hiệu gõ và bằng chứng. Chỉ worker được gọi callback nội bộ.
5. Tạo màn giảng viên chỉ đọc và route có quyền lớp; tạo writer Google Docs nhắm đúng ô vàng và đọc lại.
6. Bản Docs mẫu hiện đã gắn CTA tới trang thử `127.0.0.1:8766`, chứa Doc ID, lớp và mã bài. Link này chỉ dùng trên máy Đức, chưa đưa cho học viên. Trước khi dùng thật, thay bằng HTTPS sau khi Pages/API hoạt động và kiểm mở link từ chính Docs, không chỉ kiểm cấu trúc hyperlink.
7. Kiểm một chu kỳ n8n và Classroom `TURNED_IN` trước email tổng hợp; không áp dụng kiểm thiếu bài cho bài đã `RETURNED` hoặc bài cũ trước ngày bật pilot.

## 5. Cổng nghiệm thu và vận hành

- Phải test: class URL đúng/sai, Doc ID đúng/sai, học viên đã nhớ đúng/sai/khác lớp, tên trùng, đổi người, hết quyền, hai tab; mỗi link thiếu/đủ/chết/riêng tư/trùng URL/trùng nội dung/trùng bài trước; voice warning và xác nhận; nộp thiếu link; retry mất ACK; Docs ô vàng chứa đúng link receipt; giáo viên có/không có quyền; danh sách Bác sĩ AI 0/5/>5 bài, thứ tự theo số lần đề xuất và retry sự kiện.
- Bản cũ là nguồn nội dung; bản mới là nguồn bố cục CTA và ô trạng thái. Đối chiếu Docs API sau sửa, và kiểm link trong browser khi API + Pages đã có HTTPS hoạt động. Kiểm trực quan ở desktop/mobile cho webapp, đọc lại Google Doc sau writer.
- Tải pilot lấy theo roster IC2304, không suy từ 30 học viên của ví dụ cũ. Mỗi link cần đọc Share + AI, nên API trả trạng thái đang kiểm trong vài giây và worker xử lý nền; ngưỡng/chi phí n8n cần đo trên ca thử. Theo dõi job quá 5 phút, lỗi AI, trùng claim, hàng chờ Docs/chấm, receipt chưa ghi Docs, và danh sách Bác sĩ AI cập nhật muộn.
- Rollback: tắt feature flag Speaking Homework, khôi phục hyperlink CTA từ snapshot Docs nếu cần, giữ receipt/claim đã có để không cho nộp trùng. Không tắt luồng Lark cũ trước khi đối chiếu đủ một chu kỳ và chốt đường ghi chính.

**Chưa đủ để bật học viên:** migration canonical/role, courseWork ID, worker n8n, writer Docs, URL Pages/API HTTPS và readback end-to-end. CTA trong Docs mẫu đã được đọc lại và ô vàng vẫn trống; backend hiện chỉ có bản ứng viên trong worktree; production chưa đổi.

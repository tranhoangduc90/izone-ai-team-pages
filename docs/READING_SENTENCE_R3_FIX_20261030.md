# Sentence Completion Homework — sửa bố cục R3 ngày 30/10/2026

Athletes and stress trước đây để `_____` trong câu rồi tách ô đáp án thành một dòng rộng bên dưới. Bản sửa đặt số câu, ô nhập gọn và cờ ngay tại chỗ trống, theo [demo Sentence Completion R3](https://tranhoangduc90.github.io/izone-ai-team-pages/design-reference/master170/reading.html?case=reading-sentence). Giữ đầy đủ chữ trước/sau chỗ trống, kể cả câu 22 bắt đầu bằng ô nhập. Không lặp số câu ở đầu câu.

Nguồn tham chiếu bổ sung: `term-tests/term-test-2-computer-based/styles.css` phần `.cbt-inline-answer`, `.cbt-answer-input`, `.cbt-flag-button` và `enhance.js` phần `attachAnswerFields`: giữ control gốc ở slot của câu và cờ cạnh control. Demo R3 đo ở 1440×1000 có ô rộng 205px, cao 38px, bo 6px; Homework giữ profile chữ 18px và control tối thiểu 44px. Chỉ lấy cách bố trí/control, không thêm timer hoặc chuyển engine thi.

Theo phản hồi riêng về keyword, mỗi câu có hai cụm liên tiếp:

- Keyword chính: từ khóa trong câu hỏi và vị trí đoạn cạnh nhau khi đủ rộng; dẫn chứng trong bài ngay dưới. Khung hẹp xếp các ô cùng cụm theo chiều dọc.
- Keyword phụ: từ khóa và ba cách paraphrase, ô tự kiểm thái độ của câu 20 khi có, rồi dẫn chứng tương ứng trong bài.

Các ô keyword ngắn tự co còn khoảng 44–46px, nội dung dài vẫn tự tăng chiều cao. `prototype.js` chỉ dùng mức tối thiểu 44px khi textarea tự khai `data-compact-field="true"`; các dạng khác giữ mức tối thiểu 80px cũ. Không đổi mã bài, target ID, câu trả lời đã lưu, 28 mục chấm/ngưỡng 23, API, CTA, bộ chấm hoặc quyền GV. `reviewGroups` theo cùng thứ tự cụm.

Giữ `data-field` cho nguồn/sửa bài, `data-target` cho lưu/khôi phục và annotation root key cũ. Chỗ gạch trống gốc được giữ trong text node ẩn; số/cờ/control bị annotator loại trừ như trước. Chuỗi nguồn dùng tính offset và quote do đó không đổi khi đưa ô nhập vào câu. Ba asset thay đổi có cache version `20261030-sentence-r3-2` trên entry thật.

## Kiểm đã chạy

- Ca browser mới RED trên giao diện cũ vì ô đáp án nằm ngoài câu.
- `tests/sentence-homework-browser.mjs`: 20/20, draft/waiting/review/teacher × 1440×1000, 1024×768, 390×844, 320×568, 844×390. Kiểm ô tại chỗ trống, số/cờ duy nhất, độ rộng slot, nhóm keyword, chuỗi annotation, tự co ô ngắn, nháp/reload/cờ, focus, A+/A−, phản hồi/vòng sửa, chỉ xem và ba nhịp nền giữ DOM/vùng đọc/focus/selection.
- `tests/materials-status-browser.mjs`: 33/33; `tests/materials-history-async-focus-browser.mjs`: 6/6, bảo vệ consumer cũ của prototype chung.
- Cú pháp JS và `git diff --check` đạt; ảnh desktop/mobile được xem trực tiếp, đối chiếu ảnh demo R3 và đo control.

Các ca dùng entry/renderer thật cùng client và danh tính giả cách ly; không nộp bài, gọi AI, ghi Docs hoặc thử SSO mới. Không coi mô phỏng viewport là kiểm điện thoại vật lý. Đây là các nhóm kiểm liên quan, không phải full suite của toàn repo.

Phạm vi chỉ Pages: renderer/CSS Sentence, mức co textarea có opt-in và cache entry. Giữ nguyên source và hành vi Term/K56/các bài khác. Không có công cụ graph trong phiên; đã đọc import, selector và caller thực tế để xác định ảnh hưởng.

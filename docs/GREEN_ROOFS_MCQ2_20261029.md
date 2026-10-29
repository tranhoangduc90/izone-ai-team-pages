# Green roofs — Choose TWO theo mẫu R3

Màn MCQ cũ dùng hai select và bank Options như Matching, cho phép chọn trùng.
Màn mới dùng `groupsHtml`/`bindMultiple` từ `reading-practice/authored-ui.js`,
đúng component của demo `design-reference/master170/reading.html?case=reading-multiple`.
Một nhóm có stem, hai slot/cờ và checklist A–E, giới hạn hai lựa chọn khác nhau.

Adapter Green roofs map số10–13 sang target Homework cũ, lưu hai slot trong
cùng một patch qua ReadingInteractionBridge. Nháp cũ không bị tự đổi; nếu đã
chọn trùng, giao diện nhắc sửa. Chờ chấm, kết quả và giảng viên giữ chỉ xem.
Khởi động đợi component native tải xong rồi nạp prototype chung; lỗi tải có
thông báo thử lại. Giữ neo stem/target để Highlight/Note và vòng sửa dùng lại.

Phạm vi sửa chỉ renderer/CSS/entry Green roofs và ca kiểm của bài. Prototype,
renderer practice, bộ chấm, backend, CTA, Docs và schema dữ liệu không đổi.
Profile Homework giữ18px; hình thức lựa chọn dùng viền7px, checkbox17×17px,
padding10×12px desktop/9px hẹp, margin0 và bỏ khung Matching quanh stem.

Ca kiểm RED trên base:12/12 phát hiện bốn select sai dạng. Ca GREEN kiểm12
tổ hợp1440/390/320 × draft/waiting/review/teacher: mười checkbox,14target,
chọn/bỏ/bàn phím, từ chối lựa chọn thứ ba, payload hai slot, nháp trùng cũ,
tải lại giữ đáp án/cờ, readonly, popup, nén hai cấp và ba nhịp polling giữ DOM.
Hồi quy Desolenator12ca đạt; nguồn prototype chung giữ nguyên byte với base.
Artifacts riêng: `E:/Codex-Data/reading02-green-roofs-20261029/MCQ_SCOPE.md`,
`mcq-red.log`, `mcq-green.log` và `ui/choices-*.png`.

Fixture cách ly, không nộp/chấm bài học viên thật hoặc gọi AI/Docs. Quay lui
bằng revert đúng commit frontend; không restore database hoặc đổi bài đã lưu.

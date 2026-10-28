# Sửa Reading/Listening từ phản hồi giao diện ngày 29/10/2026

Reading authored nhận diện đúng T/F/NG và Y/N/NG từ bộ ba giá trị đáp án. Mỗi câu dùng ba radio một nhãn theo Term Test1 K67, một số câu và một cờ; không còn bank Options hiển thị hoặc số lặp cạnh dropdown. Value gửi/lưu giữ nguyên. Tiêu đề dạng `Multiple choice — subtitle` bỏ phần ghi chú kỹ thuật khỏi màn làm bài.

Listening một part chỉ gồm các nhóm Note Completion liên tục cùng chỉ dẫn được trình bày thành một giấy ghi chú. Inclusive design giữ mười ô31–40 và các đề mục nhỏ trong cùng vùng cuộn; không tách nhóm đầu sang cột khác. MCQ, bảng, hình, nhóm không liên tục và giới hạn từ khác không bị ghép. Khoảng đệm thân/đoạn mở đầu là28px desktop và16px màn hẹp.

Checkbox ghi nhớ được tách khỏi kích thước text input44px; canh giữa với nhãn và giữ thao tác chọn/bỏ chọn. Rule trong theme dùng đúng checkbox có ID nhớ người/giảng viên, không thay auth hoặc lưu danh tính. Các consumer K56 không nạp theme này giữ CSS native.

## Bảo toàn

Không đổi API, backend, số câu/key/rubric, thời gian/audio, điểm hoặc dữ liệu thật. Giữ chuỗi chữ/gốc/offset Highlight/Note cũ bằng context tương thích ẩn; chữ mới của radio không làm lệch anchor cũ. Hai gốc Listening vẫn có namespace riêng khi ghép vùng cuộn. Chỉ sửa cách trình bày và query cache của entry/import/stylesheet liên quan.

## Kiểm

- Ca RED tái hiện app Listening có10 ô nhưng chia cột, đoạn mở đầu cách viền1px; checkbox Practice cao44px; Reading chưa có radio và tiêu đề còn subtitle.
- App Listening thật + API giả:1440/390/320px, ba nhóm cùng chiều rộng, một khung/một heading chung, đủ10 ô, font16px và padding28/16px. Hai Note cũ vẫn đúng trích dẫn; qua3pulse giữ node, focus, bôi chọn, cuộn, đáp án/cờ/ghi chú.
- Checkbox:16 chuỗi stylesheet native × desktop/mobile =32 trường hợp đạt, có chọn/bỏ chọn; gồm Practice, Homework, Term, Substitute, Speaking, Writing, Progress Log và K56.
- T/F/NG so với stylesheet/markup Term1 native tại1440/390/320: font14,72px, hai cột radio/nhãn, padding10×12px desktop/9px mobile, màu viền/nền đúng cả chưa chọn/đã chọn. Không có bank hiện, không lặp số. Chuỗi chữ neo annotation cũ khớp hoàn toàn.
- Unit renderer15/15; bộ Note/Highlight hiện hành93/93. Ảnh desktop/mobile đã được xem trực quan. Không suy các phép kiểm này thành Google/AI/Docs, audio thật hoặc thiết bị vật lý đã được kiểm lại.

## Link chung đúng mã

- [Frozen Food · Buổi13](https://tranhoangduc90.github.io/izone-ai-team-pages/reading-practice/?lesson=67-practice-reading_c20_t3_p1_frozen_food)
- [C21 T2 Full Reading · Buổi16](https://tranhoangduc90.github.io/izone-ai-team-pages/reading-practice/?lesson=67-practice-reading_c21_t2_full_test)
- [Inclusive design · Buổi10](https://tranhoangduc90.github.io/izone-ai-team-pages/listening-practice/?lesson=67-practice-listening_c20_t3_p4_inclusive_design)

Dùng mã bài đầy đủ trong `lesson`; số buổi13/16 không phải alias được backend hỗ trợ. Khi kiểm từ link Homework phải mở chính URL thật, không chỉ HTTP200 của HTML.

Quay lại bằng revert commit sửa giao diện; không phục hồi database hoặc reset bài. Trạng thái phát hành lấy từ PR/build/readback của đợt này, không suy từ tài liệu.

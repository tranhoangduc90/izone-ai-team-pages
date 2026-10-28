# Demo tương tác · Scandinavian Studies

Bản xem trước độc lập để Đức duyệt hành trình sửa Listening Homework. Chưa nối đăng nhập, nộp bài, AI, Homework Docs hoặc dữ liệu học viên.

- Ba phần: Nghe và điền từ, Phân tích câu 24, Phân tích câu 25. Học viên dùng **Mục 1–22**; giữ 22 định danh V2 bên trong để bảo toàn nháp và chuẩn bị tích hợp.
- Điền từ trong câu; đáp án lựa chọn bấm cả dòng; chọn dẫn chứng trong transcript bằng bôi đen hoặc chạm từ đầu/cuối. Câu trả lời vẫn sửa được bằng tay.
- Phần nghe điền từ chỉ có gợi ý số từ, không mở transcript. Hai phần phân tích tự mở transcript; nút lấy dẫn chứng đưa tới đúng lời nói và ngữ cảnh liên quan. Transcript chỉ chứa phần dùng cho 22 mục, không phải toàn file 7:11.
- Cùng module audio Cloudflare/Pages và catalog đang phát hành. Một Blob dùng lại trong tab; nghe lại từng câu, tốc độ, âm lượng, tạm dừng, tua và lùi 5 giây. Đã bỏ nút Nghe toàn bài. Không mang giới hạn một lượt nghe/timer của bài thi vào homework.
- Tái dùng stylesheet, logo và cấu trúc component Listening thực chiến: preset Reading xám sáng–đỏ, Source Sans 3, lựa chọn A/B/C, toolbar, dock thường trực và popup đối chiếu 38/62. Desktop có hai vùng bài tập/transcript; màn hẹp chuyển vùng và đưa lại focus về ô trả lời. Notes, cỡ chữ và cờ đánh dấu đều hoạt động.
- Nháp và lịch sử riêng trong localStorage, tên khóa có `interactive-demo`; không ghi đè nháp thật. Góp ý mẫu được ghi rõ là tình huống minh họa, không chấm câu trả lời vừa nhập.

Dùng trực tiếp [bản demo trên GitHub Pages](https://tranhoangduc90.github.io/izone-ai-team-pages/listening-homework/interactive-demo/). Các đường tải tương đối hoạt động dưới prefix `/izone-ai-team-pages/`; không cần máy chủ local. `content.json` chỉ chứa câu hỏi và transcript được giao công khai trong demo; `feedback-demo.json` là một tình huống góp ý minh họa, không phải key/rubric/bộ chấm. Không có token, credential, prompt chấm hoặc dữ liệu học viên.

Thiết kế áp dụng `izone-web-design`, Master170 và các thao tác của Listening thực chiến: lựa chọn A/B/C trực tiếp, điều khiển audio thuận tiện, transcript cạnh bài, cửa sổ đối chiếu và quay lại đúng ô cần sửa. Bản demo không xác nhận kiểm chấm AI hoặc production end-to-end; trang homework đang dùng vẫn là route riêng.

Kiểm bản nâng cấp 28/10/2026: 59 kiểm tra browser trên Chrome, gồm đủ 22 mục, chọn dẫn chứng bằng bôi đen/chạm, sửa/xóa, focus, reload, lịch sử bất biến, popup, ba nhịp lưu không dựng lại DOM hoặc làm mất vùng đang đọc; các viewport 1440×1000, 1024×768, 390×844, 320×568 và 844×390. Audio thật đã tải/giải mã/phát, nghe lại dùng Blob cũ, lùi 5 giây và dừng ở cuối đoạn. Đây là kiểm demo cách ly, chưa phải nghiệm thu lớp thật hay bộ chấm.

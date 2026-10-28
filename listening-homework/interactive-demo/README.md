# Demo tương tác · Scandinavian Studies

Bản xem trước độc lập để Đức duyệt hành trình sửa Listening Homework. Chưa nối đăng nhập, nộp bài, AI, Homework Docs hoặc dữ liệu học viên.

- Ba phần: D1–D3, S1–S8, S9–S19. Giữ 22 định danh V2; các ô dẫn chứng/nhận định được ghép thành một câu trả lời cho mỗi định danh khi tích hợp.
- Điền từ trong câu; đáp án lựa chọn bấm cả dòng; chọn dẫn chứng trong transcript bằng bôi đen hoặc chạm từ đầu/cuối. Câu trả lời vẫn sửa được bằng tay.
- Transcript phần audio dùng cho 22 mục; mốc câu tham chiếu bản đối chiếu audio đã có. Không tuyên bố đã hiển thị transcript cả file 7:11.
- Cùng module audio Cloudflare/Pages và catalog đang phát hành. Một Blob dùng lại trong tab; nghe lại từng câu, tốc độ, âm lượng, tạm dừng và tua. Không mang giới hạn một lượt nghe/timer của bài thi vào homework.
- Nháp và lịch sử riêng trong localStorage, tên khóa có `interactive-demo`; không ghi đè nháp thật. Góp ý mẫu được ghi rõ là tình huống minh họa, không chấm câu trả lời vừa nhập.

Dùng trực tiếp [bản demo trên GitHub Pages](https://tranhoangduc90.github.io/izone-ai-team-pages/listening-homework/interactive-demo/). Các đường tải tương đối hoạt động dưới prefix `/izone-ai-team-pages/`; không cần máy chủ local. `content.json` chỉ chứa câu hỏi và transcript được giao công khai trong demo; `feedback-demo.json` là một tình huống góp ý minh họa, không phải key/rubric/bộ chấm. Không có token, credential, prompt chấm hoặc dữ liệu học viên.

Thiết kế áp dụng `izone-web-design`, Master170 và các thao tác của Listening thực chiến: lựa chọn A/B/C trực tiếp, điều khiển audio thuận tiện, transcript cạnh bài, cửa sổ đối chiếu và quay lại đúng ô cần sửa. Bản demo không xác nhận kiểm chấm AI hoặc production end-to-end; trang homework đang dùng vẫn là route riêng.

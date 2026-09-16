# Bản thử webapp nộp Speaking Homework Lesson 2

Mở `index.html` qua một HTTP server để xem giao diện. Ví dụ tại gốc repository: `python -m http.server 8765`, rồi mở `http://127.0.0.1:8765/speaking-homework/`.

## Phạm vi bản thử

- Có hai phần độc lập: Paraphrase và Full Speaking. Mỗi phần có hướng dẫn, link mở chatbot, ô nhập ChatGPT Share và nút **Xác nhận**.
- Nội dung hướng dẫn và chín ảnh lấy từ mẫu Homework Lesson 2: tối thiểu 5 câu Paraphrase; tối thiểu 3 câu Speaking với bước hỏi, xin gợi ý nếu cần, trả lời, nhận góp ý và nói lại câu hoàn chỉnh. Giữ hướng dẫn lấy link trên iPhone/Android và phân biệt `/share/` với `/c/`.
- Nút Xác nhận kiểm dạng link thật ở trình duyệt và mô phỏng phản hồi đọc nội dung theo tình huống được chọn. Các nhánh gồm đủ bài, thiếu bài, không mở được, đã dùng link, cùng hội thoại qua link mới, nghi vấn gõ và lỗi kỹ thuật.
- Nghi vấn gõ là cảnh báo mềm: học viên xác nhận đã voice chat thì phần Speaking được nhận. Chỉ sau khi cả hai phần được nhận, trang hiện trạng thái đang chấm và nút quay lại Homework.
- Dùng hai hồ sơ giả và module ghi nhớ học viên chung, nhưng khóa demo tách riêng. Không đọc roster thật, không gọi Google Classroom, ChatGPT, AI, n8n hoặc gửi email; không ghi kết quả.

## Link quay lại Homework

Khi mở trang bằng `?returnUrl=<URL-được-mã-hóa>`, nút **Quay lại Homework** chỉ nhận URL HTTPS của một Google Doc hoặc trang Classroom. Tham số được xóa khỏi thanh địa chỉ sau khi trang đọc. Nếu chưa có URL an toàn, nút không hoạt động; bản vận hành sẽ nhận link bản Homework của đúng học viên từ máy chủ sau khi xác thực.

## Việc cần nối trước khi dùng thật

1. Xác thực tài khoản Google và đối chiếu đúng học viên, lớp, bài Classroom; danh sách nhớ trên thiết bị chỉ giúp chọn sẵn.
2. Máy chủ/n8n đọc từng ChatGPT Share, gọi AI kiểm số lượng và đúng bước luyện, trả cảnh báo nghi gõ kèm bằng chứng phù hợp. Không coi lỗi chính tả hay việc thiếu metadata âm thanh là bằng chứng chắc chắn học viên gõ.
3. Đối chiếu URL và nội dung hội thoại với lịch sử nộp; chỉ chặn khi có bằng chứng đủ chắc. Lưu biên nhận nộp, xác nhận voice và khóa chống nộp/chấm trùng.
4. Sau khi cả hai phần hợp lệ, khởi chạy chấm ngay. Chỉ báo hoàn thành sau khi đọc lại kết quả ghi đích. Nút quay lại mở đúng file Homework của học viên.
5. Nhánh email theo lịch chỉ tổng hợp bài Classroom hiện `TURNED_IN` nhưng chưa có biên nhận webapp hợp lệ; cùng ca không báo lặp. Email dẫn tới `StudentSubmission.alternateLink` của đúng bài.

Không đưa link, nội dung hội thoại, tên hoặc mã học viên thật vào repository, ảnh kiểm thử hay bản phát hành công khai.

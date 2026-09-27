# Bản thử webapp nộp Speaking Homework Lesson 2

Tại gốc repository, chạy `node speaking-homework/server.mjs`, rồi mở `http://127.0.0.1:8765/speaking-homework/`. Máy chủ chỉ nghe trên `127.0.0.1`. Không mở riêng `index.html` hoặc chạy server tĩnh: nút **Xác nhận** cần tuyến kiểm nội dung.

## Phạm vi bản thử

- Có hai phần độc lập: Paraphrase và Full Speaking. Mỗi phần có hướng dẫn, link mở chatbot, ô nhập ChatGPT Share và nút **Xác nhận**.
- Nội dung hướng dẫn và đủ chín ảnh từ mẫu Homework Lesson 2 luôn hiện trên trang: tối thiểu 5 câu Paraphrase; tối thiểu 3 câu Speaking có hỏi, trả lời, nhận góp ý và nói lại câu hoàn chỉnh. Có hướng dẫn iPhone, Android và phân biệt `/share/` với `/c/`.
- Sau khi bấm **Xác nhận** ở mỗi phần, máy chủ gọi bộ đọc ChatGPT Share có sẵn trên máy và gửi hội thoại đã đọc tới Gemini 3.1 Flash Lite. Kết quả dựa trên các lượt chat có dẫn chứng bằng chỉ số, không dùng lựa chọn tình huống mô phỏng. Lỗi đọc hoặc lỗi AI đều không được nhận bài.
- Nếu hai link có nội dung hội thoại giống hệt, trang chặn việc dùng cùng hội thoại cho hai phần.
- Nghi vấn gõ là cảnh báo mềm: học viên xác nhận đã voice chat thì phần Speaking được nhận. Khi hai phần qua bước kiểm, trang hiện thông báo đã kiểm và nút quay lại Homework; bản xem trước chưa chấm thật.
- Dùng hai hồ sơ giả và module ghi nhớ học viên chung, nhưng khóa demo tách riêng. Có đọc ChatGPT Share và gọi Gemini dispatcher; không đọc roster thật, không gọi Google Classroom, không gửi email hoặc ghi kết quả/chạy chấm production.

## Link quay lại Homework

Khi mở trang bằng `?returnUrl=<URL-được-mã-hóa>`, nút **Quay lại Homework** chỉ nhận URL HTTPS của một Google Doc hoặc trang Classroom. Tham số được xóa khỏi thanh địa chỉ sau khi trang đọc. Nếu chưa có URL an toàn, nút không hoạt động; bản vận hành sẽ nhận link bản Homework của đúng học viên từ máy chủ sau khi xác thực.

## Việc cần nối trước khi dùng thật

1. Xác thực tài khoản Google và đối chiếu đúng học viên, lớp, bài Classroom; danh sách nhớ trên thiết bị chỉ giúp chọn sẵn.
2. Đưa bộ kiểm hiện chạy local lên backend có xác thực, hạn mức, lưu trạng thái và kiểm sức chịu tải; kiểm lại độ chính xác AI trên bộ ca thật trước khi mở cho học viên. Không coi lỗi chính tả hay việc thiếu metadata âm thanh là bằng chứng chắc chắn học viên gõ.
3. Đối chiếu URL và nội dung hội thoại với lịch sử nộp ở mọi bài; bản thử mới chỉ so hai phần trong cùng phiên. Lưu biên nhận nộp, xác nhận voice và khóa chống nộp/chấm trùng.
4. Sau khi cả hai phần hợp lệ, khởi chạy chấm ngay. Chỉ báo hoàn thành sau khi đọc lại kết quả ghi đích. Nút quay lại mở đúng file Homework của học viên.
5. Nhánh email theo lịch chỉ tổng hợp bài Classroom hiện `TURNED_IN` nhưng chưa có biên nhận webapp hợp lệ; cùng ca không báo lặp. Email dẫn tới `StudentSubmission.alternateLink` của đúng bài.

Hội thoại đi qua Gemini dispatcher theo yêu cầu kiểm AI; mỗi lần thử có thể tốn quota. Không đưa link, nội dung hội thoại, tên hoặc mã học viên thật vào repository, ảnh kiểm thử hay bản phát hành công khai.

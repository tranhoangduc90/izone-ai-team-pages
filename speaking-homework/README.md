# Bản xem Speaking Homework · IC2304

## Lesson 3 trên GitHub Pages

Mở `lesson-3.html` để xem bốn phần của Homework Lesson 3: Làm rõ cấp 1, 2, 3 và Freestyle. Bản Pages chỉ dùng hai hồ sơ giả và kết quả kiểm mô phỏng, có đủ hình hướng dẫn, cảnh báo voice chat, danh sách Bác sĩ AI mẫu (năm bài đầu và nút xem tất cả) và hai ô link luyện bổ trợ. Trang **không gửi link đi kiểm, không nhận bài thật, không tạo biên nhận và không ghi Google Docs**. Lesson 3 chưa được giao trong Classroom IC2304.

Muốn kiểm nội dung ChatGPT Share bằng bộ đọc local, chạy server bên dưới rồi mở `lesson-3.html` qua localhost. Đây vẫn là bản thử và không ghi bài nộp.

## Bản thử Lesson 2 trên máy

Tại gốc repository, chạy `node speaking-homework/server.mjs`, rồi mở `http://127.0.0.1:8765/speaking-homework/`. Máy chủ chỉ nghe trên `127.0.0.1`. Không mở riêng `index.html` hoặc chạy server tĩnh: nút **Xác nhận** cần tuyến kiểm nội dung.

## Phạm vi bản thử

- Có hai phần độc lập: Paraphrase và Full Speaking. Nút mở chatbot được đặt ngay trên ô nhập của từng phần. Nút hướng dẫn trên ô Paraphrase mở hộp thoại, đóng bằng X, nút Đóng, Escape hoặc bấm ngoài.
- Hộp hướng dẫn có đủ chín ảnh từ mẫu Homework Lesson 2, mỗi ảnh rộng bằng vùng hướng dẫn; iPhone xếp trước Android. Nội dung bài: tối thiểu 5 câu Paraphrase; tối thiểu 3 câu Speaking có hỏi, trả lời, nhận góp ý và nói lại câu hoàn chỉnh.
- Sau khi bấm **Xác nhận** ở mỗi phần, máy chủ gọi bộ đọc ChatGPT Share có sẵn trên máy và gửi hội thoại đã đọc tới Gemini 3.1 Flash Lite. Kết quả dựa trên các lượt chat có dẫn chứng bằng chỉ số, không dùng lựa chọn tình huống mô phỏng. Lỗi đọc hoặc lỗi AI đều không được nhận bài.
- Nếu hai link có nội dung hội thoại giống hệt, trang chặn việc dùng cùng hội thoại cho hai phần.
- Nghi vấn gõ là cảnh báo mềm: học viên xác nhận đã voice chat thì phần Speaking được nhận. Khi hai phần qua bước kiểm, trang hiện thông báo đã kiểm và nút quay lại Homework; bản xem trước chưa chấm thật.
- Dùng hai hồ sơ giả IC2304 và module ghi nhớ học viên chung, nhưng khóa demo tách riêng. Link nhập dở được giữ cục bộ theo hồ sơ giả; khi mở lại cần bấm Xác nhận để kiểm lại. Trình duyệt cảnh báo nếu rời trang khi chưa đủ hai phần, tùy khả năng hỗ trợ của browser. Có đọc ChatGPT Share và gọi Gemini dispatcher; không đọc roster thật, không tra trùng lịch sử, không gọi Google Classroom, không gửi email hoặc ghi kết quả/chạy chấm production.

Kế hoạch xây dựng kết nối thật và thí điểm IC2304: [PLAN-IC2304.md](PLAN-IC2304.md).

## Link quay lại Homework

Khi mở trang bằng `?returnUrl=<URL-được-mã-hóa>`, nút **Quay lại Homework** chỉ nhận URL HTTPS của một Google Doc hoặc trang Classroom. Tham số được xóa khỏi thanh địa chỉ sau khi trang đọc. Nếu chưa có URL an toàn, nút không hoạt động; bản vận hành sẽ nhận link bản Homework của đúng học viên từ máy chủ sau khi xác thực.

## Việc cần nối trước khi dùng thật

1. Xác thực tài khoản Google và đối chiếu đúng học viên, lớp, bài Classroom; danh sách nhớ trên thiết bị chỉ giúp chọn sẵn.
2. Đưa bộ kiểm hiện chạy local lên backend có xác thực, hạn mức, lưu trạng thái và kiểm sức chịu tải; kiểm lại độ chính xác AI trên bộ ca thật trước khi mở cho học viên. Không coi lỗi chính tả hay việc thiếu metadata âm thanh là bằng chứng chắc chắn học viên gõ.
3. Đối chiếu URL và nội dung hội thoại với lịch sử nộp ở mọi bài; bản thử mới chỉ so hai phần trong cùng phiên. Lưu biên nhận nộp, xác nhận voice và khóa chống nộp/chấm trùng.
4. Sau khi cả hai phần hợp lệ, khởi chạy chấm ngay. Chỉ báo hoàn thành sau khi đọc lại kết quả ghi đích. Nút quay lại mở đúng file Homework của học viên.
5. Nhánh email theo lịch chỉ tổng hợp bài Classroom hiện `TURNED_IN` nhưng chưa có biên nhận webapp hợp lệ; cùng ca không báo lặp. Email dẫn tới `StudentSubmission.alternateLink` của đúng bài.

Hội thoại đi qua Gemini dispatcher theo yêu cầu kiểm AI; mỗi lần thử có thể tốn quota. Không đưa link, nội dung hội thoại, tên hoặc mã học viên thật vào repository, ảnh kiểm thử hay bản phát hành công khai.

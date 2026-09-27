# Speaking Homework · IC2304

## Lesson 3 trên GitHub Pages

Mở `lesson-3.html` từ nút trong đúng file Homework của học viên. URL phải chứa `documentId`, `class=IC2304` và `assignmentCode=67-speaking-lam_ro`. Trang tải danh sách học viên đã duyệt từ API Speaking và dùng khóa ghi nhớ UUID chung với Writing/Term Test. Bốn phần của Lesson 3 là Làm rõ cấp 1, 2, 3 và Freestyle. Mỗi phần có ô link riêng; bấm **Xác nhận** sẽ gửi link ChatGPT Share đến API để đọc và kiểm nội dung. Chỉ khi bốn link được xác nhận hợp lệ, API mới tạo biên nhận và đưa việc ghi Google Docs/chấm bài vào hàng chờ. **Lesson 3 không có Bác sĩ AI.**

Nếu bài Classroom chưa mở hoặc bản Google Doc của học viên chưa được gắn vào bài, API sẽ từ chối mở phiên và không nhận bài. Học viên vẫn có thể xem giao diện công khai trên GitHub Pages; việc xem trang không có nghĩa là bài đã mở nộp.

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

## Vận hành Lesson 3

API lưu trạng thái kiểm link và biên nhận trong database mapping. Tác vụ nền đọc ChatGPT Share, kiểm khối lượng và dấu hiệu nhập chữ; cảnh báo nhập chữ cho phép học viên xác nhận đã luyện nói. Luồng n8n ghi biên nhận vào đúng bản Google Doc sau khi đối chiếu Doc ID. Luồng theo lịch chỉ gom các bài Classroom còn ở trạng thái **Đã nộp** mà chưa có biên nhận Speaking, rồi gửi một email cho giảng viên. Trang `teacher.html?receipt=<UUID>` dùng phiên đăng nhập Google của giảng viên để mở bản chỉ đọc.

Trang hiện biên nhận sau khi API đã lưu bốn link; trạng thái ghi Google Docs và chấm bài được cập nhật bất đồng bộ. Nếu tác vụ nền lỗi, trang giảng viên hiện trạng thái cần thử lại. Không đưa link hội thoại, nội dung học viên hoặc credential vào repository công khai.

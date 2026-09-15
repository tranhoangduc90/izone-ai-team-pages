# Hướng dẫn trải nghiệm Progress Log Demo

## 1. Phạm vi demo

- Lớp: **[DEMO] PROGRESS LOG · KHÓA 56**.
- Toàn bộ tên, câu trả lời, điểm và bằng chứng trong lớp này là dữ liệu giả.
- Phiếu mẫu có hai lần ghi ngắn. Giảng viên quyết định thời điểm yêu cầu học viên điền.
- Điểm danh dựa trên việc nộp đủ trường bắt buộc, không phụ thuộc AI hoặc kết quả chấm.

## 2. Trải nghiệm như học viên

Mở [phiếu học viên](https://tranhoangduc90.github.io/izone-ai-team-pages/progress-log/#assignment=20000000-0000-4000-8000-000000000302).

1. Chọn **BẠN TRẢI NGHIỆM 2**. Tên số 1 đã được dùng cho smoke test production.
2. Kiểm tra màn hình xác nhận có đúng tên, lớp và buổi 6; bấm **Đúng là em**.
3. Ở lần ghi thứ nhất, nhập kết quả rồi bấm **Nộp phần và tiếp tục**. Với phiếu mới tạo từ thư viện, kết quả dạng `8/10` được nhập bằng ô số có mẫu số cố định.
4. Ở lần ghi thứ hai, nhập một điểm còn vướng và một việc tiếp theo.
5. Bấm **Nộp phiếu và điểm danh**.

Kết quả đúng: mỗi phần được lưu thành checkpoint thật; dashboard có thể thấy học viên đã đi đến đâu. Màn hình cuối xác nhận hệ thống đã nhận đủ phiếu, trạng thái điểm danh là tự xác nhận và hiện một việc nên làm tiếp. Checkpoint chưa tự tạo điểm danh; chỉ nút nộp cuối mới làm việc đó.

## 3. Trải nghiệm như giảng viên

Mở [portal giảng viên](https://tranhoangduc90.github.io/izone-ai-team-pages/progress-log/teacher.html) và đăng nhập bằng tài khoản Google đã được cấp quyền Mapping Review.

### Tạo phiếu mới

1. Ở tab **Tạo phiếu**, chọn lớp demo và số buổi.
2. Chọn 2–3 câu từ thư viện; đặt mỗi câu vào lần ghi 1, 2 hoặc 3.
3. Bấm **Tạo link cho lớp**.
4. Mở link vừa sinh ở cửa sổ riêng để thấy roster đã được chốt theo đúng version của phiếu.

### Theo dõi và xử lý

1. Mở tab **Theo dõi lớp** và chọn **Phiếu điểm danh và ghi nhanh · Demo**.
2. Ở **Mở từng phần**, thử chuyển phần 2 sang **Chưa mở** rồi mở lại. Học viên chỉ đi tiếp khi trạng thái trong database là **Mở cho học viên**.
3. Kiểm tra tóm tắt cấp lớp và ba nhóm: đã nộp đủ, nộp thiếu, chưa nộp. Dòng đã nộp checkpoint nhưng chưa nộp cuối hiển thị số phần đã ghi nhận.
4. Với học viên nộp thiếu, bấm **Điều chỉnh**, chọn trạng thái và nhập lý do. Hệ thống lưu người thao tác và lịch sử thay đổi.
5. Tại dòng **MINH ANH DEMO · mã 03**, bấm **Xem tổng kết**.

Kết quả đúng: dashboard cho thấy 3 nguồn dữ liệu giả gồm Progress Log, Term Test và homework. Cửa sổ tổng kết tách rõ:

- **Phân tích của hệ thống**: tiến bộ, lỗi lặp lại và một việc tiếp theo, đều dựa trên bằng chứng đã gắn đúng học viên.
- **Lời nhắn thật từ giảng viên**: một câu rất ngắn, có giọng người thật; không giả nhận nội dung AI là lời của giảng viên.

Bạn có thể sửa lời nhắn, bấm **Lưu lời nhắn**, rồi mới **Đánh dấu đã gửi**. Nút cuối chỉ ghi nhận việc giảng viên đã gửi bằng kênh thủ công; nó không giả vờ đã gửi tin qua một dịch vụ bên ngoài.

Trong cùng cửa sổ, bấm **Tạo và sao chép link** để lấy link hành trình cá nhân. Link mới thay link cũ của đúng học viên; hệ thống đối chiếu cả lớp, học viên và thao tác trước khi trả link.

## 4. Trải nghiệm hành trình cả khóa

Mở [hành trình học viên demo](https://tranhoangduc90.github.io/izone-ai-team-pages/progress-log/journey.html#access=demo-progress-567-00000000-0000-4000-8000-000000000003).

Kết quả đúng:

1. Màn đầu chỉ hiển thị tóm tắt: số buổi có mặt, số phiếu hoàn tất và tổng kết gần nhất.
2. Phân tích của hệ thống và lời nhắn thật của giảng viên được tách rõ.
3. Bấm **Xem tình hình từng buổi** mới mở timeline chi tiết.
4. Không hiển thị câu trả lời thô, note nội bộ hoặc evidence chỉ được phép dùng để phân tích.

Link trên chỉ mở dữ liệu giả. Link học viên thật phải được giảng viên tạo riêng và gửi đúng người.

## 5. Dữ liệu mẫu đã chuẩn bị

| Học viên giả | Trạng thái để quan sát |
|---|---|
| BẠN TRẢI NGHIỆM 1 | Đã nộp đủ trong smoke test production |
| BẠN TRẢI NGHIỆM 2 | Chưa làm, dành cho trải nghiệm live |
| MINH ANH DEMO · mã 03 | Nộp đủ, có 3 evidence và tổng kết định kỳ |
| MINH ANH DEMO · mã 04 | Nộp thiếu, chờ giảng viên |
| HOÀNG NAM DEMO | Nộp đủ, có ví dụ giảng viên xác nhận |
| NGỌC LINH DEMO | Chưa nộp |

Hai học viên trùng tên được gắn mã phân biệt để kiểm tra hệ thống không nối nhầm dữ liệu.

## 6. Lưu ý khi demo

- Không dùng lớp demo để nhập dữ liệu thật.
- Link lớp là link tự xác nhận danh tính, không phải cơ chế chống gian lận.
- Nếu một tên **BẠN TRẢI NGHIỆM** đã được dùng, chọn tên còn lại hoặc tạo phiếu mới trong portal giảng viên.
- Nếu trang báo phiên Google hết hạn, tải lại portal và đăng nhập lại.
- Nếu submission thành công nhưng dashboard chưa đổi, bấm **Làm mới**; việc xử lý AI không chặn nộp phiếu hoặc điểm danh.
- Nếu học viên thấy **Hãy chờ giảng viên mở phần tiếp theo**, mở portal giảng viên, đổi đúng phần sang **Mở cho học viên**, rồi để học viên bấm **Kiểm tra phần tiếp theo**.

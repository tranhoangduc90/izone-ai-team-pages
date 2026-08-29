# Hướng dẫn trải nghiệm Progress Log Demo

## 1. Phạm vi demo

- Lớp: **[DEMO] PROGRESS LOG · KHÓA 56**.
- Toàn bộ tên, câu trả lời, điểm và bằng chứng trong lớp này là dữ liệu giả.
- Phiếu mẫu có hai lần ghi ngắn. Giảng viên quyết định thời điểm yêu cầu học viên điền.
- Điểm danh dựa trên việc nộp đủ trường bắt buộc, không phụ thuộc AI hoặc kết quả chấm.

## 2. Trải nghiệm như học viên

Mở [phiếu học viên](https://tranhoangduc90.github.io/izone-ai-team-pages/progress-log/#assignment=20000000-0000-4000-8000-000000000302).

1. Chọn **BẠN TRẢI NGHIỆM 1** hoặc **BẠN TRẢI NGHIỆM 2**.
2. Kiểm tra màn hình xác nhận có đúng tên, lớp và buổi 6; bấm **Đúng là em**.
3. Ở lần ghi thứ nhất, nhập kết quả ngắn, ví dụ `8/10`, rồi chuyển tiếp.
4. Ở lần ghi thứ hai, nhập một điểm còn vướng và một việc tiếp theo.
5. Bấm **Nộp phiếu và điểm danh**.

Kết quả đúng: màn hình xác nhận hệ thống đã nhận đủ phiếu, trạng thái điểm danh là tự xác nhận và hiện một việc nên làm tiếp. Nếu cố tình để thiếu mục bắt buộc, phiếu vẫn được lưu nhưng điểm danh chuyển sang **Chờ giảng viên**.

## 3. Trải nghiệm như giảng viên

Mở [portal giảng viên](https://tranhoangduc90.github.io/izone-ai-team-pages/progress-log/teacher.html) và đăng nhập bằng tài khoản Google đã được cấp quyền Mapping Review.

### Tạo phiếu mới

1. Ở tab **Tạo phiếu**, chọn lớp demo và số buổi.
2. Chọn 2–3 câu từ thư viện; đặt mỗi câu vào lần ghi 1, 2 hoặc 3.
3. Bấm **Tạo link cho lớp**.
4. Mở link vừa sinh ở cửa sổ riêng để thấy roster đã được chốt theo đúng version của phiếu.

### Theo dõi và xử lý

1. Mở tab **Theo dõi lớp** và chọn **Phiếu điểm danh và ghi nhanh · Demo**.
2. Kiểm tra ba nhóm: đã nộp đủ, nộp thiếu và chưa nộp.
3. Với học viên nộp thiếu, bấm **Điều chỉnh**, chọn trạng thái và nhập lý do. Hệ thống lưu người thao tác và lịch sử thay đổi.
4. Tại dòng **MINH ANH DEMO · mã 03**, bấm **Xem tổng kết**.

Kết quả đúng: dashboard cho thấy 3 nguồn dữ liệu giả gồm Progress Log, Term Test và homework. Cửa sổ tổng kết tách rõ:

- **Phân tích của hệ thống**: tiến bộ, lỗi lặp lại và một việc tiếp theo, đều dựa trên bằng chứng đã gắn đúng học viên.
- **Lời nhắn thật từ giảng viên**: một câu rất ngắn, có giọng người thật; không giả nhận nội dung AI là lời của giảng viên.

## 4. Dữ liệu mẫu đã chuẩn bị

| Học viên giả | Trạng thái để quan sát |
|---|---|
| BẠN TRẢI NGHIỆM 1–2 | Chưa làm, dành cho trải nghiệm live |
| MINH ANH DEMO · mã 03 | Nộp đủ, có 3 evidence và tổng kết định kỳ |
| MINH ANH DEMO · mã 04 | Nộp thiếu, chờ giảng viên |
| HOÀNG NAM DEMO | Nộp đủ, có ví dụ giảng viên xác nhận |
| NGỌC LINH DEMO | Chưa nộp |

Hai học viên trùng tên được gắn mã phân biệt để kiểm tra hệ thống không nối nhầm dữ liệu.

## 5. Lưu ý khi demo

- Không dùng lớp demo để nhập dữ liệu thật.
- Link lớp là link tự xác nhận danh tính, không phải cơ chế chống gian lận.
- Nếu một tên **BẠN TRẢI NGHIỆM** đã được dùng, chọn tên còn lại hoặc tạo phiếu mới trong portal giảng viên.
- Nếu trang báo phiên Google hết hạn, tải lại portal và đăng nhập lại.
- Nếu submission thành công nhưng dashboard chưa đổi, bấm **Làm mới**; việc xử lý AI không chặn nộp phiếu hoặc điểm danh.

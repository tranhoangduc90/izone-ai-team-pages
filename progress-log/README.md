# Progress Log — giao diện tĩnh

Hai trang dùng chung API backend:

- `index.html`: học viên chọn tên, xác nhận, điền và nộp từng checkpoint; chỉ lần nộp cuối mới quyết định điểm danh.
- `journey.html`: học viên mở link cá nhân để xem tổng kết gần nhất và tình hình từng buổi trong cả khóa.
- `teacher.html`: giảng viên chọn câu hỏi từ thư viện, mở/khóa từng phần, theo dõi checkpoint, điểm danh, insight cấp lớp và tổng kết cá nhân.

Các câu nhập kết quả như `8/10` dùng object `{ correct, total }`, không dùng chuỗi tự do. Nội dung học viên ghi lại từ lời giảng viên có nhãn `student_reported_teacher_feedback`; chỉ nội dung được chính giảng viên lưu ở portal mới là lời nhắn thật của giảng viên.

Link học viên có dạng `https://<pages-host>/progress-log/#assignment=<public-token>`. Token đặt trong fragment để trình duyệt không gửi nó vào request GitHub Pages.

Link hành trình cũng đặt token sau dấu `#`. Giảng viên tạo link trong cửa sổ tổng kết; máy chủ chỉ lưu hash, link mới thay link cũ và dữ liệu trả về chỉ gồm báo cáo đã công bố cùng thống kê an toàn cho học viên.

## Chạy thử local

Từ thư mục gốc snapshot, chạy:

```bash
bash ./run-local.sh
```

Script chỉ phục vụ file frontend tại `http://127.0.0.1:8090/term-tests/`; trang gọi
`https://ducizone.ddns.net/mapping-api`, và backend production mới kết nối database trên VPS.
Không khởi động backend hoặc database local cho luồng này.

Backend production phải cho phép origin `http://127.0.0.1:8090` trong `ALLOWED_ORIGINS`; nếu
không, trình duyệt sẽ chặn CORS.

## Kiểm thử

Lệnh này đọc HTML/JavaScript và kiểm các guard bảo mật chính. Khi lỗi, Node nêu rule bị vi phạm; không thay đổi file hoặc gọi API.

```powershell
node --test tests/progress-log-static.mjs
```

Không publish trước khi backend staging đã bật schema `learning`; nếu publish sớm, trang thật sẽ chỉ báo API chưa sẵn sàng.

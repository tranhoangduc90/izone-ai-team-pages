# Progress Log — giao diện tĩnh

Hai trang dùng chung API backend:

- `index.html`: học viên chọn tên, xác nhận, điền checkpoint, autosave và nộp.
- `teacher.html`: giảng viên đăng nhập Google, chọn câu hỏi từ thư viện, tạo link và theo dõi điểm danh.

Link học viên có dạng `https://<pages-host>/progress-log/#assignment=<public-token>`. Token đặt trong fragment để trình duyệt không gửi nó vào request GitHub Pages.

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

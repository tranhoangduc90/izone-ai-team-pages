# Progress Log — giao diện tĩnh

Hai trang dùng chung API backend:

- `index.html`: học viên chọn tên, xác nhận, điền checkpoint, autosave và nộp.
- `teacher.html`: giảng viên đăng nhập Google, chọn câu hỏi từ thư viện, tạo link và theo dõi điểm danh.

Link học viên có dạng `https://<pages-host>/progress-log/#assignment=<public-token>`. Token đặt trong fragment để trình duyệt không gửi nó vào request GitHub Pages.

## Chạy thử local

Lệnh dưới chỉ mở static server trên máy. Giao diện sẽ gọi API cùng origin; muốn chạy trọn luồng cần reverse proxy hoặc mock API local.

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Sau đó mở `http://127.0.0.1:4173/progress-log/`.

## Kiểm thử

Lệnh này đọc HTML/JavaScript và kiểm các guard bảo mật chính. Khi lỗi, Node nêu rule bị vi phạm; không thay đổi file hoặc gọi API.

```powershell
node --test tests/progress-log-static.mjs
```

Không publish trước khi backend staging đã bật schema `learning`; nếu publish sớm, trang thật sẽ chỉ báo API chưa sẵn sàng.

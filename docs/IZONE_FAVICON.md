# Favicon chung cho GitHub Pages

Nguồn: Đức yêu cầu ngày 05/11/2026 trong chat triển khai Thẻ 26: áp dụng icon logo đang dùng ở Progress Log cho mọi web trong GitHub Pages và ghi nhớ cho các lần sau.

Asset chuẩn là [`shared/izone-favicon.svg`](../shared/izone-favicon.svg), sao nguyên artwork từ `progress-log/favicon.svg`. Đây là biểu tượng trên tab trình duyệt. Giữ logo trong nội dung, theme, bố cục, phiên đăng nhập, nháp và nghiệp vụ của từng sản phẩm.

Mỗi tài liệu HTML hoàn chỉnh dùng đúng một thẻ icon SVG trong phần head. Ví dụ trang sâu một thư mục:

```html
<link rel="icon" type="image/svg+xml" href="../shared/izone-favicon.svg?v=20261105">
```

Đường dẫn phải tính theo URL thực và thẻ `<base>` nếu có. Trang sâu hơn cần thêm `../`; trang gốc dùng `shared/izone-favicon.svg`. Khi tạo lesson, trang giảng viên, demo hoặc sửa template sinh HTML, kế thừa cùng asset. Không dùng favicon rỗng `data:,`, icon chữ hoặc biểu tượng khác.

Các file body được nhúng vào trang chủ không tự khai báo favicon. Fixture trong `tests/` không phải trang sản phẩm. Gói `progress-log/releases/<version>/` đã phát giữ nguyên byte; build gói mới để thay đổi icon, giữ gói cũ cho tab đang làm bài và quay lui.

Kiểm toàn bộ tài liệu hiện hành, đường dẫn có base, artwork và HTML trong release đang trỏ tới:

```powershell
python tools/check-izone-favicon.py
```

Công cụ chỉ đọc file. Sau phát hành, kiểm thêm URL favicon thật và trình duyệt; việc checker đạt không tự chứng minh Pages đã nhận bản mới.

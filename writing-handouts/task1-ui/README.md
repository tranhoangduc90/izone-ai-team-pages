# Giao diện sáu handout SW Task 1

Kế thừa bản Earnings Đức đã chốt ngày25/10/2026 và mẫu SW Task2. `js/task1-ui-loader.js` chỉ chọn sáu slug trong `task1-ui-routing.js`; mọi slug khác đi controller cũ. Template/style chỉ thay trong trang đã chọn, không thay URL, config, manifest, backend, DB nháp hoặc thư viện nhận diện chung. Các controller mới nằm cạnh controller cũ trong `../js/` để giữ đường import shared hiện hành.

`source-lock.json` giữ nguồn ghim của Earnings tại lúc dựng mẫu, không phải cấu hình runtime. `reference/` là CSS/font/logo đã ghim; `legacy.css` chỉ là lớp nền trong adapter mới. `student.html`/`teacher.html` được loader gắn vào URL hiện hành; không dùng chúng như trang độc lập. Không đưa dữ liệu hoặc prompt thật vào thư mục public này.

Đường kiểm cách ly: `/task1-ui-stage-20261025/` dùng API thử và tắt ghi nhớ danh tính chung. API production vẫn lấy từ `writing-handouts/config.json`; kho IndexedDB production giữ tên và khóa cũ. Đường thử dùng UUID lớp/hồ sơ thử nên không ghi đè bài lớp thật.

Quay UI: hoàn tác thay đổi hai script entrypoint về controller cũ; giữ toàn bộ source/API/DB hiện hành và bài mới. Không restore DB hoặc mở lại nguồn Writing cũ đã khóa ghi.

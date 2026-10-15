# Reading Homework · Buổi 7

Frontend của bài `67-practice-reading_matching_heading_mcq`. Giữ giao diện demo đã được Đức duyệt ngày 12/10/2026: preset Reading xám sáng–đỏ, Matching Headings, MCQ, Summary Completion, highlight/note và một bảng Đáp án và giải thích.

- Đề chỉ tải từ API sau khi bắt đầu; không có khóa chấm hoặc lời giải trong thư mục public.
- Nháp trên thiết bị giúp phục hồi; máy chủ giữ lượt làm, thời gian và điểm chính thức.
- Link học viên được tạo riêng cho bản Docs và UUID; không dùng một link chung để đổi chủ bài.
- `teacher.html#submission=...` yêu cầu Google và quyền lớp; chỉ đọc lượt đã nộp.
- Giảng viên chọn **Tự đăng nhập Google trên thiết bị này** để khôi phục phiên khi mở tab mới hoặc mở lại trình duyệt. Cookie HttpOnly riêng của Reading giữ 90 ngày không hoạt động, tối đa 365 ngày; bỏ chọn chỉ mở phiên một giờ. **Đăng xuất** thu hồi phiên và xóa bản xem trong các tab đang mở.
- API production dự kiến trong `config.js` chưa được coi là đã hoạt động cho tới khi phát hành và readback. Local dùng `/api`.

Nguồn UI được ghim từ demo `reading-practice-buoi7-demo-20261012`, theo Term Test Reading đã duyệt. CSS/fonts/annotation adapter chép riêng để phát hành Reading không đổi giao diện sản phẩm khác. Backend độc lập nằm trong repository `izone-classroom-mapping-review`, `products/reading-practice`.

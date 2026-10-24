# Reading Homework · Khóa 67

Frontend dùng chung cho buổi 7 (`67-practice-reading_matching_heading_mcq`, câu 14–26) và buổi 9 (`67-practice-reading_matching_names_sentence_endings_mcq`, câu 27–40). API trả metadata bài trước khi bắt đầu, đề khi mở lượt và lời giải sau khi nộp. Metadata quyết định tiêu đề, số câu, điều hướng và nhóm điểm; API cũ thiếu metadata vẫn hiển thị buổi 7.

Giữ preset Reading xám sáng–đỏ, highlight/note và popup đối chiếu 38% bài đọc / 62% lời giải. Buổi 9 thêm Matching Names, Sentence Endings, bốn MCQ và nhiều dẫn chứng trong cùng popup; các màu nội dung giữ theo nguồn, độc lập với màu giao diện. `lesson9.css` chỉ áp dụng khi API xác định bài mới.

- Đề chỉ tải từ API sau khi bắt đầu; không có khóa chấm hoặc lời giải trong thư mục public.
- Nháp trên thiết bị giúp phục hồi; máy chủ giữ lượt làm, thời gian và điểm chính thức.
- Link học viên được tạo riêng cho bản Docs và UUID; không dùng một link chung để đổi chủ bài.
- `teacher.html#submission=...` yêu cầu Google và quyền lớp; chỉ đọc lượt đã nộp.
- Giảng viên chọn **Tự đăng nhập Google trên thiết bị này** để khôi phục phiên khi mở tab mới hoặc mở lại trình duyệt. Cookie HttpOnly riêng của Reading giữ 90 ngày không hoạt động, tối đa 365 ngày; bỏ chọn chỉ mở phiên một giờ. **Đăng xuất** thu hồi phiên và xóa bản xem trong các tab đang mở.
- API production dự kiến trong `config.js` chưa được coi là đã hoạt động cho tới khi phát hành và readback. Local dùng `/api`.

Nguồn UI được ghim từ demo `reading-practice-buoi7-demo-20261012`, theo Term Test Reading đã duyệt. CSS/fonts/annotation adapter chép riêng để phát hành Reading không đổi giao diện sản phẩm khác. Backend độc lập nằm trong repository `izone-classroom-mapping-review`, `products/reading-practice`.

Trong master170, màn cao tối đa 700px giữ khung làm bài tối thiểu 720px (800px nếu có thanh audio) và cho trang cuộn, để toolbar/điều hướng không làm vùng đọc hoặc câu hỏi biến mất. Khoảng cuộn cuối trang giữ focus cách footer cố định. Quy tắc chỉ áp dụng khi đang mở vùng làm bài Reading/Listening; không đổi timer, câu hỏi, popup lời giải hoặc handler.

Hồi quy bố cục: chạy `node tests/practice-short-viewport-browser.mjs` từ root Pages, với `PLAYWRIGHT_MODULE` trỏ tới file `index.mjs` của Playwright. Bộ thử dùng CSS thật và hai fixture HTML đã bỏ đề, key, media, API và định danh thật; kiểm vùng đọc, cuộn và focus ở tám viewport, hai cỡ chữ. Kết quả nằm trong `output/playwright/practice-short-viewport/` hoặc thư mục `PRACTICE_VIEWPORT_EVIDENCE_DIR`. Đây là kiểm bố cục; kiểm ứng dụng/API thật là bằng chứng riêng.

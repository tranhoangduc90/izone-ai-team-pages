# Trang gắn link CTA khóa 67

Mở trang, nhập mã truy cập nội bộ, dán tối đa 20 link Google Docs rồi bấm **Gắn link CTA**. Trang gửi Doc ID đến workflow n8n. Workflow tìm bài nộp gốc trong Lark và chuyển file sang luồng gắn link Reading/Listening khóa 67 đang có. Bấm **Kiểm tra kết quả** để xem mã CTA đã được ghi trong Lark.

Trang GitHub Pages là mã công khai. Nó không chứa khóa truy cập, token Google, nội dung Docs hay dữ liệu học viên. Mã truy cập chỉ nằm ở ô nhập trong phiên trang hiện tại. Trang dùng mã đó để ký nội dung yêu cầu bằng HMAC SHA-256, gửi chữ ký có hạn thời gian qua HTTPS; không gửi mã nguyên văn và không lưu vào localStorage hoặc sessionStorage. Mất phản hồi được hiển thị là **Cần đối soát**; kiểm tra trạng thái trước khi gửi lại.

Các trường hợp chưa có bài nộp trong bảng Lark nguồn, bài nộp trùng, link sai hoặc chưa thấy đăng ký đều có trạng thái riêng. **Lark đã ghi nhận CTA** nghĩa là đã thấy ít nhất một mã Reading/Listening cùng Doc ID và URL đích hợp lệ trong registry. Nếu một Docs chứa hai CTA, xem danh sách mã hiện ra để biết mã nào đã ghi nhận; trạng thái này không thay cho việc mở Docs kiểm tra trực quan khi nghiệm thu.

Backend cần có webhook **POST /cta-link-batch/submit** và **POST /cta-link-batch/status** nhận **text/plain**. Cách gửi này không cần yêu cầu OPTIONS; thử thật đã xác nhận OPTIONS trên máy chủ hiện trả HTTP 500. Workflow thử đã trả 200 với chữ ký đúng, 401 với chữ ký sai, đều có CORS cho origin GitHub Pages. Backend chính cần kiểm chữ ký từ mã riêng lưu ở Redis và chỉ chấp nhận yêu cầu trong 5 phút. Trước khi phát hành, cần thử hai webhook chính và đọc lại kết quả trong Docs/Lark bằng một tài liệu được phép.

Kiểm tra cục bộ: chạy **node tests/cta-link-67.test.mjs** từ gốc repo Pages; mở thư mục này qua HTTP server để kiểm bố cục và lỗi trình duyệt. Khi workflow chưa được phát hành, trang chỉ nên ở branch để review.

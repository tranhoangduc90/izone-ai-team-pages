# Trang gắn link CTA khóa 67

Mở trang, dán tối đa 20 link Google Docs rồi bấm **Gắn link CTA**. Trang gửi Doc ID đến workflow n8n. Workflow tìm bài nộp gốc trong Lark và chuyển file sang luồng gắn link Reading/Listening khóa 67 đang có. Bấm **Kiểm tra kết quả** để xem mã CTA đã được ghi trong Lark.

Trang không yêu cầu mã truy cập. Bất kỳ ai có link trang và link Docs thuộc nguồn khóa 67 đều có thể gửi yêu cầu; hãy chia sẻ link sử dụng trong nhóm vận hành phù hợp. Trang không chứa token Google, nội dung Docs hay dữ liệu định danh học viên. Mất phản hồi được hiển thị là **Cần đối soát**; kiểm tra trạng thái trước khi gửi lại.

Các trường hợp chưa có bài nộp trong bảng Lark nguồn, bài nộp trùng, link sai hoặc chưa thấy đăng ký đều có trạng thái riêng. **Lark đã ghi nhận CTA** nghĩa là đã thấy ít nhất một mã Reading/Listening cùng Doc ID và URL đích hợp lệ trong registry. Nếu một Docs chứa hai CTA, xem danh sách mã hiện ra để biết mã nào đã ghi nhận; trạng thái này không thay cho việc mở Docs kiểm tra trực quan khi nghiệm thu.

Backend có hai webhook **POST /cta-link-batch/submit** và **POST /cta-link-batch/status** nhận **text/plain** chứa `{"docs":[{"docId":"..."}]}`. Cách gửi này không cần yêu cầu OPTIONS; máy chủ từng trả HTTP 500 cho OPTIONS. Workflow chỉ gửi queue khóa 67 sau khi tìm đúng một bản ghi nguồn khớp URL Docs đầy đủ.

Kiểm tra cục bộ: chạy **node tests/cta-link-67.test.mjs** từ gốc repo Pages; sau phát hành mở URL thật và kiểm yêu cầu trong trình duyệt.

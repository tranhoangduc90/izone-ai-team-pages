# Trang gắn link CTA khóa 67

Mở trang, dán tối đa 20 link Google Docs rồi bấm **Gắn link CTA**. Backend tìm bản nộp Classroom đã xác minh và phát việc cho lớp đang do backend xử lý. Bấm **Kiểm tra kết quả** để đọc trạng thái và các mã CTA đã xác minh.

Hai thao tác dùng phiên giảng viên IZONE và quyền vận hành CTA do máy chủ xác minh. Khi thiếu phiên, mở trang đăng nhập giảng viên từ đường dẫn cạnh thông báo. Mất phản hồi được hiển thị là **Cần đối soát**. Bấm kiểm tra trạng thái trước khi gửi lại.

Trang hiển thị riêng các trạng thái chưa tìm thấy bản nộp, nhiều bản nộp khớp, lớp đang ở tuyến cũ và CTA cần đối soát. Nếu một Docs chứa hai bài, đọc danh sách mã rồi kiểm link và quyền vào từng bài khi nghiệm thu.

Backend nhận JSON `{"docs":[{"docId":"..."}]}` tại `POST /operator/cta/submit` và `POST /operator/cta/status`. Gateway chuyển cả OPTIONS và POST cho hai path. Trình duyệt gửi kèm cookie phiên và `X-Izone-Csrf: 1`.

Chỉ phát hành trang sau khi gateway, phiên SSO, quyền người vận hành và trạng thái từng Docs đã được kiểm trên hai path ở HTTPS thật. Giữ SHA của phiên bản Pages đang chạy và hai webhook n8n trước khi chuyển. Nếu quay lui CTA, trả quyền xử lý lớp về n8n trước khi đưa trang quay lại hai webhook cũ.

Chạy `node tests/cta-link-67.test.mjs` từ gốc repo Pages. Sau phát hành kiểm bằng trình duyệt ở URL thật.

Lỗi mạng fetch và phản hồi JSON không đọc được có thông báo tiếng Việt; lỗi
HTTP, đối chiếu Doc ID và thời gian chờ giữ nguyên. Khi gửi chưa xác nhận,
trang giữ từng Doc ở trạng thái cần đối soát; lỗi đọc trạng thái giữ kết quả cũ
và nhắc rõ trạng thái đang hiển thị chưa được cập nhật.
`tests/cta-recovery-copy-browser.mjs` kiểm bằng webhook giả; dùng
`CTA_RECOVERY_EVIDENCE_DIR` để lưu bằng chứng ngoài source. Không dùng kiểm UI
để kết luận đã ghi Docs/Lark thật.

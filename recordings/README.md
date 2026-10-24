# Recording Automation — trạng thái giao diện

Giao diện dùng master #170. Nhãn làm mới, dữ liệu đã đọc và dữ liệu đối soát chưa đầy đủ có màu theo vai trò; số lớp chưa xác minh hiện `—`. Khi tải lỗi mà còn số liệu, lịch học hoặc lịch sử từ lần trước, thông báo nói rõ đó là bản tải trước. Tải lại lịch sử thành công xóa trạng thái lỗi cũ.

Các thay đổi ngày 24/10/2026 chỉ ở phần hiển thị. Giữ API, xác thực, quyền, dữ liệu, bộ lọc, nhịp làm mới 60 giây và các hành vi duyệt, đổi tên, đăng video, xem trước hay dọn file. Không triển khai backend hoặc ghi dữ liệu nghiệp vụ khi kiểm UI.

Kiểm hồi quy bằng `tests/recording-status-browser.mjs`: đặt `PLAYWRIGHT_MODULE` và `RECORDING_STATUS_EVIDENCE_DIR` ra ngoài repo rồi chạy bằng Node. Có thể chọn `RECORDING_STATUS_REVISION` để dùng source Git hoặc `RECORDING_STATUS_PUBLIC_BASE` để lấy asset Pages. Bộ 16 ca trên 1440×1000 và 320×568 dùng Google/API giả, gồm loading, đủ/thiếu dữ liệu, lỗi lần đầu/sau khi đã tải và lịch sử rỗng/có dữ liệu/lỗi/phục hồi. Chỉ cho phép POST fixture xác thực và đọc `source_link`/`storage_history`; không gửi duyệt, đăng video hay dọn file.

Kiểm giả lập không chứng minh Google Sign-In, quyền thật, Zoom, YouTube, Portal, VPS, thiết bị vật lý hoặc screen reader đã đạt. Phiên đăng nhập hiện có được giữ nguyên; không lấy việc reload trong fixture làm bằng chứng đã có SSO dùng chung.

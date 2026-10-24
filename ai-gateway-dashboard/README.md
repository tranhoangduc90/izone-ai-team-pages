# Dashboard Cổng AI: popup chi tiết

Popup chi tiết chỉ xem đóng bằng nút **Đóng**, Escape hoặc nhấn và nhả trên nền ngoài; đóng xong trả focus về dòng lịch sử đã mở. Kéo từ nội dung ra ngoài, kéo từ ngoài vào trong và thao tác bị hủy giữ popup mở. Có thể cuộn tới cuối Request/Response ở màn 320 px.

Thay đổi chỉ bổ sung tương tác popup và phiên bản tài nguyên; giữ API, đăng nhập, audit khi đọc chi tiết, payload, bộ lọc, worker, nguồn gọi và quy trình thay tài khoản Google.

Kiểm native qua `tests/ai-gateway-dialog-browser.mjs`: đặt `PLAYWRIGHT_MODULE` nếu Playwright nằm ngoài repo và `GATEWAY_DIALOG_EVIDENCE_DIR` tới thư mục bằng chứng ngoài repo. Có thể dùng `GATEWAY_DIALOG_REVISION` để kiểm base hoặc `GATEWAY_DIALOG_PUBLIC_BASE` để đọc tài nguyên Pages thật. Runner chỉ phục vụ static asset và mock phiên/API bằng dữ liệu giả, không ghi vào dịch vụ ngoài. Ca nền ngoài phải RED trên base và GREEN trên bản sửa; kiểm giữ popup, focus, nội dung đầy đủ, cuộn và GET-only ở 1440×1000 / 320×568. Các test `ai-gateway-account-rotation.mjs`, `ai-gateway-session-persistence.mjs`, `ai-gateway-credit-display.mjs` giữ contract kề.

Mock không chứng nhận Google thật, quyền operator, log audit thực hoặc thiết bị thật. Không đọc payload học viên hay thay credential/Billing chỉ để kiểm giao diện. Quay lui bằng revert commit giao diện và phát lại Pages; không khôi phục dữ liệu.

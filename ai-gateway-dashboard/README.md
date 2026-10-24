# Dashboard Cổng AI: popup chi tiết

Popup chi tiết chỉ xem đóng bằng nút **Đóng**, Escape hoặc nhấn và nhả trên nền ngoài; đóng xong trả focus về dòng lịch sử đã mở. Kéo từ nội dung ra ngoài, kéo từ ngoài vào trong và thao tác bị hủy giữ popup mở. Có thể cuộn tới cuối Request/Response ở màn 320 px.

Thay đổi chỉ bổ sung tương tác popup và phiên bản tài nguyên; giữ API, đăng nhập, audit khi đọc chi tiết, payload, bộ lọc, worker, nguồn gọi và quy trình thay tài khoản Google.

Kiểm native qua `tests/ai-gateway-dialog-browser.mjs`: đặt `PLAYWRIGHT_MODULE` nếu Playwright nằm ngoài repo và `GATEWAY_DIALOG_EVIDENCE_DIR` tới thư mục bằng chứng ngoài repo. Có thể dùng `GATEWAY_DIALOG_REVISION` để kiểm base hoặc `GATEWAY_DIALOG_PUBLIC_BASE` để đọc tài nguyên Pages thật. Runner chỉ phục vụ static asset và mock phiên/API bằng dữ liệu giả, không ghi vào dịch vụ ngoài. Ca nền ngoài phải RED trên base và GREEN trên bản sửa; kiểm giữ popup, focus, nội dung đầy đủ, cuộn và GET-only ở 1440×1000 / 320×568. Các test `ai-gateway-account-rotation.mjs`, `ai-gateway-session-persistence.mjs`, `ai-gateway-credit-display.mjs` giữ contract kề.

Mock không chứng nhận Google thật, quyền operator, log audit thực hoặc thiết bị thật. Không đọc payload học viên hay thay credential/Billing chỉ để kiểm giao diện. Quay lui bằng revert commit giao diện và phát lại Pages; không khôi phục dữ liệu.

## Trạng thái đăng nhập

Đang kiểm tra phiên dùng màu đang xử lý và role status; đã đăng xuất dùng màu trung tính; lỗi cấu hình/quyền dùng màu lỗi và role alert. Khi API từ chối phiên 401, màn đăng nhập giữ lý do sau khi toast kết thúc. Không đổi cơ chế Google, cookie HttpOnly, CSRF, phiên, quyền, API hoặc luồng logout.

Runner `tests/ai-gateway-login-status-browser.mjs` nhận `PLAYWRIGHT_MODULE`, `GATEWAY_LOGIN_EVIDENCE_DIR`; có thể chọn `GATEWAY_LOGIN_REVISION` hoặc `GATEWAY_LOGIN_PUBLIC_BASE`. Cùng 14 ca trước/sau tại 1440×1000 và 320×568 kiểm màu/role, lý do hết phiên tồn tại sau toast, trace auth và khôi phục qua reload. Google button/API giả được đánh dấu rõ; không chứng nhận iframe/consent, quyền thật, cookie thật hoặc phiên A→B/thu hồi.

# Bản thử đối chiếu Portal

Entry giảng viên chỉ đọc: `portal-sync/`. Sử dụng cookie phiên IZONE dùng chung và kiểm quyền lớp ở máy chủ trên mỗi lượt đọc. Trạng thái `observed` là đã đối chiếu bằng GET, không phải xác nhận ghi Portal. Bản thử chưa chuyển tuyến ghi của Progress Log hoặc sản phẩm khác.

`dashboard.js` và `dashboard.css` được ghim từ `services/portal-sync/web` trong repo điều phối; hash và phép đổi URL font ở `dashboard-source.json`. `shared-session.js` ghim từ thư viện phiên chung hiện hành, chỉ thêm nguồn identity của bản thử; `shared-session-source.json` ghi nguồn và hash. Không thay thư viện đang chạy ở các sản phẩm khác. `teacher.js` quản lý khôi phục, Google theo nhu cầu, đổi tài khoản và xóa màn cũ khi mất quyền.

API gốc `https://ducizone.ddns.net/portal-sync-trial/api` chỉ nhận GET từ origin Pages. Google credential chỉ dùng trong bộ nhớ để đổi lấy cookie HttpOnly ở broker; khóa nguồn/khóa chữ ký nằm ở máy chủ.

Kiểm cách ly: `PORTAL_TEACHER_TEST_OUTPUT=<thư mục riêng ngoài Git> node tests/portal-sync-teacher-browser.mjs`. Runner dùng HTML/JS thật và HTTP/Google giả, chặn mọi request ra hệ thống thật. Bao gồm restore, hết phiên, 403/dịch vụ lỗi, thử lại, nhớ phiên, đăng xuất, đổi tài khoản, response muộn và giữ vùng đọc qua ba nhịp polling ở desktop/mobile. Test này không thay bằng chứng đăng nhập Google thật.

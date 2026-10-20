# Lớp demo Term Test và Mini Test

Yêu cầu phục hồi ngày 20/10/2026: dùng luồng lưu bài/chấm AI thật, không gửi điểm demo sang Portal. Không nhập lại bài demo lịch sử đã dọn ngày 19/10.

- Khóa 56: `CODEXDEMO56`, dịch vụ/kho riêng `mapping-api-demo`.
- Khóa 67: `CODEXDEMO806`, cơ chế demo hiện hành của `term-mini-k67-api`.
- Mỗi khóa 10 học viên giả, cùng định danh giữa Term 1/2 và Mini. Danh sách lấy từ máy chủ; không đưa tên hoặc định danh học viên thật vào Pages.
- Điểm vào khóa 56: `../substitute-test-1-k56-dashboard/` → **Mở lớp demo khóa 56**. Điểm vào khóa 67 và cổng chung: thư mục này; `?course=56` chọn khóa 56.

## Dùng thử

Chọn khóa, bài và thứ tự; mở bài thi hoặc phiếu đáp án, chọn tên trong phòng chờ. Muốn bắt đầu lại, đóng tab làm bài của người đó rồi trở lại đây. **Reset bài đang chọn** chỉ xóa một bài của một người; **Reset cả 3 bài** thực hiện lần lượt ba yêu cầu, dừng và báo phần chưa xác nhận khi lỗi. Không tự gửi lại khi mất phản hồi.

Nút reset trong sáu trang K56 cũng đã chuyển từ xóa cả lớp sang đúng người/bài đang chọn. Các lớp thật vẫn dùng `mapping-api-k56`. Trang giảng viên cần Google/quyền hiện hành.

## Kiểm và giới hạn

`node --test tests/demo-class-reset.mjs tests/k56-class-api-routing.mjs tests/k56-public-api-routing.mjs tests/k56-answer-sheet-identity.mjs tests/k56-landing.mjs tests/k56-mini-release.mjs tests/k56-test2-release.mjs tests/substitute-k56-dashboard.mjs tests/term-test-landing.mjs`

Nhóm này kiểm ranh giới reset, phản hồi lỗi, lưu trình duyệt, định tuyến và các entry liên quan. Kiểm trình duyệt/HTTP/database thực tế được lưu riêng tại `E:/Codex-Data/lop-demo-cac-khoa-20261020`; không suy test giả lập thành AI/Portal đã chạy. Hai suite `k56-demo-class-reset.mjs` và `k56-demo-class-reset-browser.mjs` đã chuyển sang contract reset từng người, vẫn giữ các ca chặn callback cũ sau reset. Suite browser dùng `CHROME_BIN` khi cần chọn trình duyệt Chromium hiện có.

Việc phục hồi dịch vụ dùng đúng image/config/volume trước khi dừng, chỉ thêm lớp và học viên mới. Không phục hồi dump đè kho hiện hành, không phát hành lại backend lớp thật. Snapshot/cấu hình/credential nằm ngoài repo public. Quay lại giao diện bằng revert commit; thao tác dừng dịch vụ hoặc dọn dữ liệu demo cần quyền vận hành riêng và phải đối chiếu bài mới phát sinh.

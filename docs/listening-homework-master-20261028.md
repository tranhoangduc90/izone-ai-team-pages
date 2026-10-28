# Listening Homework · Scandinavian Studies — giao diện 28/10/2026

Màn vào, màn làm bài và góp ý dùng ngôn ngữ giao diện Listening thực chiến hiện hành, trên nền master #170. Đây vẫn là homework cho nghe lại và sửa–nộp lại; backend, rubric, ID lưu/chấm, phiên đăng nhập, mã CTA và đường audio giữ hợp đồng hiện hành.

## Thay đổi

- Giữ logo IZONE đầy đủ bên trái topbar, cao 48 px desktop và 36 px mobile. Các hành động danh tính, lịch sử và giảng viên nằm trong Tùy chọn.
- Entry hai cột gồm tên audio, ba bước học và form lớp/học viên; mobile một cột. Nút mở chỉ sẵn sàng sau khi chọn đủ thông tin; lỗi tải có đường thử lại.
- Source Sans 3: nội dung, lựa chọn, transcript và ô nhập 18 px tại A100%; nhóm 20 px; tiêu đề workspace 22 px. Nội dung và blank cùng phóng 90/100/120%.
- Nhóm Mục 1–3, 4–11 và 12–22 dùng cấu trúc Listening. Số 24/25 vẫn là câu IELTS gốc. Mỗi blank có cờ và góp ý riêng, mở đúng bản đã nộp.
- Toolbar/audio gọn trên mobile; dock đo chiều cao thực. Ô đang nhập cuối bài được cuộn lên trên dock, kể cả màn ngang hoặc laptop thấp. Desktop thấp cho cuộn trang thay vì cắt nút nộp.
- Góp ý giữ tỷ lệ 38/62 desktop, xếp dọc mobile; câu hỏi và bản nộp tăng cỡ theo vai trò. Lịch sử có trạng thái tải/lỗi và giữ DOM khi phản hồi không đổi.
- `preview.html` dùng chung renderer/CSS/audio, với danh tính và góp ý minh họa trong bộ nhớ tab. Không gọi API bài làm hoặc Homework Docs. Demo cũ chuyển sang preview này.

## Kiểm chứng

| Nhóm | Bằng chứng của lượt triển khai |
|---|---|
| Chữ, logo, responsive | 77 kiểm tra computed/geometry qua 14 kích thước, gồm 320×568, 390×844, 844×390, 1280×600 và 1366×690; không tràn ngang hoặc che ô cuối. |
| Native Homework cách ly | 30 kiểm tra qua controller/backend SQL thật với danh tính giả và provider thử: đủ 22 ID, ba slot, mất ACK, reload, sửa–nộp lại, snapshot cũ, reset, GV chỉ xem. |
| Cập nhật nền | Ba nhịp đọc lại giữ DOM, cuộn và bôi chọn khi dữ liệu không đổi. Vẫn tiếp nhận kết quả mới đúng lượt. |
| State góp ý/entry | 9 kiểm tra: góp ý riêng từng blank, snapshot đúng mục, popup 38/62, Escape/trả focus, backdrop, readonly, lỗi config có thử lại. |
| Audio | Bốn ca qua transport hiện hành và manifest native thử: Worker lỗi → 20 phần Pages; đồng hồ ±1 ngày vẫn tải; native 403 không gọi CDN. Phát lại dùng Blob đã có. Worker trong phép thử cách ly đi qua relay CORS localhost. |
| Hồi quy trong repo | `node --test tests/listening-homework-interface.mjs tests/listening-homework-answer-codec.test.mjs tests/audio-clock-skew.test.mjs` — 10 test. |

Test SQL/provider cách ly không phải bài nộp học viên production. Bằng chứng AI thật và Docs thử của lần tích hợp trước vẫn áp dụng cho contract không đổi; không ghi nhận là đã chạy lại trong lượt UI này. Chưa kiểm bằng điện thoại vật lý, bàn phím ảo hoặc screen reader; không kết luận khớp tuyệt đối mọi trạng thái từ số test.

## Phát hành và quay lại

URL thật và CTA giữ `scandinavian-studies.html?assignmentCode=67-listening-scandinavian-studies`; `lesson-2.html` tiếp tục là alias. HTML, controller, renderer và CSS dùng revision `20261028-master2`. Không triển khai lại runtime hoặc thay dữ liệu học viên cho gói UI này.

Trước phát hành, đối chiếu main mới và diff đúng phạm vi. Sau Pages build, đọc lại byte các asset đã đổi, mở entry/preview bằng Chrome và kiểm logo/font/menu. Quay lại bằng revert commit giao diện và phát lại Pages; không restore database, draft, attempt, session hoặc Docs.

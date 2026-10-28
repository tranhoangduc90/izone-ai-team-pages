# Listening Homework · Scandinavian Studies — giao diện 28/10/2026

Màn vào, màn làm bài và góp ý dùng ngôn ngữ giao diện Listening thực chiến hiện hành, trên nền master #170. Đây vẫn là homework cho nghe lại và sửa–nộp lại; backend, rubric, ID lưu/chấm, phiên đăng nhập, mã CTA và đường audio giữ hợp đồng hiện hành.

## Bố cục gọn đã duyệt sau PR343

Đức duyệt ảnh minh họa gọn ngày 28/10/2026 và yêu cầu cập nhật bản thật. Thông tin học viên, ngưỡng nộp và trạng thái Homework Docs nằm bên phải topbar, cạnh nút Đổi người học hiện trực tiếp. Lịch sử bài làm chuyển xuống bên trái Góp ý. Lối giảng viên vẫn hiện ở entry và dùng phiên chung hiện hành.

Toolbar dùng một hàng có vạch phân nhóm: tên bài, ba phần luyện, A−/A+/Notes, tiến độ/lưu và sang phần. Màn hẹp cuộn ngang thanh công cụ để giữ đủ nút và cỡ chữ bài. Nhãn lưu gọn có thông điệp đầy đủ trong tên truy cập/tooltip; lỗi lưu vẫn hiện nguyên văn trên header cùng nút thử lại/tải bản nhập. Không coi đang lưu hoặc bản thử trong tab là đã lưu trên hệ thống.

Bỏ footer thương hiệu và khoảng trống phía dưới hàng 22 câu. Desktop dùng phần chiều cao còn lại cho hai pane; mobile vẫn cuộn trang khi cần và ghim dock sát đáy. Không đưa lớp luyện nghe thành một bài thi hoặc khóa điện thoại.

Kiểm ở gói gọn: 11/11 test repo, gồm ca toolbar bị cao RED trên base và GREEN sau sửa; 77 kiểm chữ/logo/geometry qua 14 kích thước; 33 kiểm native SQL/provider thử, bổ sung lỗi lưu hiện đúng header, retry khôi phục và Đổi người học về entry. Ba nhịp đọc lại giữ DOM/cuộn/bôi chọn; lịch sử, sửa–nộp lại và giảng viên chỉ xem vẫn đạt. Các phép thử cách ly không nộp bài cho học viên production.

## Nền giao diện kế thừa từ PR343

- Giữ logo IZONE đầy đủ bên trái topbar, cao 48 px desktop và 36 px mobile. Vị trí các hành động đã được thay bằng bố cục gọn nêu trên.
- Entry hai cột gồm tên audio, ba bước học và form lớp/học viên; mobile một cột. Nút mở chỉ sẵn sàng sau khi chọn đủ thông tin; lỗi tải có đường thử lại.
- Source Sans 3: nội dung, lựa chọn, transcript và ô nhập 18 px tại A100%; nhóm 20 px; tiêu đề workspace 22 px. Nội dung và blank cùng phóng 90/100/120%.
- Nhóm Mục 1–3, 4–11 và 12–22 dùng cấu trúc Listening. Số 24/25 vẫn là câu IELTS gốc. Mỗi blank có cờ và góp ý riêng, mở đúng bản đã nộp.
- Toolbar/audio gọn trên mobile; dock đo chiều cao thực. Ô đang nhập cuối bài được cuộn lên trên dock, kể cả màn ngang hoặc laptop thấp. Bố cục gọn dùng pane vừa phần chiều cao còn lại trên desktop; mobile giữ cuộn trang.
- Góp ý giữ tỷ lệ 38/62 desktop, xếp dọc mobile; câu hỏi và bản nộp tăng cỡ theo vai trò. Lịch sử có trạng thái tải/lỗi và giữ DOM khi phản hồi không đổi.
- `preview.html` dùng chung renderer/CSS/audio, với danh tính và góp ý minh họa trong bộ nhớ tab. Không gọi API bài làm hoặc Homework Docs. Demo cũ chuyển sang preview này.

## Bằng chứng mốc PR343 trước khi đổi mật độ

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

URL thật và CTA giữ `scandinavian-studies.html?assignmentCode=67-listening-scandinavian-studies`; `lesson-2.html` tiếp tục là alias. Bố cục gọn dùng revision `20261028-compact1` xuyên HTML/controller/helper/CSS; renderer vẫn giữ code đã phát, chỉ đổi query để tải cùng gói. Không triển khai lại runtime hoặc thay dữ liệu học viên cho gói UI này.

Trước phát hành, đối chiếu main mới và diff đúng phạm vi. Sau Pages build, đọc lại byte các asset đã đổi, mở entry/preview bằng Chrome và kiểm logo/font/các nút trực tiếp. Quay lại bằng revert commit giao diện và phát lại Pages; không restore database, draft, attempt, session hoặc Docs.

# Demo Term/Mini K67 dùng bộ xử lý thi gốc

Từ bản nâng cấp 14/10/2026, các entry sạch dùng bootstrap/app/audio-loader và bộ xử lý K67 hiện hành. Bản làm thử lưu vào PostgreSQL qua API gốc, không dùng adapter RAM của bản thử màu.

| Link | Nội dung |
| --- | --- |
| `/term-tests/term-test-1-design-demo/` | Term1: 40 Listening, 40 Reading, chỉ Writing Task2 |
| `/term-tests/design-demo/` | Term2: 40 Listening, 40 Reading, Writing Task1 và Task2; giữ link cũ |
| `/term-tests/mini-test-lesson-5-design-demo/` | Mini CBT: Listening 11–30, Reading 14–26, không Writing |
| `/term-tests/mini-test-lesson-5-paper-design-demo/` | Phiếu Mini: hai cột desktop, nộp thủ công, không timer CBT |

Mỗi entry có link **Bài đã chấm** (`?mode=saved`). Đường này chỉ đọc bài thật IC2200 đúng đề/lượt/lần chấm; khóa các thao tác ghi và không gửi token học viên vào renderer. Nếu không có bài hoàn tất thì báo rõ. Term1 và Term2 dùng đúng renderer nhận xét và xem toàn bài gốc.

## Giao diện và nghiệp vụ

`../design-full/native.js/css` chỉ gom node gốc và đổi lớp trình bày. Audio gốc nằm cạnh tiêu đề Listening, đồng hồ 8px, volume; không có nút pause/tua/nghe lại thông thường. Nút cứu audio của engine vẫn có khi thực sự gián đoạn. Theme Reading · xám sáng–đỏ giữ đủ 19 token, Nunito Sans, navy lựa chọn/hành động, xanh thành công, vàng cần rà.

Danh tính thử là CODEXDEMO806, tám người thử mới riêng theo bài/chế độ. Cổng API demo chuyển tiếp nguyên request tới handler K67 và kiểm chủ token; không ghi IC2200 hoặc reset dữ liệu demo cũ. Mã tạm dùng DESIGNC (CBT) và DESIGNP (phiếu) để tránh trộn hai chế độ. Bài Writing thử dùng chính luồng hàng chấm hiện hành khi nộp, cần API K67 được phát hành trước. Demo không gửi điểm CODEXDEMO806 vào Portal theo chính sách gốc.

## Bảng màu và quay lui

`/term-tests/design-lab/` giữ nguyên host/adapter/bảng màu/preset/cuộn tới vùng chỉnh của bản trước. Các asset `real-host.js`, `real-runtime.js`, `real-loader.js`, `clean-audio.js` còn lại phục vụ lab hoặc tham chiếu cũ; không phải engine của các entry sạch mới. Bản lịch sử chỉ đọc dùng adapter giới hạn riêng ở `design-full/saved-runtime.js`.

Quay lui giao diện bằng revert gói entry/lớp trình bày; không xóa bài/lượt thử. Backend có bản quay lui riêng, giữ env/volumes/secret/audio/hàng chấm hiện tại. Không thay các trang thi chính, công thức điểm, prompt hay workflow AI.

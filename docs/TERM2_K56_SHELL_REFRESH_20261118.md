# Term Test 2 K56: làm mới vỏ offline và giữ nút chuyển phần ổn định

Gói Listening report v2 đang ghim byte cũ của `shared/reading-practice-journal.mjs`. Sau khi nguồn dùng chung đổi, browser mới không cài được vỏ offline. Bản v3 giữ các tệp v2, tạo entry/bootstrap/worker/manifest riêng và kiểm lại toàn bộ 195 tài nguyên theo byte LF của Git/Pages. Không đổi ngược module Reading hoặc bỏ xác minh hash.

Sau khi chọn “Loa ngoài”, con trỏ có thể nằm đúng mép dưới của nút “Tôi đã hiểu. Đến phần thi tiếp theo.”. Hiệu ứng hover cũ dịch nút lên 1 px, khiến trạng thái hover và vị trí luân phiên mỗi frame. CSS mới chỉ vô hiệu phép dịch vị trí của nút trong `#offlineListeningInterrupted`; giữ màu, chữ và các nút khác. Đã ghi trace 25 frame của lỗi trước sửa, không dùng force-click để cho qua phép kiểm.

Phạm vi kiểm gồm RED trên manifest v2, GREEN trên v3; browser sạch cài gói, phát media, xác nhận rè/loa ngoài, nhận đúng một receipt gián đoạn và mở Reading, rồi F5 offline giữ cùng scope, nháp và thời gian. Dùng dữ liệu/API giả và một browser tại một thời điểm. Các bằng chứng native SQL, Writing, cloud và hai thứ tự còn khớp bản được giữ trong hồ sơ GOAL Test; lượt này không thay chấm AI hoặc tải vận hành thật.

Quay lại Pages bằng commit hoàn tác entry; giữ các gói cũ để đọc và quay lui. Gói v2 còn có lỗi dependency cũ đã nêu, nên quay entry về v2 sẽ khôi phục giới hạn đó. Runtime API, dữ liệu học viên, Agent và ngân sách cloud không đổi trong gói này. Module mới trong thư mục dùng chung chỉ được nạp bởi entry khai báo nó.

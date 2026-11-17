# Term 1 K56: giữ biên nhận đang chờ khi mở lại

Nếu Reading đã được API lưu nhưng trình duyệt chưa đọc được biên nhận, phản hồi resume `sealed` trước đây xóa pending seal, đặt operationId null và mất liên kết sang kỹ năng sau. Ca HTTP/PGlite đã tái hiện trên wrapper đang phục vụ. Không có dữ liệu học viên production được gửi hoặc chỉnh để tạo ca này.

Bản mới chỉ thêm wrapper `offline-term1-receipt-resume-v2.mjs` trên Term1Offline hiện hành. Khi resume tổng quát chưa phân biệt được lần nộp này với hồ sơ khác, giữ seal/interrupt đang chờ để status đọc receipt hoặc xung đột rõ ràng. Những skill không có pending vẫn nhận tiến độ, xung đột rõ ràng vẫn giữ đáp án thua và không dựng biên nhận. Không đổi API, SQL, storage/BUILD, bộ phát, đề, điểm, fallback hoặc nhật ký cloud.

Gói bất biến riêng được tạo bởi `tests/build-term1-receipt-resume.py`: 187 tài nguyên, entry/bootstrap/worker mới; chỉ index.html chính đổi bộ nạp. Mọi gói cũ và runtime dùng chung giữ nguyên.

## Bằng chứng trước phát

- `tests/term1-k56-receipt-resume.test.mjs`: bốn ca tiến độ/xuất bài, resume, bảo vệ receipt riêng và toàn bộ hash closure mới.
- `tests/term1-k56-pending-native-receipt.test.mjs`: cùng ca RED trên wrapper v1, GREEN trên v2; native HTTP/PGlite commit Reading trước khi client đọc, resume giữ pending, status đọc đúng receipt và kỹ năng sau giữ dependency.
- `tests/term1-k56-receipt-resume-browser.mjs`: hồ sơ v1 đang làm, thao tác nộp Reading do UI tạo đã commit trước mô phỏng crash, status tạm lỗi trong lúc nâng v2. Resume giữ đúng seal; sau mở status, đọc lại receipt. F5/đóng mở offline giữ scope/nháp/hạn/receipt, tiếp Listening và Task 2 qua mất ACK Writing với ba seal, một job. Hai lỗi runner đầu (đợi cờ chỉ có ở màn đề khi đang ở lobby; giả định input đầu là câu 1 thay vì đọc data-number thực) được ghi riêng, không tính RED sản phẩm.

Các phép thử dùng roster/nội dung/khóa giả, HTTP/PGlite thật và một browser cách ly tại một thời điểm. Listening nộp thủ công ngắn; không thay audio đủ thời lượng, thiết bị, AI/Portal hoặc vận hành thật. Các ca UI/audio khác còn giá trị vì bộ phát và view không đổi. Term 2 dùng runtime chung nhưng không gọi nhận tiến độ tổng quát trong resume sau mở lại; chỗ prepare tạo record trống, còn status dùng xung đột theo skill. Không tự sửa Term 2 từ lỗi caller của Term 1.

## Đọc lại và quay lại

Sau phát, đối chiếu entry/bootstrap/worker và đủ 187 hash public theo URL examBuild, đọc API vẫn đúng bản trước phát. Chỉ mở entry public không kèm lớp/người để kiểm nguồn và lỗi JS; không nộp/chấm bài thật. Ghi riêng bằng chứng public với bằng chứng native cách ly.

Nếu có lỗi mới, giữ browser/cache/dữ liệu và API hiện hành. Ưu tiên sửa hẹp caller mới. Quay entry về v1 bằng commit riêng chỉ đổi index.html có thể phục hồi entry cũ nhưng mang lại lỗi pending receipt này, cần ghi rõ giới hạn; không ép reload tab đang làm, xóa storage/SW/receipt, sửa dữ liệu hoặc sửa file trong gói bất biến đã phát.

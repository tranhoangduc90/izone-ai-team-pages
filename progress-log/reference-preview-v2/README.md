# Bản xem thử chi tiết Progress Log

Nguồn giao diện: [web mẫu](https://tranhoangduc90.github.io/izone-ai-team-pages/progress-log-567-demo/), CSS `index.B4GAfqfn.css`, màn thẻ buổi và bài đã hoàn thành; bốn ảnh Đức gửi ngày 03/10/2026. Đây là phần xem thử độc lập, nghiệm thu `small_complete`, chưa thay giao diện vận hành.

Mở trang sẽ thấy Hành trình của em. Bấm **Buổi 03 · Reading 3 + Writing 1** để xem toàn bộ câu hỏi, phương án đã chọn, câu trả lời và đúng/sai. Buổi 05 minh họa thêm câu nhìn lại và tự khai điểm. Dữ liệu công khai hoàn toàn giả; **Dữ liệu lớp của tôi** dùng phiên giảng viên hiện có và quyền lớp do máy chủ kiểm.

## Quy tắc bổ sung trước xây

| Thành phần | Tiêu chuẩn từ mẫu | Phần mở rộng theo yêu cầu |
|---|---|---|
| Thẻ buổi | Nền #fbfcfc, viền #dce2e0, radius18px, padding20px; cao tối thiểu190px/175px mobile. Số buổi đỏ12px, ngày xám12px, title18px, skills13px; trạng thái và điểm ở đáy. Grid3/2/1 tại850/560px. | Tên nội dung từ phiếu thật; buổi chưa có tên ghi rõ chưa xác nhận. Điểm là đúng/số đã chấm, không tự quy ra10 hoặc band IELTS. |
| Màn xem bài | Hero #0d2941/radius27px/padding48px; h1clamp31–48px/line1.08; mobilepadding26px20px/radius21px. Badge mint, panel kết quả radius20px, thẻ câu radius15px. | Tên học viên/lớp bên dưới hero; toàn bộ definition, helpText, lựa chọn, responses và gradingItems hiện hành. Mẫu gốc chỉ có các mục trả lời tóm tắt. |
| Chữ/nội dung | Giữ font, màu và khoảng cách từ CSS nguồn. Render Windows dùng Segoe UI. | Nguyên văn nhiều dòng, câu điền nội tuyến, chuỗi lập luận, ô ngắn có nhãn; câu điều kiện không áp dụng có nhãn riêng. |
| Nhãn buổi | Số buổi và tên nội dung đi cùng nhau. | Áp dụng thẻ, hero, bộ chọn, header giảng viên, cột Hành trình lớp, câu sai và chi tiết học viên. |

Đối chiếu cùng Chrome/Windows/DPR1 ở390/768/1440; dung sai hình học2px. Thẻ và hero khớp số đo; ngày/điểm/bài thật khác dữ liệu mẫu có chủ đích. Không khẳng định toàn bộ sản phẩm đã clone100%.

## Trạng thái lịch học

- Buổi đã gán phiếu published, trước **18:25 giờ Việt Nam** vào ngày được chỉ định: **Chưa đến buổi học**.
- Đúng ngày, từ18:25, chưa nộp đủ: **Nhấn để học buổi hôm nay**. Đường vào phiếu vẫn dùng hệ đang vận hành; quyền và mở từng phần do máy chủ quyết định.
- Bài đã nộp đủ ưu tiên **Đã hoàn thành**, bấm xem full bài; sau ngày học, phiếu còn mở cho tiếp tục. Phiếu đã đóng chỉ xem lại.
- Chưa có phiếu/Test chưa có kết quả là bình thường. Thiếu ngày hoặc có nhiều phiếu mâu thuẫn phải hiện cần xác nhận/đối chiếu, không đoán.
- Bộ thử18:24/18:25 chỉ ở dữ liệu minh họa, dùng buổi07 hôm nay và buổi08 ngày mai. Dữ liệu thật luôn dùng giờ thực.

## Ranh giới vận hành và kiểm

Tái dùng module phiên giảng viên và API GET hiện hành. Mỗi lần mở chỉ đọc một học viên/buổi, deadline15s, retry/back/Escape; đổi lớp/người/vai trò/chế độ vô hiệu kết quả cũ.401/403 xóa dữ liệu bài. Không tạo attempt, nộp bài, ghi điểm danh, gửi nhận xét hoặc chạy AI từ bản xem thử. Không có response, token thật hoặc grading key trong repository công khai.

Kiểm mới trong `tests/progress-log-reference-preview-v2.mjs` và `tests/progress-log-preview-v2-contracts.mjs`; giữ suite Progress Log cũ. Cùng hai regression đã thất bại trên preview cũ trước khi đạt trên bản mới. Phần vận hành/API/database/Portal không có thay đổi; đường lui là revert commit thêm route mới.

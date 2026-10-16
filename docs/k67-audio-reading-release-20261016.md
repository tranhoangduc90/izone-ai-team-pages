# K67: bảo vệ audio và làm quen trong giao diện Reading xám sáng–đỏ

Phạm vi: Term Test 1/2, Mini Buổi 5 CBT K67, cả Listening trước và Reading trước; trang làm quen riêng. Giữ phòng chờ Listening và các lựa chọn thiết kế đã phát hành.

- Khi nghe bình thường, nhóm công cụ xử lý chỉ hiện “Tôi không nghe được”. Khi giữ bài mới hiện “Đầu ra”, “Chuyển thiết bị”, thử tiếng, tiếp tục và hướng dẫn giáo viên; phục hồi xong ẩn nhóm này.
- Tất cả điều khiển ở một dòng tiêu đề; màn hẹp cuộn trong thanh, không kéo ngang toàn trang. Không thêm pause/replay thường của bài thi.
- Bài làm quen dùng nội dung tự soạn, cùng font Nunito Sans và bảng màu Reading; tách phiên/API khỏi đề thi. Không tự gửi yêu cầu hỗ trợ giáo viên.
- Khôi phục audio từ bản mã hóa vẫn cần mạng để xác thực. Chỉ một nơi phát; không tự cướp quyền từ máy mất liên lạc.

Backend phải có migrations 010–015 và gói tương thích trước khi bật bốn cờ audio/readiness. Các cờ không được tắt giữa những phiên đang dùng protocol mới để giả lập quay lui. Phương án vận hành đầy đủ nằm trong runbook của sản phẩm backend.

Không thêm công tắc ngừng mở mới theo yêu cầu mới nhất. Tải local không chứng minh công suất hàng trăm người trên production. Web không xác nhận thay người dùng việc tai nghe vật lý có tiếng, Windows mute, mọi extension hay ứng dụng cùng chạy.

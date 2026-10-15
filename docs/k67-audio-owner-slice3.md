# K67: một nơi phát audio và bảo vệ gián đoạn

Ngày 15/10/2026. Chỉ triển khai local, chưa phát hành. Dùng trên nền hai lát giữ bài và cache mã hóa.

## Hành vi

- Tab đầu nhận quyền phát. Tab thứ hai cùng profile bị Web Lock chặn; thiết bị/profile khác bị máy chủ chặn. Không dùng nhịp tim hết hạn để tự chiếm quyền của máy mất mạng.
- Reload cùng profile phải giữ được bằng chứng chủ phát, lấy Web Lock và xác thực online. Mỗi lần đổi trang chủ tăng phiên bản quyền; yêu cầu từ trang cũ không được lưu nháp, bù giờ hoặc nộp Listening.
- Chuyển nơi làm: chọn **Dừng để chuyển** tại nơi cũ. Trang dừng audio, giữ bài, chờ máy chủ xác nhận rồi nhả quyền. Nơi mới xác thực và tiếp quản cùng sự cố/mốc nghe; thử âm thanh trước khi tiếp tục. Nếu nơi cũ không truy cập được, báo giáo viên; không tự chiếm bằng timeout.
- Mute/âm lượng bằng 0, freeze/resume, khoảng ngừng xử lý dài hoặc đầu ra đã chọn biến mất đi qua luồng giữ bài. Phím media không tự thoát giữ bài. Thay đổi danh sách thiết bị chung chỉ nhắc kiểm tra, không dừng bài đang phát bình thường.
- Chọn đầu ra là khả năng tùy trình duyệt. Mẫu thử dùng cùng đầu ra đã chọn cho đề thi. Không xin microphone. Wake Lock chỉ là hỗ trợ; bị từ chối không làm dừng bài.
- Tín hiệu âm thanh sau khi đã nghe hết không khóa thời gian xem lại đáp án, kể cả khi reload vào phần xem lại.

## Giao diện

Toàn bộ trạng thái, nút báo lỗi, thử âm thanh, tiếp tục, chọn đầu ra và dừng/chuyển nằm trong cùng dòng tiêu đề Listening. Màn hình hẹp cuộn ngang cục bộ dòng này, không đẩy trang rộng ra hoặc thêm hàng nút thứ hai. Hướng dẫn giáo viên mở trong hộp thoại khi học viên yêu cầu.

## Giới hạn phải giữ khi vận hành

Web không biết chính xác tiếng đã tới tai, không đóng được app gọi/họp, không kiểm kê/tắt extension và không thể dừng từ xa một thiết bị đang offline. Bảo vệ giữa thiết bị dựa vào cấp quyền duy nhất và quy trình dừng nơi cũ. Không coi cơ chế này là chống người dùng cố ý sao chép bằng chứng chủ phát hoặc sửa mã trong trình duyệt.

Thiếu Web Locks vẫn có bảo vệ máy chủ; không tự reclaim từ trang khác chỉ dựa localStorage. Không ghi/đọc lại được bằng chứng bền thì chặn trước claim, hướng dẫn cho phép dữ liệu trang/giáo viên, tránh tạo phiên mất quyền sau reload.

Kiểm thật còn cần: tai nghe dây/Bluetooth, đổi thiết bị mặc định, cuộc gọi, ngủ/khóa máy, tab bị hệ điều hành loại bỏ, profile có extension và profile sạch. Không dùng sự kiện mô phỏng để kết luận đã kiểm các thiết bị đó. Safari/Firefox/mobile chưa được nghiệm thu cho đợt này.

## Thử local

Chạy `node --test tests/k67-audio-owner-browser.mjs` trong worktree Pages có backend fixture nằm cạnh. Thử Edge bằng `K67_BROWSER_CHANNEL=msedge`. Các fixture chỉ nghe loopback, dùng audio/câu hỏi/học viên giả. Hồi quy chung: `node scripts/run-term-test-67-regression.mjs --all`.

Backend cần migration 012 và cờ `K67_AUDIO_OWNER_ENABLED`; mặc định tắt. Tắt cờ chỉ ngừng nhận phiên mới, không gỡ guard của phiên đã cấp quyền. Không hạ backend xuống bản không hiểu quyền/hold khi còn phiên đang hoạt động.

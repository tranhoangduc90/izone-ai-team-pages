# K67 — giao diện giữ bài khi không nghe được

Đã xây và kiểm local, chưa đưa lên production. Nút **Tôi không nghe được** chỉ xuất hiện khi backend công nhận `audioProtocolVersion: 1`. Bản server chưa bật cờ tiếp tục dùng luồng audio cũ.

## Phần thay đổi

- `term-tests/k67-shared/listening-controller.js`: điều phối giữ bài, mẫu thử một giây không có câu hỏi, tiếp tục hai bước, bỏ phản hồi cũ, giữ ID khi retry và giới hạn hai lần tự phục hồi mỗi chu kỳ.
- Bộ nạp chuẩn K67: nạp module bảo vệ trước start, ghi thời điểm đã bắt đầu trước các bước player có thể lỗi, giới hạn chờ metadata và đưa lỗi startup vào luồng giữ bài.
- `shared/app.js`: adapter snapshot nháp, khóa sửa/nộp, dừng autosave trong lúc giữ, nhận deadline mới và ngăn phần finally của request cũ mở khóa nhầm.
- `enhance.js`: nhường điều khiển phục hồi/timer dự phòng cho controller khi tính năng mới có hiệu lực. K56/Substitute dùng controller riêng.
- Bốn trang dùng bộ nạp chuẩn đã cập nhật phiên bản asset. Tuyến thi lại vẫn giữ kiểm vé và quy trình định danh hiện hành; chưa có nghiệm thu buổi thi lại thật trong lát này.

Khi mất mạng lúc báo lỗi, UI ghi sự kiện theo mã phiên/generation và khóa ngay tại máy. Chỉ sau ACK mới hiển thị trạng thái server đã giữ. Nếu bộ nhớ trình duyệt bị chặn, thông báo rõ hạn chế qua tải lại. Lỗi API tiến độ trong lúc audio vẫn chạy không tự dừng bài.

Trình duyệt không biết chắc người dùng nghe được từ loa/tai nghe. `play()` thành công vẫn cần học viên nhấn xác nhận. Mẫu thử dừng trước khi tiếp tục audio đề; không xin microphone hoặc thu âm.

## Kiểm

`tests/k67-audio-incidents-browser.mjs` tự chạy preview backend thật với dữ liệu giả. Khi hai repository không nằm cạnh nhau, đặt `K67_BACKEND_FIXTURE_ROOT` trỏ tới `products/term-mini-k67` trong worktree backend. Cần cài dependency theo package-lock của backend trước.

```powershell
# Đi toàn luồng trên Chrome thử nghiệm, SQL thật trong database nhúng và dữ liệu giả.
node --test tests/k67-audio-incidents-browser.mjs

# Bộ hồi quy hiện có gồm test mới; nhận trạng thái lỗi thật, không skip nếu thiếu fixture.
node scripts/run-term-test-67-regression.mjs --all
```

17 ca mới phủ cả ba đề × hai thứ tự, hold qua deadline cũ, bù một lần, nộp tự động/thủ công, lost ACK, reply sai thứ tự, reload với nháp không rỗng, autoplay lỗi, trần 900 giây và hai lần tự phục hồi không lặp vô hạn.

Full run phát hiện thêm hai vấn đề harness: VM legacy thiếu binding `protection: null`, và fixture trạng thái Writing Substitute thiếu `accepted: true` theo contract hiện hành. Đã sửa fixture; giữ nguyên luật sản phẩm, assertion và thời gian chờ 35 giây. Bản nền cũng tái hiện lỗi fixture Substitute; bốn route được chạy lại đạt. Không sửa tính năng K56/Substitute trong lát này.

Đã nhìn bản render hẹp 390px của màn giữ bài. Chưa xác minh phần cứng/tai nghe, extension, Firefox/Safari, file đề trọn 30 phút hoặc buổi thi thật. Các phần này giữ ở lát nghiệm thu sau, không suy từ currentTime hoặc screenshot.

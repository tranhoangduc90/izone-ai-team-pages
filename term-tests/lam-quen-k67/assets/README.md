# Mẫu kiểm MP3 riêng

`codec-sample-v1.mp3` lấy sáu giây đầu của audio làm quen tự soạn `listening-v1.wav`, không dùng đề thi, học viên hoặc nội dung bên ngoài. WAV gốc có SHA-256 `489c8cf0848198ae9bf55b37f15b5937d70387ecd753f111ad75c8d353179c81`.

Mẫu MP3: stereo 44.100 Hz, 128 kbit/s, 96.548 byte; SHA-256 `28f88bb9a2aa243d322787641339773061f1906a8ae562f30f6681e9f572feb1`. Mã kiểm ghim kích thước/hash, rồi giải mã toàn bộ bằng decoder của trình duyệt. Không tự phát mẫu này hoặc xin micro. Nghe xác nhận vẫn diễn ra trong Listening làm quen.

Tạo asset bằng [lamejs 1.2.1](https://github.com/zhuker/lamejs) ở công cụ local riêng, không thêm encoder hoặc dependency vào runtime/gói trang. Chỉ đưa audio tự soạn đã chuyển định dạng vào Git; `.gitattributes` giữ nguyên byte nhị phân.

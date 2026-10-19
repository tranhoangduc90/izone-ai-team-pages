# Progress Log IC2304 buổi 09 và sửa bộ kiểm

Phiếu dùng app Progress Log chung, gồm Listening và Speaking. Listening có mười ô trong câu, số 31–40, giới hạn một từ; đáp án được Đức gửi trong chat ngày 19/10/2026. Speaking giữ nguyên nội dung, tám lựa chọn và ô Khác có điều kiện của buổi 08. Đề, đáp án và danh sách học viên nằm trong kho riêng và database, không đưa vào Pages.

Assignment: `eb3b434f-e8bb-4af0-b41a-1344c777ca92`. Version: `429edcff-1d9e-5902-ad36-c20ce791d746`. Khi tiếp tục, đọc lại assignment này thay vì tạo phiếu mới.

## Thay đổi giao diện

Câu có dấu mở nháy ngay trước ô từng khiến bộ dựng notes chuyển toàn phần về cách trình bày dự phòng. `compact-exercises.js` nay nhận dấu nháy thẳng hoặc cong và giữ dấu nháy quanh ô. ID từng câu, lưu nháp, required và dữ liệu gửi chấm giữ nguyên. Câu không có dấu nháy và answer sheet chọn tên vẫn dùng cùng bộ dựng.

Các bộ nạp học viên/demo đổi phiên bản tài nguyên để lấy đúng mã mới. Bộ tạo trang demo giữ màn thử hiện có khi trang chính thêm lối vào giảng viên: mã run giả của demo không được chuyển thành mã phiếu của dashboard thật. Kho demo vẫn tách khỏi bài và điểm danh lớp thật.

## Bộ kiểm đã được sửa

- Fixture mở lượt có đủ mã người/lớp theo hợp đồng nhận diện ngày 18/10. Tải lại tab đã ghim không bấm lại màn chọn đang ẩn.
- Các mẫu HTML cũ đã thu hồi trong commit `12e5dd611cca7ae6683eec7c8fd354d1fc847ec3` tiếp tục không có route công khai. Helper test chỉ đọc nguyên mẫu từ cha của commit đó trong lịch sử Git và phục vụ vào localhost. Không thêm bản sao HTML vào repository. Các ca này kiểm module mẫu lịch sử, không chứng minh giao diện production hiện hành.
- Hai callback kiểm bộ nhớ/buổi 3 được nối với `node:test` và Chrome thật; trước đây Node chỉ đọc biểu thức mà không chạy các assertion. Bộ nhớ UUID cũ được kiểm trên phiếu DEMO legacy; nhận diện ERP của phiếu thật được kiểm riêng.
- Bộ kiểm nhận diện có cấu hình chạy độc lập như các bài kiểm khác. Kiểm revision chấp nhận hai tên tham số cache đang dùng là `rev` và `v`.
- Smoke production nhận URL và file kỳ vọng độc lập, thay vì cố định IC2305 buổi 3 và revision tháng 09. Nó chỉ mở danh sách, không chọn học viên, bắt đầu lượt hoặc nộp bài.

## Cách chạy

Chạy toàn bộ tệp `.mjs` và `.cjs` có tên bắt đầu `progress-log-` trong thư mục `tests` bằng `node --test --test-concurrency=2`. Smoke cần `LIVE_PROGRESS_LOG_URL` và `LIVE_PROGRESS_LOG_EXPECTED_FILE`; file kỳ vọng khai tiêu đề, lớp, buổi, sĩ số và hai đường dẫn tài nguyên. Giữ URL/token và file riêng của lớp ngoài Git. `IDENTITY_EVIDENCE_DIR` có thể chỉ đến kho bằng chứng riêng.

Các ca mẫu lịch sử cần checkout có đủ lịch sử trước commit thu hồi nêu trên. Helper báo lỗi khi thiếu lịch sử; không fetch mạng hoặc tự phục hồi trang. Mã nguồn/chức năng đang vận hành được kiểm bằng các ca nộp, identity, Journey, dashboard và demo chung riêng biệt.

Lượt kiểm cuối ngày 19/10: **83/83** native test đạt, không fail/skip, gồm smoke chỉ đọc của IC2304 buổi 09 và tám tình huống trong bộ nhận diện chung. Kho demo riêng đã kiểm trọn luồng ở 390/768/1440 px: cố ý sai một câu nhận 9/10, giữ nháp sau reload, bắt buộc ô Khác, nộp cuối, xem biên nhận và reset. Các buổi cũ và hàng điểm danh thật giữ nguyên; buổi 09 chưa có lượt/bài/điểm danh thử.

## Phạm vi vận hành và quay lại

Chỉ thêm definition/key/assignment của buổi 09 và sửa frontend/bộ kiểm. Không đổi API image, schema, workflow n8n hay cấu hình điểm danh. Khi chưa có bài nộp thật mới, chưa thể kết luận Portal buổi 09 đã nhận điểm danh.

Quay lại giao diện bằng hoàn tác các commit của gói này; giữ assignment/version và bài đã nhận. Muốn ngừng nhận bài thì khóa phiếu/phần đúng quyền, không phục hồi database cũ hoặc xóa bài học viên. Bằng chứng đầy đủ của lần kiểm, ảnh và snapshot được lưu riêng trên máy vận hành.

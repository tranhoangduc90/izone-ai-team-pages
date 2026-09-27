# Thiết kế bản xem trước: kiểm ChatGPT Share ngay

## Phạm vi và nghiệm thu

Bản xem trước chạy tại máy Đức cho hai hồ sơ giả IC2200 Homework Lesson 2. Chọn cách nghiệm thu `small_complete`: đủ 9 ảnh và hướng dẫn trong trang; bấm **Xác nhận** ở từng phần thì máy chủ đọc chính link vừa dán, nhờ AI kiểm khối lượng và trả kết quả hoặc lý do chưa nhận. Giao diện không ghi bài nộp vào Classroom, không kích hoạt chấm Speaking production và không gửi email.

## Đường đi và tải

Trình duyệt → máy chủ chỉ nghe `127.0.0.1` → bộ đọc ChatGPT Share hiện có (đọc trực tiếp, có fallback n8n) → Gemini dispatcher → kết quả về đúng phần đang xác nhận. Hai hồ sơ giả là hai người dùng thử; giả định tối đa hai lượt kiểm đồng thời. Nếu cần mở cho cả lớp, phải đo tải và cấp cơ chế xác thực, hàng đợi, giới hạn chi phí trước khi phát hành.

## Chờ, giới hạn và khôi phục

Trang báo rõ đang đọc link rồi đang phân tích. Bộ đọc có thể mất tối đa khoảng 90 giây khi cần fallback; AI tối đa 45 giây. Nếu link riêng tư, trang sai, AI lỗi hoặc kết quả không đủ chắc chắn, phần đó không được đánh dấu đạt; học viên thấy lý do và có thể thử lại. Nút bị khóa khi một lượt đang chạy; hai lần kiểm cùng link trong cùng tiến trình dùng chung kết quả đang chờ để giảm gọi AI trùng. Nội dung hội thoại chỉ ở bộ nhớ tiến trình, không ghi vào repo, localStorage hay log HTTP.

## Theo dõi và quyết định

Máy chủ ghi mã lỗi, thời lượng và loại kết quả, không ghi URL hoặc nội dung. Đức xem kết quả ngay trên trang và terminal local. Bản xem trước dùng Gemini 3.1 Flash Lite để phân loại các chu trình luyện; AI phải trả dẫn chứng bằng chỉ số lượt chat hợp lệ. Dấu hiệu gõ chỉ là cảnh báo mềm có trích dẫn thực xuất hiện trong lời học viên. Bản vận hành sau này cần đối chiếu lịch sử bài nộp, xác thực Google và biên nhận chấm bền trước khi mở cho học viên thật.

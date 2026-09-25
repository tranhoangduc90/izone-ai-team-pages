# IC2305 — rà chấm từng ô với Gemini và GPT-6 Luna

Trang công khai 98 bài làm ẩn danh của Buổi 2–4, gồm 308 ô trả lời. Gemini 3.1 Flash-Lite và GPT-6 Luna chấm độc lập từng ô. Nếu hai mô hình đồng thuận, ô chỉ hiện một kết luận; nếu bất đồng, ô hiện riêng kết luận của từng mô hình. Trang xếp 16 bài có ô bất đồng lên đầu và hiển thị số liệu lấy trực tiếp từ `data.json`.

Người rà có thể mở phần góp ý dưới từng ô, chọn Đồng ý/Không đồng ý, đưa ra kết luận của mình và ghi lý do. Nút gửi mở Google Form đã điền mã ca kèm số ô, ví dụ `IC-xxxxxxxx#2`; phản hồi chỉ được lưu tập trung sau khi người rà bấm **Gửi** trên Form. Bản tạm nằm trong `localStorage` theo phiên bản v4; tệp xuất phản hồi không chứa bài làm.

`data.json` chỉ chứa câu hỏi, bài làm đã được phép công khai và hai mảng kết luận boolean. Mã học viên, mã bài nộp, tiêu chí chấm riêng, prompt và credential nằm ngoài Git. Trang không ghi vào Progress Log hoặc điểm chính thức. Không dùng trang này cho bài làm có thông tin nhận dạng hay nội dung bí mật.

Kiểm thử: `node --test tests/ic2305-grading-review.mjs`, sau đó rà giao diện máy tính, điện thoại, bộ lọc, phản hồi và lỗi tải dữ liệu bằng trình duyệt.

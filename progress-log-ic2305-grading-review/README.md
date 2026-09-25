# IC2305 — rà chấm thử Gemini và GPT-6 Luna

Một trang `index.html` chứa giao diện rà cả 98 ca. Với 97 ca đồng thuận, trang chỉ hiện một kết quả và một lựa chọn đánh giá; lựa chọn này được ghi cho cả Gemini và Luna trong biểu mẫu phản hồi. Ca bất đồng được xếp đầu, hiện riêng kết quả và đánh giá của từng AI.

Trang tự tải `data.json` cùng thư mục khi mở. Tệp này công khai 98 câu trả lời, câu hỏi và kết luận của hai AI theo quyền Đức đã cấp; mã ca được thay bằng mã ngẫu nhiên, không kèm mã học viên hoặc số thứ tự bài nộp. Bảng nối mã gốc với mã công khai nằm trong kho riêng ngoài Git. Dữ liệu công khai không chứa prompt hay tiêu chí chấm riêng.

Lựa chọn Đồng ý/Không đồng ý/Chưa chắc, kết luận của người rà và lý do được lưu tạm trong `localStorage`; tệp xuất phản hồi không chứa bài làm. Nút gửi mở Google Form đã điền sẵn những trường này. Phản hồi chỉ được lưu tập trung khi người rà bấm **Gửi** và thấy xác nhận trên Google Form.

`data.json` được tạo từ 98 kết quả chấm của sáu câu thuộc Buổi 2–4 bằng script riêng ngoài Git. Giao diện không dùng thư viện ngoài, chỉ tải tệp tĩnh cùng nguồn, không ghi Progress Log, điểm danh hay Portal. Vì nội dung câu trả lời đã công khai trên Pages, không dùng trang cho câu trả lời có dữ liệu nhận dạng hoặc thông tin bí mật.

Kiểm thử: `node --test tests/ic2305-grading-review.mjs`, sau đó kiểm trang bằng trình duyệt ở desktop và màn hẹp, gồm cả lỗi tải dữ liệu.

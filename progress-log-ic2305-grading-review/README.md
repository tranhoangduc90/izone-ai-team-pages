# IC2305 — rà chấm thử Gemini và GPT-6 Luna

Một trang `index.html` chứa giao diện rà cả 98 ca. Ca bất đồng được xếp đầu và có nhãn riêng; bộ lọc cho phép xem ca bất đồng hoặc 97 ca hai AI có cùng kết luận.

Đức chọn tệp `comparison.private.json` nằm ngoài Git. Trang đọc tệp trong bộ nhớ tab, không tự tải lên máy chủ. Mã ca, lựa chọn Đồng ý/Không đồng ý/Chưa chắc, kết luận của người rà và lý do được lưu tạm trong `localStorage`; tệp xuất phản hồi không chứa bài làm. Nút gửi mở Google Form đã điền sẵn những trường này. Phản hồi chỉ được lưu tập trung khi người rà bấm **Gửi** và thấy xác nhận trên Google Form.

Tệp riêng được tạo bằng script ngoài Git, từ 98 kết quả chấm của sáu câu thuộc Buổi 2–4. Không commit bài làm, đáp án, prompt chấm hoặc tệp phản hồi chứa trích dẫn bài làm vào repo Pages. Giao diện không dùng thư viện ngoài, không gọi API và không ghi Progress Log, điểm danh hay Portal.

Kiểm thử: `node --test tests/ic2305-grading-review.mjs`, sau đó kiểm hai trang bằng trình duyệt với tệp riêng, cả desktop và màn hẹp.

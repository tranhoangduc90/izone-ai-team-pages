# Lesson 9 — bản thử IC2304

Trang học viên và giảng viên là entrypoint mỏng của Handout Writing 67. Bản này chuẩn bị để xem trước, chưa mở trên Pages hoặc đổi hệ thống đang chạy.

Luồng: Ý tưởng và Topic → Check chung A–X–B ý 1 → mở ý 2 → Check chung A–X–B ý 2 → một bảng nội dung và từ vựng cho cả hai ý. Ba phương án WHY được hiển thị để tham khảo; không bắt học viên chọn nhãn trước khi viết.

Giữ theme Reading, cách vào lớp/tên, autosave, nháp, Edit, lịch sử và trao đổi của mẫu chung. `shared/workflow.mjs` chọn luật theo mode, `shared/whole-chain-ui.mjs` trình bày cả chuỗi. Controller học viên và giảng viên tiếp tục dùng chung với Lesson 5/7; thiếu mode giữ luồng cũ. Không chứa prompt, dữ liệu thật hoặc khóa API trong trang này.

Kiểm hành vi Handout67 bằng Node với các file `*.test.mjs` trong `lesson5-demo`, `lesson5-thu`, `lesson5` và `shared/whole-chain.test.mjs`. Kiểm trình duyệt cần backend bản thử tương thích; chỉ dựng HTML không chứng minh được Check/AI/lưu bài.

Trước phát hành cần duyệt bản thử, kiểm consumer hàng chấm nhận phần `si1/si2` và vocab cả hai ý, đối chiếu registry/roster/quyền Google hiện hành, rồi phát hành backend và registry tương thích trước trang. Không tự chấm lại hoặc chuyển bài/comment cũ.

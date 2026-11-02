# Ưu tiên diện tích bài làm và gom trạng thái — Đức chốt 01/11/2026

Nguồn: yêu cầu trực tiếp của Đức sau khi tối ưu Reading Homework Lesson 12, rồi mở rộng rà cả Reading Homework, Listening Homework, Reading và Listening thực chiến. Đây là bổ sung cho master170 v1.1/R3, cụ thể hóa E02, E05, E06, E08 và F03; giữ số tiêu chí, profile và nghiệp vụ riêng.

## Ba nguyên tắc

1. **Ưu tiên không gian cho bài làm.** Vùng đề, câu trả lời và đối chiếu nhận phần chiều cao còn lại sau header, công cụ và dock thực tế. Gom chrome gọn; không giữ một hàng chỉ để báo thành công thường lệ. Không thu chữ bài, vùng bấm hoặc cắt hướng dẫn bắt buộc để lấy diện tích.
2. **Không có khoảng trống thừa dưới chân trang.** Trên màn đủ chỗ, hàng thao tác cuối sát đáy cửa sổ. Không trừ chiều cao của hàng đã ẩn, cộng đệm hai lần hoặc giữ footer thương hiệu trong workspace. Màn thấp/hẹp và bàn phím có thể cần cuộn; chỉ chừa safe area và phần bù thật để đọc/gõ được ô cuối. Không ép chiều cao cố định làm mất nội dung, form vào bài hoặc popup.
3. **Trạng thái có một khu vực nhất quán.** Tiến độ, lưu thiết bị/máy chủ, nộp/chấm và đồng bộ Homework được nhóm tại một nơi dễ tìm. Khi đủ ngang, thông báo Homework nằm cạnh trạng thái lưu với cùng vai trò chữ; hẹp thì xuống dòng trong chính nhóm đó. Không rải banner thành công giữa đầu và cuối bài, không lặp cùng trạng thái. Vẫn phân biệt từng kết quả nghiệp vụ và giữ cảnh báo/lỗi đầy đủ cùng thao tác phục hồi. Đồng hồ, thanh nghe và phản hồi học tập gắn với câu/đoạn giữ đúng vị trí phục vụ thao tác; không gom chúng thành một nhãn “đã xong”.

## Áp dụng theo engine

| Engine | Cách kế thừa |
|---|---|
| Reading Homework | Dùng khung và nhóm trạng thái ở dock của Lesson 12 cho các dạng còn lại, cả lúc sửa bài; giữ ngưỡng, 42 hay số target riêng và vòng sửa native. |
| Listening Homework | Giữ dock Mục 1–N sát đáy đã có; gom tiến độ/lưu/chấm/Docs và lỗi vào cùng vùng trạng thái, giữ audio/tua/tốc độ và nguồn theo phần. |
| Reading/Listening thực chiến | Giữ đồng hồ, lưu và tiến độ trong nhóm native; bỏ footer trang trí khi đang làm. Khung lấy chiều cao còn lại, không đẩy dãy câu khỏi màn thấp. Giữ timer, lượt nghe, thời gian rà, Note/Highlight và 40 số liên tục. |
| Skill thiết kế, clone, audio | Dùng nguyên tắc trong đúng consumer/master đang áp dụng. Mẫu được người dùng yêu cầu giữ nguyên vẫn ưu tiên; audio chỉ đổi hiển thị trạng thái trong phạm vi giao, không đổi tuyến tải/quyền/timing. |

Không tự chuyển Writing, SW, Speaking, Progress Log hoặc K56 sang layout của bốn engine này. Yêu cầu mới hoặc sửa mẫu riêng giữ ưu tiên. CSS của Lesson 12 là một cách triển khai, không phải công thức `position:fixed` cho mọi màn.

## Kiểm bằng kết quả nhìn thấy

- Đo header, vùng làm, dock và mép đáy trên desktop, 1366 × 600, màn hẹp và ngang thấp; không còn dải trống vô dụng. Kiểm cả tên bài/thông báo dài và cỡ A lớn.
- Đến ô/câu cuối bằng chuột và bàn phím; focus còn nhìn thấy, không bị dock/bàn phím che, không tràn ngang toàn trang. Options/đề giữ quan hệ native.
- Kiểm trạng thái đang lưu, đã lưu, đang chấm, lỗi và Homework chờ/đã cập nhật. Lỗi còn nội dung và cách thử lại; trạng thái thay đổi không tạo thêm khối rải rác.
- Qua ít nhất ba nhịp cập nhật nền, giữ node, focus, bôi chọn và cuộn khi nội dung không đổi. Kiểm lúc làm, sửa, kết quả và GV chỉ xem theo phần thực sự chịu tác động.
- Ghi rõ renderer/CSS với dữ liệu giả, API thật và thiết bị thật là các mức khác nhau. Có nguyên tắc hay ảnh không chứng minh mọi consumer đã triển khai.

Các DOCX/bản chụp có ngày 28–30/10 giữ nội dung tại mốc đã giao. Bổ sung này và catalog hiện hành là nguồn đọc tiếp; không sửa hồi tố biên nhận cũ hoặc tự phát lại sản phẩm chỉ vì cập nhật skill.

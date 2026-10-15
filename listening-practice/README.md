# Listening thực chiến · Buổi 8

Giảng viên dùng phiên cookie HttpOnly riêng của Listening, theo mẫu Reading: ghi nhớ mặc định 90 ngày không hoạt động, tối đa 365 ngày; bỏ ghi nhớ còn một giờ. Mở tab/link kết quả mới vẫn nhận diện, mỗi lần xem vẫn kiểm quyền lớp. Đăng xuất xóa kết quả/audio đang xem ở các tab giảng viên. Helper gửi cookie dùng lại ../shared/teacher-session-client.js, không giữ token mới trong JavaScript.

Giao diện giữ bộ Reading gốc. app.js chỉ thay điểm mở lời giải để nhận cửa sổ transcript/giải thích; các phần làm bài, lưu, thời gian và chấm vẫn dùng handler hiện có.

- `explanation-dialog.css`: CSS cửa sổ Reading dùng lại nguyên bản.
- `explanation-review.js`, `review.css`, `review-audio.js`: transcript, đối chiếu ý và phát lại từng đoạn có mốc. Dữ liệu chỉ nhận qua API sau nộp; không chứa key/transcript riêng trong repository này.
- `flow-options.js`, `flow-options.css`: giữ select gốc, thêm bảng chọn chữ + từ, bảng A–H cạnh flowchart trên màn rộng, bảng từ dưới lên trên điện thoại. Giữ thứ tự chữ trong DOM để Highlight/Note không đổi vị trí.

Thanh audio một hàng, âm lượng trước đồng hồ; chỉ ẩn dòng đang nghe thông thường. Q26–30 bỏ đệm trên để ngang Q21–25. Màn rất thấp có chiều cao tối thiểu để cuộn được vùng đề. Không sửa 9 CSS nền hoặc annotations.js.

API riêng do config.js chỉ định. Audio xem lại lấy URL tương đối từ kết quả, giải theo API base; không lấy từ tên miền Pages. Giữ xác thực học viên/GV và không tạo lượt làm khi xem lại.

Backend/test/canary và quy trình quay lại: repository izone-classroom-mapping-review, products/listening-practice. Mở lớp/đăng ký link bài là bước riêng với đúng tài liệu homework, không suy từ việc Pages đã phát hành.

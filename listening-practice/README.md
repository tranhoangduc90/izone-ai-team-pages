# Listening thực chiến · Buổi 8

Giảng viên dùng phiên cookie HttpOnly riêng của Listening, theo mẫu Reading: ghi nhớ mặc định 90 ngày không hoạt động, tối đa 365 ngày; bỏ ghi nhớ còn một giờ. Mở tab/link kết quả mới vẫn nhận diện, mỗi lần xem vẫn kiểm quyền lớp. Đăng xuất xóa kết quả/audio đang xem ở các tab giảng viên. Helper gửi cookie dùng lại ../shared/teacher-session-client.js, không giữ token mới trong JavaScript.

Giao diện giữ bộ Reading gốc. app.js chỉ thay điểm mở lời giải để nhận cửa sổ transcript/giải thích; các phần làm bài, lưu, thời gian và chấm vẫn dùng handler hiện có.

- `explanation-dialog.css`: CSS cửa sổ Reading dùng lại nguyên bản.
- `explanation-review.js`, `review.css`, `review-audio.js`: transcript, đối chiếu ý và phát lại từng đoạn có mốc. Dữ liệu chỉ nhận qua API sau nộp; không chứa key/transcript riêng trong repository này.
- `flow-options.js`, `flow-options.css`: giữ select gốc, thêm bảng chọn chữ + từ, bảng A–H cạnh flowchart trên màn rộng, bảng từ dưới lên trên điện thoại. Giữ thứ tự chữ trong DOM để Highlight/Note không đổi vị trí.

Thanh audio một hàng, âm lượng trước đồng hồ; chỉ ẩn dòng đang nghe thông thường. Q26–30 bỏ đệm trên để ngang Q21–25. Màn rất thấp có chiều cao tối thiểu để cuộn được vùng đề. Không sửa 9 CSS nền hoặc annotations.js.

Master170 bổ sung giới hạn chiều cao cho cả bài có flowchart và bài Note Completion: khi viewport cao tối đa 700px, khung có thanh audio giữ tối thiểu 800px để vùng đề còn đọc và thao tác được. Khoảng cuộn cuối trang giữ focus cách footer cố định. Trang cuộn theo chiều dọc; audio, tốc độ phát, timer, lưu/nộp và quyền xem lại giữ nguyên. Hồi quy bố cục dùng `tests/practice-short-viewport-browser.mjs`; fixture không chứa đề, key, audio hoặc API thật, nên cần kiểm ứng dụng/API riêng.

API riêng do config.js chỉ định. Audio xem lại lấy URL tương đối từ kết quả, giải theo API base; không lấy từ tên miền Pages. Giữ xác thực học viên/GV và không tạo lượt làm khi xem lại.

Backend/test/canary và quy trình quay lại: repository izone-classroom-mapping-review, products/listening-practice. Mở lớp/đăng ký link bài là bước riêng với đúng tài liệu homework, không suy từ việc Pages đã phát hành.

## Chuẩn bị nghe lại sớm — 26/10/2026

Mọi kết quả đã nộp dùng engine này, gồm Buổi 8 và 10, chuẩn bị audio sau khi hiện điểm. API nghe lại vẫn xác minh đúng người/GV trước khi module tải dùng lại một Blob hoàn chỉnh đã kiểm hash trong tab. Chưa có file thì giữ bộ nhớ đệm từng phần và tuyến Cloudflare/Pages cũ; không tải sớm từ màn chuẩn bị, đang làm, nháp hoặc kết quả chưa nộp.

Tải sớm và bấm nghe dùng chung một công việc. Chuẩn bị decoder không phát tiếng; chỉ nút nghe mới phát. Đổi câu hủy ý định phát cũ, hủy/đóng/ẩn tab dừng phần chuẩn bị đang chờ; đổi người, đổi kết quả và đăng xuất bỏ kết quả trả về muộn. Mỗi URL Blob do trình phát xem lại sở hữu được giải phóng khi đổi ngữ cảnh; bộ nhớ file không lưu quyền và được xóa khi đổi người/đăng xuất. Không gộp controller nghe một lượt với controller xem lại.

Chi tiết hành vi, phép kiểm, giới hạn và quay lui: [hồ sơ tối ưu nghe lại](../docs/LISTENING_REPLAY_FAST_2026-10-26.md). Các bài sau kế thừa cùng engine và cùng query version của `audio-delivery.mjs` ở `app.js`/`explanation-review.js`, tránh tạo hai bộ nhớ module riêng.

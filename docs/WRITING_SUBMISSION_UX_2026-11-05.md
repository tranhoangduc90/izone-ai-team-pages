# Writing: đã nhận bài, chờ chấm và nhấn Nộp lại

Phạm vi: Mini/Term 1/2/Substitute 1/2 K56/K67, các app native tương ứng. Bảy app dùng module `term-tests/shared/writing-submission.mjs`. Giữ thiết kế riêng từng khóa; tái sử dụng vùng trạng thái Writing hiện có, không thêm luồng chờ chấm cho Listening/Reading.

## Hành vi

- Nhấn Nộp có thông báo ngay. Handler giữ một lần gửi đang chờ; thao tác lặp không gửi thêm request.
- Đã có biên nhận thì giữ “đã nhận”; phân biệt queued với processing, ready và lỗi chấm. Nút kiểm tra trạng thái chỉ đọc, không gọi nộp/chấm lại.
- Gói Substitute chưa rõ kết quả được giữ riêng theo bài/lớp/người/lượt, đọc biên nhận trước khi gửi lại cùng snapshot. Kho đã queued nhưng chưa chuyển được sang bộ chấm được nói rõ, không giả đang chấm.
- Phản hồi khác chủ/lượt bị bỏ. Lỗi đọc kết quả sau nộp không biến thành lỗi chưa nhận bài.
- Polling tiếp tục hoạt động; dữ liệu Writing không đổi giữ node và vùng đọc. Khóa gửi không thay deadline, quy tắc trắng/thiếu Task hoặc bảo vệ định danh.
- Native Listening/Reading handler giữ nguyên; xác nhận lưu xong chuyển kỹ năng theo engine cũ.

## Kiểm và giới hạn

`node --test tests/writing-submit-contract.mjs` chạy handler thật cùng controller: gửi lặp, mất ACK, đổi người, đọc kết quả lỗi, phục hồi pending qua reload. BASE_REF cho cùng ca RED trên mã trước sửa.

`node --test tests/writing-submit-status-browser.mjs` kiểm sáu Term/Mini qua ba nhịp tự cập nhật, thao tác kiểm trạng thái chỉ đọc và ready, renderer/entry thật với API giả. Bốn Substitute dùng `tests/substitute-submit-browser.mjs` qua toàn hành trình, gửi ba sự kiện submit trong lúc mạng chờ, kiểm trạng thái và reload; cần PLAYWRIGHT_MODULE và fixture/store đúng phạm vi. Không gọi AI/Portal.

Kế thừa bộ ca `term-writing-save-clients.cjs`, contract ACK/renderer, pending/cache, Listening 48 và Reading 96. Các fixture được cập nhật để phục vụ `.mjs` và mock dependency riêng của renderer; không thay kỳ vọng nghiệp vụ.

Loader tới bảy app được tăng query `writingSubmit=20261105-v1` theo chuỗi index → bootstrap → app → module. Không đổi các query lịch sử khác. Các route thiết kế/phiếu dự phòng dùng cùng app cũng cần nhận đúng dependency; thay đổi tại đó chỉ là cache revision.

API Substitute phải có phép sửa `writing-dispatch-receipt.mjs` ở repo chung để chống race giữa các tab. Frontend khóa gửi một tab không thay bảo vệ phía máy chủ. Backend Term/Mini, rubric, model, đồng bộ Portal và nội dung đề không đổi.

Bằng chứng riêng máy Đức: `E:/Codex-Data/investigations/substitute-submit-20261104/`. Có ảnh desktop/hẹp, RED/GREEN, các runner cuối và readback phát hành. Bộ ca dùng dữ liệu giả không chứng minh một lớp thật mới đã thi trọn vẹn; không nộp/chấm lại bài học viên để lấp phần này.

Hậu kiểm public 05/11: 38 tài nguyên khớp nội dung đã merge; sáu Term/Mini đạt kiểm trạng thái, ready và ba nhịp polling; cả bốn Substitute đạt hành trình gửi lặp, lỗi mạng, kiểm trạng thái và reload. Runner lỗi Writing chờ đúng response `/api/test/writing` và thông báo lỗi sau đối soát, tránh nhận nhầm response `/status` hoặc thông báo “đang gửi” là hoàn tất. API được giả lập trong browser; không gọi AI/Portal.

Rollback frontend bằng commit hoàn tác, API bằng snapshot riêng của đúng workflow; giữ dữ liệu mới. Không reset storage hoặc restore dump để quay code.

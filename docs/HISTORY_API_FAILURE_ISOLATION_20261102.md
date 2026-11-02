# Không để lỗi ghi URL làm dừng bài làm hoặc màn đang xem

Bản đầu [PR416](https://github.com/tranhoangduc90/izone-ai-team-pages/pull/416) giữ việc nhận/lưu đủ 42 đáp án Reading Homework khi History API bị trình duyệt từ chối. Gói tiếp nối rà 54 tệp với 85 điểm dùng History API trong source ứng dụng, bảo vệ thêm **46 thao tác URL phụ trợ trong 31 tệp**. HTML/module/loader được nối cache qua **77 tham chiếu thuộc 64 tệp**, giữ các version nghiệp vụ đã có và thêm `history=20261102-1`.

## Phạm vi áp dụng

| Sản phẩm/luồng | Thành quả | Phần giữ nguyên |
|---|---|---|
| Sáu Reading Homework và demo dùng cùng renderer | Nhập/lưu từ PR416; tiếp tục nháp, Sửa bài và đổi cách xem không bị lỗi URL chặn | 42 target của TFNG, nội dung/ID/version, chấm, nháp và quyền chỉ xem |
| Năm Listening Homework cùng controller | Mã alias cũ vẫn được xác minh/mở; lối GV vẫn xác thực và mở chỉ xem | Chủ Docs, ERP, phiên, audio, bộ chấm |
| Reading và Listening thực chiến | Link entry vẫn qua bước kiểm chủ/mở bài dù không dọn được URL | Timer, audio, bài/nháp, nộp và quyền |
| Tiến trình GV Reading/Listening/Speaking | Đổi lớp/bài/vị trí xem không biến lỗi URL thành lỗi tải dữ liệu | API chỉ đọc, phiên GV và phạm vi người/lượt |
| Term/Mini K56 và K67 | Phản hồi thứ tự/hạn/trạng thái thi vẫn được áp vào RAM; các bước chọn lớp và vào bài tiếp tục | Token lượt, deadline, thứ tự kỹ năng, nháp, receipt nộp và Writing |
| Bốn Substitute, kết quả và dashboard liên quan | Đổi lớp, khôi phục/vào bài và xem kết quả không dừng vì URL | Cơ chế chủ lượt/reset/epoch, token, kết quả và Portal |
| Progress Log | Danh sách lớp/phiếu tiếp tục tải; đăng xuất Journey tiếp tục điều hướng sau khi đã quên phiên | Quyền, dữ liệu, API và luồng điểm danh |
| Writing Flow v2 | Chuyển thẻ và mở chi tiết ngày vẫn tải đúng nhóm/khoảng ngày | Source/bài viết, bộ chấm, giao tài liệu; handout/SW không có điểm cùng lỗi nên không đổi |
| Các trang chấm legacy/Vocab, Bổ trợ và mẫu Writing từng bước | URL không chặn đăng ký handler hoặc dựng bước tiếp | Nội dung, đích nhận bài và quyền native; mẫu/demo không được nhận thành production mới |

Các chỗ dùng `history.state` để ghim đúng chủ, kiểm reset, giữ ý định logout K56 hoặc lưu trạng thái demo không bị đổi hàng loạt. Chúng có hợp đồng và cách báo lỗi riêng. Progress Log demo cần URL làm nguồn token; các config Substitute cần URL để chọn tuyến được giữ nguyên. Tài liệu/design/historical preview không được lấy làm consumer production mới.

## Cách sửa và luật kế thừa

Chỉ bọc chính lời gọi `replaceState`/`pushState` phụ trợ; lỗi đó không ngăn bước cập nhật trạng thái, tải dữ liệu hoặc dựng màn phía sau. Không bao cả hàm nghiệp vụ bằng catch mới. Bản nhập liệu PR416 còn tránh gọi History API nếu URL không đổi để không tạo thao tác thừa trên từng lần gõ.

Khi thêm bài hoặc dùng lại engine: lấy source main hiện hành, giữ query của HTML → loader → module; không copy handler từ bản trước PR416. Xác định rõ URL là gợi ý điều hướng hay một phần hợp đồng ghim phiên/reset trước khi thêm fallback. Không thay lỗi xác thực hoặc lưu bài thật thành thành công vì có cơ chế bỏ qua lỗi URL.

## Bằng chứng và giới hạn

- `tests/history-ui-failure.test.mjs`: **10 RED trên nguồn base → 10 GREEN**, chạy hàm thật trong VM với DOM/HTTP giả. Kiểm phản hồi K56/K67, mở Reading/Listening entry, khôi phục Homework, lớp Progress Log, thẻ/ngày Writing Flow và vị trí xem GV. Đây không phải bằng chứng toàn trang hoặc SQL production.
- Ba ca History API trong `tests/listening-homework-owner-entry-browser.mjs`: **3 RED trên base → 3 GREEN** bằng controller/renderer thật, HTTP giả và tên giả. Có alias, chuyển GV, đúng chủ và readonly.
- Hồi quy nhập/lưu/reload đủ 42 ô: 3/3; T/F/NG 5/5 viewport; kiểm thứ tự/nộp/cache 50/50 (đã gồm 10 ca VM trên); tiến trình GV 6/6; Progress Log teacher 1/1 và Journey 1/1; Writing Flow 24/24 ca bố cục.
- Listening Homework: ca hai tab nay đợi đúng nội dung được lưu ở fixture, tránh nhận dòng ACK của bản nháp trước là bằng chứng lưu bản mới. Không hạ kỳ vọng nội dung hoặc quyền.
- K56 session/navigation hiện hành: 19/19 đạt. Runner logout cũ có 11 ca dừng ở setup chờ Google callback dù chuẩn hiện hành tải Google khi cần; baseline kiểm mẫu cùng lỗi setup. Không coi 11 ca đã kiểm được logout. Runner retained-resume cũ: 25/39 đạt, cùng 14 lỗi trên base; giữ nguyên runner và lỗi để theo dõi, không gọi toàn bộ suite xanh.

Mọi kiểm trên dùng dữ liệu giả/fixture riêng hoặc bản nội dung được cấp riêng, chặn kết nối ghi thật. Chưa kiểm mọi thiết bị, Google thật, AI, SQL, Docs, Portal hoặc lượt mới của học viên. Bản sửa không tự phục hồi nội dung chưa được lưu trong một tab cũ; lưu riêng nội dung đang hiện trước khi tải lại.

Source base gói tiếp nối: `73818cf50ebfeb55fbdb912d5b853e7262fe08b5`. Readback deployment/assets và bản lưu local theo biên nhận của lượt phát, không suy merge Git là đã phát. Quay code bằng revert đúng gói frontend/cache trên main mới; không restore database, reset hoặc tái chấm bài thật.

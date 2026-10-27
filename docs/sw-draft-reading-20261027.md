# SW: giữ trạng thái đọc kết quả Draft khi cập nhật nền

## Lỗi và nguyên nhân

Màn chấm Draft ở tám bài SW dùng chung engine. Mỗi khoảng 5 giây, đọc phiên/trao đổi xong lại thay toàn bộ `#app`, tạo placeholder kết quả rồi GET kết quả thêm lần nữa. Người đọc thấy loading lặp, mất focus/bôi chọn dù dữ liệu không đổi. Cơ chế bảo vệ ô nhập đang focus chưa bảo vệ việc đọc.

Ca browser trên bản gốc tái hiện trong 35 giây: 7 lần loading, node vùng kết quả/thẻ/focus/bôi chọn và vị trí đọc không được giữ. Cùng ca được chạy lại trên bản vá, không sửa bản gốc để gây lỗi giả. Tham khảo bất biến K67 tại commit `689a672ab74aed6b68f07e8d10026cecfc714fc6` và `tests/term-test-k67-result-details.mjs`.

## Thay đổi

- `shared/reading-view.mjs` được hai consumer SW/Shops nạp trực tiếp: cập nhật các node thay đổi trong lần đọc nền, giữ node không đổi và dialog đang mở. Vùng kết quả cùng định danh lượt được giữ nguyên, kể cả có trao đổi mới ở phần khác.
- Hai `connected-app.mjs` dựng markup đầy đủ trước khi cập nhật DOM; vẫn giữ Markdown, nháp reply, trạng thái details, xác nhận GV và guard phiên chỉ đọc. Render chủ động do người dùng vẫn giữ vùng kết quả cùng lượt.
- Lượt chấm được nhận diện theo bài/lớp/người/phiên/attempt/thời điểm hoàn tất và generation. Không dùng chỉ sessionRef để mang số thẻ hoặc response sang lượt/người khác.
- GET kết quả vẫn chạy nền vì API có thể trả bản sửa trong cùng attempt mà không đổi draftVersion. Nội dung thẻ không đổi thì không dựng lại; chỉ timestamp thay đổi cũng không phá thẻ. Request đang chờ cùng khóa được gom. Lỗi đọc tạm giữ bản đang xem và báo lỗi; 401/403 xóa thẻ cũ. Response muộn của người/lượt trước bị bỏ.
- Nâng query cache `reading=20261027-v1` ở bốn entry SW/Shops, giữ các revision nghiệp vụ và startup cũ. Module mới có query riêng.

Phạm vi runtime: hai consumer SW/Shops và tám cấu hình SW; không đổi backend, AI, dữ liệu bài làm, đề/rubric, roster, Term Test hay Handout 67. Shared helper mới chỉ có hai consumer này import. Không có công cụ graph trong phiên; phạm vi được đối chiếu qua import/entry và browser thật.

## Bằng chứng kiểm

Nguồn chuẩn để chạy hồi quy là `tests/sw-draft-reading-browser.mjs`: dùng HTML/module thật, Chrome headless, toàn bộ API/Google bằng fixture và chặn request thoát ra dịch vụ thật. Chỉ dữ liệu giả được dùng; fixture giữ nguyên interval 5 giây của sản phẩm.

| Nhóm | Kết quả |
|---|---|
| RED trên bản chưa sửa | Đúng lỗi vùng đọc bị thay/loading 7 lần trong 35 giây |
| Browser SW chuyên biệt | Lượt cuối 5/5 đạt, 0 skip, 205,6 giây: ba màn × 35 giây, tám cấu hình mobile và các ca cập nhật/lỗi/đổi người |
| Khởi động/phiên SW/Shops | `teacher-startup-sw-browser.mjs`: 30/30 tình huống desktop/mobile |
| Writing | `npm test`: 204/204; `npm run check`: đạt |
| Cấu hình, từ vựng và K67 lân cận | 4/4 ca đạt |
| Handout 67 lân cận | 49/62 đạt, 13 lỗi fixture có sẵn; bản gốc và bản vá cùng 49/62. Không sửa test hoặc sản phẩm 67 để che lỗi |
| Cú pháp và diff | Các module thay đổi qua `node --check`; `git diff --check` đạt |

13 lỗi Handout 67 nằm ở fixture nhật ký/giảng viên thiếu biên đăng nhập (gồm `createTeacherAuthState`); các file nguồn liên quan không đổi. Bộ SW có kiểm startup/guard riêng đã chạy. Không gọi toàn bộ suite xanh.

Các ca SW cần giữ: ba màn học viên SW/giảng viên SW/giảng viên Shops mỗi màn 35 giây; focus, bôi chọn, thẻ và vị trí nội dung trên màn hình; trao đổi mới; pending → hoàn tất; lượt mới; 0 thẻ; sửa kết quả cùng lượt; 503/403/phục hồi; autosave; response muộn khi đổi người; phiên chỉ đọc; đủ tám bài ở viewport 390.

Các lệnh nhận source của checkout hiện tại và dùng fixture cách ly để trả số ca đạt/lỗi tại terminal: `node --test tests/sw-draft-reading-browser.mjs`, `node tests/teacher-startup-sw-browser.mjs`, `npm test` trong `writing-handouts`. Startup runner cần đặt `TEACHER_STARTUP_ROOT` và `TEACHER_STARTUP_OUTPUT` theo phần cấu hình đầu file; ảnh/log lưu ngoài Git. Không trỏ fixture vào API thật.

## Phát hành và quay lui

Bản ghi này chốt bằng chứng local trước phát hành. Đức đã duyệt Git và phát hành Pages cho đúng gói ngày 27/10/2026. Kết quả merge/build/hash asset public và kiểm màn thật được ghi riêng trong PR sau khi thực hiện; không suy kiểm local thành website đã được kiểm. Fixture online chỉ chứng minh frontend công khai với dữ liệu giả; đọc phiên thật là bằng chứng riêng, không nộp/chấm lại bài để kiểm.

Quay lui bằng commit đảo đúng gói này trên main hiện hành, không reset/force push hoặc restore database. Module mới không có consumer khác, nên việc đảo các import/entry và engine không đòi thay runtime backend.

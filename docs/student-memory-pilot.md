# Bản thử ghi nhớ học viên giữa các bài Writing

## Phạm vi phát hành được duyệt ngày 05/09/2026

Đức đã yêu cầu phát hành cho hai lớp CS vừa mở webapp Task 2. Cấu hình phát hành bật cho `CS.070626` và `CS.160826`, thay cho phạm vi IC2200 từng đề xuất bên dưới. Các bài đã gắn hai lớp này dùng chung phần ghi nhớ; không mở thêm lớp hoặc thay đổi danh sách học viên. Bài `writing-task2-public-health-spending` là một trong các bài được kiểm trực tiếp. Lịch sử bản thử bên dưới được giữ để truy vết; trạng thái phát hành thật phải theo biên bản readback.

Trước ghi cấu hình đã khóa: giữ hành vi bản thử đã kiểm, chỉ bật cờ và đổi hai mã lớp; kiểm bằng fixture cho từng lớp CS và lớp ngoài phạm vi. Rollback bằng tắt cờ hoặc hoàn tác commit phát hành frontend; không sửa database/n8n/bài làm.

## Đặc tả đã khóa trước khi sửa giao diện

- Nguồn: repo `izone-ai-team-pages`, commit `8bd63a6`, đọc ngày 05/09/2026; `writing-handouts/index.html`, `lesson.html` và hai ứng dụng JavaScript tương ứng.
- Phạm vi: Writing Task 1 và Task 2, một lớp trong cấu hình thử. Tính năng mặc định tắt. Bản xem local dùng lớp và học viên giả; chưa phát hành hoặc gắn lớp thật.
- Term Test chưa thuộc bản thử: cần xác minh backend đang chạy trước khi nối nhận diện. Mã lớp Writing là phạm vi riêng từng activity; không tái sử dụng mã lớp từ bài trước.
- Giữ nguyên: đề, nội dung, màu/font/khoảng cách theo CSS hiện hành, chấm bài, điều kiện mở khóa, API, lưu nháp và xác thực mã hồ sơ tạm. Không sửa database/n8n.
- Được đổi: chọn sẵn lớp/tên khi ID chính thức khớp duy nhất trong roster mới; thêm ô ghi nhớ tự nguyện và nút đổi người; link có lớp ưu tiên hơn bộ nhớ; chặn mở bài lặp khi đang tải.
- Bộ nhớ mới chỉ chứa phiên bản và UUID công khai của học viên, tách theo địa chỉ API. Không chứa tên, mã lớp theo bài, mã truy cập, token hoặc bài viết. Đây là gợi ý điền form, không phải quyền truy cập.
- Nếu học viên thuộc nhiều lớp trong bài mới: chỉ tự điền khi link xác định một lớp hợp lệ; nếu không thì yêu cầu chọn lớp. Không ghép theo tên, thứ tự hoặc phần tử đầu tiên.
- Người dùng vẫn bấm **Mở bài làm**. Không tự tạo phiên, gửi bài hoặc bắt đầu tính giờ. Hồ sơ tạm không được dùng để tự nhận diện xuyên bài và vẫn cần mã truy cập.
- Trong phạm vi thử, nút **Tiếp tục bài gần nhất trên thiết bị** được thay bằng luồng **Mở bài làm** theo danh tính đã chọn để tránh mở bài của người dùng máy trước. Bản nháp cũ vẫn giữ nguyên và được khôi phục theo đúng khóa bài/lớp/học viên.
- Đổi người khi đang làm: lưu thành công, kiểm không còn bản sửa chưa lưu rồi mới quên lựa chọn và tải lại form. Nếu lỗi hoặc xung đột thì giữ nguyên bài và hiển thị lỗi.
- Không tự đổi người trong tab đang làm khi tab khác đổi bộ nhớ; danh tính phiên hiện tại vẫn cố định.

## Ma trận nghiệm thu

Chưa chọn; chọn lần đầu có/không ghi nhớ; tải lại; chuyển Task 1 ↔ Task 2 với classRef khác; roster đảo thứ tự; trùng tên khác UUID; 0/1/nhiều lớp; query lớp đúng/sai/khác; hồ sơ tạm; ID biến mất; JSON lỗi; chặn lưu trình duyệt; API roster/mở phiên/lưu lỗi; bấm đôi; đổi người và bảo toàn bài cũ; desktop 1280×900 và mobile 390×844.

Ảnh baseline và bản sửa lấy từ cùng source với API giả, cùng viewport. Không có yêu cầu sao chép mẫu bên ngoài; font/màu giữ CSS gốc. Đáp án/công thức/câu hỏi mới: N/A vì không đổi đề hay bộ chấm. Kiểm production/cache phát hành: chưa áp dụng cho bản local, bắt buộc trước khi mở cho học viên.

## Rollback và trạng thái

Nhánh riêng `codex/student-memory-20260905`. Có thể bỏ commit bản thử hoặc tắt `studentMemory.enabled`; không xóa bài, IndexedDB hay database. Không sửa thay đổi đang có trong checkout chính. Chỉ commit các file của bản thử sau kiểm tra; chưa push.

## Cách đọc phần kiểm thử

Các script kiểm thử nhận source và roster giả, mô phỏng thao tác người học rồi kiểm đúng UUID được gửi khi mở/lưu phiên. Chúng không gọi hệ thống thật. Khi sai, script báo ca lỗi; ảnh chỉ chứa tên giả. Kiểm thử tự động không chứng minh backend production đã được xác minh.

## Cấu hình và hợp đồng nhận diện

`writing-handouts/config.json` có `studentMemory.enabled=false` và phạm vi lớp đề xuất `IC2200`. Chỉ đổi sang `true` sau khi được duyệt mở thử. Đây là cấu hình hiển thị, không phải cơ chế cấp quyền. Link lớp có thể dùng `class=IC2200`; không cần link riêng từng học viên.

Hai bài dự kiến: Task 1 `pie-app-users-by-age` và Task 2 `writing-task2-lawbreakers-prison-alternatives`. Hợp đồng máy đọc nằm ở `student-memory-identity-contract.json`: nối roster bằng UUID học viên, chốt cặp lớp/người theo bài mới, giữ nguyên đích phiên đang làm dù tab khác đổi ghi nhớ. Các tên test `batch_interleaved`/`out_of_order` ứng với hai tab khác người, danh sách đảo thứ tự và request mở bị trì hoãn; không có hàng đợi backend mới.

Trong hợp đồng, `target_key` là UUID người nhận, `target_scope` là bài/lớp hiện tại, còn `storage_slot` là ô bộ nhớ dùng chung theo API. Ô bộ nhớ được ghi đè có chủ đích khi đổi người; không phải bảng lưu một dòng cho mỗi học viên. Checker chỉ kiểm hợp đồng nhận diện; test trình duyệt mới xác minh lớp đích và ô lưu thực tế.

Kiểm thử logic: chạy `npm test` và `npm run check` trong `writing-handouts`, cộng kiểm cú pháp hai module `student-memory.js` và `student-memory-ui.js`. Kiểm trình duyệt: chạy server tĩnh ở cổng 4187 chỉ trên `127.0.0.1`, mở một phiên `playwright-cli` riêng rồi chạy `tests/student-memory-ui.cjs`. Script mô phỏng API trước khi mở app, trả báo cáo JSON có `outcome`, `baseline`, danh sách ca và số yêu cầu ngoài. Chỉ coi đạt khi `outcome=success`, `baseline=false`, không có lỗi tool. Hai ảnh bản thử nằm ở `output/playwright/student-memory-pilot-*.png` và không được commit vào repo.

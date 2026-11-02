# Reading Homework: giữ đáp án khi trình duyệt từ chối sửa URL

Khi `history.replaceState()` ném lỗi, ô trả lời vẫn hiện giá trị đã nhập nhưng handler dừng trước khi cập nhật đáp án và tự lưu. Người học có thể điền đủ 42 ô T/F/NG mà Rà soát vẫn báo 0/42. Đây là cơ chế đã tái hiện; chưa có console của thiết bị báo lỗi để xác nhận nguyên nhân riêng trên thiết bị đó.

`reading-skills67/prototype.js` nay chỉ cập nhật History API khi URL thực sự đổi và cô lập lỗi cập nhật URL khỏi việc nhận/lưu đáp án. Giữ cách chuyển bản minh họa, nhận diện, quyền chỉ xem, nội dung, ID và phiên bản bài. Bảy entry tham chiếu prototype đã tăng query cache, gồm đường tải gián tiếp của Green roofs.

Không sửa bộ chấm, backend, dữ liệu học viên hoặc đường đăng nhập. Gói này chỉ sửa source trên branch, chưa merge/phát hành; tab đang mở không tự nhận bản sửa và không được coi đã khôi phục dữ liệu chưa lưu.

## Kiểm chứng

Nền: `2aab7a550921437a9dc934dff3866fe671f23c80`.

- `tests/reading-homework-input-history-browser.test.mjs`: **3 RED trên base → 3 GREEN sau sửa**, cùng test. Hai ca chủ động từ chối History API tại 1440/390px kiểm đủ 42 giá trị gửi lưu, Rà soát 42/42, reload nhận đủ đáp án và không có lỗi JavaScript. Ca còn lại kiểm gõ đáp án không sửa lịch sử khi URL không đổi. Dùng entry/renderer/web-client thật, HTTP fixture cách ly và danh tính giả; chưa chứng minh ghi SQL production.
- `tests/tfng-homework-browser.mjs`: **5/5 viewport đạt**, gồm nháp, vòng sửa/nộp, lịch sử, popup, chỉ xem và ba nhịp giữ vùng đang đọc. Client và chấm là fixture.
- `tests/materials-status-browser.mjs`: **33/33 đạt**.
- `tests/reading-homework-concise-browser.mjs`, chế độ `states`: **18/18 đạt**, năm bài còn lại cùng legacy root tại 1440/390/320px. Nguồn nội dung/nháp được cấp riêng ngoài Git; mọi kết nối ghi thật bị chặn.
- `reading-skills67/test/materials-repair-browser.test.mjs`: **16/23 đạt, 7 thất bại có sẵn**. Chạy lại đúng bảy ca với `MATERIALS_SITE_ROOT` trỏ base đã xác minh sạch: cùng lỗi, ba ca còn tìm nút “Tôi sẽ sửa”, bốn ca còn đòi “Trạng thái Homework” sau thay đổi nhãn/bố cục trước đó. Không sửa runner hoặc hành vi ngoài phạm vi để làm xanh. Không nhận toàn bộ suite xanh.
- `node --check reading-skills67/prototype.js` và `git diff --check`: đạt.

Phạm vi test được chọn theo shared prototype và các consumer Reading Homework; không chạy toàn bộ sản phẩm trong repo. Graph tool không có trong phiên; đã truy toàn bộ HTML/loader tham chiếu prototype trực tiếp. Không kiểm thiết bị học viên thật, Google thật, AI, SQL, Docs hoặc production.

## Chạy hồi quy mới

`node --test tests/reading-homework-input-history-browser.test.mjs`

Lệnh mở Chrome cách ly, dùng nội dung và tên giả, chặn dịch vụ bên ngoài, điền và đọc lại đủ 42 đáp án. Kết quả liệt kê ba ca đạt/thất bại; khi hỏng sẽ chỉ rõ đáp án thiếu hoặc lỗi trình duyệt. Không có yêu cầu package/flag phục vụ test được thêm vào code production.

Nếu phát hành sau: quay lui bằng revert đúng gói source/cache version; không restore database hoặc reset bài học viên.

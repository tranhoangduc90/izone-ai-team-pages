# Báo rõ nội dung còn thiếu khi Check Writing

Phạm vi: tám bài SW Task 2, engine Shops cùng nguồn và handout Writing 67 Lesson 5/7/9/11. Giữ giao diện, rubric, tiến độ, quyền và dữ liệu cũ. Không tạo lượt chấm thật để kiểm.

## Hành vi

- Mỗi nút Check kiểm đúng các ô thuộc phần đó. SW đọc `requiredFields`/`validationMode` từ cấu hình máy chủ; Writing 67 dùng `workflowFor(lesson).fields` đang điều khiển chính form. Chuỗi chỉ có khoảng trắng/ký tự vô hình không được coi là nội dung.
- Thiếu nhiều ô: hộp giữa màn hình liệt kê tất cả tên ô. Nút “Đến ô cần bổ sung” đóng hộp, mở phần đang thu gọn, cuộn và đặt con trỏ đúng ô đầu tiên. Escape/bấm nền ngoài cũng đưa về ô cần sửa. Mỗi ô thiếu có viền đỏ, lời nhắc và liên kết trợ năng; gõ đủ thì tự gỡ nhắc. Học viên vẫn được nhập, sửa và lưu nháp.
- SW hiện trạng thái đang lưu/gửi, gộp các lần nhấn khi một Check đang gửi và báo lỗi ngay ở nơi thao tác. Nếu học viên sửa tiếp trong lúc lưu, giữ chữ mới và yêu cầu Check lại để tránh âm thầm gửi bản cũ. Cập nhật nền vẫn tiếp tục sau khi đóng hộp; giữ bảo vệ phiên, bản lưu mới hơn và vùng đọc.
- CSS là tệp cùng origin để tuân thủ CSP của Writing 67. Đổi cache xuyên entrypoint → loader → app → helper/CSS.

## Kiểm chứng

- `tests/sw-check-second-browser.mjs`: hồi quy Check lần 2, response đọc cũ, đọc trong lúc lưu, xung đột thật, ô thiếu/ẩn, lỗi dịch vụ, nhấn lặp và sửa trong lúc lưu. Ma trận tám cấu hình × bốn phần = 32 vị trí Check. SW và legacy Shops dùng cùng ca.
- `tests/handout67-check-feedback-browser.mjs`: 24 vị trí trên bốn lesson, gồm B–A–X từng điểm, cả chuỗi, hai thân bài và bước lập ý. Thiếu thì không có POST Check; bổ sung đủ thì gửi đúng một POST. Kiểm desktop/mobile, focus, CSS thực tế và giữ nội dung.
- Ca thiếu nội dung RED trên main trước sửa (không có hộp liệt kê), GREEN trên source mới ở cả SW và Writing 67.
- `tests/sw-draft-reading-browser.mjs`: 8/8 đạt trên controller mới; giữ vùng đọc, focus, chữ, kết quả, trao đổi, người/lượt và các phản hồi muộn/lỗi.
- `tests/teacher-startup-sw-browser.mjs`: 30/30 đạt; không thay xác thực hoặc phạm vi quyền.
- `writing-handouts`: nhóm chung 204/204 đạt. Ở mốc phát giao diện, nhóm `test:handout67` là 49/62: 13 lỗi fixture `createTeacherAuthState is not defined` giống nguyên bản main trước sửa. Hai fixture VM học viên tối thiểu được bổ sung dependency UI giả; hộp thông báo thật được kiểm riêng bằng Chromium. Lần rà tiếp theo bên dưới đã khắc phục riêng 13 lỗi fixture giảng viên này.

Các phép thử dùng HTTP giả cách ly và dữ liệu tổng hợp. Đây không phải xác nhận mọi thiết bị học viên đã tải bản mới hoặc đã thao tác lại thành công. Sau phát hành phải đọc lại từng asset public, không chỉ dựa vào trạng thái GitHub.

## Phòng lỗi chấm Draft

Source SW backend giữ các ca hồi quy từ lặp, sửa đã khai báo nhưng gộp nhiều đoạn và giữ nguyên lời giải thích khi lưu thẻ tại `backend/ops/sw-task2-production/repairs-20261101/` của repository Writing. Các ca đối chiếu được đúng 14 validator và parser trong image writer hiện hành; không nới kiểm giải thích hoặc HTML để ép chấm thành công.

Quay lui riêng commit giao diện này và cache version. Không restore database hoặc ghi đè bài làm để quay code. Các sửa chấm Draft đã phát trước đó có điểm quay lui riêng trong hồ sơ backend.

## Rà và sửa 13 lỗi fixture giảng viên — 01/11/2026

Các test VM bỏ dòng `import` để chạy controller với DOM/API tối thiểu, nhưng chưa nạp module mới `shared/teacher-auth-state.js`. Vì vậy chúng dừng ở `ReferenceError` lúc khởi tạo màn, trước khi tới các assertion. Không có 13 lỗi tương ứng đã được quan sát trên trang học viên. Tuy nhiên, đây là khoảng trống kiểm thử cần khắc phục vì có thể che hồi quy màn giảng viên.

Đã bổ sung `tests/fixtures/teacher-auth-vm.mjs`: nạp nguyên module trạng thái đăng nhập thật vào VM, chỉ thêm thao tác DOM tối thiểu cho nút, thuộc tính và vùng thông báo. Không giả đăng nhập thành công, không thay kiểm quyền hoặc sửa assertion để ép đạt. Hai file test dùng helper này; không sửa JS/CSS/HTML ứng dụng hoặc dữ liệu bài làm.

13 ca trước đó bị chặn gồm: ba ca nhật ký/góp ý và đọc lại chi tiết; hai ca chọn lớp đúng quyền từ link; tám ca khóa lời trả lời khi gửi, giữ nháp, đối chiếu phiên bản, chống phản hồi muộn và đổi danh tính. Chạy lại đủ `npm run test:handout67` đạt **62/62, không skip**; chính 13 ca đó chuyển từ lỗi khởi tạo sang đạt assertion. Không phát hiện thêm lỗi runtime trong phạm vi các ca đã khôi phục. Bằng chứng VM không thay xác nhận mọi phiên hoặc thiết bị học viên.

Draft được đối chiếu lại bằng snapshot mới đọc từ workflow đang chạy: hai hàm sửa từ lặp/tách sửa đã khai báo khớp cả 14 validator, 4/4 ca đạt. Parser trong writer đang chạy đạt 2/2 ca bảo toàn lý do và làm sạch HTML. Hai kết quả được chỉ định vẫn trả HTTP 200, `readbackOk=true`, đủ 5 và 17 thẻ. Chỉ đọc/chạy parser với dữ liệu giả; không tạo lượt chấm hay gọi AI mới.

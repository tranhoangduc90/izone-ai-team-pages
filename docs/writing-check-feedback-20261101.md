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
- `writing-handouts`: nhóm chung 204/204 đạt. Nhóm `test:handout67` vẫn 49/62: 13 lỗi fixture `createTeacherAuthState is not defined` giống nguyên bản main trước sửa. Không coi nhóm này là xanh hoàn toàn. Hai fixture VM tối thiểu được bổ sung dependency UI giả; hộp thông báo thật được kiểm riêng bằng Chromium.

Các phép thử dùng HTTP giả cách ly và dữ liệu tổng hợp. Đây không phải xác nhận mọi thiết bị học viên đã tải bản mới hoặc đã thao tác lại thành công. Sau phát hành phải đọc lại từng asset public, không chỉ dựa vào trạng thái GitHub.

## Phòng lỗi chấm Draft

Source SW backend giữ các ca hồi quy từ lặp, sửa đã khai báo nhưng gộp nhiều đoạn và giữ nguyên lời giải thích khi lưu thẻ tại `backend/ops/sw-task2-production/repairs-20261101/` của repository Writing. Các ca đối chiếu được đúng 14 validator và parser trong image writer hiện hành; không nới kiểm giải thích hoặc HTML để ép chấm thành công.

Quay lui riêng commit giao diện này và cache version. Không restore database hoặc ghi đè bài làm để quay code. Các sửa chấm Draft đã phát trước đó có điểm quay lui riêng trong hồ sơ backend.

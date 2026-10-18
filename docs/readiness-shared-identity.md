# Danh tính chung cho Làm quen K67

Trang `term-tests/lam-quen-k67/` nhận người đã nhớ từ các sản phẩm cùng địa chỉ gốc của website. Trang chỉ chọn sẵn tên có trong danh sách lớp được mở Làm quen; người học vẫn xác nhận rồi đi qua bước kiểm máy/tai nghe. Nhớ danh tính không cấp quyền mở bài hoặc tự tải audio.

Trang dùng `shared/test-student-identity.js` đã ghim phiên bản. Việc quy đổi mã thực hiện qua đường nhận diện K67 hiện có; phiên Làm quen vẫn do API `/api/k67-readiness/v1` kiểm và cấp riêng. Không gửi token Làm quen sang dịch vụ quy đổi.

Với bộ nhớ cũ, dùng bộ chuyển đổi chung để đối chiếu mọi người đang được nhớ. Nếu nguồn Mapping xác nhận không biết một UUID, trang tra tiếp qua nguồn K67 để giữ tương thích mã riêng của khóa. Nguồn lỗi hoặc nhiều người khác nhau thì yêu cầu chọn lại; không lấy một tên cũ tùy ý để tự đăng nhập.

Nháp và phiên trên máy được tách theo người. Khi gặp dữ liệu cũ, chỉ sao chép dữ liệu đúng chủ và giữ bản gốc. Tab đang mở giữ chủ khi tải lại; tab mới dùng danh tính chung hiện tại. Khôi phục phiên cũ không tự ghi lại người cũ vào bộ nhớ chung. Nút đổi người giữ nháp trước khi rời; nếu cả giữ nháp trên máy và đồng bộ đều thất bại, trang giữ người học ở lại và báo lỗi.

## Kiểm an toàn

Chạy `tests/readiness-shared-identity-browser.mjs` với `PLAYWRIGHT_MODULE` trỏ tới Playwright đã cài và `IDENTITY_EVIDENCE_DIR` trỏ tới thư mục bằng chứng riêng. Runner mở giao diện thật trên localhost, thay phản hồi HTTP bằng danh sách/phiên giả; chặn mọi mạng ngoài và tệp audio. Kết quả từng ca nằm trong `results.json`; có lỗi thì tiến trình trả mã khác 0 và lưu ảnh lỗi.

Các nhóm ca bảo vệ: chọn sẵn đúng người; chỉ nhớ sau khi mở phiên được xác nhận; giữ bước thiết bị; đổi A/B/A với nháp riêng; tải lại và nhiều tab; chuyển bộ nhớ cũ; phản hồi muộn; sai chủ; lỗi nguồn nhận diện, lỗi đồng bộ và lỗi lưu trên máy. Bộ này không chứng minh đã nghe được tiếng trên tai nghe thật hoặc dịch vụ production đã ghi nháp.

Sau phát hành, đối chiếu HTML/module công khai với commit phát hành; kiểm giao diện với phản hồi thử được cô lập khi lớp thử chưa mở. Không tự mở lớp, tải audio thật, tạo lượt hay nộp bài học viên để làm kiểm tra. Báo rõ ranh giới giữa kiểm giao diện và hành trình thật qua dịch vụ.

## Phục hồi

Đảo commit frontend của thay đổi này khi cần; không xóa các khóa nháp mới hoặc dữ liệu cũ, không đổi backend/cấu hình lớp và không ép tải lại tab học viên. Nếu quay lại giao diện cũ, nháp đã tách riêng vẫn cần được giữ để khôi phục; giao diện cũ không tự hiểu định dạng tách theo người.

# Lesson 5 — bản thử chấm thật

Route này thay Google Docs bằng giao diện web, dùng backend Handout Writing 67 riêng. Chỉ có lớp/học viên giả; chọn tên rồi xác nhận giống Progress Log. Học viên thử 1 có bài đã đi hết hành trình để xem nhận xét và hai bảng từ vựng; các học viên thử khác có tiến độ riêng.

Backend quyết định mở bước: Topic → B1 → A1 → X1 → từ vựng ý 1 → mở ý 2 → B2 → A2 → X2 → từ vựng ý 2. Lịch sử gồm nội dung từng lần gửi. Không tự gán đạt hoặc chấm mô phỏng trong route này. Token phiên chỉ nằm trong bộ nhớ tab/header.

## Phạm vi đã kiểm

AI thật đã trả 7 bước đạt, 2 bộ từ vựng; mỗi bộ có 6 cụm theo A/X/B. Trình duyệt đã kiểm xác nhận tên, tự lưu, xung đột hai tab, khôi phục riêng phần nháp chưa lưu, mất mạng, trạng thái đang chấm, nhận xét cần sửa không mở B1, tải lại giữ Comment, bài hoàn tất và viewport 1440/390/360.

Backend đã kiểm quyền PostgreSQL thật (243 bảng sản phẩm cũ từ chối SELECT, quyền ghi các bảng cũ bằng 0), trần hai lượt xử lý, callback sai định danh, mất ACK và đọc lại, hết hạn bằng đồng hồ thật, cấp lại giữ prompt/operation key, khởi động lại giữ bài. Metadata 40 container cũ giữ nguyên; PostgreSQL chỉ thêm kết nối mạng của sản phẩm mới.

## Kiểm lại giao diện

Chạy `node --test ui-races.test.mjs` trong thư mục này: 8 ca độc lập bằng dữ liệu giả, không gọi mạng hay AI. Test đọc source app thật, kiểm phản hồi muộn trộn người học, poll cũ ghi đè, gõ khi tự lưu, Check khi đang flush, double-click đọc lại, mất body ACK, HTTP409 và khôi phục chỉ các trường chưa lưu. Lỗi làm test dừng; người dùng vẫn cần browser acceptance cho kết quả thật.

Source thay đổi được rà độc lập; log và ảnh kiểm thật giữ trong kho bằng chứng riêng của tác vụ. Route demo mô phỏng ở `../lesson5-demo/` vẫn được giữ.

## Giới hạn trước mở lớp

Chưa mở lớp thật, chưa chuyển bài Docs, chưa nối danh sách học viên thật hoặc thử tải 30 người. Cần chốt quyền lớp, người vận hành, quota AI, lưu trữ lịch sử và canary trước mở lớp. Chọn tên/xác nhận không chống việc chọn hộ người khác; đây là cách xác nhận theo mẫu được yêu cầu. Chỉ bỏ route thử hoặc dừng backend/consumer Handout 67 riêng khi cần quay lui; không dựng lại các hệ cũ.

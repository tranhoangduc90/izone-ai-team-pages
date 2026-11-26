# Báo cáo sự cố đăng nhập K56

Trang Pages giữ phiên Google IZONE hiện hành. Link thường chỉ ghi tại chỗ.
Link hỗ trợ theo vụ việc dùng capability chỉ ghi ở fragment, đúng origin Pages, có hạn và không mở quyền đọc. Trang thông báo tự gửi và cho dừng trước khi chạy. Báo cáo trước và sau Google đều có thể được ghi để thấy chặng bị lỗi.

Worker riêng chỉ nhận POST đã xác thực ở /v1/reports. D1 riêng chứa mã vụ việc, mã báo cáo, thời gian nhận và nội dung giới hạn. Thiếu ACK có thể gửi lại với cùng mã; D1 giữ một bản. Job riêng dọn báo cáo đã quá bảy ngày mỗi ngày. Worker không cần quyền đọc dữ liệu thi, bảng giảng viên hoặc thông tin phiên Google.

Đọc qua quyền quản trị D1 và lọc theo mã vụ việc. Kiểm quyền từ chối khi gọi đọc hoặc gửi thiếu capability. Ghim cấu hình worker và phiên bản Pages khi đọc lại. Để dừng một vụ việc, bỏ hash tương ứng khỏi REPORT_CASES. Hoàn tác thay đổi Pages tắt gửi tự động; dữ liệu đã nhận vẫn theo thời hạn dọn của Worker.

Bản r3 ghi một sự kiện `page_open` nếu người mở link chưa dừng gửi. Cloudflare thêm `country` từ `request.cf.country` vào mỗi sự kiện và báo cáo r3 ngay tại Worker. Kho không lưu IP hoặc thông tin vị trí chi tiết. Mã phản ánh đầu ra mạng, có thể là quốc gia của VPN hay proxy. Giá trị `null` là chưa xác định, còn bản r2 không có trường này.

Để kiểm số lượt mở theo quốc gia, lọc D1 theo mã vụ việc và `json_extract(payload, '$.event') = 'page_open'`, rồi nhóm theo `json_extract(payload, '$.country')`. Chỉ so sánh mã quốc gia có giá trị với `VN`.

Bản r4 lưu email mà API K56 trả sau bước xác minh phiên ở `$.run.reviewerEmail`. Trường có thể xuất hiện khi đọc quyền lớp thất bại hoặc tài khoản thiếu quyền IC2367, miễn đã xác minh phiên. Dùng email từ phản hồi đọc quyền lớp nếu có, rồi mới dùng phản hồi xác minh phiên của API lớp thật. Báo cáo trước khi xác minh và các bản cũ không có trường này.

Bản r4 tách ba nguồn để chẩn đoán. Ô email riêng báo `email_entered` với `$.enteredEmail` khi người dùng nhập địa chỉ hợp lệ. Khi Google trả về kết quả chọn tài khoản, trang chỉ lấy email từ callback và báo `google_account_selected` với `$.googleEmail`, kể cả khi API K56 không kết nối được. Cả hai không chứng minh K56 đã xác minh tài khoản. `$.run.reviewerEmail` là email từ API K56 sau khi xác minh. Không gửi token Google tới kho báo cáo.

Các sự kiện trong cùng lần mở trang có chung UUID ngẫu nhiên ở `$.visitId`. ID chỉ dùng trong lần mở đó và không được lưu trên máy.

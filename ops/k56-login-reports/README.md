# Báo cáo sự cố đăng nhập K56

Trang Pages giữ phiên Google IZONE hiện hành. Link thường chỉ ghi tại chỗ.
Link hỗ trợ theo vụ việc dùng capability chỉ ghi ở fragment, đúng origin Pages, có hạn và không mở quyền đọc. Trang thông báo tự gửi và cho dừng trước khi chạy. Báo cáo trước và sau Google đều có thể được ghi để thấy chặng bị lỗi.

Worker riêng chỉ nhận POST đã xác thực ở /v1/reports. D1 riêng chứa mã vụ việc, mã báo cáo, thời gian nhận và nội dung giới hạn. Thiếu ACK có thể gửi lại với cùng mã; D1 giữ một bản. Job riêng dọn báo cáo đã quá bảy ngày mỗi ngày. Worker không cần quyền đọc dữ liệu thi, bảng giảng viên hoặc thông tin phiên Google.

Đọc qua quyền quản trị D1 và lọc theo mã vụ việc. Kiểm quyền từ chối khi gọi đọc hoặc gửi thiếu capability. Ghim cấu hình worker và phiên bản Pages khi đọc lại. Để dừng một vụ việc, bỏ hash tương ứng khỏi REPORT_CASES. Hoàn tác thay đổi Pages tắt gửi tự động; dữ liệu đã nhận vẫn theo thời hạn dọn của Worker.

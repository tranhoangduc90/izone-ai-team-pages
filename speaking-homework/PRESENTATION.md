# Giao diện và tiếp nhận Homework Speaking 67

Lớp master #170 hiện dùng Source Sans 3 qua `shared/master170/speaking.css`.
Link giảng viên, đổi người học, mở bài bổ trợ và trợ giúp Share dùng chữ 16px,
vùng bấm tối thiểu 44px; nhãn trợ giúp được xuống dòng khi hẹp. Hướng dẫn thiếu
hai đề xuất cá nhân dùng vai trò chú ý và chữ ghi chú 14px. Điểm nhảy
iPhone/Android chừa chỗ dưới thanh đóng popup để tiêu đề không bị che.
Handler và nội dung của renderer giữ nguyên. `tests/speaking-actions-browser.mjs` kiểm cả
chín lesson ở năm viewport, mở/đóng hướng dẫn, giữ giá trị và đích link; dùng
API giả, không gọi Check, finish hoặc dịch vụ thật. Đặt `PLAYWRIGHT_MODULE` và
`SPEAKING_ACTIONS_EVIDENCE_DIR` để chạy và lưu kết quả ngoài source.

Thẻ tự nộp đang gửi/đọc lại/chờ kết nối dùng màu chờ. Khi renderer hiện nút
thử nộp lại, CSS dùng màu chú ý; biên nhận đã nộp vẫn giữ màu thành công.
Không sửa trạng thái, thông báo hoặc handler tự nộp. Bộ
`tests/speaking-submit-colors-browser.mjs` kiểm component trình bày với các
trạng thái giả trên cả chín renderer; không chứng nhận giao dịch nộp thật.

Từ gói ngày 11/10/2026, Lesson 2–7 dùng một lớp trình bày chung: Nunito Sans, màu đỏ/navy IZONE, phần luyện trước phần nộp trên điện thoại và hai cột trên laptop. Hướng dẫn lấy Share nằm trước từng ô nhập; mở bài bắt đầu ở tiêu đề, mở lại bài đã nộp bắt đầu ở biên nhận.

HTML nạp `presentation.js`; module này nạp renderer Lesson 2, Lesson 3 hoặc renderer cấu hình chung Lesson 4–7, rồi sắp xếp lại các node thật. Sự kiện, phần học, link chatbot và kiểm kết quả vẫn do renderer hiện hành xử lý. `composition.css` và `fonts/` giữ font cùng trang; không phụ thuộc dịch vụ font bên ngoài.

Lesson 2–5 cũng mở bằng API Speaking độc lập. Backend ưu tiên đúng hồ sơ cũ khi đã có tiến độ hoặc Docs sẵn sàng và trả `intakeMode: legacy`; renderer tiếp tục gửi request tới API cũ. Chưa có Docs sẵn sàng thì nhận trên web. Không xóa, di chuyển hoặc đổi assignment/receipt lịch sử. Bài đóng/nháp không được mở lượt mới; ngưỡng lấy từ mẫu hoặc cấu hình lớp thực tế.

Các ca browser dùng dữ liệu mẫu và API giả, chạy trên HTML/renderer thật: `tests/speaking-homework-journey.mjs`, `speaking-homework-identity.mjs`, `speaking-homework-draft-clear.mjs` và `speaking-homework-closed-cta.mjs`. Harness hành trình hỗ trợ `SPEAKING_LESSON_FILTER` để chỉ chạy các buổi bị tác động. Ảnh kiểm thử không phải bằng chứng AI đã chấm bài thật hoặc Docs đã ghi thành công.

Khi thêm buổi mới, giữ lớp trình bày này và cấu hình đúng nội dung/phần/ngưỡng của buổi. Kiểm vị trí hướng dẫn, focus, nháp, receipt và các breakpoint 390/768/1440px; không sao chép dữ liệu mẫu từ pilot vào trang phát hành.

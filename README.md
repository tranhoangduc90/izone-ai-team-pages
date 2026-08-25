# izone-ai-team-pages
Kho chứa các website HTML tĩnh của đội IZONE để xuất bản bằng GitHub Pages.

## Chấm bài Vocab 03

Trang `vocab-03.html` nhận `documentId` từ liên kết trong bài làm, gửi yêu cầu tới workflow Vocab 03 và hiển thị tiến độ Đọc → Chấm → Ghi. Trang không chứa credential hoặc nội dung bài làm; quyền Google Docs và dữ liệu chấm nằm trong n8n.

## Chấm bài Reading/Listening 67

Trang `check-now.html` dùng chung cho các bài Reading và Listening khóa 67. Trang nhận `documentId` cùng `assignmentCode`, xóa hai giá trị khỏi thanh địa chỉ, gửi yêu cầu chấm tới n8n và chỉ dùng `jobId` để hỏi tiến độ. Trang không chứa credential, nội dung bài làm hoặc dữ liệu định danh học viên.

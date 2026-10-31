# Listening Homework · Horton Castle

Bài mới lấy từ Thẻ 3 của tài liệu giáo viên, lesson metadata 8. Mã chuẩn `67-listening-horton-castle`, entry `listening-homework/horton-castle.html`.

Giữ renderer/controller hiện hành, giao diện master170 skill-homework, nháp CAS và vòng sửa–nộp lại. Bài có 16 mục, ngưỡng nhập 13 mục; độ đúng được chấm riêng phía máy chủ. Nội dung hiển thị ở `horton-castle-content.json`; rubric/key và kết quả kiểm riêng ở kho private của dự án điều phối.

Renderer hỗ trợ chương, câu chép, lựa chọn và slot từ cấu hình. Bài Scandinavian vẫn dùng cấu hình cũ; serializer giữ nguyên bài tự do lịch sử và chỉ khôi phục metadata khi tạo lại đúng raw answer.

Audio dùng module chung Cloudflare → Pages, catalog/hash từng phần 512 KiB. Việc thêm catalog chưa chứng minh object R2/Worker hoặc API production đã chuyển. Query phiên bản mới đi xuyên renderer → transport → catalog.

Kiểm: codec; renderer và entry thật với fixture cách ly; hai bài dùng chung sản phẩm nhưng nháp/job/nhận xét tách theo code/version; ca AI thật theo rubric riêng; MP3 đầy đủ và ca lệch đồng hồ/403/fallback. Biên nhận phát hành và giới hạn live phải được ghi riêng sau khi thực hiện, không suy từ bộ test.

Giữ SSO, quyền lớp/người/lượt, lịch sử và dữ liệu mới khi quay code. Không dùng dữ liệu minh họa làm bài thật hoặc ghi Docs học viên để lấy ảnh kiểm.

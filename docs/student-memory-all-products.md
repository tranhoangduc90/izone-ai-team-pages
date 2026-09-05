# Ghi nhớ học viên cho toàn bộ sản phẩm

## Phạm vi mở rộng ngày 05/09/2026

Nguồn kế thừa: commit `b131b88`, tính năng đã phát hành cho hai lớp CS. Yêu cầu mới của người dùng: áp dụng cho toàn bộ sản phẩm webapp. Giữ nguyên các quy tắc chọn đúng UUID, xác nhận trước khi mở bài và giữ danh tính của lượt đang làm trong `student-memory-full-audit.md`.

| Sản phẩm | Phạm vi |
|---|---|
| Writing Task 1/2, toàn bộ manifest | Tất cả lớp được roster của bài cho phép, gồm lớp mới về sau |
| Term Test 1/2, Mini Test Buổi 5 | Tất cả lớp, cả phiếu trả lời và giao diện thi trên máy |
| Progress Log | Ghi nhớ từ roster của đúng phiếu; vẫn xác nhận trước khi bắt đầu |
| Term Test K56 trên máy | Ghi nhớ trong kho K56 riêng, không ghép UUID với hệ chính |
| Các trang demo | Không ghi đè lựa chọn học viên thật |
| Chấm từ Google Docs, từ vựng và trang giảng viên | Không có bước chọn danh tính học viên tương ứng nên không thêm bộ chọn |

## Hành vi và nghiệm thu

- Tất cả lớp là phạm vi tiện ích giao diện, không cấp thêm quyền hoặc thêm học viên vào danh sách.
- Writing dùng `studentMemory: {enabled: true, allClasses: true}`; bộ chọn vẫn hỗ trợ danh sách lớp giới hạn để có thể thu hẹp khi cần.
- Bộ nhớ chỉ chứa `{version, studentRef}`. Chọn sẵn khi UUID chính thức xuất hiện duy nhất trong roster mới. Không đoán theo tên, thứ tự hoặc lấy lớp của bài trước.
- Writing, Term/Mini và Progress Log chính thức dùng chung khóa trên cùng nguồn website. K56 dùng API riêng nên giữ khóa riêng. Trình duyệt và thiết bị khác cần chọn lần đầu riêng.
- Bỏ tick, xóa bộ nhớ, roster đổi, hồ sơ tạm, nhiều tab và lỗi lưu phải giữ các quy tắc đã kiểm trước đó. Không tự mở phiên hoặc bắt đầu đồng hồ.
- Kiểm bằng dữ liệu giả với API bị chặn mặc định; đọc URL thật sau phát hành bằng GET. Không nộp, chấm hoặc sửa bài học viên thật.
- Không thay đề, đáp án, điểm, roster, cấu hình máy chủ hay n8n. Những nội dung này không thuộc yêu cầu mở rộng giao diện.

## Kiểm chứng trước phát hành

- 95 kiểm thử Writing; kiểm cú pháp bundle; 10 manifest và toàn bộ nhóm hồi quy chọn tên/lưu/đổi người/hồ sơ tạm.
- 10 kiểm thử Term/Mini hiện có và trình duyệt chạy sáu giao diện trên bốn lớp CS, IC và lớp mới. Demo không dùng khóa học viên thật.
- 4 kiểm thử cấu trúc Progress Log; kiểm trên trình duyệt với UUID chung, xác nhận bị gián đoạn, thử lại, lưu nháp trong phiên, bỏ tick và lỗi xóa.
- 5 kiểm thử K56, gồm khóa riêng, chọn sẵn không tự chuẩn bị bài, đổi người, lỗi xóa, bỏ tick và giao diện điện thoại.
- Chỉ dùng dữ liệu giả cho thao tác mở/lưu/nộp. Roster thật IC2200 và IC2238 đã đọc giới hạn bằng GET để kiểm khả dụng, không lưu dữ liệu định danh vào repo hoặc báo cáo.

## Hoàn tác bản mở rộng

Hoàn tác đúng commit mở rộng rồi phát hành lại Pages sẽ trở về phạm vi hai lớp CS. Không xóa bộ nhớ bài làm, danh sách học viên hoặc lượt thi. API mapping 1.7.3 giữ nguyên.

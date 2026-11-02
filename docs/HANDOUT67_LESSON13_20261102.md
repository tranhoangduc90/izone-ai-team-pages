# Handout Writing 67 · Lesson 13

Bản xây ngày 02/11/2026. Route học viên `writing-handouts/lesson13/`, route GV `writing-handouts/lesson13/teacher.html`. Dùng loader, controller, chính sách và API Handout67 chung với Lesson 11. Hai entry mới chỉ khai báo bài và opt-in adapter R3; không có app/backend/workflow riêng theo số lesson.

Đề: Directors and managers of organisations are often older people. Some people say that it is better for younger people to be leaders. To what extent do you agree or disagree?

Học viên chốt mức đồng ý, phía ủng hộ, điều kiện khi đồng ý một phần và bốn idea trước Topic. Đồng ý hoàn toàn chọn phía trẻ; phản đối hoàn toàn chọn phía lớn tuổi; đồng ý một phần được nghiêng mỗi phía với điều kiện rõ. Thân bài 1 luôn đánh giá phương án không ủng hộ; thân bài 2 bảo vệ phương án ủng hộ. Mỗi đoạn giữ Topic, hai Check chung A–X–B và bảng recap/từ vựng riêng như Lesson 11.

## Kiểm đã thực hiện trên gói source

- Backend Handout67: 84/84; frontend: 64/64. Bao gồm callback cũ, sửa outline, snapshot, prompt pin, comment, quyền GV, roster theo lesson, lớp trong link và tiến độ không tính thiếu ô điều kiện tùy chọn.
- Trình duyệt Chrome cách ly, HTML/controller/CSS thật và API/AI fixture: ba mức đồng ý, toàn hành trình bảy Check/hai recap, chặn thiếu điều kiện/lựa chọn mâu thuẫn. Năm viewport 1440×900, 1366×600, 390×844, 320×568, 844×390 không tràn ngang. Năm trạng thái ở ba độ rộng: 15/15. Polling tiếp tục hoạt động; qua ba nhịp giữ node, selection và vùng cuộn khi dữ liệu không đổi; thay kết quả ở thân 2 giữ vùng đọc thân 1.
- So với source production đã chụp: 31 prompt cũ của Lesson 5/7/9/11 không đổi; 39 phép so markup/CSS Lesson 11 không đổi. 54 ca header cũ không lỗi. Thay query cache trên entry cũ chỉ để tải đúng phiên bản code chung.
- AI thật qua tuyến chấm hiện hành, dữ liệu tự tạo: 15/15 ca ra trạng thái kỳ vọng, phản hồi trong giới hạn 100 từ. Đây là đánh giá rubric, không phải bài đã nộp của học viên thật.
- Gate n8n live đã xác minh đúng host/profile/workflow: 22/22 ca hợp đồng, gồm outline bodyIndex=0/ideaIndex=0. Không sửa workflow hoặc tuyến/model chấm.

## R3 và giới hạn bằng chứng

Adapter `shared/opinion-preparation.css` chỉ áp cho `data-handout-preparation=opinion-v1`: Source Sans 3, nền/token master170, ô nội dung trắng 18px, focus navy, tiêu đề navy, khoảng cách và thao tác mobile. Kiểm trạng thái phát hiện và sửa focus bị màu revision ghi đè. Các thành phần thi có timer/audio không áp dụng cho handout này.

Ảnh và số đo giữ trong hồ sơ riêng tại máy triển khai. Preview trên Chrome thật đã kiểm trang GV với danh tính mẫu: lập trường/điều kiện/vai trò hai đoạn hiện đúng, nội dung 18px; qua ba nhịp cập nhật giữ node/selection/cuộn. Chưa dùng Google thật hoặc chấm/nộp thay học viên production; kiểm fixture không được gọi là bằng chứng người thật. Chưa coi file này là biên nhận đã phát hành: phải đọc lại URL, registry, image và phạm vi lớp sau phát hành.

## Phạm vi phát hành

Nguồn ERP có 11 lớp đang học và 2 lớp pending. Mapping đã duyệt có 10 lớp với tổng 140 học viên; IC2363 chưa có roster, IC2376/IC2404 chưa có mapping được duyệt. Không tự tạo người hoặc duyệt mapping để làm đủ số. Roster và quyền Lesson 13 có nhánh riêng; giữ danh sách cũ và quyền Lesson 11. Mọi số liệu là ảnh nguồn ngày triển khai, cần kiểm lại trước khi mở.

Chuyển backend/registry tương thích trước Pages. Giữ image/container/config cũ cùng snapshot bài và file private; không dùng Compose lịch sử nếu khác inspect live. Quay lui không restore database hoặc ghi đè bài mới; nếu đã có bài Lesson 13, giữ code đọc được schema mới hoặc đóng riêng phần ghi trong quyền tương ứng. Không ghi đè Lesson 13 ở hệ Writing cũ.

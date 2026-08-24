# izone-ai-team-pages
Kho chứa các website HTML tĩnh của đội IZONE để xuất bản bằng GitHub Pages.

Đây là repo chuẩn cho mọi trang HTML tĩnh mới của team. Mỗi hệ thống đặt trong một thư mục riêng, dùng đường dẫn tương đối và không lưu token, credential, đáp án hoặc dữ liệu định danh học viên.

## Đường dẫn chính

- Trang gốc: <https://tranhoangduc90.github.io/izone-ai-team-pages/>
- Term Test và Mini Test: <https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/>
- Handout Writing Task 1/2: <https://tranhoangduc90.github.io/izone-ai-team-pages/writing-handouts/>

Các repo `izone-term-tests` và `izone-writing-task1-practice` cũ vẫn được giữ để quay lui trong giai đoạn chuyển đổi. Không xóa hoặc tắt link cũ cho tới khi các lớp đang dùng đã chuyển hết sang link mới.

## Cấu trúc

- `term-tests/`: Term Test 1/2, Mini Test Buổi 5 và dashboard giáo viên.
- `writing-handouts/`: giao diện và manifest dùng chung cho Writing Task 1/2.
- Các file ở thư mục gốc: những trang chấm Reading, Listening và Vocab do team đang vận hành.

Khi thêm một web mới, ưu tiên dùng thư mục con có tên ổn định; không tạo repo Pages riêng nếu không có yêu cầu tách quyền, tên miền hoặc vòng đời phát hành.

## Link Term Test và Mini Test

- Term Test 1 computer-based: `https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/term-test-1-computer-based/?class=<MÃ_LỚP>`
- Term Test 1 answer sheet: `https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/term-test-1/?class=<MÃ_LỚP>`
- Term Test 2 computer-based: `https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/term-test-2-computer-based/?class=<MÃ_LỚP>`
- Term Test 2 answer sheet: `https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/term-test-2/?class=<MÃ_LỚP>`
- Mini Test Buổi 5 computer-based: `https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/mini-test-lesson-5-computer-based/?class=<MÃ_LỚP>`
- Mini Test Buổi 5 answer sheet: `https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/mini-test-lesson-5/?class=<MÃ_LỚP>`
- Kết quả giáo viên: `https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/teacher/?class=<MÃ_LỚP>&test=<MÃ_BÀI_TEST>`

## Link handout Writing

- Task 1 · App users by age: `https://tranhoangduc90.github.io/izone-ai-team-pages/writing-handouts/?task=pie-app-users-by-age`
- Task 1 · Australian destinations: `https://tranhoangduc90.github.io/izone-ai-team-pages/writing-handouts/?task=australian-destinations-1999-2009`
- Lesson 13 · Young leaders: `https://tranhoangduc90.github.io/izone-ai-team-pages/writing-handouts/lesson.html?task=writing-lesson13-young-leaders`
- Task 2 · Living alone: `https://tranhoangduc90.github.io/izone-ai-team-pages/writing-handouts/lesson.html?task=writing-task2-living-alone-development`
- Task 2 · Public-health ban: `https://tranhoangduc90.github.io/izone-ai-team-pages/writing-handouts/lesson.html?task=writing-task2-public-health-ban`

## Chấm bài Vocab 03

Trang `vocab-03.html` nhận `documentId` từ liên kết trong bài làm, gửi yêu cầu tới workflow Vocab 03 và hiển thị tiến độ Đọc → Chấm → Ghi. Trang không chứa credential hoặc nội dung bài làm; quyền Google Docs và dữ liệu chấm nằm trong n8n.

## Chấm bài Reading/Listening 67

Trang `check-now.html` dùng chung cho các bài Reading và Listening khóa 67. Trang nhận `documentId` cùng `assignmentCode`, xóa hai giá trị khỏi thanh địa chỉ, gửi yêu cầu chấm tới n8n và chỉ dùng `jobId` để hỏi tiến độ. Trang không chứa credential, nội dung bài làm hoặc dữ liệu định danh học viên.

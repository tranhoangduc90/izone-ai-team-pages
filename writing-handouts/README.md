# Web app luyện Writing Task 1 và Task 2

Giao diện GitHub Pages, không dùng framework và không chứa dữ liệu học viên, prompt chấm, credential hay đáp án. Mở `?task=<slug>` để tải `manifests/<slug>.json`; thêm `&version=<phiên-bản>` để tải `manifests/<slug>/<phiên-bản>.json`. Không có query thì dùng `sample-task`.

Đề “lawbreakers — prison or alternatives” cho IC2200 dùng slug `writing-task2-lawbreakers-prison-alternatives` trên trang `lesson.html`.

Với handout dùng chung tại `lesson.html`, không có query `class` thì học viên tự chọn trong toàn bộ lớp đang được gắn với activity. Nếu URL có `class=CS.070626`, app chọn sẵn lớp đó và chỉ nạp danh sách họ tên của lớp đã chọn.

Dashboard giảng viên tại `teacher.html` dùng cùng query `class`. Sau khi đăng nhập, dashboard chọn sẵn lớp và chỉ tải tiến độ của lớp đó; giảng viên vẫn có thể đổi bộ lọc lớp.

## Đối soát hồ sơ dùng chung cho mọi đề

Từ bản cập nhật 03/09/2026, dashboard chuẩn đã đồng bộ phần đối soát với bản legacy: nhập tên → **Tìm trong database** → chọn đúng hồ sơ kèm lớp → **Ghép hồ sơ** và xác nhận. Kết quả tìm không bị giới hạn vào lớp đang lọc. Có nút **Xóa hồ sơ tạm** với xác nhận riêng; backend chỉ ẩn hồ sơ khỏi danh sách và giữ lịch sử kỹ thuật. Tài khoản chỉ xem không có các nút quản trị.

Mọi đề Task 1, Lesson 13 và Task 2 dùng chung `teacher.html`, `js/teacher-app.js`, `js/api.js` và cùng dịch vụ API. Không sao chép giao diện riêng cho từng đề/lớp. Ghép thành công giữ nguyên bài, bỏ hồ sơ khỏi “Cần đối soát”; nếu không còn hồ sơ chờ thì ẩn cả khung. Việc ghép liên kết danh tính, không chuyển bài sang lớp khác. Các link legacy còn hoạt động, không đổi backend hoặc quyền trong lần đồng bộ giao diện này.

Kiểm tra trước phát hành: chạy kiểm thử mã trong thư mục này; chạy `playwright-cli run-code --filename tests/handout-reconciliation-ui.cjs` từ gốc repo sau khi mở `teacher.html` của đích cần kiểm trong phiên Playwright riêng. Script thay toàn bộ API/Google bằng dữ liệu giả, kiểm từng manifest trên đích, chọn lớp, UUID cùng tên, đồng ý/hủy, lỗi, chỉ xem và mobile. Đọc báo cáo ở trang trắng cuối cùng để xác nhận suite hoàn tất; không coi riêng exit code CLI là đủ. Không dùng script với Chrome đã đăng nhập của giảng viên.

Nguồn giao diện đối soát: repo backend/legacy ở commit `517ca98009005935ccf38a91f6f48b719b11db7c`. Giữ các thay đổi riêng của repo Pages chuẩn; chỉ chuyển phần đối soát và đổi mã phiên bản tài nguyên để tránh cache cũ. Rollback bằng cách hoàn tác commit giao diện này rồi phát hành Pages; không rollback database hay xóa bài làm.

## Chạy cục bộ

```powershell
cd "E:\Codex-Projects\izone-ai-team-pages\writing-handouts"
npm test
npm run check
python -m http.server 8080
```

Sau đó mở `http://localhost:8080/?task=sample-task`. Để chạy được luồng thực tế, đặt URL công khai của API trong `config.json`; file này chỉ là cấu hình công khai, không được chứa credential. Sample manifest cố ý không chứa dữ liệu thật.

Manifest dùng contract `task1-web-manifest-v1` do Content Factory xuất: định danh hoạt động, đề/ảnh, cách đọc dữ liệu, phân tích, routes, vocabulary, chatbot và phiên bản nội dung/prompt. Các route có `recommended: true` luôn hiển thị đầu tiên; từ vựng hiển thị thành bảng hai cột Việt–Anh. Chỉ đưa nội dung có thể công khai vào manifest.

## Luồng người học

1. Chọn lớp, rồi chọn tên từ roster trả về bởi API. Trình duyệt chỉ lưu `classRef`, `studentRef`, `sessionRef`, `attemptRef` công khai.
2. Viết Overview hoặc Outline. Outline gồm hai ô Body 1 và Body 2, nhưng chỉ có một trạng thái và một nút gửi.
3. Bản nháp được ghi IndexedDB sau 500 ms; khi có thay đổi sẽ tự lưu database sau 10 phút, hoặc khi bấm **Lưu ngay**, gửi Check, **Lưu & đóng**, hay rời tab.
4. Một phần đạt sẽ bị khóa. Sau phản hồi cần sửa lần thứ 3, 6, 9…, giao diện hiện cảnh báo hỗ trợ.
5. Sau khi Overview và Outline đạt, học viên viết Draft 1, bấm chuyển để copy xuống Draft 2 rồi tự sửa. Nút **Gửi chấm từng câu** tạo một lượt duy nhất; app chờ link LMS, hiện trong một ô kết quả và khóa Draft khi link hợp lệ xuất hiện.
6. Comment trực tiếp của giảng viên xuất hiện trong khung riêng dưới đúng ô viết, có highlight đoạn được nhận xét và thread trả lời. Học viên không có nút xóa, chấp thuận hoặc ẩn comment; trạng thái “đã xử lý” vẫn giữ toàn bộ lịch sử.

## Adapter API

Mọi chi tiết API nằm trong [js/api.js](js/api.js). Adapter hiện gọi hợp đồng v1:

- `GET /api/v1/activities/:slug/roster`
- `POST /api/v1/sessions` với `activitySlug`, `classRef`, `studentRef`
- `GET /api/v1/sessions/:sessionRef`
- `PUT /api/v1/sessions/:sessionRef/draft` với optimistic concurrency (`baseVersion`, `If-Match`) và `requestId`
- `POST /api/v1/sessions/:sessionRef/checks`
- `GET /api/v1/attempts/:attemptRef` với `ETag`/`If-None-Match`
- `POST /api/v1/attempts/:attemptRef/retry` cho lỗi kỹ thuật còn trong giới hạn ba lần

`409` dừng lưu và yêu cầu tải bản server mới nhất; bản IndexedDB không bị xóa. Polling chỉ chạy cho lượt đang chấm, dừng khi tab ẩn, và dùng 2 giây trong 20 giây đầu, 5 giây tới phút thứ hai, rồi 10 giây.

Link kết quả Draft chỉ được render nếu dùng HTTPS, đúng host `practice.izone.edu.vn` và đúng đường dẫn `/shared/writing-essays/`. API và workflow n8n lặp lại cùng kiểm tra trước khi khóa bài.

Bản demo `draft-inline-result-demo.html` dùng dữ liệu band 6.0 giả theo đúng response `essays` của Quick Aid để hiển thị từng thẻ chấm câu ngay trong handout. Mỗi lần chỉ có một thẻ được hiện; học viên dùng nút Trang trước/Tiếp theo như LMS Writing. Comment dạng Markdown dùng cùng bộ render production nên các mục `1.` cách nhau bởi dòng trống vẫn hiển thị liên tục thành `1, 2, 3`. Demo cố ý bỏ qua hai trường `content` và `feedback`, tức màn tổng hợp TR/CC, đồng thời không gọi API, LMS, n8n hay database.

Bộ demo `task2-demo.html` dùng đúng đề crime prevention trong handout và chín tình huống giả: mới bắt đầu, Topic Sentence cần sửa, Idea 1 hổng điểm X, Idea 2 còn chung chung, đã mở từ vựng, đang viết Draft, Draft đang chấm, lỗi kỹ thuật và hoàn tất với thẻ LMS. Trang chỉ tải tệp cục bộ, không tạo phiên học viên hoặc gọi API/n8n/LMS thật.

## Lưu ý triển khai

`fetch(..., { keepalive: true })` chỉ là phương án dự phòng khi đóng tab; API vẫn áp dụng cùng kiểm tra phiên bản/idempotency như `PUT draft`. GitHub Pages không bảo vệ API: backend vẫn phải kiểm tra UUID, CORS origin allow-list và rate limit.

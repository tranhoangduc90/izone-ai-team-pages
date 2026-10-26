# Phạm vi khởi động đăng nhập GV — 26/10/2026

Kế thừa PR309: chờ xác minh phiên bằng thông báo, chỉ hiện form Google/ghi nhớ khi chưa có hoặc hết phiên. Khôi phục sớm chạy song song với tải giao diện, dùng lại kết quả trong cùng thế hệ tài khoản. Quyền lớp/bài/thao tác vẫn do API của từng sản phẩm quyết định. Chuẩn phiên và quay lui nằm ở [TEACHER_SHARED_LOGIN.md](TEACHER_SHARED_LOGIN.md).

## Các đường vào hiện hành

| Nhóm | Entry/consumer | Cách nối và phần được kiểm |
|---|---|---|
| Reading thực chiến | `reading-practice/teacher.html`, `teacher-progress.html` | `reading`; đọc kết quả/tiến độ sau xác minh, Google chỉ khi 401 |
| Listening thực chiến | `listening-practice/teacher.html`, `teacher-progress.html` | `listening`; giữ bộ phát/xem lại hiện hành |
| Reading Materials | `reading-skills67/materials-beyond-concrete/teacher.html` và link GV trên bài | `materials`; form sinh sau 401, link quay về đúng lớp/học viên |
| Speaking Homework | `speaking-homework/teacher.html`, `teacher-progress.html` | `mapping`; cả hệ legacy/independent, receipt/tiến độ chỉ đọc, không tải Google trên phiên còn hiệu lực |
| Progress Log | `progress-log/teacher.html`, `teacher-thuy.html` | `mapping`; hai entry chung engine/preset, bỏ GET phiên dư từ PR309 |
| Term/Mini K67 | `term-tests/`, `term-tests/teacher/`, `lam-quen-k67/teacher.html` | `term67`; cổng HTTPS 18869; landing giữ nhập mã lớp trong khi chờ; Làm quen chờ phiên xong trước đọc API sâu |
| Term/Mini K56 thật/demo | `term-tests/k56-demo/`, `term-tests/teacher-k56/` | `k56`/`k56demo`; giữ hai nguồn quyền và hàng đợi/ý định logout, không khôi phục sớm vượt điều phối |
| Substitute | Bốn `term-tests/substitute-test-{1,2}-k{56,67}-results/` | `substitute`; dùng identity chung rồi kiểm scopes gốc |
| Writing gốc và Task 1 | `writing-handouts/teacher.html?task=…` qua loader Task 1, `library.html`, `writing-flow.html`, `writing-flow-v2.html` | `writing`; giữ GET phiên khi consumer còn cần contract gốc; Google tải khi cần đăng nhập, gồm sau logout/expiry |
| Handout B–A–X | `writing-handouts/lesson{5,7,9,11}/teacher.html` qua `shared/loader.mjs` và template GV chung | `handout67`; template ẩn form từ đầu, lấy reviewer/session gốc; lỗi mạng/403 có thử lại |
| SW chuyên sâu | `sw-task2-writing/teacher.html?task=…` cho đủ tám bài; alias `shops-writing/teacher.html` | Native `shops`; runtime phiên đồng bộ với thư viện chung, không mượn Writing/Handout; giữ class/student/session trong link |
| Shops entry cũ còn truy cập được | `shops-writing/writing-handouts/shops-review/connected-teacher.html` | Native `shops`; cùng trạng thái chờ/401/403/lỗi và lazy Google |
| Cổng AI vận hành | `ai-gateway-dashboard/` | Phiên operator riêng; tối ưu màn chờ và tải Google khi thiếu phiên, không đổi nguồn quyền hoặc tự nối broker GV |

Tám bài SW được runner đọc từ catalog production, không dùng danh sách mẫu cũ. Bản sao runtime dưới Shops/SW được kiểm bằng nhau với nguồn chung để tránh consumer chạy bản cũ. Asset đổi có query cache xuyên chuỗi loader/import, giữ các version nghiệp vụ đã có.

## Ranh giới

- `reading-skills67/teacher.html` gốc trỏ `reading67-preview`; các thư mục preview/stage/review/demo lịch sử không phải bài Materials production. Không chuyển dữ liệu hoặc source phiên của chúng sang bài thật. Riêng K56 demo là consumer còn dùng và được giữ trong phạm vi trên.
- `recordings/` là công cụ đăng/xem nội bộ với Google ID token trong bộ nhớ và quyền vận hành riêng, không có phiên GV lưu trên máy chủ để khôi phục. Nó không được nhận là đã chuyển sang SSO GV. Nối broker cho công cụ này là thay hệ thống xác thực riêng, cần một thay đổi backend có kiểm tương ứng.
- `mvp-writing-7-plus/`, design/preview và các trang học viên không có GV login không được tạo thêm yêu cầu khôi phục chỉ vì dùng chung asset.
- Không mở thêm lớp, nộp/chấm bài, đổi điểm, gửi Docs/Portal/Classroom hoặc phát hành backend trong thay đổi frontend này.

## Bằng chứng

`teacher-startup-sw-browser.mjs` dùng HTML/module thật, fixture HTTP/Google và chặn mọi mạng ngoài: tám bài SW cùng entry Shops cũ, desktop/mobile 390, không lóe form hoặc tải Google khi còn phiên, một lượt restore, lỗi 403/dịch vụ, hết phiên và thử lại. `teacher-sso-products-browser.mjs` dùng SQLite/cookie fixture và backend identity thật với Google giả: Handout → K56 thật/demo → bốn Substitute, reload và logout chung; bổ sung kiểm không lóe form/không tải Google khi reload Handout.

Các bộ startup, K56 navigation/landing, tiến độ Reading/Listening/Speaking, receipt, Làm quen, Materials, Writing/Flow và Cổng AI kiểm theo đúng engine. Kết quả từng lần chạy được ghi trong PR/ledger. Fixture, viewport hẹp và số đo PR309 không thay bằng chứng Google production hoặc thiết bị vật lý; không suy mỗi bài có cùng mức giảm mili giây.

Quay lui bằng revert gói frontend và query asset. Không phục hồi DB/cookie phiên cũ; giữ các bản sửa nghiệp vụ từ task khác.

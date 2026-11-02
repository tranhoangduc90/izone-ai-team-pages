# Theo dõi giảng viên Speaking — nguồn đã kiểm, chưa phát hành T3

Dashboard dùng chung nhận capability từ lần tải lớp bắt buộc. Chỉ khi kho độc lập và kho cũ đều bật observation, phiên native là cookie session và server quảng bá đủ hai kho thì trang dùng tracker mới. Không có lượt dò capability riêng. Bearer, server cũ hoặc chuyển bản một phần tiếp tục polling native30giây.

Hai luồng metadata vẫn thuộc hai kho có quyền riêng. Tracker gom tín hiệu thành tối đa một lần đọc danh sách gộp đang chạy và một lần đọc chi tiết đang chạy. Metadata đến khi đang đọc chỉ giữ yêu cầu mới nhất để đọc bù, tránh bỏ mọi response khi lớp cập nhật liên tục. Docs có dấu riêng; thay đổi Docs không tải lại danh sách hoặc chi tiết. Trang biên nhận `teacher.js` không có polling nghiệp vụ nên giữ nguyên.

Định danh chi tiết kho cũ giữ `legacy_` ở URL/body native; metadata chỉ gửi UUID tới đúng kho. Mỗi callback kiểm generation, lớp, bài và unit. Thu hồi401/403/423 đóng cả hai luồng và xóa nội dung riêng. Lỗi đọc body dùng backoff30/60giây và Retry-After, không bị metadata mới phá khoảng chờ; deadline15giây giải phóng lane bị treo. Tracker không mở/nộp/chấm bài học viên.

Renderer sửa node thay đổi theo từng phần Speaking và từng hàng học viên. Cùng bài/lượt giữ node, focus, bôi chọn và vị trí đọc. Mẫu hiện hành đổi tên làm cập nhật tiêu đề; cấu trúc chi tiết vẫn theo template đã lưu của unit như native trước đây.

## Bằng chứng

- Frontend57/57: observer, các consumer Reading/Listening/Speaking, tracker giảng viên8ca và các kiểm chính sách/HTML.
- Browser cách ly9/9: renderer thật, hai app/source/auth SQL thật trên PGlite tổng hợp, ba nhịp30giây thật, Docs-only, thay đổi cả hai kho, nhãn bài, hàng học viên khác, viewport390/768/1440, thu hồi quyền và server cũ. Không gọi Google/AI/Docs hoặc database production; script Google ở màn đăng nhập được giả lập tại ranh giới trình duyệt.
- Browser lỗi3/3: lớp503 chờ30giây nhưng chi tiết vẫn cập nhật; responseA chậm không đè bàiB; cookie chuyển sang principalB chỉ được lớp khác xóa bàiA và giữ nháp học viên.
- Browser native dự phòng dùng chung6/6 cho Speaking, Reading và Listening: reload, đổi bài, đăng xuất, storage login/logout và không tải audio.
- Backend liên quan412ca:398đạt,14ca chỉ chạy native được skip. Không nhận đây là toàn bộ suite818ca. PostgreSQL17 native27/27, DB fixture0/externalAttempts0, node/PG thoát0 không OOM; bốn runtime production giữ ID/image/running trong cửa sổ này.
- RED renderer dùng nguyên source Git204c508; cùng assertion node sau92giây thất bại trên lối cũ, GREEN ở nguồn mới. Capability/nhãn template cũng có RED theo base02c7de4 riêng.

Các log/JSON riêng tư nằm dưới QA của task, không đưa snapshot Docker/config hoặc dữ liệu thật vào repository. Các bộ kiểm không chứng nhận GoogleSSO thật, capacity cùng NAT, actualCLI hoặc rollout; phần đó còn tiếp tục ở T3. Probe middleware riêng đã tái hiện180/200stream thành công và20lỗi429 ở cùngIP; phải xử lý trước bật observation, không nhận là sức chứa VPS.

## Chạy lại trên máy kiểm

Dùng Node hiện hành, dependencies backend đã cài và Playwright library có sẵn. Trỏ `SPEAKING_BACKEND_DIR` tới thư mục `backend` của cùng gói source; `PLAYWRIGHT_MODULE` tới `playwright/index.mjs`; `SPEAKING_TEACHER_EVIDENCE_DIR` tới thư mục QA mới cho từng lượt. Hai runner là `tests/speaking-teacher-observation-browser.mjs` và `tests/speaking-teacher-fault-browser.mjs`; chạy bằng `node`, không dùng `node --test` vì runner tự điều khiển vòng đời trình duyệt/máy chủ. Kết quả có source hashes, request không chứa cookie/token và `result.json` với trạng thái thực. Thiếu biến môi trường, API sai hoặc assertion lỗi làm process thoát khác0; không nhận một vài case đã in thành công là toàn lượt đạt.

Native dùng profile `speaking-state` ở workspace điều phối, hai exact live capture đã ghim và PostgreSQL fixture độc lập. Sau chạy tiếp tục poll tới `native_fixture_complete`; không suy container đã dừng từ test log.

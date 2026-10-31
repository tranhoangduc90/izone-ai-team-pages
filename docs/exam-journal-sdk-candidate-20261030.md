# SDK journal ứng viên — chưa phát hành

Ngày30/10/2026, branch `codex/log-sdk-integration-20261030-pages` từ `ed6916109b24c059de8a384f46acc326c8f11894`. Logger production đang tắt theo yêu cầu Đức. Bản này chỉ tích hợp local để hoàn thiện hệ mới; không bật lại logger, đổi API/lịch/khóa hoặc tác động bài/điểm.

## Phạm vi

SDK8asset được dựng từ source chuẩn `tools/exam-journal/browser/` của repo điều phối bằng `build-browser-sdk.mjs`. Revision `ej-a176e4d58d3089a76456`; SHA256 của `term-tests/shared/exam-journal/SDK_MANIFEST.json` là `f1fd2e22c8432aec43928d7e7956acb5ebb8b7955f2aded760bd5df3af6c7a95`. Manifest và SOURCE mô tả byte thực, không phải chữ ký hoặc giấy phép bật production.

Giữ recorder/retry/ACK, thêm nhịp gom adaptive và phối hợp tab từ hệ ứng viên. Kế thừa API startup và bản sửa tail lifecycle đã phát của Pages. Cache vé khởi tạo dùng thời hạn máy chủ và elapsed time; collector vẫn kiểm quyền/hạn, log giữ đồng hồ client và cờ lệch giờ.

Mọi caller trực tiếp tới SDK dùng cùng `?ej=<revision>`. Các asset native gọi SDK và entry/loader tổ tiên giữ tham số cũ, thay/thêm ej. Có cập nhật cache ở Listening Homework/thực chiến vì dùng audio chung; không thêm slug/cờ ghi log mới. Audio transport/chunks/metadata/quyền và các thuật toán native giữ nguyên.10test-config chỉ thay suffix generated từ lobby SDK; prefix nguyên byte.

Preview ban đầu83file:10SDK/metadata và73host,145URL. Rà token/trivia độc lập kiểm không đổi byte ngoài URL/suffix được giao. Các file test và hồ sơ sau đó được thêm riêng;83 không phải tổng file Git cuối cùng. Backup/receipt riêng ở `C:/Codex-Work/log-optimization-build-20261028/`, gồm `PAGES_SDK_PREVIEW_REVIEW.json`, `PAGES_SDK_LOCAL_APPLY.json`.

## Kiểm đã đạt

### Ghép main ngày01/11/2026 — vẫn là bản nháp

Đã ghép `main` tại `4aa5a9c3afb6ec040e7241cf86c42144837015ec` vào ứng viên SDK, xử lý 12 file/16 vùng xung đột bằng cách giữ mã nghiệp vụ mới của main rồi thêm lại riêng tham số `ej`. Các phiên bản workspace, demoEntry và selectiveReset của Substitute được giữ. Rà độc lập 108 host so với main: ngoài URL asset, code/trivia nguyên sau chuẩn hóa CRLF; 10 prefix test-config nguyên, suffix khớp artifact. Graph tĩnh gồm cả chuỗi trong script HTML có 179 cạnh, thêm một URL template động của Homework Demo; tổng 180 URL đổi phiên bản. Không đổi cờ bật log.

Kiểm tại `E:/Codex-Data/pages-sdk-reconcile-20261101/`: lượt cuối chạy đủ 162 native Node trong 15 runner, không ghép số đếm từ lượt cũ. Khởi tạo/thoát trang 12 ca và đổi học viên/nháp 20 ca trên bốn Substitute đạt ở Edge headless cách ly; các source liên quan không đổi khi sửa chuỗi demo. Lượt native đầu có 2 ca Homework audio lỗi vì catalog của fixture Worker cũ thiếu Scandinavian; giữ log lỗi. Lượt cuối dùng cùng mã Worker với catalog hiện hành của Pages. Catalog này là fixture, không chứng minh cấu hình Cloudflare đang triển khai. 1.398 file input cuối giữ SHA trong lượt native; 10 bundle generated cũng đạt check.

Homework Demo cần thêm cache revision ở import template `data.kind`, app loader và 31 entry. Trình duyệt Chrome cách ly kiểm đủ 31 trang: câu hỏi/ô nhập, thao tác demo, reset và viewport 390; chặn mạng ngoài, không gọi API học viên/AI. Bốn loại demo được kiểm riêng với HTTP cache thật, không dùng Playwright routing: làm nóng mã main, đổi sang ứng viên trong cùng browser context, xác nhận module chung vẫn lấy cache nhưng app/module động mới được fetch với `ej` đúng. Cùng phép thử RED khi phục vụ byte backup trước bản sửa động, GREEN ở bản cuối. Không suy bốn demo này thành cache/rollback của toàn bộ Term.

PR vẫn draft trong khi hoàn thiện hệ log. Đây là bằng chứng tương thích của SDK với mốc main trên, chưa là Google thật, BFCache/OS kill, tải lớn hoặc toàn A–G. Logger production vẫn tắt.

- 126native ID Node tập trung theo nhóm: startup/exit/package/bundle, clock/part rescue, Worker/Homework audio, cache/submission/teacher session và Git checkout autocrlf=true giữ SHA. `.gitattributes` chỉ scoped SDK giữ LF; host giữ newline hiện có. Đây không phải toàn bộ test Pages. Các lượt thiếu cấu hình fixture và guard v/rev cũ giữ nguyên log; runner mới kiểm ej đúng manifest.
- Native Chrome cách ly, asset/entry thật: Term1K56 giờ đúng/nhanh30ngày/chậm30ngày, Term2K56 và MiniK56 giờ đúng; Reading35giây giữ DOM/focus/selection/scroll/nháp. Mạng ngoài bị chặn hoặc trả API giả, không gọi bài thật. SDK thực sự tải đều dùng revision trên.
- Native journal handler/SQLite dùng code thật trên laptop qua route interception. Cả năm DB đã giải mã GCM độc lập, so payload/binding mọi event ACK và dựng text UTF16;74asset ghim. ACK lặp không thành event mới. Receipt `NATIVE_SDK_HOST_FIVE_CASE_READBACK_20261030.json`; không nhận thành collector HTTP từ xa.
- Browser exit r4 và startup r3 đạt6ca mỗi nhóm, gồm điều hướng thật và IDB treo, context chậm/lỗi/hồi phục, phân biệt visibility/pagehide, scope lớp và disabled. Guard departure4,5giây không đổi; chỉ warmup/quan sát thường/replay chờ20giây cho nhịp gom15giây. `SDK_BROWSER_CONTRACT_ACCEPTANCE_20261030.json` giữ số native ID và checksum; receipt lỗi cũ vẫn giữ.

Lát tiếp cùng SDK đã chạy ba K67 với API thật/PGlite RAM và bốn Substitute với journal/owner worker thật nhưng API bài thi/DB phiên giả. Các ca giữ trạng thái35giây và readback GCM/ticket/ACK/owner có hồ sơ riêng trong repo điều phối. Không nhận fixture thành production parity hoặc native n8n/Portal/Google.

Runner `tests/substitute-shared-identity-browser.mjs` được bổ sung điều kiện đợi ô Listening trong bố cục semantic đã dựng xong, xác nhận giá trị đã nhập trước thao tác Đổi người, rồi kiểm cùng node/giá trị và ô Reading không đổi.20ca danh tính/nháp của bốn host đạt trên Chrome cách ly, audio/API bị thay bằng fixture. Thay đổi này chỉ ở test;8asset SDK và mã bài thi nguyên byte.

Chẩn đoán có kiểm soát trên hai K67, có/tắt SDK: chuyển ô native sang bố cục thi làm mất focus; ký tự gửi trong khoảng đó chưa vào ô, sau focus lại thì nhập/giữ được. Nội dung đã nhập trước chuyển vẫn được giữ. Bốn phép xen thời điểm xác nhận cơ chế này nhưng không có trace đủ để gán lại chính xác hai failure cũ. Rủi ro native gõ quá sớm không được sửa trong PR SDK và không được gọi là lỗi production đã giải quyết.

Các phép kiểm không đổi UI, phiên GV90/365ngày, native deadline hoặc quyền Listening. Chưa gọi toàn bộ K67/Substitute, Google thật, OS kill/BFCache thực, cache nóng/rollback, tải lớn hay toàn hệ A–G đã đạt. Sự kiện pagehide/pageshow giả lập không chứng minh eligibility BFCache. Xem STATUS của repo điều phối để lấy kết quả mới nhất.

## Cách kiểm lại

Từ root Pages, dùng Node24 chạy các test `exam-journal-*.test.mjs`, `exam-journal-startup-contract.mjs`, `audio-clock-skew.test.mjs`, `audio-part-rescue.test.mjs`, `term-test-reliability.mjs`, `term-mini-submission-contract.mjs`, `term-mini-cache-graph.mjs`, `term-test-teacher-session.mjs` trong `tests/` theo nhóm phù hợp. Các runner browser là chương trình riêng, không chạy mọi file mjs bằng test runner.

Hai runner `cloudflare-audio.mjs` và `listening-homework-audio.test.mjs` cần `AUDIO_WORKER_SOURCE` trỏ đúng release Worker cô lập tại backend `backend/ops/releases/audio-cloudflare-20261023`; runner đầu còn cần `AUDIO_PUBLIC_FIXTURE` là MP3 MiniK56 đã kiểm SHA theo catalog. Thiếu env thì runner lỗi; không coi là skip/pass. Worker được import trong tiến trình với R2/mạng giả, không triển khai cloud.

Lệnh kiểm nhận source/fixture local, chạy hành vi và in số đạt/lỗi; lỗi trả exit khác0. Chọn thư mục evidence mới ngoài Git cho browser. Không đưa log/SQLite/ảnh/khóa hoặc thông tin học viên thật vào repo public. `tools/build-exam-journal-startup.mjs --check` kiểm suffix lobby đúng artifact; không dùng helper cũ để ghi đè SDK từ source chưa đóng gói.

## Tiếp theo và quay lại

Hoàn thiện các engine còn lại, consumer/cache thực, replay/lifecycle, canary và kế hoạch toàn hệ trước khi phát hành. Tab đang mở giữ bản đã tải; không ép tải lại bài đang làm. Nếu cần quay mã ứng viên, dùng commit/revert đúng SDK và chuỗi cache của cùng gói sau review; giữ database/nháp/bài mới và cấu hình paused. Không restore dữ liệu bài thi để quay frontend.

# Chuẩn bị sớm audio dẫn chứng trong Test — 26/10/2026

## Phạm vi

Mở rộng cách [Listening thực chiến](LISTENING_REPLAY_FAST_2026-10-26.md) giảm chờ ở lần đầu bấm nghe lại sang tất cả Test hiện có chức năng này. Kiểm kê `K67_ANSWER_EXPLANATIONS.attach`, `reviewAudio`, loader và catalog xác nhận:

| Test | Luồng dùng chung được cập nhật |
|---|---|
| Term Test 2 khóa 67 | Học viên answer-sheet/CBT và dashboard giảng viên |
| Substitute Test 1 khóa 67 | Học viên CBT và trang kết quả giảng viên |

Term Test 1 và Mini Test Buổi 5 khóa 67 có lời giải chữ, chưa có descriptor/clip nghe lại. Hai bài này vẫn tải lời giải khi bấm; không thêm audio hoặc tải trước. Các trang dùng renderer chung nhận cùng revision để tránh lệch cache. Test K56 và các gói IZTT1 cũ giữ đường tải riêng.

## Cách hoạt động

- Chỉ khi màn kết quả đã qua cổng `completed` hiện hành, renderer của hai Test có replay mới gọi sớm **cùng API xem lời giải** mà nút bấm đang dùng. API học viên/GV, attempt token, kiểm định danh và điều kiện nộp Writing của caller giữ nguyên. Không suy quyền từ cache audio.
- Loader lúc làm bài và loader nghe lại cùng import `transport.mjs?v=20261026-test-replay1&journal=20261024-startup-v2`. Sau kiểm catalog, envelope, nguồn và tín hiệu hủy, transport tái dùng tối đa một Blob MP3 hoàn chỉnh đã xác minh trong bộ nhớ module, thời hạn 24 giờ. Không lưu grant, session key hoặc token. Caller có collection `parts` riêng vẫn được điền đủ collection đó.
- Nếu cùng tab đã tải đúng MP3 public khi thi, nghe lại dùng chính Blob đó, không tải thêm byte MP3 hoặc ghép/hash lại toàn bộ. Nếu mở tab mới, vẫn phải đọc/kiểm/ghép từ chunk cache một lần; chưa có cache thì tải qua Worker/Pages như trước. Gói mã hóa cũ không được chuyển sang đường public để lấy lợi ích này.
- Khi lời giải hợp lệ trả về, chuẩn bị audio và metadata trong nền, không tự phát và không chặn điểm/transcript. Nút nghe lại nối vào cùng công việc chuẩn bị; đổi clip/câu bỏ ý định phát trước, không tạo lượt tải song song. Chỉ click mới phát, giữ 1×, kiểm thời lượng và mốc đầu–cuối, tự dừng.
- Đóng/hủy, ẩn trang hoặc đổi ngữ cảnh hủy phần chuẩn bị đang chờ; phản hồi cũ không được gắn media. Reset/đổi người trong Term gọi cleanup; adapter Substitute giữ controller và kiểm identity hiện hành. Sau reset, renderer gắn lại nút đúng lượt trên cả DOM kết quả tái sử dụng, không nhân đôi cột Giải thích.
- Tổng chuẩn bị hữu hạn 120 giây; chờ metadata/seek tối đa 10 giây. Lỗi tải sớm không che kết quả; click sau được thử lại. Nguồn tĩnh dự phòng vẫn kiểm SHA-256, catalog transport vẫn kiểm hash trước trả Blob.

Không đổi backend, Worker/R2, database, đề/key/transcript/MP3/timestamp, lớp, login GV, điểm, timer, submission, attempt hoặc CSS. Không tạo/nộp/chấm lại bài thật để kiểm.

## Bằng chứng kiểm

Nền trước sửa: `eb7878a6d9244a4b3cb485a3ad237929684e1d8d`. Revision frontend: `20261026-test-replay1`.

- RED trên nền: ca giữ nguyên Blob thất bại vì code cũ ghép Blob mới; ca Term Test 2/HV thất bại vì chưa gọi quyền/chuẩn bị trước click.
- GREEN 115 ca unit/hợp đồng: cache hoàn chỉnh, TTL, collection riêng, metadata, catalog/hash/hủy, Worker 512 KiB, quyền/từ chối/1027/dự phòng, audio public/IZTT1, Listening thực chiến, pending/submission/cache graph và Substitute recovery.
- GREEN thêm 36 ca journal startup/adapter: kết quả và lỗi API gốc được giữ; bootstrap/capture không giành quyền owner audio và các URL cache còn nối đúng.
- GREEN 14 ca Chrome dùng renderer/player/native loader và adapter Substitute thật, API dữ liệu/quyền giả ở biên HTTP, bytes MP3 thật: hai Test × HV/GV, first click/currentTime/tự dừng, option sai/đổi câu, Reading popup, chưa hoàn thành, hai bài chỉ có chữ, từ chối/thử lại, hash sai, hủy/thử lại, đổi lượt khi API còn chờ và reattach cùng bảng. Ca tab ẩn thật qua Chrome profile thử riêng/CDP `noDefaults:true`, không skip; quay lại không tự phát.
- GREEN 4 ca Chrome hồi quy Listening thực chiến Buổi 8/10 × HV/GV, decoder và clip thật.
- GREEN 48 ca browser chạy handler nộp Listening và 96 ca nộp Reading hiện hành cho sáu bài K56/K67: hủy, lỗi/response rỗng, ACK hợp lệ, bấm đôi, mất reply, điểm 0/toàn bộ. Đây là kiểm handler với API giả, không thay chứng cứ một học viên nộp thật.
- Đã xem ảnh popup 390 px cho Term Test 2/HV và Substitute Test 1/GV; không đổi bố cục.

Runner mới: `tests/test-replay-cache.mjs`, `tests/test-replay-browser.mjs`; cập nhật `tests/k67-review-audio.mjs`. Browser runner cần Playwright/Chrome, hỗ trợ `TEST_REPLAY_EVIDENCE_DIR` và `TEST_REPLAY_NATIVE_CDP_URL` cho ca tab ẩn thật. Không có CDP thì ca đó ghi skip rõ. `TEST_REPLAY_BASE_REVISION` phục vụ chạy RED trên source nền.

| Luồng | Click đầu sau chuẩn bị → `playing` | p95 trong 10 click |
|---|---:|---:|
| Term Test 2 · HV | 13,1 ms | 13,1 ms |
| Term Test 2 · GV | 9,7 ms | 15,4 ms |
| Substitute Test 1 · HV | 7,6 ms | 18,6 ms |
| Substitute Test 1 · GV | 11,8 ms | 12,4 ms |

Số đo Chrome desktop local với biên mạng giả, MP3 và decoder thật; còn kiểm `currentTime` tiến lên. Không đo tiếng phát từ loa. Mỗi hàng là một ngữ cảnh với 10 click, không phải 10 thiết bị hoặc 10 lần mở lạnh. HV dùng loader lúc thi trước; test xác nhận review thêm một yêu cầu quyền nhưng không thêm request MP3. GV chưa có audio tải sớm một lần.

Nếu bấm ngay khi tải nền chưa xong, vẫn có thể phải chờ. Tải sớm có thể tải audio cho người chỉ xem điểm; chỉ chuẩn bị kết quả đang mở, không tải hàng loạt lịch sử. Chưa kiểm iPhone/Safari vật lý, mạng thật của học viên, Google GV thật xuyên sản phẩm hay Portal/Docs. Fixture không chứng minh các phần đó đạt.

## Phát hành và quay lui

Chỉ frontend Pages. Sau commit/push/merge, cần xác nhận Pages build đúng SHA rồi đọc lại HTML và toàn bộ runtime đã đổi qua HTTPS trên link hiện dùng. SHA/PR/build/readback thực tế lưu trong biên nhận task ngoài repo; tài liệu này không tự chứng minh đã phát hành.

Nếu có phát nhầm/nghe sau hủy, lỗi quyền hoặc tác động làm bài: revert đúng commit frontend của gói, giữ các thay đổi task khác. Khôi phục đồng bộ renderer/player, hai native loader, bootstrap và query HTML. Không rollback DB, reset hoặc chấm lại bài.

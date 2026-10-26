# Chuẩn bị sớm audio nghe lại Listening — 26/10/2026

## Phạm vi và hành vi

Yêu cầu: giảm thời gian chờ ở lần đầu bấm “Nghe lại đoạn này”, áp dụng cho tất cả webapp Listening thực chiến hiện có. Kiểm kê source/cấu hình: bài Buổi 8 `67-practice-listening_mcq_flowchart` và Buổi 10 `67-practice-listening_c20_t3_p4_inclusive_design`, cùng engine `listening-practice/`, cả học viên và giảng viên. Bài sau dùng engine này kế thừa thay đổi; không mở bài/lớp hoặc sửa CTA trong đợt này.

- `audio-delivery.mjs`: sau grant API mới và kiểm manifest, dùng lại tối đa một Blob MP3 hoàn chỉnh đã xác minh trong tab. Khóa file gồm assetVersion/hash và dung lượng; không cache grant/token/quyền. Xóa bộ nhớ có generation riêng để lượt tải cũ không lấp lại cache sau đăng xuất.
- `app.js`: khi đã dựng kết quả nộp hợp lệ, chuẩn bị nghe lại không chặn hiển thị điểm. Không gọi audio từ màn chưa nộp. Kết quả trả về sau đổi người hoặc yêu cầu GV cũ bị bỏ. Đăng xuất Listening/SSO từ tab khác hủy chuẩn bị cũ.
- `explanation-review.js`: một công việc chuẩn bị cho đúng owner, vai trò, lượt, contentVersion, hash và endpoint. Bấm nghe nối cùng công việc; đổi câu chỉ hủy ý định phát. Đóng/hủy/ẩn trang hủy tải đang chờ; thay ngữ cảnh giải phóng URL và bỏ phản hồi muộn. Lỗi tải sớm không che kết quả; click sau cho thử lại.
- `review-audio.js`: chuẩn bị metadata không phát hoặc thay vị trí/đồng hồ làm bài. Chờ metadata/seek hữu hạn 10 giây, tổng tải vẫn 120 giây. Chỉ phát khi bấm; giữ mốc đầu–cuối và cơ chế tự dừng.
- Hai HTML vào bài/GV cùng dùng revision `20261026-review-fast1`. Hai nơi import `audio-delivery.mjs` có cùng URL để dùng chung bộ nhớ module.

Giữ nguyên backend, database, MP3/hash, transcript, timestamp, theme master #170, tiến độ/nghe một lượt/Pause/Resume/Reset/Submit, điểm và Docs. Không sửa module transport dùng chung với Test. Nguồn API cũ trả MP3 vẫn dùng được; review xác minh hash mong đợi, không đưa file chưa xác minh vào cache hoàn chỉnh.

## Kiểm chứng trên bản phát hành

Nền trước sửa: `49690ce3affeda72f6d3abb6dd247c41d9808e2b`. Các runner mới nằm trong `tests/listening-audio-reuse.mjs`, `tests/listening-review-player.mjs`, `tests/listening-review-browser.mjs`.

- RED: cùng ca browser “lesson 8 student prepares before first click” chạy source từ Git nền, thất bại đúng vì trước click chỉ có grant lúc làm bài, chưa có grant/chuẩn bị nghe lại. Ca tái dùng Blob cũng RED trên code cũ vì tái ghép file.
- GREEN: 65 ca unit/hợp đồng gồm cache hoàn chỉnh, hash, hủy, API cũ, deadline metadata, transport/Workers 512 KiB, lỗi IndexedDB, quyền, nguồn dự phòng và hồi quy nhận diện/phục hồi.
- GREEN: 12 ca Chrome, không skip: Buổi 8/10 × HV/GV, MP3 thật/decoder thật, mốc clip và dẫn chứng option sai; click khi đang tải, đổi câu, hủy/thử lại, từ chối quyền, đổi người, hai loại đăng xuất, chưa nộp và tab ẩn thật.
- GREEN: 4 ca backend hiện hành trong bản sao cách ly dùng PGlite/HTTP: cả hai hash, owner, quyền review sau nộp, quyền lớp GV, Range và state không đổi. Không trỏ fixture đến production.
- Kiểm ảnh popup ở chiều rộng 390 px cho cả hai bài/vai trò. Không đổi CSS hoặc bố cục.

Ca tab ẩn dùng Chrome profile thử riêng, CDP `noDefaults:true` trên default context; đã quan sát `document.hidden === true`. Playwright context thường ép focus, nên chỉ bringToFront hoặc phát visibilitychange giả không đủ. Cấp endpoint thử qua `LISTENING_NATIVE_CDP_URL`; không dùng profile Chrome của người học. Runner không có endpoint sẽ ghi rõ skip ca này, không nhận là đạt.

Các lần setup thiếu fixture/dependency và selector thử trỏ vào lời giải ẩn đã được sửa ở harness, không sửa hành vi app để cho qua. Đầu ra kiểm được giữ ngoài Git tại kho bằng chứng của task trên máy vận hành; ảnh và JSON không chứa dữ liệu học viên thật.

## Số đo và giới hạn

Chrome desktop trên localhost, API/roster giả tại biên mạng, bytes MP3 gốc thật. Đo từ sự kiện click đến `playing`, kiểm thêm currentTime thực sự tiến lên; chưa đo thời gian từ loa/tai nghe phát tiếng.

| Luồng | Lần bấm đầu sau chuẩn bị | p95 của 20 lần bấm khi đã chuẩn bị |
|---|---:|---:|
| Buổi 8 · HV | 9,5 ms | 14,3 ms |
| Buổi 8 · GV | 13,2 ms | 14,1 ms |
| Buổi 10 · HV | 12,2 ms | 14,2 ms |
| Buổi 10 · GV | 12,0 ms | 14,4 ms |

Bản nền Buổi 8/HV: lần đầu 241,7 ms trong cùng loại harness đã có audio của lượt làm bài. Đây là phép đo local, không cam kết mức tăng tốc production hoặc mọi thiết bị. Bộ 20 mẫu gồm lần đầu và những lần bấm tiếp theo trong cùng ngữ cảnh, không phải 20 thiết bị hoặc 20 lần mở trang lạnh.

HV cùng tab có một lượt tải file lúc làm bài; review chỉ thêm grant, không thêm byte MP3 hoặc tái ghép. Mở trang mới còn chunk cache vẫn cần đọc/kiểm/ghép một lần; máy chưa có cache vẫn phải tải file và có thể chờ nếu bấm ngay. Tải sớm có thể tải file cho người chỉ xem điểm, giới hạn một kết quả hoạt động, hủy khi rời/ẩn; không tải hàng loạt lịch sử. Quyền grant vẫn thuộc API, cache byte public không thay quyền.

Chưa kiểm iPhone/Safari vật lý, mạng thật của học viên, Google GV thật xuyên sản phẩm, Docs/Portal hoặc hành trình nộp của học viên thật. Các phép kiểm đó không được suy ra từ fixture hoặc số đo local.

## Phát hành và quay lui

Phát hành chỉ frontend Pages sau khi commit/push gói này, tích hợp main và Pages build thành công. Đọc lại các file đã đổi và query version qua HTTPS, mở hai link bài cũ, kiểm console và đường vào mà không tạo/nộp/reset lượt thật. Ghi SHA/PR/build thực tế vào biên nhận task sau thao tác; không coi tài liệu này là bằng chứng đã phát.

Nếu có phát nhầm/nghe sau hủy, lỗi quyền hoặc ảnh hưởng làm bài: revert đúng commit frontend của gói này rồi kiểm lại các asset/query tương thích. Không quay toàn bộ main về mốc cũ, không đè thay đổi task khác, không restore DB/reset/chấm lại. HTML, app, popup, player và module tải phải cùng bộ revision.

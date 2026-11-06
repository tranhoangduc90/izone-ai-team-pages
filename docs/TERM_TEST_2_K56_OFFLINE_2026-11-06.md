# Term Test 2 K56: offline, phục hồi và tải bài

Áp dụng cho lượt CBT Term Test 2 K56 mới, theo cả thứ tự Listening trước và Reading trước. Giữ bố cục, câu hỏi, hình Writing, timer Reading 60 phút/Writing 30 phút, dữ liệu cũ và đường xem kết quả. Writing vẫn chỉ có Task 1, không có textbox dàn ý.

## Hành trình

1. Xác nhận đúng người học khi đang có mạng. Trang lấy quyền cho cả bài, tải và kiểm đủ audio, nội dung và đồ thị tài nguyên web. Thiếu phần thiết yếu thì chưa báo sẵn sàng và chưa chạy giờ.
2. Sau sẵn sàng có thể mất mạng: nghe thử, bắt đầu, làm bài, khóa từng kỹ năng và chuyển phần trên máy. Đáp án/bài viết được lưu ở IndexedDB và bản dự phòng localStorage; audio là Blob riêng trong IndexedDB. Không dùng sessionStorage làm bản bền duy nhất.
3. Mở lại cùng URL, trình duyệt và hồ sơ trên máy để phục hồi đúng người/lượt, đáp án, phần đang làm và hạn giờ. Không cấp lại 60/30 phút khi mở lại. Giờ máy bất thường được đánh dấu đối soát.
4. Có mạng trở lại, trang đọc biên nhận rồi gửi lại từng operation theo thứ tự. Chỉ biên nhận khớp đầy đủ mới gỡ pending. Lỗi mạng, HTTP hoặc quyền không xóa bài.

Nút **Tải bài làm về máy** nằm trên thanh đầu trang khi làm bài, cũng dùng được khi đang offline/chờ đồng bộ. File HTML mở độc lập, có đủ Listening/Reading/Writing, Unicode, xuống dòng và trạng thái/biên nhận. Nội dung giống markup/script được escape; file không chứa token, permit, khóa audio hoặc đáp án đúng. Tải file không nộp bài, đổi hạn giờ hay điều khiển audio.

## Audio

Nguồn đầu là [MP3 trên GitHub Pages](https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/k56-audio-assets/term-test-2-k56-3600563c0af62fd5.mp3), dự phòng [Cloudinary do Đức cung cấp](https://res.cloudinary.com/dhvgrthes/video/upload/v1793958877/term-test-2-k56_kqfl62.mp3). Cả hai có 29.173.785 byte và SHA-256 `3600563c0af62fd5c9656be0d7b7f52a1bae281d6af1de80ba4fe0de523f92af`, decoder trình duyệt đọc khoảng 30 phút 23 giây. Chỉ bắt đầu khi nguyên file đã khớp byte/hash và đọc lại được trên máy.

Mạng, autosave, log hoặc đồng bộ điểm không có quyền pause/seek/load lại audio v2. Lỗi media/không tiến lên giữ mốc nghe và đáp án; phục hồi phải quan sát tiến độ thực, không chỉ dựa vào Promise `play()`. Không tự thu Listening theo wall deadline khi chưa có natural ended hợp lệ. Học viên vẫn có nút báo không nghe được và nộp thủ công có xác nhận.

## Writing và trạng thái

Bài Task 1 canonical đã khóa thực sự trống, kể cả whitespace/ký tự vô hình, nhận 0 theo `blank_rule`; không tạo job AI. Field thiếu, dữ liệu xung đột hoặc chưa có quyền không được coi là bài trắng. Bài ngắn có chữ vẫn vào luồng chấm hiện hành. Điểm 0 được giữ như một điểm hợp lệ khi hiển thị và gửi Portal.

Các trạng thái được tách: đang lưu trên máy; đã lưu trên máy/chờ đồng bộ; máy chủ đã xác nhận; cần đối soát; đang có kết quả. Khóa trên máy không có nghĩa máy chủ đã nhận. Chỉ mở kết quả theo chính sách công bố hiện hành.

## Kiểm và vận hành

- `tests/term2-offline-unit.mjs`: kho lỗi, export, receipt/ACK, quyền, clock, revision cuối và fallback audio.
- `tests/term2-offline-browser.mjs`, `term2-offline-faults.mjs`: HTML/native renderer thật với API giả; hai thứ tự, mất mạng, reload, thiếu cache, CDN thật, quota/IDB abort, hai tab/focus/vùng đọc, timeout API, play giả và browser restart.
- `tests/term2-full-round.mjs`: hai lượt đủ audio thật + 60 phút Reading + 30 phút Writing; một online, một ngắt mạng từ sẵn sàng. Ghi hash manifest source và timeline, không tua/rút giờ.
- Nhóm hồi quy Term/Mini/Substitute vẫn chạy riêng; không cộng số test trùng thành một tỷ lệ nghiệm thu chung. Một số fixture cũ thiếu biến initializer/cache revision đã được sửa ở harness, giữ assertions về lưu/khôi phục; ca cache lặp cũ của kết quả được thay bằng ca điểm 0.

Tạo lại `offline-assets.mjs` bằng `python tests/build-term2-offline-assets.py` sau mọi thay đổi public liên quan. Worker kiểm hash của từng asset khi cài và trước sẵn sàng; không cache API/bài làm/khóa trong CacheStorage. Worker chờ khi còn tab khác trong scope, không tự chiếm lượt đang làm.

Hash dùng đúng byte Git/Pages, chuẩn LF cho file text. `python tests/term2-offline-release-bytes.py` so độc lập với blob đã đi qua bộ lọc Git thật. Cache mang ID từ toàn bộ bảng hash, nên cài bản mới không ghi đè kho của worker đang phục vụ lượt cũ. Mọi phát hành có sửa tài nguyên trong đồ thị, kể cả file dùng chung, cần tạo lại metadata và kiểm byte phát hành trước khi đưa lên Pages.

Backend nằm trong release `backend/ops/releases/term2-offline-20261106` của repo mapping. Phát backend tương thích trước Pages; chỉ cấp v2 cho lượt mới. Nếu cần ngừng cấp mới, backend dùng `TERM2_OFFLINE_NEW_ENABLED=false` nhưng phải giữ endpoint/secret/bảng để nhận v2 pending. Không xóa kho máy hoặc restore đè dữ liệu khi quay lui.

Kiểm trình duyệt có kiểm soát không chứng nhận người học đã nghe được tai nghe thật. Trạng thái kiểm sleep/wake phần cứng và một ca thi tự nhiên cần được ghi riêng; không suy từ thời gian player hoặc `paused=false`.

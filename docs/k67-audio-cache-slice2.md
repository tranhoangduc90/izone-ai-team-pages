# K67 — lưu audio mã hóa và phục hồi sau reload

Đã xây và kiểm local trên nền lát 1; chưa phát hành. Phạm vi Term Test 1/2 và Mini Test Buổi 5, cả Listening trước/Reading trước. Tuyến thi lại dùng cùng bộ nạp; chưa nghiệm thu vé thi lại thật trong lát này.

## Hành trình

Phòng chờ gọi POST `audio-access` bằng mã phiên và generation để xác thực quyền và nhận manifest đã ghim. Trước start, response không có khóa. Trình duyệt kiểm bản lưu đúng API, slug, phiên, generation, version, thời hạn, kích thước và checksum; cache hỏng/mất thì tải toàn file mã hóa khi có mạng.

`k67-shared/audio-store.js` dùng database riêng `izone-k67-encrypted-audio-v1`, store `audio`. Một record chứa định danh, manifest, Blob ciphertext, checksum, expiry và complete. Không lưu khóa, MP3 rõ hoặc Blob URL. Chỉ báo đã lưu sau transaction hoàn tất và đọc lại đạt. Mỗi thao tác mở/giao dịch chờ tối đa 2,5 giây; storage lỗi/quota/hết chờ vẫn dùng RAM và hiện **Audio chưa được lưu để khôi phục qua tải lại**.

Khi reload bài đang nghe, server được xác thực lại; trang gửi lại journal sự cố chưa ACK hoặc mở sự cố reload trước tải/khôi phục audio. Lát 1 giữ mốc/nháp/deadline trong khi học viên thử âm thanh và tiếp tục. Đã hết audio thì giữ giai đoạn xem lại, không mở sự cố reload hoặc phát lại đoạn cuối. Final checkpoint và tiến độ gần cuối vẫn chịu giới hạn thời gian phía server.

Khi start, khóa mới cấp chỉ nằm trong bộ nhớ trang. AES-GCM kiểm xác thực ciphertext; SHA-256 của plaintext phải khớp manifest tin cậy trước khi tạo nguồn audio. Bản lưu hỏng nhưng checksum bị tính lại cũng không qua được hai bước này. Nếu lỗi do cache, xóa bản đó và tải lại đúng audio một lần; không đổi phiên bản đề để che lỗi.

Reload lúc offline phải chờ online xác thực. Nếu shell trang vẫn tải được, UI giữ nút start khóa và có nút thử lại; sự kiện online thử lại việc chuẩn bị. Khi trình duyệt không tải được cả shell, có thể chỉ hiện trang lỗi mạng của trình duyệt. Không có service worker hoặc quyền tự mở bài offline trong lát này.

Nộp Listening xong thì xóa bản lưu phiên theo khả năng storage. Mỗi lần ghi cũng dọn bản hết hạn trong riêng database K67. Không xóa cache/localStorage sản phẩm khác. Nếu xóa không thành công, ciphertext còn lại vẫn không có khóa lưu bền và không qua xác thực phiên đã nộp.

## File và tác động

- `audio-store.js`: đọc/ghi/kiểm/dọn ciphertext bằng IndexedDB thật.
- `bootstrap.js`: xác thực online, dùng cache, kiểm giải mã/hash, giữ nháp revision mới, xử lý reload/review và trạng thái lưu.
- `listening-controller.js`: journal/keepalive khi pagehide; chốt tiến độ cuối khi audio ended; giữ cơ chế bù một lần và chặn nộp của lát 1.
- Bốn HTML dùng bootstrap chuẩn tăng revision; không đổi CSP hoặc tải thư viện ngoài.
- `tests/k67-audio-incidents-browser.mjs`: thêm 26 ca, tổng 43 ca bảo vệ audio. `mini-test-identity.mjs` chỉ thêm response cache chưa bật cho fixture kiểm danh tính; giữ assertion hiện hành.

K56/Substitute không nhận tính năng mới; bộ hồi quy vẫn kiểm các consumer hiện có. Không sửa shared/app.js thêm trong lát 2.

## Kiểm chứng

Chạy trong repo Pages:

```powershell
# Kiểm hành trình thật trên Chrome, API và SQL giả tại máy.
node --test tests/k67-audio-incidents-browser.mjs

# Kiểm đầy đủ suite K67 và các consumer dùng chung hiện có.
node scripts/run-term-test-67-regression.mjs --all
```

Cần Node 24, Playwright runtime đã cài và dependency backend đúng package-lock. Backend mặc định ở repo kề Pages; nếu khác, đặt `K67_BACKEND_FIXTURE_ROOT` trỏ tới `products/term-mini-k67`. Test tự tạo server localhost, chỉ dùng tên/đề/audio giả; lỗi trả exit khác 0.

43 ca audio đã đạt, gồm 6 hành trình reload/cache → reauth → đúng mốc/nháp → bù → nộp, lỗi phiên/version/hash/GCM, quota/storage, mất mạng, mất ACK, reload giai đoạn review và ciphertext 40 MiB. Bộ hồi quy Pages đủ 149 ca đạt theo phép ghép: full run 148 đạt/1 fixture lỗi, sửa đúng fixture rồi chạy lại 1 ca đạt. Không gọi đây là một full invocation xanh mới. Backend 239 ca đạt, không skip.

Kiểm 40 MiB chỉ chứng minh ghi/hash/đọc lại trong môi trường thử và UI còn xử lý nhịp timer; không phải chứng nhận bộ nhớ mọi máy hay đề thật dài 30 phút. Chưa kiểm Safari/Firefox, profile/extension thật, sleep/Bluetooth/cuộc gọi hoặc một chủ phát giữa nhiều tab.

Tham chiếu API: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [AES-GCM decrypt](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/decrypt), [quota và eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). Bản lưu là phương án phục hồi có kiểm tra, không phải cam kết trình duyệt giữ file vĩnh viễn.

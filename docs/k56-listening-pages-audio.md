# Audio Pages cho K56 và Listening thực chiến

Áp dụng cho Term 1/Term 2/Mini K56 và hai audio Listening thực chiến đã phát hành: Science experiment, Inclusive design. Giữ nguyên bytes MP3, chất lượng, thời lượng và mốc dẫn chứng; chỉ chuyển nơi tải file. Các MP3 trong `term-tests/k56-audio-assets/` và `listening-practice/audio-assets/` có tên chứa SHA-256 và công khai như audio K67. Không đặt đề, đáp án, transcript riêng, bài làm hay token ở các thư mục này.

## Cơ chế tải

`shared/public-audio.mjs` dùng thuật toán K67: hai phần tải song song, mỗi phần 1 MiB, tối đa hai lần thử; kiểm hash từng phần và toàn file trước khi phát. Phần đúng giữ tối đa 24 giờ trong IndexedDB, lỗi kho dùng RAM. K56 và Listening có cache và đường dẫn cho phép riêng. Cache không thay cho quyền kiểm tra phiên trên API.

- K56: frontend báo `publicAudioVersion: 1` khi prepare. API chỉ chọn MP3 khi đến phần Listening, không phải phiếu giấy, phiên còn hợp lệ và chưa bắt đầu. Metadata được ghim trong `mini_definition_snapshot.publicAudioManifest`; không thay nội dung đề đã ghim. Phiên đã bắt đầu nhưng chưa có metadata public tiếp tục dùng gói IZTT1. Phiên đã ghim MP3 giữ đúng URL/hash ấy khi tiếp tục. Nghe thử tối đa 30 giây lấy từ cùng Blob đã kiểm, không tải preview từ VPS. Bắt đầu vẫn xác nhận với API và dùng controller K56 hiện hành.
- Listening: API audio hiện có kiểm chủ bài hoặc quyền giảng viên trước khi trả metadata khi client gửi Accept `application/vnd.izone.audio-manifest+json`. Sau đó trình duyệt tải MP3 từ Pages. Audio xem lại vẫn yêu cầu kết quả đã nộp và đúng phiên bản/hash; quyền lớp, phiên giảng viên và đăng xuất chung giữ nguyên. Không gửi Bearer token hay cookie API tới yêu cầu MP3 Pages.
- Client cũ/API cũ vẫn nhận hoặc tải file theo đường cũ. Một tab đang mở có thể dùng VPS cho đến khi tải lại; không cưỡng bức tải lại hoặc reset bài đang làm.

## Phát hành và quay lại

Phát hành frontend/file trước; kiểm URL thật, Range, kích thước và SHA-256, rồi mới chuyển API. API được ghép từ image live hiện hành, chỉ thay module cần thiết, giữ env/mount/network/cổng và dữ liệu. Không migration schema hoặc reset học viên. Quay code bằng image trước đó và giữ database hiện tại; frontend tương thích phản hồi audio cũ. Không xóa MP3 đã được ghim.

## Kiểm

- `node --test tests/public-audio-delivery.mjs`: retry, hash, thiếu bytes, hủy, giới hạn đường dẫn, token chỉ tới API và tương thích file cũ.
- `node --test tests/term-mini-cache-graph.mjs`: entry K56 tải revision mới, app nộp bài và K67 giữ revision hiện hành.
- Backend: `backend/ops/releases/audio-pages-20261023/test.mjs` kiểm pin bằng SQL; `products/listening-practice/test/public-audio.test.js` kiểm quyền metadata trước/sau nộp và giảng viên, không truyền bytes từ VPS.

Kiểm trình duyệt riêng cần tải file thật, xác minh cache qua reload, nghe thử, lỗi hash khóa Bắt đầu, giữ lượt Listening qua tải lại/Tiếp tục. Bộ API/SQL thử dùng học viên giả; không nộp/chấm/reset học viên thật để tạo bằng chứng.

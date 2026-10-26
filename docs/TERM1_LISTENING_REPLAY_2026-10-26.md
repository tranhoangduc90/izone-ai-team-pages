# Nghe lại dẫn chứng Term Test 1 khóa 67 — 26/10/2026

## Phạm vi và cách dùng

Term Test 1 khóa 67 (Cambridge 16 Test 1) bổ sung nghe lại bằng chứng cho đủ 40 câu Listening, gồm cả dẫn chứng phương án nhiễu. Giữ 40 lời giải Listening và 40 Reading đã phát hành ngày 17/10. Áp dụng bản bảng đáp án, CBT hai thứ tự kỹ năng và giảng viên; không thêm tính năng vào vé thi bù hoặc Mini.

Sau khi nộp đủ các phần theo quyền hiện hành, mở bảng Listening và chọn **Xem giải thích**. Nút nghe nằm ở ô bằng chứng và các trích dẫn trong phân tích. Có mốc đầu–cuối, phát 1×, tự dừng; đóng, đổi câu hoặc ẩn trang dừng phát. Hai phần bằng chứng cách nhau được tách thành hai nút. Trích transcript, màu và toàn bộ chữ nguồn giữ nguyên.

Kế thừa [chuẩn bị sớm/tái dùng audio Test](TEST_LISTENING_REPLAY_FAST_2026-10-26.md): xin lời giải qua cùng API quyền xem kết quả, chuẩn bị decoder trong nền, tái dùng Blob public đã xác minh của lượt làm bài trong cùng tab. Không thêm request MP3 khi audio đã tải đủ. Click khi đang chuẩn bị nối cùng công việc; hủy/đổi người không gắn phản hồi muộn. Không tự phát, tải hàng loạt lịch sử hoặc suy quyền từ cache.

## Nguồn và mốc

- MP3 public hiện hành: `term-test-1-128kbps-9af027eaaf402acc.mp3`, SHA-256 `9af027eaaf402acc230fdaeff11bcc1b792b62e55d75067f1a2bcf2392b485f8`, 27.757.131 byte. Không thay audio lượt thi hoặc đường IZTT1 cũ.
- Bundle gốc riêng tư: SHA-256 `1be53ed60e04a8292d083468c54a527b1b17a78e43153ab5f0375077b1785927`; content gốc SHA-256 `8dd418c4c43835c577cb5faec7153cd3e84c4d92f4f1e42bd687fa08f3b8fd03`. Version đề/key giữ nguyên.
- Nhận dạng cục bộ đúng MP3, word timestamps job `9c23dc5704e74d40bd895e25`. Đối chiếu 72 trích dẫn khác nhau, 161 lần gắn theo câu/block; 54 khoảng phát riêng, dài 4,5–31,6 giây. Rà các khác biệt chữ/số/tên và chỗ ngắt người nói, nhất là hai bằng chứng rời ở Q23–24.
- Mốc được đối chiếu bằng nhận dạng và chữ nguồn, **chưa nghe thủ công trọn từng clip**. Không đánh dấu transcript đã được người dùng duyệt. Không thay chữ/key để khớp kết quả nhận dạng.

Backend hiện hành đã kiểm hash/catalog/mốc cho Term 1 và đọc bundle mỗi lần yêu cầu. Chỉ thay nguyên tử `explanations.json` riêng của Term 1 sau kiểm tra bản gốc; không build/restart container hoặc sửa module, content, DB, điểm, lượt, timer, Writing, đăng nhập hay quyền lớp. Công cụ bổ sung mốc nằm trong repo backend; dữ liệu thật, bản sao và audit giữ riêng ngoài Git.

Frontend mở Term 1 trong allowlist replay, giữ nguồn file chặt theo slug/hash. Bản bảng đáp án thêm player và `media-src 'self' blob:` như bản CBT để phát Blob đã kiểm. Module config/transport, hai native loader và renderer dùng pin `20261026-term1-replay1`; HTML phụ thuộc đổi pin cùng nhau để không trộn cache. Không đổi CSS hoặc giao diện.

## Kiểm chứng

- RED/GREEN: Term 1 chưa có bộ nối nghe lại trên nền; thêm ca Chrome mới. Ca media policy dùng CSP thật của bản bảng đáp án thất bại trước khi cho Blob, đạt sau sửa.
- 90 ca unit/hợp đồng frontend: cache, hash/hủy, nguồn chính/dự phòng, Worker 512 KiB, public/IZTT1, journal và cache graph bài cũ.
- 18 ca Chrome replay (17 ca tổng hợp và một ca CSP bổ sung): ba Test × HV/GV, chưa nộp, bundle Term 1 cũ chỉ có chữ, Mini giữ tải lười, từ chối/thử lại, sai hash, đổi câu/hủy/reset, tab ẩn thật không tự phát khi quay lại. MP3/decoder thật; API quyền là fixture. Bằng chứng ghép chỉ dùng ca có cùng runtime; CSP mới chỉ tác động ca đọc CSP của HTML thật.
- Backend: 14 ca builder kiểm nguyên vẹn nguồn và chặn map cũ/sai câu/block/hash/mốc; 4 ca SQL/HTTP fixture qua middleware quyền HV/GV, gồm replay Term 1, thiếu quyền/sai người/lượt chưa hoàn thành và không ghi điểm. Validator canonical khớp byte chữ với module đang chạy; candidate thật qua cùng validator, trả đủ 40 replay và giữ nguyên cả 80 lời giải khi bỏ trường replay.
- Bản thử entry/HTML/JS thật với bundle riêng tư và API/identity giả: mở 80 câu HV bảng đáp án và 80 câu GV, phát/seek/tự dừng đủ 54 khoảng mỗi vai trò; CBT nghe trước/đọc trước kiểm 14 câu và 17 khoảng mỗi thứ tự. Đối chiếu toàn bộ paragraph nguồn của popup; ảnh desktop và 390 px, không lỗi JS/CSP hoặc mạng ngoài fixture.

Phép đo click → `playing` Chrome local sau chuẩn bị, trong lượt kiểm tổng hợp: Term 1/HV 253 ms, GV 10,8 ms; p95 trong 10 click lần lượt 253/102 ms. Không phải đo tiếng từ loa hoặc cam kết tốc độ thiết bị/mạng thật. Ca native loader xác nhận nghe lại không tăng số request MP3 sau lúc tải bài.

Chưa kiểm iPhone/Safari vật lý, Google GV thật xuyên sản phẩm, bài học viên mới hoặc Portal/AI/Docs. Không tạo/nộp/chấm bài thật để thử tính năng này. Sự cố harness cũ chặn nhầm thư mục JS `/shared/audio/` và lối vào demo CBT đã sửa trong fixture; không sửa app để vượt nhận diện.

## Phát hành và quay lui

Phát frontend tương thích trước, xác nhận Pages build và đọc lại runtime/HTML qua HTTPS; sau đó mới đổi bundle riêng tư Term 1. Kiểm hash/mode/owner tệp, giữ bản cũ và runtime không đổi, đối chiếu dữ liệu thi và đọc lại API có quyền. SHA/PR và kết quả phát thực tế nằm trong biên nhận task; tài liệu này không tự xác nhận đã chuyển production.

Quay lui đúng bundle đã sao lưu và commit frontend của gói, không đè thay đổi task khác. Không restore DB, reset/chấm lại hoặc đổi container. Tab đã mở từ trước có thể cần tải lại trang kết quả để nhận bộ nút mới; không xóa bài hoặc lịch sử trình duyệt.

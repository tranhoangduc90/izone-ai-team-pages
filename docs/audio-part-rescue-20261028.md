# Audio: Cloudflare ưu tiên, cứu từng phần và số luồng tự giảm

Term/Mini, Substitute, Listening practice và Listening homework dùng chung bộ tải
`shared/audio/transport.mjs` → `chunks.mjs`. Cloudflare vẫn là nguồn được thử trước.

## Hành vi

- Một phần audio bị lỗi kỹ thuật được thử lại hữu hạn. Nếu hết thời gian chờ
  6 giây, hủy request đó rồi lấy đúng phần còn thiếu từ Pages, không chờ thêm
  một lần timeout. Các phần khác tiếp tục dùng Cloudflare.
- Mỗi lượt bắt đầu với tối đa bốn luồng. Gặp timeout thì giảm còn hai luồng cho
  phần còn lại của lượt đó; các request đang chạy được kết thúc hoặc hủy theo
  chính sách hiện có. Lượt tải mới lại ưu tiên Cloudflare với bốn luồng.
- Một phần hỏng không mở cầu dao nguồn 10 phút. Quota 1027/429 có thể tạm ngừng
  primary; lỗi nhiều phần chỉ ngừng nguồn khi còn việc chưa phân và có lỗi 5xx
  liên tiếp, hoặc không có phần Cloudflare thành công ít nhất 12 giây.
- 401/403 quyền dừng, không chuyển Pages để vượt quyền. Quota 1027 được nhận
  riêng. Abort/đổi người dừng cả các luồng đang chạy; phần đã kiểm đúng được giữ.
- Giữ kiểm hash từng phần/toàn file, AES-GCM, vé/khóa, cache và refresh vé một lần.
  Không sửa Worker/R2, API, catalog, bài thi, timer, owner, nộp bài hoặc điểm.

## Thông báo

`primary-error` chỉ có nghĩa đang gặp lỗi/thử lại nguồn chính. `pages-start`
cho biết bộ tải đã thật sự chọn Pages, kèm chỉ số phần và scope `part`/`source`.
Cloudflare thử lại thành công phải trả thông báo về nguồn đúng. Lượt mới xóa
trạng thái lỗi cũ; cache được hiển thị đúng là audio đã tải và kiểm tra.

Các phase `pages-start` và `transfer-start` phục vụ UI, không đổi schema journal.
Nhật ký byte vẫn dùng các event nhận response `cloudflare`/`pages` hiện có,
không ghi vé/khóa/cookie hoặc coi sự kiện transport là quyền thi.

## Đo và kiểm

Chrome thật, ngữ cảnh cách ly, cùng Term 1 27.757.131 byte/53 phần, RAM rỗng,
giữ 512 KiB và mã hóa; không bắt đầu hoặc nộp bài học viên:

| Điều kiện | Hai luồng | Bốn luồng |
|---|---:|---:|
| Lượt thăm dò khi Cloudflare chậm | 57,8 và 54,6 giây | 58,6 giây, toàn Cloudflare |
| Cặp đo sau khi đường truyền ổn định | 10,1 giây | 7,0 giây |

Cặp đo sau đều dùng 53 phần Cloudflare, không Pages, đủ byte và SHA-256.
Các phép đo chạy tuần tự và chịu biến động mạng; không suy thành cam kết tốc độ
trên mọi thiết bị/mạng. Khi nghẽn đường truyền, tăng số luồng không đảm bảo nhanh hơn.

Ca hồi quy mới chứng minh lỗi trên base: một phần hỏng làm các phần sau bỏ
Cloudflare; timeout bị chờ hai lần; chỉ hai luồng dù yêu cầu bốn; giao diện báo
Pages trước khi đổi nguồn. Cùng ca đã đạt sau sửa, thêm kiểm nhóm timeout,
giảm luồng, quyền/quota, hủy giữa chừng và lượt mới không bị cầu dao oan.

Nhóm kiểm gồm audio/crypto/cache, đồng hồ, Homework, popup replay, cache graph,
nộp/phục hồi và mở kết quả cũ bằng fixture cô lập. Fixture kết quả đã bổ sung
response `/clock` theo contract đang có; không bỏ assertion hay gọi API thật.
Ca background visibility của bộ replay vẫn có giới hạn riêng trong runner.

## Cache và quay lui

Revision `20261028-part-rescue-v1` đi xuyên import/script tới entry thực sự dùng
bộ tải. Các file ngoài ba module lõi chỉ đổi query để tránh ghép module cũ/mới.
Không đổi query `v` đang bảo vệ các bản vá nộp, owner hoặc demo.

Quay lui bằng revert commit của PR này, giữ mọi bài/nháp/điểm mới. Không restore
database, reset học viên hoặc đổi cờ Worker. Tab đã mở dùng module đã nạp cho
đến lần tải lại; không ép refresh bài đang làm.

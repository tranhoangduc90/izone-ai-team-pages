# Nhận diện học viên và tối ưu mở bài — bản chờ duyệt 23/10/2026

**Chưa phát hành production, chưa push/nhập main.** Đức yêu cầu kiểm nhận diện xuyên sản phẩm và tối ưu mở bài; giữ người, nháp, quyền lớp và không nộp/chấm thay học viên. Bản này giữ chuẩn [nhận diện chung](../shared/student-identity.js), không thêm tài khoản Google/mật khẩu hoặc đổi thời hạn phiên.

## Kết quả và phạm vi sửa

- Materials dùng lại danh sách lớp trong riêng một lượt mở, từ 3 → 1 lượt đọc ở lần chọn tên đầu, 2 → 1 khi đã nhớ người. Reload/thử lại vẫn đọc mới; POST đăng nhập và API bài vẫn kiểm quyền phía máy chủ.
- Reading/Listening thực chiến dùng lại kết quả quy đổi vừa nhận trong cùng lượt tự mở từ thư viện, giảm 2 → 1 request quy đổi. Sau khi roster về vẫn kiểm người đã nhớ còn hiện hành và UUID có trong roster; phản hồi đăng nhập vẫn phải đúng người/lớp/binding. Đường CTA cá nhân giữ kiểm chủ link.
- Sửa Materials khi `sessionStorage` bị chặn: trước đây máy chủ cấp phiên thành công nhưng trang dừng vì lỗi ghi bộ nhớ. Nay phiên trong RAM tiếp tục dùng được, báo không giữ được phiên/ghi nhớ. Không nhận là đã lưu bền khi trình duyệt từ chối.
- Không sửa thư viện nhận diện chung, schema, backend, bộ chấm, Term/Mini, Speaking, Writing, Progress Log hoặc cấu hình mở lớp. Không thêm TTL cache quyền hoặc dùng dữ liệu từ nháp để đoán danh tính.

Đầu vào vẫn là người đã chọn/mã ERP đã nhớ và ngữ cảnh bài. Giao diện đối chiếu mã tương ứng, roster và phản hồi phiên của máy chủ; đầu ra là đúng người vào bài hoặc màn chọn/thông báo rõ khi chưa xác minh được. Nguồn lỗi, sai chủ, lớp bị thu hồi hoặc danh tính đổi giữa chừng không được biến thành một lần vào bài thành công.

## File thay đổi

| Nhóm | File và lý do |
|---|---|
| Materials | `reading-skills67/access.js`: bỏ đọc lớp lặp trong lượt mở, giữ phiên RAM khi storage bị chặn. |
| Reading/Listening | `reading-practice/app.js`, `listening-practice/app.js`: bỏ quy đổi người lặp sau roster, giữ đối chiếu revision/người/phiên. |
| Bộ nạp | Hai `index.html` Reading/Listening và hai `index.html` Reading67/Materials: đổi query asset thành `20261023-student-entry`. |
| Kiểm | `tests/materials-student-entry-browser.mjs`: UI thật, fixture riêng và cầu nối xuyên nhóm. `tests/practice-shared-identity-browser.mjs`: bổ sung số lượt đọc, đổi người khi roster đang chờ và phép đo. |
| Hồ sơ | Tài liệu này: phạm vi, bằng chứng, giới hạn và phương án phát hành. |

Tổng gói hiện tại: 7 file chạy trên Pages, 2 file kiểm và 1 tài liệu. Không sửa source trên main hoặc nhập thay đổi từ worktree khác.

## Kiểm xuyên sản phẩm

Các bộ kiểm mở giao diện thật bằng Edge/Chrome, thay API bằng dữ liệu giả và chặn đường ra ngoài. K67 dùng thêm API/SQL thật trên PostgreSQL nhúng với dữ liệu thử trong RAM. Đây là kiểm tự động cách ly, **không phải nghiệm thu học viên thật trên production**.

| Nhóm | Phạm vi và kết quả |
|---|---|
| Materials và cầu nối nhóm | 14/14 ca: lần đầu/đã nhớ, Materials → Reading/Listening/Writing/Speaking/Progress Log, Reading/Writing → Materials, sai chủ, lớp bị từ chối, bài đóng, phản hồi A đến sau B, token hết hạn, nháp A/B qua reload/mobile, lưu lỗi và storage bị chặn. |
| Reading/Listening thực chiến | 36/36: hai vai chọn đầu/nhận người, CTA sai chủ, chưa có trong roster, lớp khác, alias mơ hồ, bộ nhớ legacy, đổi người lúc roster/login đang chờ, tab ghim người cũ và không tự bắt đầu/phát audio. |
| Writing Task 1/2/Lesson13, B–A–X 5/7/9 | 36/36: tự vào, chọn đầu, phiên sai chủ, giữ nháp A khi tab khác đổi B, lỗi lưu chặn đổi và quên người không tự quay A. |
| Speaking | 14/14 trên Lesson4 đại diện runtime: nhận/chọn người đầu, đúng UUID dù tên trùng, sai chủ Docs, lưu lỗi và giữ tab/nháp. Không gọi đây là kiểm mới mọi lesson. |
| Progress Log | 8/8: tự nhận, người/phiếu khớp, tab/nháp, lớp/phiếu đóng, chọn đầu, phản hồi muộn và lưu lỗi. Không gửi checkpoint/nộp hoặc ghi Portal. |
| K56 CBT | 16/16 mỗi Term1, Term2, Mini; có chuỗi Speaking ↔ Term ↔ Substitute cùng trình duyệt, khác mã sản phẩm cùng ERP. Giữ phòng chờ và bước bắt đầu. |
| K56 bài giấy | 8/8 mỗi Term1, Term2, Mini: chọn/nhận người, hủy, tab, thiếu lớp/mơ hồ và bộ nhớ lỗi. |
| Substitute | 5/5 cho mỗi Test1/Test2 K56/K67: nhận người, chọn đầu, A/B hai tab, roster hết quyền, storage lỗi. Audio thử, không nghe đề thật. |
| K67 | 15/15 CBT, 18/18 bài giấy, cả Term1/Term2/Mini và hai thứ tự. API/SQL fixture từ worktree backend `711fa7eddbc61abffdc09b29bdb6169ec1f436b1`; không chứng minh runtime backend production hiện hành đã được kiểm lại. |
| Làm quen K67 | 32/32, giữ bước kiểm thiết bị, chủ nháp và phiên riêng. |
| Bộ nhớ chung và điều phối | 41/41 unit + 3/3 browser hai writer, quên/ghi cạnh tranh và hết thời gian chờ. Helpers chung không đổi. |
| Giảng viên Materials | 23/23 Node/browser assertions, gồm desktop/mobile, phiên chung, quyền, Google/referrer và chỉ xem. Không đổi cơ chế GV 90/365 ngày. |

Không cộng số lần chạy lại/benchmark vào số ca chức năng. Hai cụm ba sản phẩm đã thực sự mở trong cùng context trình duyệt: Materials → Reading/Listening và Speaking ↔ Term ↔ Substitute; cầu nối Materials → Writing/Speaking/Progress Log cùng context nối các nhóm. Không tuyên bố đã kiểm mọi cặp hoặc mọi lesson/bài/lớp.

## Đo trước và sau

Baseline Pages `10d3e572562b2162e4151ce12e4e8cb0198254e5`. Cùng trình duyệt, cùng API/roster giả, mỗi request API thêm 80 ms, 10 mẫu mỗi bản/hành trình, xen kẽ trước/sau; tổng 80 quan sát. Mỗi mẫu dùng context mới; nhánh đã nhớ có sẵn danh tính fixture hợp lệ. Nhánh đầu chọn tên bằng script nên không tính thời gian người đọc/bấm. Không chạy suite browser khác trong lúc đo.

| Hành trình | Lượt đọc mục tiêu trước → sau | Median trước → sau |
|---|---:|---:|
| Materials chọn tên lần đầu | Lớp 3 → 1 | 1.773,5 → 1.429,1 ms |
| Materials đã nhớ người | Lớp 2 → 1 | 1.108,6 → 1.086,7 ms |
| Reading thư viện đã nhớ người | Quy đổi 2 → 1 | 1.288,9 → 1.139,9 ms |
| Listening thư viện đã nhớ người | Quy đổi 2 → 1 | 1.209,7 → 1.123,6 ms |

Số request giảm là kết quả chắc chắn trong các ca này. Chênh thời gian Materials đã nhớ rất nhỏ so với nhiễu; không nhận mọi trường hợp nhanh hơn rõ. Mẫu có dao động: Materials đã nhớ trước tối đa 4.841,5 ms, sau 1.962,6 ms; Materials chọn tay sau có mẫu 2.799,4 ms. Giữ đủ mẫu, không bỏ outlier; không hứa tỷ lệ tăng tốc hoặc sức chịu tải production. Chưa đo mạng học viên/điện thoại thật, tài nguyên lạnh/ấm CDN hoặc số đông đồng thời.

## Bằng chứng và các lần chưa đạt

Kho riêng được Đức duyệt chuyển sang `C:/Codex-Work/student-entry-optimize-20261023/evidence/` vì E từng còn 0 byte. Worktree đang làm là `C:/Codex-Work/student-entry-optimize-20261023/pages`, branch `codex/student-entry-optimize-c-20261023`; bản E giữ nguyên để đối soát. Không xóa dữ liệu để tiếp tục.

- `materials-final/results.json`, `practice-final/results.json`: nghiệm thu cuối. `before-move/existing/` chứa native runner của nhóm không sửa; các kết quả chạy bù K67/atomic và K56 CBT ở thư mục riêng. Không sửa biên nhận trước.
- `materials-red/results.json` trong `before-move/`: baseline đọc lớp 2 thay vì 1. `practice-red/results.json`: baseline quy đổi 2 thay vì 1. `blocked-storage-base-red/`: cùng ca storage chạy trên worktree baseline riêng. Các ca tương ứng GREEN trong kết quả cuối.
- `benchmark-materials/measurement.json`, `benchmark-practice/measurement.json`, `measurement-summary.json`: đầy đủ mẫu và cách tính. `source-fingerprints.json`: hash/UTF-8 của các file sửa trước khi thêm tài liệu này.
- Lượt đầu practice có ca timeout khi chạy đồng thời; chạy riêng ca đó và full suite cuối đạt. Chưa chứng minh nguyên nhân phần cứng, không ghi lỗi này thành đã sửa bằng tối ưu. Giữ log/ảnh thất bại.
- Runner atomic/K67 ban đầu trỏ sai fixture HTTP nên không đạt; đã chạy lại trên server K67 đúng với SQL trong RAM, đạt các nhóm nêu trên. Không đếm lỗi setup thành RED sản phẩm. Fixture mới cho Writing từng thiếu route roster; sửa fixture khớp contract hiện có, không đổi source Writing để test đạt.
- Tạo worktree backend mới trên E thất bại vì hết dung lượng; không sửa backend. Git local E có cảnh báo pack rời khi clone đọc; task không dọn/sửa kho của task khác. Bản C clone độc lập, checkout baseline thành công; diff/định dạng được kiểm trong gói này.

Không có token, cookie, hồ sơ học viên thật, đề/key thật trong các fixture mới. Các API ghi nháp/phiên trong kiểm chỉ là kho thử; không nộp/chấm thay học viên, gọi AI/Docs/Classroom/Portal hoặc đổi quyền/mở lớp thật. Phạm vi này chưa thay nghiệm thu HTTPS với người học thử trên đúng runtime sản phẩm hoặc thiết bị di động vật lý.

## Phương án phát hành để duyệt

1. Chỉ phát hành 3 JS runtime và 4 bộ nạp nêu trên của Pages; kèm 2 test và hồ sơ. Không deploy API, broker, migration, đổi Google, quyền hay cờ mở lớp.
2. Trước nhập Git/phát hành, đối chiếu main/live mới để giữ thay đổi song song; giữ exact source/bộ nạp cũ làm đường lui. Nếu chọn kiểm HTTPS thử riêng trước, chỉ dùng hồ sơ/nháp thử, không mở lớp hoặc làm bài thay học viên thật; cấu hình thử cần duyệt trong đúng phạm vi.
3. Sau khi được duyệt phát hành, đọc lại byte/query public và kiểm nhận diện bằng hồ sơ thử hợp lệ ở các đường vào đã sửa, giữ nguyên cờ mở lớp. Nếu thiếu nguồn thử hợp lệ thì báo giới hạn, không giả kết quả thật.
4. Nếu cần quay lại, hoàn tác đúng JS/bộ nạp của gói này; giữ toàn bộ bộ nhớ ERP, token, bài/nháp/lượt đang có. Không xóa storage, restore database hoặc ép đổi người ở các tab đang làm.

Lượt hiện tại dừng ở bản đã kiểm local để Đức xem kết quả. Chưa có quyền phát hành production cho gói này; không dùng quyền phát hành của gói GV trước để chuyển bản học viên.

# Preset chuẩn giao diện Progress Log · Thủy

**Mã chuẩn:** `progress-log-thuy-v1` · **Hồ sơ áp dụng production:** 1.2, ngày 22/10/2026.

Đây là chuẩn cần đạt, không phải giấy xác nhận bản đang chạy đã đạt. Kế thừa DESIGN, screens, components trong master ngày 20/10 và các lựa chọn trực tiếp Q1–Q8/M01–M10 cùng phản hồi sau đó. Bản public trong repo Pages là bản xuất từ tài liệu này; không sửa hai bản độc lập.

## 1. Nguồn chuẩn và thứ tự ưu tiên

1. Chỉ dẫn mới và lựa chọn đã gửi của Đức trong đúng phạm vi.
2. Demo được sửa và kiểm qua từng bước: [thuy-review](https://tranhoangduc90.github.io/izone-ai-team-pages/progress-log/thuy-review/).
3. Master ngày 20/10 cùng các bản bổ sung ngày 21–22/10; giữ bằng chứng gốc.
4. [Mẫu ban đầu của Thủy](https://izone-progress-log-design-demo.wingsenglish90.chatgpt.site/) cho phần chưa được thay đổi.

Không lấy UI production hiện tại làm baseline để hợp thức hóa sai lệch. Không dùng preset Reading, mẫu Progress Log tháng 9 hoặc editor cũ thay preset này. Khác biệt bắt buộc do quyền/dữ liệu thật phải ghi rõ, giữ phần hình thức không bị ảnh hưởng.

## 2. Token và hình học

| Thành phần | Chuẩn |
|---|---|
| Font | Geologica đã tải thật; fallback Arial/sans-serif. Không thay Inter/Nunito ở phạm vi preset này |
| Màu | Đỏ #DB0829; navy #174266; chữ #263744; nền #F3F4F6; mặt #FFFFFF; viền #E2E7EB; chọn #FFF0F3; hover #EDF4FA; xanh thành công #18734C |
| Chữ phụ | #586477 theo bản demo đã chỉnh tương phản; #647482 là màu gốc, không ghi nhầm hai nguồn |
| H1 | 24/32px, 600 |
| H2 vùng / nội dung | 16/24px, 600 / 14/20px, 400 |
| H2 phần editor | 18/26px, 600 |
| Metadata / form học viên | 12/16px / 16/24px |
| Sidebar desktop | 200px, đệm25px dọc/18px ngang; một logo; chỉ một mục active |
| Header giáo viên | 52px; breadcrumb trái; danh tính giảng viên phải |
| Vùng làm việc | Tối đa1400px, đệm20px dọc/24px ngang, cân trong phần còn lại sau sidebar |
| Nhịp khoảng cách | 4/8/12/16/24/32px; khối liên quan gần nhau, không thêm khoảng trắng trang trí |
| Panel / control / badge | Bo8px / 6px / 5px; nền trắng, viền nhẹ, không đổ bóng mọi khối |
| Bảng | Padding8px dọc/12px ngang; hàng một dòng khoảng40px; tên navy đậm; header nền xám; nhận xét được wrap |
| Control | Desktop32px, editor36px; vùng chạm điện thoại hướng tới44px; không tăng toàn bộ bảng để đạt vùng bấm |

Responsive nguồn đã đo: sidebar170px ở1024,140px ở768; ≤650 chuyển điều hướng lên trên. Dưới760 học viên có hai mục điều hướng ghim dưới và chừa safe-area. Số đo chính xác theo rule cuối và cùng viewport, không lấy rule cũ bị ghi đè. Ở1440 nội dung trái224/phải1416; ở1742 sidebar200, nội dung x295/rộng1352 đã đo lại ngày22/10.

## 3. Khung điều hướng và quản lý lớp

- Sidebar: **Quản lý lớp**, **Quản lý bài tập**, **Cổng học viên ↗**. Chỉ mục hiện tại active. Không để Các lớp và Kho bài tập cùng sáng; không lặp logo ở header.
- Đầu Quản lý lớp: chọn lớp, chọn buổi và tổng số học viên; bên phải **Theo dõi buổi học / Hành trình lớp**. Giữ đúng lớp/buổi khi đổi màn hoặc mở editor.
- Theo dõi buổi: trái tên bài/hạn và các hành động; phải các phần với toggle, số bắt đầu/nộp và thanh tiến độ; dưới là **Tiến độ / Kết quả**.
- Tiến độ: Học viên / từng phần / **một cột Điểm danh**. Trạng thái **Đã nhận bài** ở Progress Log khác **Đã điểm danh** đã đọc lại Portal. Không dùng hai cột Tham gia/Portal; không nói synced chỉ từ outbox complete.
- Kết quả: hai lối vào ngang hàng **Thống kê câu hỏi → / Kết quả từng học viên →**, chỉ tiêu đề, không thêm hai dòng mô tả. Giữ cùng trang, thanh chuyển nhanh ghim khi cuộn, không thêm hai tab con.
- Thống kê: danh sách câu trái, chi tiết phải; đủ đề/phương án/kết quả và mẫu số. Nút xem phân bố/học viên ở phần đầu dễ thấy. Bảng kết quả từng người vẫn là vùng chính, không chôn mà không có lối vào.
- Có dấu hiệu còn nội dung dưới hoặc cột bên phải; số đang hiển thị/tổng rõ. Thiếu do chưa cuộn khác thiếu dữ liệu.
- Laptop: bài/nhận xét trong panel cạnh danh sách, cân khoảng nửa vùng làm việc, mép trên68px để không bị header52px che, có chuyển người trước/sau; giữ bộ lọc/vị trí/nháp. Không khóa tương tác nền như modal. Mobile theo bố cục nguồn, không áp panel hẹp desktop.
- Popup: X/Esc/bấm ngoài; tiêu đề/X ghim khi thân cuộn; trả focus; không làm mất dữ liệu chưa lưu. Đường bấm con không kích hoạt nhầm cả hàng.

## 4. Hành trình lớp và tổng quan

- Bốn kỹ năng ngang hàng. Listening/Reading: Học viên, TB Progress Log, Mini Test, Term Test1/2; buổi chi tiết ở lịch sử/khung cá nhân. Không thay bảng chính bằng một bảng buổi dài.
- Nhãn **Ưu tiên xem** chỉ L/R, sau ≥3buổi hợp lệ, TB **ba buổi gần nhất <60%**. Đúng60% không gắn; thiếu không tính0; hiện lý do và giữ TB cả khóa riêng. Người cần xem trước, người có dữ liệu tiếp, thiếu cuối khi sắp mặc định.
- Speaking: các nhóm chuẩn hóa đã duyệt bằng mapping có đối chiếu nhãn gốc (bộ dữ liệu đã duyệt từng hiển thị tám nhóm; không cố định số nhóm hoặc bỏ nhãn ngoài mapping); số lần chọn, số học viên và số phiếu tách rõ; biểu đồ và nhận xét có mục đích riêng; **Cách thống kê** mở khi cần. Không nhận là AI chẩn đoán.
- Writing: ba đợt Test cạnh nhau; điểm và trích1–2dòng gốc mỗi Task, Đọc đủ mở đúng người/Test; không AI viết lại. Có tìm/lọc, sắp từng Test cả thấp→cao và cao→thấp. Không có TB Progress Log giả cho Writing.
- Bấm tên từ Hành trình: tổng quan đủ bốn kỹ năng trước, rồi lịch sử; lịch sử đúng tên/ngày/buổi và có dấu Đang xem. Nhận xét đã công bố không bị ẩn chỉ vì người học chưa nộp.
- Roster hiện tại và học viên lịch sử phải phân biệt. Không đổi17 thành18 mà không giải thích phạm vi.

## 5. Quản lý bài tập

- Đầu trang: **Quản lý bài tập**, bên phải **+ Tạo bài tập**. Màn danh sách không chứa editor cũ bên dưới.
- Trong panel: nguồn có số lượng **Tất cả / Kho IZONE / Phiếu đã dùng / Của tôi**. Kho IZONE là bổ sung thật theo M04; bài từng dùng không mặc nhiên là bài chuẩn.
- Thanh công cụ: **Tìm tên bài tập**, **Tất cả kỹ năng**, tổng số bài; tìm không phân biệt dấu/hoa thường. Không dùng select toàn chiều rộng desktop.
- Bảng: Tên bài tập (tên chính + metadata) / Kỹ năng (badge) / Nguồn. Click toàn hàng và bàn phím mở đề; search/filter không tự mở hay giao bài.
- Xem đề có đủ nội dung, không chỉ đếm số câu. **Sửa bài tập** hoặc **Tạo bản riêng** ở đầu cạnh X, không nút Đóng dư ở cuối. Sửa bài nguồn tạo nháp riêng, không thay bản đã giao.
- Nháp cá nhân lưu máy chủ và bản chụp trong kho phải có nhãn phân biệt; không coi bản nháp là bài chuẩn đã duyệt.
- Trạng thái không tìm thấy, kho rỗng, đang tải và lỗi tải tách riêng; có thử lại. Không biến API lỗi thành0bài.

## 6. Bộ soạn

- Một màn riêng có **← Quản lý bài tập**, Tạo/Sửa bài tập và hành động đầu trang; quay lại giữ tìm/lọc và nháp an toàn.
- Thứ tự: tên/trình độ → Hướng dẫn toàn bài thu gọn → Không chia phần/Chia phần (số/tên phần) → tất cả phần nối tiếp. Không ép mỗi phần chỉ một kỹ năng hoặc dựng tab chuyển phần.
- Trong mỗi phần: tên/số câu, thêm từng loại, AI đúng ngữ cảnh phần; các câu nối tiếp. Kỹ năng mặc định **Chung**. Mỗi câu có **số riêng**, loại, kỹ năng/phần, lên/xuống/Bỏ; không đưa số vào prompt thay cho nhãn.
- Các lựa chọn có marker ở cạnh: trắc nghiệm **radio tròn**, chọn nhiều **checkbox vuông**; Speaking phản hồi chỉ các lựa chọn, không đánh dấu key hoặc Xem đáp án. Không bắt nhập JSON/mã phương án cho ca phổ thông.
- Điền từ nhận nhiều đáp án hợp lệ, một dòng một đáp án. Câu mở có gợi ý do giảng viên nhập; chỉ hiện nút Xem gợi ý khi có nội dung.
- Nối cặp soạn hai vế theo từng hàng, thêm/bỏ cặp; xem trước chọn/đổi được. Tự báo có tổng rõ, trống khác0, báo lỗi ngoài miền.
- Theo yêu cầu Đức ngày22/10, đã gỡ Gạch chân từ khóa khỏi danh mục tạo mới, nhập CSV/văn bản và nhập AI. Chỉ giữ khả năng đọc dữ liệu lịch sử; không xóa bài làm cũ hoặc cho tạo/copy lại dạng đã gỡ.
- Đổi thứ tự/chuyển phần giữ ID/nội dung/đáp án/gợi ý. Chỉ bỏ phần trống; phần có câu phải chuyển câu trước. Không âm thầm xóa cả phần.
- Lưu nháp phải qua tải lại/đóng tab; đang lưu/đã lưu/lưu lỗi rõ, giữ chữ khi lỗi và có Thử lưu lại. Không báo Đã lưu chỉ vì dữ liệu trong RAM. Bản chưa gửi thành công phải nói rõ giới hạn.
- Xem trước dùng renderer học viên thật, có hướng dẫn một lần và lời giải theo quyền. Không phát bài thật để lấy preview.
- Duyệt/phát thật theo revision/hash/quyền hiện hành; nháp AI không tự được duyệt. Chỗ cần thêm xác nhận thật so với demo được ghi rõ và đặt đúng ngữ cảnh, không trải toàn bộ form vận hành lên thư viện.

## 7. Học viên, số câu và kết quả

- Hai mục **Buổi học / Kết quả học tập**; chào đúng tên, lớp/buổi/tên bài và Đổi người học bảo toàn nháp. Học viên ưu tiên điện thoại.
- Một card các phần nối tiếp; trước Bắt đầu chỉ tên/trạng thái và CTA toàn chiều rộng. Sau Bắt đầu mở câu tại chỗ; nộp xong đọc lại kết quả trong phần, mở/thu được.
- Số câu là một trường giao diện, tách khỏi prompt. Nếu nguồn đã có prefix CâuN thì không lặp CâuN hai lần.
- Một câu gồm nhiều mục con: tiêu đề CâuN một lần; Câu hỏi và A/B/C bên trong, không hiển thị bốn câu độc lập. Việc nhóm không đổi itemVersionId, thứ tự từ, ID từ trùng nhau, payload hoặc câu trả lời đã lưu.
- Sentence completion giữ nguyên câu và ô nằm trong câu. Bảng Scanning/Skimming giữ cấu trúc bảng, số/câu theo nguồn, không hardcode số2 cho mọi phiếu.
- Chữa bài gọn: trả lời, đúng/sai, đáp án/lời giải khi được phép; toàn bộ lựa chọn mở khi cần. Không chấm đúng/sai cho tự báo/phản hồi; thiếu kết quả nguồn không gọi là chấm sai.
- Nhóm điền nhiều ô có đáp án được duyệt: tự chấm riêng từng vị trí, mỗi ô một điểm; sai hoặc bỏ trống nhận 0 và giữ đủ mẫu số. Chữa bài/lịch sử hiện nhãn, câu trả lời và đúng/sai từng ô; đáp án chỉ hiện theo quyền. Không chấm cả nhóm theo kiểu đúng hết mới có điểm.
- Kết quả học tập: bốn thẻ kỹ năng trước, lịch sử sau; Writing gọn và mở đủ Test, Speaking có lối xem nhận xét; lịch sử có ngày/tên/tóm tắt và Đang xem.

## 8. Nghiệp vụ giữ qua mọi lần sửa giao diện

- Nộp phần đầu thành công, kể cả trắng, ghi nhận tham gia và yêu cầu Portal; mở/nháp không điểm danh. Cho nộp thiếu, không phục hồi chặn required.
- Các phần mở độc lập; nộp hết tự hoàn tất, không Nộp toàn bộ phiếu. Đã nộp chỉ đọc. Lỗi hoàn tất giữ những phần đã nhận và có thử lại.
- Thu hồi giữ nháp/bài nộp/kết quả cũ, chỉ giáo viên xem lịch sử; học viên thấy bài hiện hành/thông báo. Không xóa dữ liệu để giống nguồn ban đầu.
- Hạn22:00 ngày người thứ ba nộp đủ **nội dung**, không phải người thứ ba nộp phần đầu. Chưa đạt ngưỡng chưa chốt hạn tự động. Gia hạn có thời điểm/lý do/quyền và lịch sử; không mở sửa phần đã nộp.
- Nhận xét Speaking: tự giữ nháp riêng tại trình duyệt; bấm Lưu và hiển thị cho học viên mới công bố. Sửa chưa công bố giữ bản cũ trước học viên; nhãn Nháp trên thiết bị này. Không hứa nháp giảng viên đồng bộ máy khác.
- AI chỉ chuyển câu có sẵn thành cấu trúc để giảng viên xem/sửa/chấp nhận. Không soạn câu mới từ chủ đề, đoán key, chọn đáp án đầu mặc định, tự đưa vào kho chuẩn hoặc giao lớp. Nội dung chưa nhận dạng được giữ để đối chiếu.

## 9. Nội dung thật và ngoại lệ đã xác nhận

- Mini Test có nguồn thật; Term chưa có kết quả thì để thiếu. Giữ mẫu số L/10,R/13 của Mini nguồn, không quy về phần trăm giả hoặc trộn vào TB luyện tập.
- Kho IZONE cần đợt đầu nhưng người phụ trách chưa chuẩn bị bộ chuẩn. Kho có chức năng và kho đã đủ nội dung là hai trạng thái khác nhau.
- Buổi4 giữ tên/kỹ năng nguồn, thêm giải thích Ôn Listening; bài mới Reading và Speaking. Không tự chuyển số Reading sang Listening.
- Nhận xét nguồn cũ vô nghĩa đã được chỉ định cần xác minh: ẩn học viên, giữ giảng viên đối chiếu; không tự gán tác giả.
- Dữ liệu giả chỉ ở demo có nhãn/bật tắt. Production không tự bịa điểm/nhận xét/học viên/đáp án để lấp layout. Nguồn trực tiếp lỗi mà dùng snapshot phải hiện thời điểm và cảnh báo.

## 10. Kiểm chuẩn trước và sau phát hành

1. Đi hết S01–S11 và mỗi biến thể được thay đổi; lập hàng đối chiếu yêu cầu → màn/component → kết quả → bằng chứng. Không dùng một màn đại diện cho mọi màn.
2. So demo và build cùng viewport/DPR/font/theme/state; desktop1440 hoặc1742, điện thoại390; đo quanh breakpoint có ảnh hưởng. Chênh lệch dữ liệu thật phải chú thích. Dung sai cạnh chính đề xuất2CSSpx khi điều kiện giống nhau; không gọi phần trăm pixel là phần trăm hoàn thiện.
3. Kiểm riêng nội dung/thứ tự, hành vi/identity/quyền và hình thức. Có lỗi người dùng gặp phải có ca hồi quy đỏ trên bản lỗi, xanh trên bản sửa.
4. Chụp và nhìn ảnh thật của từng màn, gồm lỗi/thiếu/dữ liệu dài. Không chỉ kiểm source, màu hoặc số test. Giữ ảnh trước/mẫu/sau, không cập nhật baseline theo ảnh lỗi cho test xanh.
5. Trên Pages đã lên: đọc lại asset, mở đúng route qua lớp/buổi thật ở chế độ chỉ đọc; bài làm thử ở môi trường riêng. Kiểm trước/sau không thay dữ liệu thật vì QA.
6. Báo độc lập: khớp preset, chức năng đã kiểm, dữ liệu thật/thiếu, Git/Pages/API và Portal. Còn lệch thì nói rõ; không tuyên bố tuyệt đối hoặc hoàn tất toàn sản phẩm từ245/90test hay tool success.

**Phạm vi:** chuẩn riêng Progress Log dùng lại cho các lớp/buổi. Không giới hạn sản phẩm ở IC2305, hai phần, bảy item hoặc một bộ câu. Không sửa DECISIONS.md và không thay quy tắc của sản phẩm khác.

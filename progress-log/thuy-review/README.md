# Progress Log theo preset Thủy

Bản demo HTML/CSS/JavaScript thuần theo master 1.3 ngày 20/10/2026 của [Thủy](https://izone-progress-log-design-demo.wingsenglish90.chatgpt.site/), kèm các lựa chọn Q1–Q8 Đức đã chốt. Đây là demo độc lập; không sửa ứng dụng, bài làm hoặc điểm danh đang chạy.

## Mở trên GitHub Pages

Mở route `progress-log/thuy-review/`: trang tự tải `demo-data.json`, không cần chọn file. Đức đã cho phép công bố gói dữ liệu demo IC2305 ngày 20/10/2026. Gói gồm dữ liệu học viên, bài làm và đáp án phục vụ bản demo; không chứa credential hoặc token phiếu production. Khi tải thất bại, trang hiển thị lỗi và nút **Thử tải lại**.

Các tab trong cùng trình duyệt dùng BroadcastChannel để chia sẻ bản chụp và thao tác thử. Đóng tab cuối sẽ bỏ phiên thử. Bản chụp gốc không đổi. Bài do người xem soạn nằm trong phiên tab giảng viên; không hứa lưu bền vững hoặc đồng bộ nhiều thiết bị.

## Dữ liệu thật đã tìm được

Bản chụp chỉ đọc lúc **18:54 ngày 20/10/2026**, giờ Việt Nam. Theo dõi buổi dùng ba buổi gần nhất:

| Buổi | Ngày | Roster nguồn | Đã nộp cuối | Câu trong phiếu |
|---|---|---:|---:|---:|
| 10 | 19/10/2026 | 17 | 14 | 10 |
| 9 | 15/10/2026 | 17 | 15 | 9 |
| 8 | 12/10/2026 | 18 | 2 | 11 |

Hành trình bổ sung các phiếu buổi **2, 3, 4, 5, 6**; tổng cộng tám phiếu hiện có, hợp danh sách 18 học viên theo studentRef. Không nối người theo tên. Kế hoạch nguồn có 31 buổi; chưa có phiếu buổi 1 và 7 trong nguồn đang đọc. Không coi buổi chưa có phiếu là vắng hoặc 0 điểm.

Listening có số tự báo ở buổi 3 và 10; Reading ở buổi 4 và 8. Chưa đủ ba buổi cùng kỹ năng để có nhãn ưu tiên thật. Theo yêu cầu ngày 21/10, bảng Listening/Reading mặc định thêm **bảy học viên giả**, từng dòng có nhãn riêng, để thử lọc/sắp xếp/mở chi tiết như bảng thật. Có thể bỏ chọn **Hiện 7 học viên giả** để chỉ còn 18 người thật. Các tình huống: dưới ngưỡng, mới giảm, đã tiến bộ, đúng 60%, chưa đủ ba buổi, có 0% hợp lệ, chưa có dữ liệu. Ba người giả có nhãn ưu tiên; không gán kết quả giả cho tên thật, không sửa gói nguồn hoặc tạo bài nộp/điểm danh/điểm Test. Bộ số giả giống nhau cho Listening và Reading để đối chiếu. TB từ các phiếu hiện có dùng trọng số bằng nhau theo buổi; nhãn dùng ba buổi hợp lệ gần nhất, ngưỡng chưa làm tròn dưới 60%.

**Bất nhất nguồn:** tên bài buổi 4 có Listening nhưng hai ô tự báo được gắn Reading. Demo giữ mã kỹ năng của nguồn và hiện giải thích; chưa tự sửa dữ liệu.

Yêu cầu bổ sung ngày 21/10: mặc định **Hiện điểm Test giả** để xem đủ giao diện, có thể ẩn để về trạng thái thiếu thật. Mỗi học viên có Mini Test, Term Test 1/2 giả với Listening/Reading và điểm Writing /9, nhận xét Task 1/2 ghi rõ là giả. Cùng người/Test dùng cùng bộ số ở bảng lớp, tổng quan cá nhân và Kết quả học viên. Kết quả thật nếu có được ưu tiên; không sửa `demo-data.json`, API lớp hoặc điểm thi thật. Mô-đun `test-scenarios.mjs` tạo dữ liệu minh họa tại trình duyệt.

Tổng quan cá nhân có đủ ba mục Test trong các thẻ Listening/Reading/Writing; Writing có trích đoạn nguyên văn và Đọc đủ đúng người/Test/Task. Speaking đếm lựa chọn tự phản ánh đã nộp, bỏ câu không áp dụng/câu chấm điểm, lấy nhận xét đã công bố ở buổi mới nhất; không dùng nháp. Có lối xuống lịch sử buổi học. Nhận xét nguồn cũ chưa xác minh người viết được ghi rõ, không gán cho Thủy.

Speaking lớp và cá nhân dùng chung bản đồ quy đổi các đáp án có sẵn trong `model.mjs`, không gọi AI để gom nhóm và không phân loại nhận xét viết tự do. Dấu chấm/khoảng trắng/chữ hoa được chuẩn hóa; các cách viết cùng nghĩa đã biết được gộp. Nhãn chưa biết giữ riêng. “Chưa nhận thấy vấn đề” tách khỏi “Diễn đạt tự tin hơn”; không suy mức tự tin từ lời phủ định. Dữ liệu hiện có: 18/18 học viên, 98 phiếu có lựa chọn Speaking đã nộp cuối, 19 cách viết thành 8 nhóm. Chỉ tính câu áp dụng, không chấm điểm; mỗi học viên/buổi tối đa một lần cho mỗi nhóm. Nháp và phiếu chưa nộp cuối không vào thống kê này, nhưng quy tắc ghi nhận tham gia từ lần nộp phần đầu vẫn giữ nguyên. Biểu đồ có trục số, thứ tự giảm dần, mục Cách thống kê và bảng đối chiếu toàn bộ câu chữ nguồn; không dùng dữ liệu Test/học viên giả.

Writing có bộ lọc **Tất cả/Chưa có dữ liệu**, theo mẫu Thủy: chỉ thiếu toàn bộ khi cả ba Test đều chưa có điểm và nhận xét Task 1/2. Điểm 0 và trường hợp chỉ có nhận xét vẫn là có dữ liệu. Sắp xếp Tên A–Z hoặc điểm giảm dần theo từng Test; Term Test 1 và Term Test 2 có thêm chiều tăng dần (↑) để xem điểm thấp trước. Người thiếu điểm Test được chọn nằm sau người có điểm, người thiếu toàn bộ ở cuối, hòa thì theo tên. Mũi tên chi tiết đi đúng thứ tự và nhóm đang lọc; đổi dữ liệu thử giữ bộ lọc, đóng chi tiết nếu người đó không còn trong nhóm. Có trạng thái nhóm rỗng. Hàng bảng thu gọn: điểm/nhãn giả chung dòng, Task nằm cùng trích đoạn tối đa hai dòng, Đọc đủ bên cạnh; giữ cỡ chữ nhận xét 14px và nội dung nguyên văn. Điều kiện lọc chỉ thay cách xem, không sửa điểm hoặc nhận xét.

Kho Test có định nghĩa Mini Test, Term Test 1/2 nhưng chưa có roster/kết quả của IC2305 tại thời điểm đọc. Không tự gán Test vào buổi, tạo điểm hoặc viết nhận xét thay. Quiz Writing không thay kết quả Writing Test. Bản chấm Test hiện hành dùng band /9; nếu có dữ liệu phải giữ đơn vị nguồn, không tự đổi thành /10.

## Các màn và hành vi

| Vùng | Đã có trong demo |
|---|---|
| Theo dõi buổi | Tên/hạn nguồn, mở phần độc lập, tiến độ từng phần, tham gia và Portal tách biệt |
| Kết quả buổi | Thống kê câu trái/chi tiết phải, đề và lựa chọn đầy đủ, đáp án chuẩn cho GV, phân bố và học viên theo lựa chọn |
| Chi tiết cạnh danh sách | Đúng người/buổi, chuyển nhanh, giữ nháp nhận xét, bài làm và đáp án theo quyền xem |
| Listening/Reading | TB nguồn hiện có, lý do nhãn ba buổi, nhóm/lọc/sắp xếp, ba cột Test có trạng thái thiếu |
| Speaking | Biểu đồ số lần chọn; nhận xét đúng buổi, giữ nhận xét gốc ẩn/hiển thị |
| Writing | Điểm và hai dòng đầu nguyên văn Task 1/2; Đọc đủ đúng người/Test/Task khi có nội dung; nguồn thật hiện chưa có |
| Tổng quan cá nhân | Bốn kỹ năng trước, lịch sử tám phiếu sau, mở bài cũ chỉ đọc |
| Thư viện/editor | Xem ba phiếu thật, tạo bản riêng, soạn mới, chia phần, sáu kiểu câu của mẫu, mặc định Chung, lưu nháp thiếu nội dung, xem trước/xuất bản trong demo |
| Hộp AI | Bố cục gốc, dán văn bản, phân tích tại máy, chọn câu và thêm vào đúng phần; ghi rõ chưa kết nối AI; không tự sinh câu/đáp án |
| Danh tính học viên | Chọn → xác nhận → chào tên; danh tính mô phỏng hoặc bản chụp chỉ đọc, chưa là xác thực ERP |
| Buổi học học viên | Bắt đầu/làm/nộp/xem kết quả ngay trong phần, mở/thu gọn không mất nháp, mở phần độc lập |
| Kết quả học viên | Bốn thẻ kỹ năng, nhận xét được công bố, lịch sử riêng của người đang xem |

Nộp phần đầu thành công, kể cả trống, ghi nhận tham gia trong demo. Nháp chưa tính tham gia. Final thiếu vẫn được nhận; câu chấm còn trống tính 0, câu điều kiện không áp dụng không vào mẫu số. Không tự báo đã ghi Portal.

Góp ý duyệt ngày 21/10/2026: bảng tiến độ giữ một cột **Điểm danh**. **Đã nhận bài** nghĩa là Progress Log đã nhận lần nộp phần đầu; **Đã điểm danh** chỉ hiện khi Portal có xác nhận đọc lại, không có cờ cần kiểm tra. Bấm trạng thái để đọc hai kết quả; chưa nhận bài và cần kiểm tra có nhãn riêng. Khi còn hàng ở dưới màn hình, hiện nút **Còn … học viên phía dưới ↓**; cuộn hết hoặc lọc danh sách ngắn thì tự ẩn.

Nút **Xem phân bố và học viên** ở đầu khung câu hỏi, ngoài vùng nội dung cuộn. Hộp phân bố đóng bằng nút đóng, Escape hoặc bấm nền ngoài; kéo chọn chữ từ trong ra ngoài không làm đóng, và đóng xong trả focus về nơi mở.

Phương án A Đức chọn ngày 21/10: đầu màn Kết quả có hai lối vào **Thống kê câu hỏi** và **Kết quả từng học viên**. Theo góp ý tiếp theo, mỗi lối vào chỉ giữ tiêu đề và mũi tên; bỏ hai dòng số liệu/mô tả để gọn hơn. Cuộn xuống thì thu thành thanh chuyển nhanh ghim phía trên. Hai phần vẫn trên cùng trang; chuyển bằng cuộn, không dựng lại dữ liệu hoặc mất người đang xem/bộ lọc/nháp. Thanh ghim chừa chỗ cho tiêu đề và khung chi tiết.

Nhận xét Speaking tự giữ nháp riêng. Chỉ **Lưu và hiển thị cho học viên** mới công bố; sửa tiếp giữ bản đã công bố cũ. Đổi người học phải giữ nháp thành công trước; lỗi lưu giữ người và nội dung tại chỗ.

Thay bài bằng phiếu khác hoặc bài vừa soạn sẽ thu hồi bản cũ, giữ nháp/bài nộp cho giảng viên, bài mới bắt đầu sạch. Học viên không nhận lịch sử thu hồi; phiên bản cũ bị từ chối. Bài đã thu hồi không được cộng vào TB hiện hành.

## Source và kiểm thử

- `app.js`, `theme.css`, `completion.css`, `index.html`: giao diện và các hành trình. Giữ renderer nội dung dùng chung ở `../answer-review.js`.
- `model.mjs`: tính số tự báo, nhãn, kiểm câu trả lời và chấm mô phỏng từ khóa trong gói demo.
- `journey-scenarios.mjs`: bảy học viên giả chỉ có ở bảng và chi tiết Listening/Reading; dùng cùng hàm tính nhãn với dữ liệu thật, không thêm vào kho dữ liệu hoặc danh sách buổi học.
- `demo-store.mjs`: cùng một bộ nhớ thao tác cho bản local và Pages.
- `pages-adapter.mjs`: tự tải gói công khai, chia sẻ phiên qua các tab và xử lý tải lại khi lỗi; không gọi API production.
- `demo-data.json`: gói IC2305 đã được cho phép công bố, giữ nguyên nội dung gói bàn giao; không phải bản chụp thô từ hệ thống vận hành.
- `editor-bridge.mjs` và `exercise-*`, `library-model.js`, `worksheet-model.js`: editor/CSS từ nguồn Thủy, bỏ dữ liệu gieo sẵn và đường URL chứa payload; giữ điều kiện khi sao chép phiếu thật.
- `fonts.css`, `fonts/`: Geologica tại chỗ, giấy phép SIL Open Font License.
- `server.mjs`: tùy chọn chạy local bằng Node, chỉ nghe 127.0.0.1, đọc file qua biến PROGRESS_DEMO_SNAPSHOT; mặc định cổng 7163. Không dùng server này làm máy chủ công khai.

Kiểm native: `node --test progress-log/thuy-review/model.test.mjs progress-log/thuy-review/server.test.mjs progress-log/thuy-review/completion.test.mjs progress-log/thuy-review/journey-scenarios.test.mjs progress-log/thuy-review/personal-overview.test.mjs progress-log/thuy-review/test-scenarios.test.mjs progress-log/thuy-review/speaking-analytics.test.mjs progress-log/thuy-review/writing-table.test.mjs`. Nhóm server cần PROGRESS_DEMO_SNAPSHOT trỏ tới bản chụp riêng hoặc gói demo; thiếu biến sẽ skip, không tính là đã kiểm.

Bằng chứng browser và dữ liệu thật ở kho riêng ngoài Git. Dữ liệu Test giả để duyệt giao diện nằm trong mô-đun riêng; không nằm trong gói dữ liệu IC2305 gốc. Không coi demo là nghiệm thu xác thực ERP, AI thật, lưu bền vững, Portal hoặc production backend.

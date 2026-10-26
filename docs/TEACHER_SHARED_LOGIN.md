# Đăng nhập giảng viên dùng chung — chuẩn bắt buộc IZONE

Yêu cầu trực tiếp của Đức ngày 23/10/2026: mọi sản phẩm IZONE mới hoặc được sửa có giảng viên đăng nhập phải kế thừa phiên chung. Giảng viên đăng nhập Google một lần trên trình duyệt cá nhân, mở sản phẩm khác hoặc link bài học viên thì vào thẳng phần có quyền. Không xây thêm hệ đăng nhập riêng theo từng bài.

## Hành vi phải giữ

- Phiên máy chủ được ghi nhớ **90 ngày không hoạt động**, trần tuyệt đối **365 ngày**. Nơi hỗ trợ không ghi nhớ tiếp tục giữ lựa chọn đó; thiết bị cá nhân là mặc định, không ép chọn lại tài khoản ở mỗi sản phẩm.
- Dùng lại phiên trên cùng trình duyệt và vùng lưu trữ. Máy tính, điện thoại, trình duyệt khác hoặc chế độ riêng tư không tự chia sẻ phiên. Trình duyệt chặn cookie có thể cần đăng nhập lại; không hứa mọi thiết bị luôn giữ đủ 90 ngày.
- Phiên chung xác minh người đăng nhập. Mỗi sản phẩm **vẫn kiểm tài khoản, vai trò, lớp, bài và thao tác** bằng nguồn quyền hiện hành. Có phiên không đồng nghĩa có quyền tất cả sản phẩm/lớp.
- Link bài cụ thể giữ nguyên bài/lớp/người sau khôi phục; không bắt đi qua danh sách giảng viên để chọn lại. Chỉ đọc nháp/lịch sử đúng chủ; không tạo lượt làm, nộp, chấm hoặc mở lớp từ đăng nhập.
- Đăng xuất thu hồi phiên chung và các phiên sản phẩm đã liên kết. Thu hồi quyền hoặc đổi Google subject phải bị phát hiện; không rơi về bearer/cookie cũ để vượt đăng xuất.
- Lỗi mạng/dịch vụ xác thực phải báo chưa xác minh được. Không biến lỗi thành đăng nhập thành công, lớp rỗng hoặc xóa nháp; không tự phát lại thao tác ghi/nộp/chấm.

## Cách kế thừa

Frontend dùng [thư viện phiên chung](../shared/teacher-single-sign-on.js) trước lần gọi xác thực đầu tiên. Dashboard dùng [client phiên máy chủ](../shared/teacher-session-client.js) khi phù hợp; trang có API riêng gọi `IzoneTeacherSso.restore/login/logout` qua bộ nối được hỗ trợ. Google credential chỉ đi tới máy chủ xác minh, không lưu trong browser storage hoặc URL. Cookie `izone_teacher_shared` có HttpOnly, Secure, SameSite=None, Partitioned; JavaScript không đọc token.

Đăng ký sản phẩm tại broker và đúng đường API trong thư viện; **đăng ký frontend đơn thuần chưa đủ**. Hai kiểu nối hiện hành:

| Kiểu | Dùng khi | Trách nhiệm riêng |
|---|---|---|
| Phiên gốc | Reading, Listening, Materials, Writing, Mapping, Term, K56 | Broker phát phiên qua adapter bảng phiên riêng; role database chỉ có quyền tối thiểu lên bảng phiên/cột tài khoản cần thiết |
| Danh tính nội bộ | Handout B–A–X, Substitute | Consumer gọi `/internal/identity/<product>` bằng khóa riêng phía máy chủ; tiếp tục kiểm registry/grant gốc; đủ cặp URL/key mới bật |

Broker production: `https://ducizone.ddns.net/teacher-session-api/v1`; các đường `restore/<product>`, `source/<product>`, `login/<product>` và `logout` chỉ dùng đúng kiểu adapter. Request có cookie, origin được phép và `X-Izone-Csrf: 1`. Đường `/teacher-session-api/internal/` bị chặn ngoài Internet; không đưa khóa consumer lên Pages.

Nguồn đang đăng ký: `reading`, `listening`, `writing`, `mapping`, `term67`, `materials`, `k56`, `k56demo`, `handout67`, `substitute`, `shops`. Progress Log/Speaking dùng nguồn Mapping; cổng Writing gốc/Task 1 dùng nguồn Writing; SW chuyên sâu/đề Shops dùng native `shops` ở `/shops-writing-api/api/v1/auth/session`. Sản phẩm mới dùng mã nguồn riêng theo chức năng, không mượn danh tính sản phẩm khác chỉ để qua kiểm.

**Kiểm đúng origin thực tế, gồm cả cổng:** Term 67 hiện gọi `https://ducizone.ddns.net:18869/term-mini-k67-api`; thư viện nhận riêng origin này cho `term67`, còn broker/cầu nối dùng HTTPS 443. Không nới wildcard mọi port/host. Đây là nguyên nhân lỗi mở Term vẫn hỏi đăng nhập đã được khóa bằng test hồi quy ngày 23/10.

Source broker/adapter và bộ kiểm nằm trong [backend teacher-sso](https://github.com/tranhoangduc90/izone-writing-task1-practice/tree/main/backend/src/teacher-sso). Handout/Substitute đang dùng [module phát hành ghim theo image](https://github.com/tranhoangduc90/izone-writing-task1-practice/tree/main/backend/ops/teacher-sso/release-20261023); không rebuild toàn main lịch sử làm mất sửa nghiệp vụ live. Mỗi sản phẩm vẫn có runtime/dữ liệu/phát hành riêng.

## Khởi động nhanh và trạng thái đăng nhập — 26/10/2026

Trang vào **riêng cho giảng viên** có thể khai báo `data-izone-teacher-product` trên script phiên chung. Thư viện bắt đầu khôi phục ngay trong lúc tải giao diện. Trang học viên hoặc trang chưa xác định vai trò không khai báo thuộc tính này. K56 giữ điều phối ý định đăng xuất hiện hành trước khi khôi phục, không khởi động sớm vượt qua điều phối đó.

Kết quả thành công dùng chung trong bộ nhớ của cùng trang/sản phẩm/thế hệ đăng nhập; lời gọi trực tiếp và lần đọc API đầu không khôi phục lặp. Đổi tài khoản/đăng xuất ở tab khác vô hiệu hóa kết quả cũ; GET bị 401 có thể khôi phục mới và thử lại một lần. Không tự phát lại thao tác ghi. Kết quả âm/lỗi của lần khởi động sớm chỉ được tiêu thụ một lần, không chặn lần thử hoặc đăng nhập mới sau đó.

Term K67 và Progress Log dùng `sharedProduct` của client phiên để bỏ GET phiên trung gian, vì API tải lớp tiếp theo vẫn chạy cùng middleware xác thực và kiểm quyền gốc. Chỉ áp dụng tùy chọn này sau khi đối chiếu API kế tiếp; không thay việc kiểm quyền bằng cờ lưu trong trình duyệt hoặc bỏ dữ liệu trả về của API phiên ở consumer còn dùng nó.

Giao diện mặc định hiển thị **Đang khôi phục đăng nhập của bạn…**, ẩn form/checkbox từ HTML đầu tiên. Chỉ hiện Google khi chưa có/hết phiên và đã đọc lựa chọn ghi nhớ. Phân biệt thiếu quyền (403), lỗi dịch vụ và chưa có phiên (401); lỗi dịch vụ có thử lại, không trở thành đăng nhập thành công hoặc vòng tự đăng nhập. Kế thừa giao diện hiện hành từng sản phẩm. Entry/module đổi phải cập nhật query phiên bản xuyên chuỗi import/loader để tránh trình duyệt trộn HTML mới với JavaScript cũ.

Kiểm hồi quy: `tests/teacher-sso-core.test.mjs`, `tests/term-test-teacher-session.mjs`, `tests/teacher-startup-browser.mjs`, bộ K56 navigation và browser cookie/consumer hiện có. Runner startup dùng HTML/JS thật, chặn toàn bộ API/Google bằng fixture; đo tới lúc có dữ liệu dùng được, ghi riêng số khung hình form xuất hiện và số lượt khôi phục. Số đo fixture không thay số đo thời gian production.

Phạm vi từng sản phẩm/entry và các ngoại lệ vận hành: [bảng phủ khởi động hiện hành](TEACHER_LOGIN_STARTUP_COVERAGE.md). Hai consumer Shops/SW dùng cùng runtime đã tối ưu, giữ nguồn quyền native riêng.

## Kiểm khi tạo hoặc sửa sản phẩm có giảng viên

1. Một lần Google thật ở sản phẩm A → mở URL thật của B, link bài cụ thể, tải lại và tab mới; không có bước Google lần hai khi phiên còn hợp lệ. Kiểm origin/path/cookie thực tế, không chỉ URL giả trong fixture.
2. Đúng tài khoản nhưng thiếu quyền, bị khóa/gỡ quyền, khác Google subject, sai lớp/bài đều bị từ chối. Không tự cấp thêm quyền để ca kiểm xanh.
3. Đăng xuất từ một sản phẩm → sản phẩm khác không khôi phục phiên đã thu hồi; kiểm race/kết quả muộn và phiên cũ còn ở tab khác.
4. Kiểm hạn 90/365 ngày bằng đồng hồ giả lập và metadata máy chủ; đây không phải quan sát sử dụng suốt 90 ngày. Kiểm không ghi nhớ nếu sản phẩm có lựa chọn.
5. Lỗi broker/consumer, CSRF/origin sai, giả Google token, truy cập internal công khai phải bị chặn. API ghi và nháp/học viên không bị thư viện đăng nhập can thiệp.
6. Kiểm màn máy tính/điện thoại; ghi rõ giả lập viewport hay thiết bị vật lý. Dùng lại bằng chứng còn giá trị, chạy phần bị tác động; không gọi mọi nghiệp vụ AI/Docs/Portal đã kiểm lại chỉ vì phiên đạt.

Các bộ kiểm sẵn có: `tests/teacher-sso-core.test.mjs`, `tests/teacher-sso-products-browser.mjs`, `tests/k56-teacher-session-navigation-browser.mjs` và bốn nhóm `backend/test/teacher-sso*.test.js` ở repo Writing. Runner browser cần cấu hình backend/Handout fixture riêng; không trỏ bài giả sang production.

## Vận hành và quay lui

- So source/config/image live với main trước build. Giữ sửa của task khác, cấu hình điểm danh Progress Log và runtime Test; nối phiên không yêu cầu rebuild các runtime đó.
- Sao lưu riêng cấu hình và dữ liệu trước chuyển, đọc lại source/quyền/bài/điểm sau chuyển. Substitute có thể mã hóa lại `scope_cipher` khi khởi động: so cả nội dung quyền đã giải mã, không chỉ hash ciphertext.
- Docker network dùng subnet tự cấp có thể từ chối gán IP thủ công dù inspect hiện subnet. Giữ hostname/alias/host port; nếu IP đổi thì đối chiếu và đổi đúng upstream phụ thuộc. Kiểm health sau thời gian khởi động, không suy một lỗi tức thì thành lỗi ứng dụng.
- Quay code/cấu hình consumer trước và giữ broker tương thích các nguồn mới. **Không restore đè database phiên cũ** làm sống lại phiên đã đăng xuất; không restore bài/điểm để quay code.

Đây là yêu cầu hành vi sản phẩm và chất lượng, không tạo cổng manifest/checker hay quyền Git/production mới. Sản phẩm có cơ chế cũ ngoài danh sách không tự được coi đã chuyển; chỉ chuyển khi task cho phép và đã kiểm tương ứng.

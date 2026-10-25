# Reading 67 — prototype luyện nén

## Trạng thái giao diện master #170

Trong bài Materials, **Xem phần cần sửa** mở thanh **Trước / Tiếp**, số thứ tự
và tên phần đang xem. Thanh đi qua các ô chưa đạt theo đúng bản chấm đang mở;
chế độ sửa dùng bản chấm gần nhất trong cùng lượt. Nhập lại chỉ đánh dấu chờ
chấm, không tự xóa ô khỏi danh sách. Bản chấm mới tạo danh sách mới; bài đạt
toàn bộ không hiện thanh này. Điều hướng và đổi cách xem GV/HV không ghi bài.

`repair-workspace.js`/`.css` đặt cụm Trước/Tiếp gọn trong footer, tách khỏi
Nộp lại; giữ điểm bấm khi đổi khung. Rà soát liệt kê phần đã chỉnh/chưa chỉnh
so với bản chấm, không gọi thay đổi nội dung là đã đúng. Nhận xét cũ giữ bên
ô nhập; Đối chiếu mở câu hỏi/đoạn người học đã chọn, không lấy key để chọn nguồn.
Vị trí ô/khung/cuộn và chỗ đọc popup được nhớ riêng theo người, lớp, bài,
version, lượt, bản chấm và vai trò; chỉ lưu metadata trên thiết bị, không lưu
câu trả lời hoặc gọi API. Storage lỗi không chặn sửa bài. `data-target` chỉ
dành cho control trả lời; vùng nguồn dùng `data-repair-context-for` để không
chiếm selector focus/nhập liệu. Renderer cũ không nạp workspace vẫn giữ fallback.

Banner chờ xử lý dùng vai trò `pending`. Trường hợp cần đối chiếu hoặc chưa rõ
kết quả AI dùng `attention`; lỗi đã xác định dùng `error`. Hook DOM chỉ chọn màu
trình bày, giữ nguyên thông báo, nháp, phiên bản bài, hành vi gọi lại và API.

`tests/materials-status-browser.mjs` chạy renderer thật với nội dung và WebClient
giả, kiểm bảy tình huống tại 1440/390/320px. Test nhận module Playwright qua
`PLAYWRIGHT_MODULE`, lưu bằng chứng tại `MATERIALS_STATUS_EVIDENCE_DIR` và trả mã
lỗi nếu vai trò màu, 20 ô hoặc bố cục không đúng. Không gọi AI hoặc dữ liệu thật.

Sự kiện đóng dialog trên master không lấy lại focus khi người dùng đã chọn một
control bên ngoài. `tests/materials-history-async-focus-browser.mjs` kiểm tải lịch
sử có độ trễ tại ba chiều rộng: giữ focus bên ngoài hoặc chuyển tới tiêu đề kết
quả, đồng thời đối chiếu nguyên 20 câu trả lời. Test nhận `PLAYWRIGHT_MODULE`, lưu
JSON vào `MATERIALS_ASYNC_EVIDENCE_DIR` và trả mã lỗi nếu sai focus hoặc dữ liệu.

## Chặng 3 — bản thử trên Pages

Trang giảng viên dùng chữ 16px cho label, tên người học và link thao tác; tên dài
được xuống dòng. Khi tải danh sách, `data-state` chỉ chọn cách trình bày pending
hoặc error, rồi được bỏ khi có dữ liệu; không đổi request, thông báo hoặc guard
chống phản hồi cũ. `tests/materials-teacher-browser.mjs` kiểm hai entry với tên
thường/dài ở năm viewport, gồm tải, lỗi và thử lại. Test dùng API chỉ đọc giả,
nhận `PLAYWRIGHT_MODULE`, lưu qua `MATERIALS_TEACHER_EVIDENCE_DIR` và trả mã lỗi
nếu typography, trạng thái, identity link hoặc bố cục không đúng.

Khung preview trên điện thoại giữ chiều cao iframe tối thiểu 480px; nút và link
trong hai vỏ preview/demo có vùng bấm tối thiểu 44px. Bộ
`tests/materials-preview-layout-browser.mjs` kiểm 42 tình huống ở bảy viewport,
đổi khung điện thoại/máy tính, query, nguồn iframe và cuộn tới cuối nội dung giả.
Nhận `PLAYWRIGHT_MODULE`, lưu JSON/ảnh qua `MATERIALS_PREVIEW_EVIDENCE_DIR` và trả
mã lỗi khi kiểm bố cục sai. Nội dung iframe giả không chứng nhận API hoặc bài thật.

`demo.html` trình bày sau nộp/chờ/kết quả và mở bản làm để sửa, chấm lại.
Màn chờ minh họa có nhãn riêng; bản kết quả lấy từ API/SQL thử, không nhúng key
hoặc phản hồi trong source Pages. `api-config.js` chọn API HTTPS thử riêng khi
chạy ngoài localhost. Đăng nhập giảng viên ở `teacher.html` dùng Google và quyền
lớp từ nguồn Reading. Runtime công khai dùng học viên giả; không ghi mã người
giả vào bộ nhớ ERP dùng chung. Cách nhận diện bằng roster thật đã có ở profile
local riêng, không công khai danh sách thật trong bản demo.

Nháp/reset/bản gửi và lịch sử giữ riêng trên máy chủ. Lượt có kết quả chỉ xem;
Sửa bài quay về nháp mới. Reset lưu nháp cũ trước khi mở lượt tiếp theo. Tải lại
nối job còn chờ; phản hồi muộn không phủ phần đang sửa. Giảng viên chỉ đọc đúng
lớp, nháp, lịch sử và feedback; tham số `teacher=1` không tự cấp quyền.

Đây là phát hành **bản thử riêng**, chưa mở lớp, đăng ký CTA hoặc ghi Homework.
Không thay API/DB/worker Read 67 hoặc Reading thực chiến đang vận hành.

## Chặng 2 — bản nối máy chủ thử

`?server=1` dùng `web-client.js` để lưu nháp lên API/SQL của Reading/Listening 67,
gửi bản bất biến và đọc phản hồi Read 67 thật. Phần hiển thị vẫn dùng cùng renderer.
Mở qua máy chủ thử ở cổng 8948; `preview.html?server=1` có khung máy tính/390 px.
Không dùng cờ này trên GitHub Pages khi chưa có backend và quyền đăng nhập thật.

Chặng 2 đã có CAS/retry theo mutation ID, lưu dự phòng thiết bị khi mạng lỗi,
lịch sử máy chủ và kết quả gắn đúng bản gửi. Nhận diện vẫn là hai tài khoản giả
chỉ ở localhost; chặng này chưa nối roster/quyền GV/CTA hoặc ghi Homework.
Source máy chủ thuộc module `backend/src/reading-listening67/web-*` trong repo
`izone-writing-task1-practice`. Source browser không chứa đề/key/prompt riêng tư.

Các mô tả dưới đây giữ cho chế độ prototype chặng 1 không có `?server=1`.

Chặng 1 của bài **Materials to take us beyond concrete**: đủ A–H, Q1–4,
16 ô viết và 4 ô chọn đoạn. Giao diện tự do chuyển đoạn/câu, có bản mobile,
Highlight/Note, rà soát, lịch sử cục bộ và phản hồi mô phỏng từng phần.

Đây là prototype cục bộ, chưa phải webapp chấm bài hoặc tuyến Classroom được
phát hành. Bài làm chỉ lưu ở localStorage; danh tính, chờ chấm, nhận xét và màn
giảng viên là dữ liệu minh họa có nhãn. Không dùng nó cho học viên thật.

Mã CTA mới theo tên bài và dạng luyện tập:
`67-reading-materials-beyond-concrete-matching-information-nen-cap-1`.
Mã này chưa đăng ký trên catalog production. Không đổi route/dữ liệu mã lịch sử.

## Nguồn và ranh giới

- Khung/font/CSS và annotation dùng trực tiếp từ `../reading-practice/` trong
  cùng revision. Giữ nguyên toàn bộ file dùng chung; CSS mới thích nghi cho ô nén.
- Các route `/__prototype__/content` và `/__prototype__/review` được máy chủ
  localhost cấp từ kho riêng ngoài Git. Không đưa đề/key/fixture vào repo public.
- Bộ chấm được đọc từ catalog live ngày 22/10/2026; source UI chưa gọi bộ chấm.
- Bản làm tự nhập và bản phản hồi mẫu dùng kho nháp khác nhau trên thiết bị.

## Mở bản xem trên máy Đức

Máy chủ nhận source worktree và dữ liệu riêng của task; trả một trang xem với
nút Máy tính/Điện thoại. Lỗi file hoặc nội dung được trả bằng HTTP thật, không
chuyển sang gọi production.

```powershell
# Chạy localhost; không ghi dữ liệu lên VPS, Google hoặc n8n.
python 'E:/Codex-Data/plans/reading67-materials-webapp-20261022/serve-prototype.py' 8947
```

Mở `http://127.0.0.1:8947/preview`. Chọn trạng thái ở thanh BẢN XEM GIAO DIỆN
để xem bài trống, bài mẫu, chờ chấm, phản hồi hoặc màn vào bài. Khung 390 px
là mô phỏng màn hẹp, chưa phải kiểm bằng điện thoại thật.

## Kiểm chứng của chặng 1

Hồ sơ riêng tại `E:/Codex-Data/plans/reading67-materials-webapp-20261022/`:
`ui-check.json`, `ui-extra.json`, `ANH-XA-20-O.md`, ảnh viewport và báo cáo chặng 1.
Các kiểm này không thay thế chấm AI, quyền đăng nhập, API/SQL hay readback Docs.

Chặng 2 đã nối bản gửi có version vào bộ chấm Read 67, lưu nháp máy chủ và
phản hồi thật trên localhost. Phần tiếp theo là nhận diện/quyền GV, vận hành
runtime được phát hành, rồi CTA chỉ ghi trạng thái/link vào Homework.

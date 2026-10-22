# Reading 67 — prototype luyện nén

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

Chặng sau nối bản gửi có version vào bộ chấm Read 67, lưu nháp máy chủ và
phản hồi thật, nhận diện/quyền GV, rồi CTA chỉ ghi trạng thái/link vào Homework.

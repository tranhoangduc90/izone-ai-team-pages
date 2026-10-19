# Tự nộp Homework Speaking

Phạm vi: toàn bộ trang học viên Lesson 2–9, mọi lớp dùng những bài này. Học viên xác nhận từng hội thoại; khi tất cả phần bắt buộc hiện hành được máy chủ công nhận, trang tự nộp và hiển thị biên nhận. Ngưỡng, bài bổ trợ và quy tắc công nhận của từng bài giữ nguyên.

`auto-submit.js` nhận phiên và điều kiện từ renderer Lesson 2/3/4, gửi `/finish`, quản lý khóa trong tab và giới hạn ba vòng xử lý. Khi mất phản hồi, nó đọc lại trước khi gửi thêm. Lượt tự thử giãn 15 rồi 30 giây và tôn trọng `Retry-After`. Không xác minh được sau giới hạn thì hiện Thử nộp lại; lỗi quyền/điều kiện không được thử tự động.

Trình duyệt chỉ báo thành công khi API trả biên nhận hoặc đọc lại được trạng thái submitted có biên nhận. Đang nộp/đọc lại thì khóa sửa phần bắt buộc và đổi người; thành công mở lại Đổi người học. Phản hồi draft cũ không được làm mất trạng thái đã nộp. Đổi người hủy vòng thử của phiên trước, giữ nháp đúng chủ.

Máy chủ vẫn chịu trách nhiệm kiểm đủ phần và chống trùng giữa các tab. Dịch vụ Speaking độc lập bỏ điều kiện yêu cầu bấm thủ công cho các phần đã được công nhận lại. Các route legacy tiếp tục được chọn theo phiên; không đổi assignment/Doc/lịch sử hoặc tạo lượt mới để mở khóa.

## Kiểm và giới hạn

- `tests/speaking-auto-submit.mjs`: trang thật/API giả, mọi lesson và 390/768/1440px; đủ/thiếu phần, thứ tự xác nhận, mất phản hồi, mất mạng kéo dài, 409/429, thiếu biên nhận, polling, reload, hai tab, đổi người và kết quả draft đến muộn.
- `speaking-completion-feedback.mjs`: công nhận theo lời chatbot không bị đổi; chỉ nộp sau phần cuối.
- `speaking-homework-draft-clear.mjs`: nháp rỗng cũ, xóa chủ động, polling/reload và đổi người. Phải chờ màn chọn người hiện sau thao tác đổi người bất đồng bộ.
- `speaking-shared-identity-browser.mjs`: cấu hình nhận diện ERP thật của trang; dùng `IDENTITY_SPEAKING_LESSON` cho Lesson 2–9.
- `speaking-homework-identity.mjs`: kiểm nhánh bộ nhớ UUID tương thích cũ; chỉ fixture đặt `sharedIdentityEnabled=false`. Không dùng nhánh này làm chứng cứ nhận diện ERP hiện hành.
- `speaking-homework-journey.mjs` và `speaking-homework-lesson2-live.mjs`: API nhận diện được giả đầy đủ; reload theo đúng tự vào bài hiện hành, không bấm lại Mở bài.

Chạy script Node bằng thư viện đã cài ở `PLAYWRIGHT_MODULE`; đặt `SPEAKING_EVIDENCE_DIR` ra kho riêng. Fixture không gửi AI, Docs hoặc Portal thật. Backend có kiểm HTTP đồng thời trên PostgreSQL native, một biên nhận và một tác vụ cho mỗi loại sau nộp. Không dùng kết quả giả lập để tuyên bố Docs/học viên thật đã được nghiệm thu.

## Phát hành và quay lại

HTML → presentation → renderer → helper có cùng phiên bản asset `20261019-auto-submit-v1`; không đổi URL học viên. Backend phát hành riêng một module trên đúng image live và giữ nguyên các source khác, Env, mount, network. API chung không đổi runtime.

Nếu quay lại, khôi phục gói asset cùng phiên bản để trở về nộp thủ công và container/image độc lập đã giữ. Không khôi phục database đè các bài mới nộp; receipt đã tạo vẫn hợp lệ. Git revert không tự chuyển runtime.

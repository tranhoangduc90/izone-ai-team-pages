# Listening thi lại IC2311

Được Đức duyệt 05/11/2026. Dùng nội dung Listening Substitute Test 1 K56; bốn phần, 40 câu, một lượt nghe và năm phút rà. Danh sách năm học viên do API riêng cấp, không chứa trong source public. Backend/source vận hành: `izone-AI-team/services/listening-retake`.

Tải đủ chương trình/đề/sơ đồ, chuẩn bị vé offline, thử bộ nhớ và kiểm trọn file audio trước Sẵn sàng. Pages chính, Cloudinary dự phòng, SHA-256 chung `31c0ccac5841e814e41b0ba31723fbceaafe95c789c8c373ba3c2828a825955d`, 8.643.188 byte. Nghe thử dùng cùng Blob và đo tiến độ thực; sau khi bắt đầu không đổi nguồn theo lỗi mạng.

Audio, thời gian rà và nhập bài chạy cục bộ. Bài đã bấm nộp được khóa và ghi bền trước khi gửi. Mạng/server lỗi giữ bài chờ đồng bộ; chỉ có receipt đúng người/lượt/generation/operation/revision mới báo thành công. Đóng trang thì đồng bộ tiếp khi mở lại cùng thiết bị/trình duyệt; không hứa gửi khi browser đã tắt.

Không import bootstrap/enhancer/controller hoặc demo-reset cũ. Không có Reading/Writing, key trong frontend hoặc tự thay điểm Portal. Mất mốc/gián đoạn nghe không phục hồi an toàn thì dừng để giảng viên hỗ trợ, không phát lại từ 0. Một controller độc quyền player; Web Lock chặn tab thứ hai can thiệp lượt đang chạy.

`teacher-sso.js` là bản ghim của `shared/teacher-single-sign-on.js` tại nền Pages d8ed2edbaa718362ba78b9429a5c23957564d238, thêm đúng source identity `listeningretake` cho entry riêng. Giữ chung cookie/broker/discovery/login/logout và thời hạn 90/365; không đổi asset của consumer cũ. Nâng bản ghim sau này phải đối chiếu contract/bộ kiểm SSO, không chép phiên bản cũ làm mất sửa đã phát.

Log kỹ thuật qua allowlist `log-contract.mjs`: giữ mã lỗi/build có nghĩa, không body/đáp án/token/message tùy ý. Request ID không mang quyền; snapshot player và server ACK là hai mốc riêng. Lỗi export log không được điều khiển player hoặc chặn lưu bài.

Runner cách ly: `tests/listening-retake-browser.mjs`, `tests/listening-retake-full-round.mjs`. Mỗi runner cần cấu hình fixture do backend cung cấp; không trỏ người giả sang API production. Số đo player trong runner không chứng minh âm thanh vật lý; học viên phải nghe thử và xác nhận có tiếng trên thiết bị của mình.

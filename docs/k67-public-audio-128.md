# Audio Pages của Term 1, Term 2 và Mini K67

Ba MP3 có tên chứa hash trong `term-tests/k67-audio-assets/`: Term 1/Mini 128 kbps; Term 2 giữ nguyên gốc 96 kbps (22,12 MB) theo lựa chọn của Đức, tránh tăng lên 29,49 MB khi mã hóa lại 128 kbps. Nội dung công khai theo yêu cầu; không đặt đáp án, đề, token hoặc danh tính tại đây. Không ghi đè file đã có hash.

VPS vẫn xác thực và ghim metadata theo phiên; quyết định bắt đầu, xác nhận phát, giữ bài, phục hồi vị trí và bù giờ. Phòng chờ tải từng phần 1 MiB, kiểm SHA-256 từng phần và toàn file trước nghe thử/Bắt đầu. Tối đa hai yêu cầu cùng lúc, mỗi phần thử hai lần rồi hiện thử lại. Phần đúng giữ tối đa 24 giờ trong IndexedDB; kho lỗi dùng RAM. Tải lại trang vẫn phải xác thực phiên với VPS.

Frontend hiểu cả MP3 và gói mã hóa cũ. Backend chỉ cấp MP3 khi bật `K67_PUBLIC_AUDIO_ENABLED=true` và client báo hỗ trợ; áp dụng cả ba bài, phiên chưa bắt đầu và chưa ghim. Phiên đã ghim giữ đúng bản cũ. Chế độ Listening trước/Reading trước cùng dùng bootstrap và bộ tải đã kiểm; không có bản audio riêng cho hai thứ tự.

Đã kiểm hai bài × hai thứ tự trên Chrome/Edge: tải đứt, reload giữ phần, nghe thử trước mở bài, phát từ Blob, giữ bài/phục hồi và giờ bù, offline sau tải; không có lượt tải file/preview từ VPS ở nhánh MP3. Kiểm thật URL/hash/CDN thực hiện trước bật backend. Chất lượng 128 kbps đã được Đức nghe và chấp thuận.

Quay lui: giữ frontend tương thích và file Pages cho phiên đã ghim. Tắt cờ public chỉ đổi lựa chọn cho phiên mới; bản gốc còn trên VPS. Quay runtime dùng container trước phát hành cùng DB hiện hành, không restore dump cũ. Không xóa MP3 đang được phiên nào ghim.

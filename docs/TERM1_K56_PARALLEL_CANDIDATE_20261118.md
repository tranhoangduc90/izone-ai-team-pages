# Ứng viên Pages Term Test 1 K56 · 18/11/2026

Ứng viên này chưa được ghép với API production bật chế độ Term 1 mới. Giữ rõ giới hạn đó khi bàn giao; các phép thử dưới đây không phải tuyên bố hoàn tất Term 1 K56.

Gói riêng gửi capability Term 1, nhận tiến độ chính thức, đi tới phần còn mở và giữ nội dung cục bộ chưa được nhận để tải ra. Biên nhận đã có không bị thay bằng cờ tiến độ. Giữ kho/namespace/generation và mốc tuyệt đối của lượt cũ. Khi khôi phục online, tải vỏ offline mới ở nền; lỗi nâng cấp giữ vỏ đã xác minh và bài hiện tại. Entry bất biến và đủ 182 tài nguyên được ghim theo byte LF; các tệp gói cũ giữ nguyên.

Phần tải nội dung cục bộ chưa được nhận chỉ xuất trường nội dung/chẩn đoán của thao tác, không mang attempt/session/owner scope gốc sang HTML. Ca RED/GREEN dùng đúng thao tác có scope thật của fixture; giữ nguyên đáp án 32a–32b và Task 2. Đây là sửa riêng phép xuất, không đổi wire receipt hoặc dữ liệu IndexedDB đang lưu.

Bổ sung Báo lỗi âm thanh bằng component lựa chọn hiện hành: khoảng im lặng, Cancel, không nghe thấy, rè và ba loại thiết bị. Chỉ thay khối tương tác báo lỗi trong view Term 1, giữ bốn Part, 41 ô/40 điểm với 32a–32b, Reading 26 câu và Writing Task 2. Nút sau “Loa ngoài” dùng CSS ổn định được phát cùng gói cache Term 2 K56.

Đã kiểm bằng dữ liệu giả, tuần tự một browser:

- Unit của tiến độ, giữ nội dung, receipt của chính lượt và toàn bộ manifest: 4/4. Hai ca hành vi trượt trên wrapper Term 1 đang phục vụ trước sửa.
- Browser mới đi từ Listening đã được nhận sang Reading, F5 offline giữ cùng scope/startedAt/deadlineAt/nháp, nộp Task 2 và đọc lại đúng một receipt sau mất ACK.
- Cache thật cũ từ byte lịch sử hợp lệ, tab Reading đang sống, tải lại qua entry mới và F5 offline giữ bài/thời gian. Bản trước bổ sung nâng cấp shell trượt ở đúng bước worker mới chưa được cài.
- Khoảng im lặng và Cancel không gián đoạn; bốn xác nhận lỗi dừng đúng một lượt và nối cùng reportId/operationId/receipt. Giữ 41 ô và nội dung 32a–32b. Ca loa ngoài có RED trace hover dao động 1 px và GREEN click bình thường sau CSS sửa đúng scope.

Các ca browser trên gồm thao tác media 1× và chủ động đặt mốc để kiểm từng nhánh, không thay nghe đủ thời lượng. API/receipt của các ca trên là giả. Chrome plugin không kết nối được, các ca này dùng Edge cách ly; không thay kiểm đầu ra âm thanh trên thiết bị thật.

Đã bổ sung hai ca `tests/term1-k56-parallel-native-browser.mjs`: browser ghép endpoint admission và giao dịch offline thật của API ứng viên, SQL/roster/đáp án cách ly. Cả hai thứ tự đều đi từ kỹ năng được A nhận sang B tiếp tục kỹ năng còn lại và Task 2; mất ACK được đọc lại, đúng một bài chính thức, một grading run/job. Không chạy AI hoặc ghi Portal. Test helper chỉ chuyển admission sang API native khi fixture bật `native.admission`, giữ các ca giả hiện có.

Ca riêng của kế hoạch GOAL dùng owner/context/collect đang phục vụ, native SQL và kho mã hóa cục bộ để xác nhận bốn metadata lỗi/thiết bị/report/operation được giữ đúng phiên; sai binding bị từ chối. Đây chưa phải canary browser → Collector VPS/cloud. Phần còn thiếu trước bàn giao mục 5: phát API và Pages đúng cờ; nối nguồn cloud native qua giới hạn Agent và đọc lại hai kho theo kế hoạch.

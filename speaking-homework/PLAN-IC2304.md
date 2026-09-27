# Kế hoạch xây dựng webapp nộp Speaking Homework · thí điểm IC2304

Ngày lập: 27/09/2026. Trạng thái: **kế hoạch để rà soát**, chưa triển khai lên học viên. Bản xem trước hiện chỉ đọc ChatGPT Share bằng máy chủ trên máy Đức; chưa có dữ liệu nộp bền, đối chiếu lịch sử, CTA Google Docs hoặc chấm production.

## 1. Học viên và giảng viên sẽ thấy gì

Học viên mở nút trong file Homework của chính mình, chọn đúng hồ sơ IC2304 theo cơ chế đang dùng ở Term Test và handout Writing, luyện Paraphrase và Full Speaking trong **hai hội thoại khác nhau**, rồi xác nhận từng link. Trang kiểm được link chia sẻ có mở được hay không, khối lượng luyện, dấu hiệu nghi gõ và lịch sử trùng. Chỉ khi **cả hai phần đạt** thì hệ thống tạo biên nhận, khởi chạy chấm và ghi vào đúng file Homework: `Đã nộp bài đầy đủ lúc …` theo giờ Việt Nam. Học viên thấy nút quay lại file Homework để làm tiếp.

Giảng viên chỉ nhận **một email tổng hợp theo kỳ quét** về những học viên đã bấm nộp bài Classroom nhưng không có biên nhận Speaking hợp lệ, khi bài Classroom vẫn ở trạng thái **Đã nộp** (`TURNED_IN`). Không gửi email riêng cho nghi vấn gõ. Cảnh báo gõ và bằng chứng hiện cho học viên; nếu học viên xác nhận đã voice chat thì vẫn cho đi tiếp và lưu lời xác nhận.

## 2. Căn cứ hiện có và ranh giới

- Bản thử hiện tại: `speaking-homework/` đọc ChatGPT Share thật và AI kiểm 5 câu Paraphrase, 3 chu trình Speaking. Hai link giống URL hoặc cùng nội dung trong một lượt bị chặn. Chưa có xác thực, lịch sử hoặc biên nhận bền.
- Nguồn học viên hiện dùng ở Term Test và handout Writing: danh sách theo lớp/bài, chọn mã học viên chính thức, tùy chọn ghi nhớ đã tick sẵn; bản nháp/bài làm gắn với phiên máy chủ. **Ghi nhớ không phải xác thực**. Google sign-in hiện có ở khu giảng viên/thư viện, không được suy rằng học viên đã đăng nhập Google chỉ vì được chọn sẵn tên.
- Luồng Speaking 67 hiện quét Lark theo lịch, đi qua workflow `01 → 02 → 03 → 04`, sau đó có thể gửi đề xuất qua queue. Các cạnh workflow con không chờ kết quả; thành công ở cha không chứng minh chấm xong. Thiết kế mới phải thay nguồn nhận bài và đích lưu trạng thái, rồi đối chiếu output trước khi bỏ phụ thuộc Lark.
- CTA chấm Reading/Listening/Vocab 56/67 dùng nút trong Google Docs, truyền định danh tài liệu vào cổng kiểm và đọc lại receipt trước khi báo hoàn tất. Speaking dùng lại nguyên tắc **đúng tài liệu, đúng bài, có biên nhận đọc lại**, không sao chép webhook công khai vốn chỉ lọc theo Doc ID.
- Pilot chỉ bật cho **IC2304 Homework Lesson 2** sau khi đối chiếu được course ID, Classroom courseWork ID, mẫu Google Docs và quyền của tài khoản dịch vụ. Không suy các ID từ mã lớp hoặc tiêu đề bài.

Nguồn đối chiếu: `lop-67/docs/speaking-67-grading-flow.md`, `lop-67/docs/writing-student-memory.md`, `lop-67/working/grading-flow-audit-20260916/BAO_CAO_AUDIT_20260916.md`, `n8n-workflows/workflows/writing-per-pair-v1/docs/THUYET-MINH-KY-THUAT-WRITING-56-67-2026-09-26.md`, source `term-tests/shared/` và `writing-handouts/js/` trong repo Pages.

## 3. Kiến trúc và chủ ghi

```text
Nút trong Google Doc của học viên
  → Pages: chọn học viên, xem hướng dẫn, nhập 2 link
  → API: xác minh phiên + lớp + bài + Doc ID; tải nháp và chỉ mục link cũ
  → PostgreSQL mapping_db: nguồn chuẩn của phiên, lịch sử và biên nhận
  → Bộ đọc ChatGPT Share + workflow AI kiểm từng phần
  → Giao dịch chốt đủ 2 phần và tạo hai việc độc lập (outbox)
      ↳ Bộ ghi Google Docs cập nhật dòng trạng thái, đọc lại receipt
      ↳ n8n chấm Speaking, lưu kết quả/đề xuất vào database
  → Lịch đối soát Classroom gửi 1 email tổng hợp khi có vấn đề
```

**PostgreSQL trong hệ mapping** là nguồn chuẩn cho bài nộp và lịch sử. Lark Base trong giai đoạn chuyển đổi chỉ là nguồn đối chiếu/backfill, không là điều kiện để trang nhận bài hoặc giáo viên xem ca cần xử lý. Không để Pages gọi n8n hoặc Google Docs bằng credential trực tiếp. Backend giữ quyền và kiểm mọi cặp `classId + studentId + courseWorkId + documentId` dựa trên mapping/roster, không tin bốn giá trị do URL gửi lên.

Đề xuất các thực thể (tên schema/bảng cuối cùng chốt sau khi kiểm dictionary và migration hiện hành):

| Thực thể | Khóa và dữ liệu chính | Vai trò |
| --- | --- | --- |
| `speaking_assignment` | course ID, Classroom courseWork ID, lesson, hai chatbot URL, Doc template/anchor, trạng thái mở | Chỉ bài được cấu hình mới nhận link |
| `speaking_submission` | assignment ID + student ID, document ID, revision, trạng thái `draft/checking/needs_work/ready/grading/completed/error`, thời gian UTC | Một hồ sơ học viên–bài; hỗ trợ tải lại và hai tab |
| `speaking_submission_link` | submission ID + phần, URL chuẩn hóa, share ID, dấu vân tay nội dung, số câu, kết luận, bằng chứng an toàn, thời điểm kiểm | Hai link và lịch sử phiên bản; giữ lượt sửa, không ghi đè mất nguồn |
| `speaking_link_claim` | course ID + share ID/dấu vân tay, assignment, phần, student, thời điểm nộp, trạng thái | Index chống dùng lại hội thoại trong khóa; uniqueness theo phạm vi đã chốt |
| `speaking_receipt` | submission ID + revision + idempotency key, trạng thái ghi Docs/chấm, thời điểm, receipt Google Docs | Chốt một lần và phục hồi khi side effect không chắc chắn |
| `speaking_outbox` | receipt ID, loại việc, trạng thái, retry/lease | Giao n8n/Docs không mất việc khi API trả thành công rồi bước sau lỗi |
| `speaking_teacher_notice` | kỳ quét + ca phát hiện, trạng thái gửi, message ID | Một email/kỳ và không nhắc lặp cùng ca |

Lưu timestamp chuẩn UTC có offset; chỉ đổi sang giờ Việt Nam khi hiển thị trong Docs/email. Link thô và nội dung hội thoại chỉ nằm ở kho riêng có quyền phù hợp, thời hạn giữ được chốt trước migration. Frontend chỉ nhận kết luận, số câu và đoạn dẫn chứng đủ để học viên hiểu; không tải cả danh sách link của bạn khác.

## 4. Hợp đồng từng bước

| Bước | Đầu vào → kết quả | Quy tắc khi lỗi |
| --- | --- | --- |
| 1. CTA | Workflow nhúng nút vào đúng Google Doc của học viên, link chứa Doc ID theo mẫu CTA hiện có và một mã truy cập opaque có thể thu hồi trong `#fragment`; backend tra Doc ID và bài từ mapping | Doc chưa đối chiếu hoặc trùng đích: không nhúng/không mở phiên; đưa vào hàng cần kiểm |
| 2. Vào trang | Mở link, tải roster IC2304, chọn học viên theo mã chính thức, ghi nhớ chọn sẵn, tạo/khôi phục phiên | Hồ sơ không thuộc lớp, `dropped`/`on_hold`, Doc ID sai hoặc chưa có quyền: dừng trước khi lộ link cũ |
| 3. Nạp lịch sử | Backend tải chỉ mục link/hội thoại đã nộp của **khóa** vào cache của phiên sau khi xác minh; trả tóm tắt trạng thái, không gửi toàn bộ URL thô xuống browser | Cache lỗi: tra database trực tiếp; cả hai lỗi: chưa cho kết luận không trùng |
| 4. Xác nhận từng link | Chuẩn hóa `/share/`; chặn `/c/`; tra trùng URL/share ID; đọc hội thoại; tính dấu vân tay; tra trùng nội dung; AI kiểm 5 hoặc 3 chu trình; lưu kết quả và revision | Không mở được hoặc AI/DB lỗi: giữ nháp, báo thử lại, không đánh dấu đạt. Trùng cho biết bài/phần đã dùng, không tiết lộ học viên khác |
| 5. Dấu hiệu gõ | AI kiểm dấu hiệu chính tả/cách viết ngay khi đọc Share, hiện cảnh báo, dẫn chứng và ô “Tôi voice chat chứ không phải gõ”; lưu lời xác nhận theo revision | Không lấy lỗi chính tả làm kết luận chắc chắn; thiếu khối lượng vẫn chặn dù đã tick |
| 6. Chốt bài | Backend **kiểm lại trùng trong transaction** và xác nhận cả hai phần đạt trên revision hiện tại; khóa claim, tạo receipt + outbox | Hai tab/hai người cùng nộp: một receipt; bên còn lại nhận trạng thái mới. Chưa đủ 2 link thì không ghi Docs/chấm |
| 7. Chấm + Docs | Ngay sau bước chốt, hai việc độc lập được gửi: n8n chấm Speaking và writer ghi dòng trạng thái/receipt vào Google Docs rồi đọc lại. Trang phản ánh tiến độ từng việc. | Timeout sau khi ghi: đọc lại Doc/receipt trước retry, không thêm dòng lần hai. Chấm lỗi: biên nhận nộp vẫn còn, việc chấm có thể retry |
| 8. Theo dõi GV | Lịch quét Classroom chỉ lấy `TURNED_IN`, loại `RETURNED`, so với receipt; gom các ca chưa có Speaking và gửi một email đến giảng viên đã cấu hình | Nếu Classroom/DB lỗi: không gửi kết luận thiếu bài; ghi kỳ quét `unknown` để chạy lại |

Tại bước 4, chỉ mục tải trước giúp phản hồi trùng nhanh, nhưng **transaction ở bước 6 là cổng quyết định** vì học viên khác có thể nộp trong lúc trang đang mở. Khi phát hiện cùng nội dung ở link Share khác, câu báo cần ghi “Hội thoại này thực ra đã được nộp cho bài …” và chặn. Cùng URL dùng cho hai phần cũng chặn. Với link đã thuộc chính bài/phần/phiên hiện tại, xử lý như mở lại hoặc xác nhận lại, không kết tội nộp trùng.

API dự kiến (tên route sẽ theo convention backend sau khi đối chiếu source):

| Route | Input tối thiểu | Output/cam kết |
| --- | --- | --- |
| `POST /speaking/sessions` | Doc ID, ticket từ fragment, mã học viên được chọn | Phiên gắn đúng học viên–lớp–bài–Doc, revision, hai trạng thái hiện tại; ticket bị xóa khỏi URL và không ghi log |
| `GET /speaking/sessions/:id` | Phiên đã cấp | Nháp và kết quả kiểm đã lưu từ database, quyền kiểm lại mỗi lần tải |
| `PUT /speaking/sessions/:id/draft` | Revision (`If-Match`), hai URL | Bản nháp mới hoặc `409` nếu tab khác đã sửa; không đánh dấu đạt |
| `POST /speaking/sessions/:id/check/:part` | URL, revision, idempotency key | Kết quả `pass/needs_work/duplicate/voice_warning/error`, số câu, bằng chứng phù hợp; lưu đúng phần |
| `POST /speaking/sessions/:id/submit` | Revision, idempotency key, lời xác nhận voice nếu có | Một receipt bền khi đủ hai phần và qua kiểm trùng lần cuối; không trả thành công chỉ vì đã enqueue |
| `GET /speaking/sessions/:id/status` | Receipt/phiên | Trạng thái ghi Docs, chấm và link quay lại do máy chủ cấp; `unknown` khi side effect chưa đối soát |

## 5. Giao diện và lưu tiến trình

- Hai nút **Mở bài luyện** nổi bật, nằm trên ô nhập của từng phần. Nút **Xem hướng dẫn lấy link** ở ngay trên ô Paraphrase mở hộp thoại; bấm ngoài, X, Đóng hoặc Escape sẽ đóng. Chín ảnh xếp một cột, rộng bằng vùng hướng dẫn; iPhone xong mới tới Android.
- Từng ô lưu nháp sau thay đổi. Trang mở lại cùng bài/học viên phải tải trạng thái từ **máy chủ**, so revision với bản trên thiết bị và báo xung đột rõ ràng. Bản thử cục bộ chỉ giữ URL trên thiết bị và yêu cầu bấm kiểm lại.
- Rời trang khi chưa đủ hai phần: trình duyệt hiện cảnh báo rời trang theo khả năng hỗ trợ của browser; không dựa vào popup để lưu bài. Lưu nháp trước mọi chuyển trang quan trọng và khôi phục sau mở lại.
- Có trạng thái rõ: chưa nhập, đang kiểm, cần luyện thêm, link đã dùng trước đó, nghi gõ cần xác nhận, đủ hai phần, đã tạo biên nhận, đang chấm, đã ghi Docs, lỗi cần thử lại. Nút quay lại Homework luôn dùng URL máy chủ cấp cho đúng học viên.
- Không hiển thị “Đã nộp bài đầy đủ” khi chỉ có hai kết quả AI trên trình duyệt. Câu này chỉ xuất hiện sau transaction biên nhận và Docs readback; nếu Docs chậm, hiện “Đã nhận bài, đang cập nhật file Homework”.

## 6. Di chuyển khỏi Lark và thí điểm IC2304

1. **Đối chiếu nguồn:** đọc lại IC2304 trong ERP/mapping, Classroom course/courseWork, roster, từng Google Doc, template anchor và workflow Speaking đang chạy. Chốt mapping bằng ID, không bằng tên học viên hay tiền tố lớp. Kiểm source live n8n trước khi sửa.
2. **Backfill lịch sử:** quét các bài Speaking cũ của cùng khóa từ Classroom + Google Docs (Lark chỉ hỗ trợ đối soát), tách link Paraphrase/Full Speaking, chuẩn hóa share ID, lưu assignment/student/source ID và ghi báo cáo số đã đọc, thiếu, trùng, không chắc. Không tự gán link thiếu chủ cho một học viên.
3. **Xây DB/API:** migration riêng, index tra trùng, ràng buộc duy nhất, API phiên/nháp/kiểm/chốt/status và outbox. Test phân quyền, cùng tên, hai tab, cache cũ, link đổi, retry và rollback.
4. **Kết nối bộ kiểm:** đóng gói bộ đọc Share/AI hiện có cho backend hoặc workflow n8n; chuẩn hóa JSON kết quả, timeout, giới hạn đồng thời và chi phí. Dùng bộ ca thật đã được Đức chọn cùng fixture giả, đo false positive/negative trước khi mở lớp.
5. **CTA và Google Docs:** làm workflow gắn link chứa định danh opaque vào file IC2304; tạo anchor dòng trạng thái; writer ghi rồi đọc lại receipt. Dùng Doc thử trước khi chạm bài thật.
6. **Chấm Speaking:** chuyển nguồn nhận từ quét Lark sang outbox/receipt; điều chỉnh output chấm vào DB và đề xuất bài luyện. Trong giai đoạn song song, đặt khóa idempotent chung để một bài không bị cả lịch Lark và CTA chấm hai lần. Chỉ tắt phụ thuộc Lark sau đối soát đủ một chu kỳ và có đường lui.
7. **Email định kỳ:** giữ lịch định kỳ, gom nhiều học viên trong một thư; chỉ xét Classroom `TURNED_IN` chưa `RETURNED`, có link mở đúng bài của học viên. IC2304 có thời điểm bắt đầu áp dụng để bài cũ không bị báo nhầm; địa chỉ nhận thí điểm đã được Đức cung cấp trong hội thoại và sẽ cấu hình riêng tư, không đặt trong source Pages.
8. **Canary và mở lớp:** chạy đủ ca giả; thử 1–2 Google Docs IC2304 được chọn, đọc lại DB → n8n → Docs → màn học viên → báo cáo GV. Bật cờ chỉ IC2304, theo dõi chi phí, lỗi và thời gian chờ. Khi ổn mới lập đợt mở lớp tiếp theo.

## 7. Nghiệm thu, tải và khôi phục

**Cách nghiệm thu:** `large_phased` cho toàn hệ thống; phần UI cục bộ hiện tại là `small_complete` khi các hành vi xem trước đạt. Không gọi hệ thống thí điểm `verified` nếu chưa có một lượt thật được đọc lại từ database, Google Docs và n8n.

Ca bắt buộc trước pilot: 2 link đủ; thiếu 1 link; `/c/`; share chết/riêng tư; thiếu câu; cùng URL; khác URL cùng hội thoại; link đã nộp cho bài khác trong khóa; link của chính phiên mở lại; nghi gõ và xác nhận; nhập dở rồi đóng/mở lại; hai tab cùng sửa; hai người nộp cùng link đồng thời; lỗi AI/DB/Docs sau ghi; Docs nhiều tab; Classroom `TURNED_IN`/`RETURNED`; một email chứa nhiều ca và không gửi lặp; giảng viên không có quyền; roster `dropped`/`on_hold`; học viên cùng tên; rollback.

Thiết kế vận hành trước build: đo số học viên IC2304 và số lượt xác nhận tập trung gần hạn nộp bằng roster/lịch thật; tạm giả định 30 học viên × 2 link, tối đa 10 lượt kiểm đồng thời và **phải đo lại** trước mở pilot. Mục tiêu phản hồi trùng từ index dưới 2 giây; kiểm nội dung có thanh tiến độ, mục tiêu dưới 90 giây, timeout và retry có giới hạn. Ghi metric số yêu cầu, độ trễ, lỗi đọc/AI, số claim trùng, outbox còn chờ, Docs `unknown`, email gửi/không gửi; không ghi bài nói hoặc secret trong log. Người vận hành có màn xem ca lỗi và nút retry đúng receipt; rollback bằng tắt cờ IC2304, giữ dữ liệu đã nhận và khôi phục workflow từ snapshot, không xóa bài học viên.

**Cổng phát hành:** backup DB/workflow/Docs mẫu; migration thử và restore drill; test hợp đồng; regression RED/GREEN nếu sửa lỗi đã lọt tới người dùng; full suite đúng revision; kiểm bằng tài khoản học viên/GV giả; readback Docs thật; quét secret; checker quality gate; xin duyệt riêng trước thay đổi n8n/DB/Google Docs production. Chưa đủ bằng chứng thì giữ trạng thái `not_ready` hoặc `deployed_awaiting_validation` đúng thực tế.

## 8. Ba thông tin cần chốt trước khi build backend

1. ID chính xác của bài Classroom và Google Docs mẫu của **IC2304 Homework Lesson 2**, cùng vị trí dòng trạng thái được phép ghi. Không dùng một Doc của IC2200 làm mẫu sản xuất.
2. Phạm vi “đã dùng trong khóa”: đề xuất chặn cùng hội thoại ở **bất kỳ học viên/bài Speaking nào cùng course ID**, không chỉ lịch sử của người đang đăng nhập; thông báo không nêu danh tính học viên khác.
3. Mốc bắt đầu kiểm bài theo cơ chế webapp, để các bài cũ không bị báo nhầm. Địa chỉ email thí điểm đã có; cần xác minh khả năng gửi và đọc lại đúng người nhận khi thử workflow.

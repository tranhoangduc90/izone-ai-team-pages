# Kế hoạch xây dựng webapp nộp Speaking Homework · thí điểm IC2304

Ngày lập: 27/09/2026; mở rộng phạm vi Bác sĩ AI: 27/09/2026. Trạng thái: **kế hoạch để rà soát**, chưa triển khai lên học viên. Bản xem trước hiện chỉ đọc ChatGPT Share bằng máy chủ trên máy Đức; chưa có dữ liệu nộp bền, đối chiếu lịch sử, CTA Google Docs, chấm production hoặc danh sách Bác sĩ AI.

Cập nhật 28/09/2026: phần Bác sĩ AI dưới đây là thiết kế chung cho các bài Speaking sau này, **không áp dụng cho Homework Lesson 3 IC2304**. Trang Lesson 3 chỉ nhận bốn link Speaking; kế hoạch cụ thể ở `PLAN-LESSON-3-PILOT.md` được ưu tiên cho bài này.

## 1. Học viên và giảng viên sẽ thấy gì

Học viên mở nút trong file Homework của chính mình, chọn đúng hồ sơ IC2304 theo cơ chế đang dùng ở Term Test và handout Writing, luyện Paraphrase và Full Speaking trong **hai hội thoại khác nhau**, rồi xác nhận từng link. Trang kiểm được link chia sẻ có mở được hay không, khối lượng luyện, dấu hiệu nghi gõ và lịch sử trùng. Chỉ khi **cả hai phần đạt** thì hệ thống tạo biên nhận, khởi chạy chấm và ghi vào đúng file Homework: `Đã nộp bài đầy đủ lúc …` theo giờ Việt Nam. Học viên thấy nút quay lại file Homework để làm tiếp.

Giảng viên chỉ nhận **một email tổng hợp theo kỳ quét** về những học viên đã bấm nộp bài Classroom nhưng không có biên nhận Speaking hợp lệ, khi bài Classroom vẫn ở trạng thái **Đã nộp** (`TURNED_IN`). Không gửi email riêng cho nghi vấn gõ. Cảnh báo gõ và bằng chứng hiện cho học viên; nếu học viên xác nhận đã voice chat thì vẫn cho đi tiếp và lưu lời xác nhận.

Với bài Speaking được mở Bác sĩ AI sau này, khu này sẽ dùng cùng hồ sơ học viên. Trang đó tiếp nối webapp **Luyện tập bổ trợ** đã có: giữ cách chia **Bài cần luyện tập / Bài đã luyện**, mặc định hiện **5 bài đầu**, có nút mở rộng và thu gọn. Bên dưới danh sách có **hai ô nộp link luyện tập bổ trợ**; từng link được kiểm và ghi nhận riêng. Sau mỗi bài Speaking mới thuộc phạm vi này, hệ thống phân tích hội thoại rồi cập nhật bài cần luyện. Phần bổ trợ không làm mất biên nhận Homework đã nộp.

## 2. Căn cứ hiện có và ranh giới

- Bản thử hiện tại: `speaking-homework/` đọc ChatGPT Share thật và AI kiểm 5 câu Paraphrase, 3 chu trình Speaking. Hai link giống URL hoặc cùng nội dung trong một lượt bị chặn. Chưa có xác thực, lịch sử hoặc biên nhận bền.
- Nguồn học viên hiện dùng ở Term Test và handout Writing: danh sách theo lớp/bài, chọn mã học viên chính thức, tùy chọn ghi nhớ đã tick sẵn; bản nháp/bài làm gắn với phiên máy chủ. **Ghi nhớ không phải xác thực**. Google sign-in hiện có ở khu giảng viên/thư viện, không được suy rằng học viên đã đăng nhập Google chỉ vì được chọn sẵn tên.
- Luồng Speaking 67 hiện quét Lark theo lịch, đi qua workflow `01 → 02 → 03 → 04`, sau đó có thể gửi đề xuất qua queue. Các cạnh workflow con không chờ kết quả; thành công ở cha không chứng minh chấm xong. Thiết kế mới phải thay nguồn nhận bài và đích lưu trạng thái, rồi đối chiếu output trước khi bỏ phụ thuộc Lark.
- Bác sĩ AI hiện có danh mục bài 56/67 được cache vào Redis; workflow `04` phân tích Speaking và gửi đề xuất qua queue `xu_ly_de_xuat`, workflow `05` tạo/tăng đề xuất trong bảng lớp, workflow `07` match hội thoại luyện bổ trợ rồi tăng số lần luyện/đóng `Chờ luyện`. Lớp chống lặp của gói v4 đã được đọc lại ngày 10/09, nhưng chưa có nghiệm thu trọn chuỗi bằng một bài Speaking kiểm soát mới; phải kiểm live trước khi nối lại.
- Webapp **Luyện tập bổ trợ** đã có tại `https://tranhoangduc90.github.io/lark-view/` (GET trang và JavaScript trả HTTP 200 ngày 27/09/2026). Source frontend `E:/Codex-Projects/lark-view/index.html`, `app.js`, `styles.css`; proxy nguồn `lark-base-view-html/server.js` trong workspace. Trang nhận `base_id/table_id/view_id` từ URL, đọc Lark qua `/api/view`, nhóm theo `Chờ luyện`, mở link từ `Link BT`, xếp các bài cần luyện theo `Số lần đề xuất` giảm dần, hiện 5 bài đầu và nút **Xem thêm bài tập / Thu gọn**. Đây là bộ xem danh sách **chỉ đọc**: chưa có hai ô nộp Share, xác thực học viên theo hồ sơ Homework, biên nhận luyện hay logic ưu tiên Bác sĩ AI 2.0. Không nhúng nguyên endpoint Lark vào trang Homework để thay cho API theo học viên đã xác minh.
- `E:/Codex-Projects/Lớp 67/output/doc/plan-bac-si-ai-2-0.md` là **định hướng sản phẩm**, chưa phải hành vi production đã xác minh. Tài liệu đặt mục tiêu khóa học lên trước lỗi lẻ, mặc định **1 bài active**, tối đa **2 bài active** khi cần; bài đã luyện một lần vẫn có thể tiếp tục với biến thể mới, chỉ chuyển khi 2/3 lượt gần nhất đạt hoặc sau giới hạn 6–8 lượt cần GV can thiệp/đổi cách luyện. Danh sách 5 bài trên màn hình là phần xem trước của backlog, **không có nghĩa cả 5 đều đang được giao luyện**. Quy tắc này thay cho việc tự bật mọi đề xuất mới hoặc tự đóng `Chờ luyện` ngay sau một lượt nếu triển khai 2.0.
- CTA chấm Reading/Listening/Vocab 56/67 dùng nút trong Google Docs, truyền định danh tài liệu vào cổng kiểm và đọc lại receipt trước khi báo hoàn tất. Speaking dùng lại nguyên tắc **đúng tài liệu, đúng bài, có biên nhận đọc lại**, không sao chép webhook công khai vốn chỉ lọc theo Doc ID.
- Pilot chỉ bật cho **IC2304 Homework Lesson 2** sau khi đối chiếu được course ID, Classroom courseWork ID, mẫu Google Docs và quyền của tài khoản dịch vụ. Không suy các ID từ mã lớp hoặc tiêu đề bài.

Nguồn đối chiếu: `lop-67/docs/speaking-67-grading-flow.md`, `lop-67/docs/writing-student-memory.md`, `lop-67/working/grading-flow-audit-20260916/BAO_CAO_AUDIT_20260916.md`, `docs/LARK_BASE_BO_TRO_DE_XUAT.md`, `E:/Codex-Projects/Lớp 67/output/doc/plan-bac-si-ai-2-0.md`, source `E:/Codex-Projects/lark-view/` và `lark-base-view-html/`, mục “Trạng thái cuối thay thế ma trận cũ — 10/09/2026” trong `n8n-workflows/workflows/writing-56-67-simplify-20260907/parallel-followup/ai-doctor-audit-0909/acceptance-closure-next/README.md`, `n8n-workflows/workflows/writing-per-pair-v1/docs/THUYET-MINH-KY-THUAT-WRITING-56-67-2026-09-26.md`, source `term-tests/shared/` và `writing-handouts/js/` trong repo Pages.

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
          ↳ Bác sĩ AI ghép lỗi với kho bài luyện, cập nhật bảng ưu tiên
Trang học viên → 5 bài ưu tiên đầu / xem tất cả → 2 ô nộp link luyện bổ trợ
  → Bộ kiểm Share + match bài luyện → cập nhật số lần luyện và bảng ưu tiên
Lịch đối soát Classroom → 1 email tổng hợp khi có vấn đề
```

**PostgreSQL trong hệ mapping** là nguồn chuẩn cho bài nộp và lịch sử. Lark Base trong giai đoạn chuyển đổi chỉ là nguồn đối chiếu/backfill, không là điều kiện để trang nhận bài hoặc giáo viên xem ca cần xử lý. Không để Pages gọi n8n hoặc Google Docs bằng credential trực tiếp. Backend giữ quyền và kiểm mọi cặp `classId + studentId + courseWorkId + documentId` dựa trên mapping/roster, không tin bốn giá trị do URL gửi lên.

Proxy mẫu `lark-base-view-html/server.js` nhận các ID của Base/table/view từ URL và source có route `/api/token`. Trước khi tận dụng bất kỳ phần backend nào, kiểm deployment thật và loại đường trả credential ra frontend; API mới chỉ trả bài của học viên đã xác minh. Kiểm HTTP 200 của trang cũ không chứng minh API Lark, phân quyền hay dữ liệu cá nhân hiện vận hành đúng.

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
| `doctor_exercise_catalog` | mã bài luyện ổn định + khóa học, tên, link, mục tiêu, kỹ năng, trạng thái, phiên bản nguồn | Kho bài luyện được đối soát từ danh mục hiện hành; không dùng tên tự do làm khóa |
| `doctor_error_evidence` | receipt nguồn + phần/hội thoại + vị trí câu, loại lỗi, giải thích, mức độ, mã bài ghép, phiên bản bộ phân tích | Dẫn chứng của đề xuất; mỗi lỗi truy được về bài nộp, không lẫn học viên |
| `doctor_recommendation` | course ID + student ID + exercise ID, điểm/thứ tự ưu tiên, số bài nguồn riêng biệt, trạng thái chờ luyện, số lần luyện, phiên bản danh sách | Một dòng hiện hành cho mỗi bài luyện; giữ lịch sử và tiến trình khi có bài mới |
| `doctor_active_plan` | course ID + student ID + tối đa hai exercise ID, slot chính/phụ, mục tiêu can-do, tiêu chí đạt, trạng thái, thời điểm cần luyện tiếp | Phân biệt 1–2 bài đang tập trung với backlog 5 bài được xem trước |
| `doctor_practice_attempt` | active plan + exercise ID + variant ID, receipt luyện, kết quả theo tiêu chí, thứ tự lượt | Giữ cùng bài qua nhiều lượt, đổi biến thể và xét 2/3 lượt gần nhất trước khi chuyển |
| `doctor_practice_link` | student ID + lượt nộp + slot 1/2, Share ID/dấu vân tay, exercise ID được xác nhận, kết quả kiểm, receipt | Hai ô luyện bổ trợ; chống dùng lại link Homework hoặc link bài luyện cũ |
| `doctor_update_run` | source receipt + analyzer/catalog version, trạng thái, danh sách version trước/sau | Cập nhật idempotent; retry không tăng số lần đề xuất hoặc luyện |

Lưu timestamp chuẩn UTC có offset; chỉ đổi sang giờ Việt Nam khi hiển thị trong Docs/email. Link thô và nội dung hội thoại chỉ nằm ở kho riêng có quyền phù hợp, thời hạn giữ được chốt trước migration. Frontend chỉ nhận kết luận, số câu và đoạn dẫn chứng đủ để học viên hiểu; không tải cả danh sách link của bạn khác. Danh sách Bác sĩ AI phải cùng cặp course ID–student ID đã xác minh ở phần Homework, không tìm bằng tên học viên như bảng Lark cũ.

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
| 9. Cập nhật Bác sĩ AI | Khi có receipt Speaking mới, bộ phân tích dùng hai hội thoại đã đọc, ghi lỗi kèm dẫn chứng và match với mã bài trong kho. Cập nhật backlog theo mục tiêu khóa học và bằng chứng; selector giữ hoặc chọn 1–2 bài active theo bản thiết kế 2.0, tăng version danh sách rồi trang tải bản mới. | AI không chắc hoặc bài chưa có trong danh mục: ghi ca cần rà, không tự tạo link/bài luyện giả. Lỗi Doctor không đảo ngược biên nhận Homework hay ghi Docs; không thay bài active chỉ vì có một lỗi mới. |
| 10. Nhận hai link bổ trợ | Mỗi ô nộp một ChatGPT Share của bài luyện bổ trợ; kiểm mở được, không trùng lịch sử, match đúng bài được chọn và đủ thao tác luyện, rồi tạo receipt và cập nhật số lần luyện/trạng thái. | Không khớp hoặc không đọc được: giữ nháp, chỉ báo lý do. Replay cùng link không tăng số lần luyện; lỗi cập nhật danh sách được phục hồi từ receipt. |

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
| `GET /speaking/doctor/recommendations?session=…&limit=5` | Phiên đã xác minh, version danh sách nếu có | Tổng số, 5 bài ưu tiên đầu, trạng thái từng bài và version; `limit=all` trả toàn bộ qua phân trang nếu danh sách dài |
| `PUT /speaking/doctor/practice/draft` | Phiên, slot 1/2, URL, revision | Nháp hai ô được giữ trên máy chủ theo đúng học viên; `409` khi phiên/tab cũ ghi đè |
| `POST /speaking/doctor/practice/check/:slot` | URL, bài luyện chọn từ list hoặc yêu cầu tự match, idempotency key | Kết quả đọc Share, bài nhận diện, bằng chứng, receipt luyện hoặc lý do chưa nhận; không tăng số lần chỉ vì HTTP 200 |

## 5. Giao diện và lưu tiến trình

- Hai nút **Mở bài luyện** nổi bật, nằm trên ô nhập của từng phần. Nút **Xem hướng dẫn lấy link** ở ngay trên ô Paraphrase mở hộp thoại; bấm ngoài, X, Đóng hoặc Escape sẽ đóng. Chín ảnh xếp một cột, rộng bằng vùng hướng dẫn; iPhone xong mới tới Android.
- Từng ô lưu nháp sau thay đổi. Trang mở lại cùng bài/học viên phải tải trạng thái từ **máy chủ**, so revision với bản trên thiết bị và báo xung đột rõ ràng. Bản thử cục bộ chỉ giữ URL trên thiết bị và yêu cầu bấm kiểm lại.
- Rời trang khi chưa đủ hai phần: trình duyệt hiện cảnh báo rời trang theo khả năng hỗ trợ của browser; không dựa vào popup để lưu bài. Lưu nháp trước mọi chuyển trang quan trọng và khôi phục sau mở lại.
- Có trạng thái rõ: chưa nhập, đang kiểm, cần luyện thêm, link đã dùng trước đó, nghi gõ cần xác nhận, đủ hai phần, đã tạo biên nhận, đang chấm, đã ghi Docs, lỗi cần thử lại. Nút quay lại Homework luôn dùng URL máy chủ cấp cho đúng học viên.
- Không hiển thị “Đã nộp bài đầy đủ” khi chỉ có hai kết quả AI trên trình duyệt. Câu này chỉ xuất hiện sau transaction biên nhận và Docs readback; nếu Docs chậm, hiện “Đã nhận bài, đang cập nhật file Homework”.

## 6. Bác sĩ AI dưới phần nộp Speaking

### Bố cục và hành vi học viên

Lấy webapp `lark-view` làm **mẫu hành vi và giao diện đã có**; chuyển phần render danh sách cần luyện/đã luyện, link mở bài và nút hiện 5 bài sang khu Speaking Homework trong repo Pages chung. Trang mới lấy dữ liệu qua API theo phiên học viên, thay cho URL ba ID Lark và proxy view tổng quát. Kiểm lại trên điện thoại vì bản cũ là bảng có cuộn ngang. Giữ URL cũ hoạt động trong thời gian chuyển nguồn; không tạo hai nơi ghi tiến trình.

1. Đặt tiêu đề **Bác sĩ AI · Bài cần luyện tiếp** ngay dưới trạng thái nộp hai link Speaking. Cùng hồ sơ đang mở, không bắt chọn học viên lần nữa.
2. Chia **Bài đang tập trung luyện** (một bài chính, tối đa hai) và **Các bài khác có thể cần luyện / Bài đã luyện**. Mỗi hàng có tên, link **Mở bài luyện**, mục tiêu học viên sẽ làm được, lý do ưu tiên gắn với bài học hiện tại, số lần đề xuất/luyện và tiến độ; lỗi cụ thể chỉ là bằng chứng hỗ trợ, không biến thành tiêu đề mang tính phạt. Chỉ hiện dẫn chứng từ bài của chính học viên đó.
3. Mặc định hiện tối đa **5 bài trong backlog**, như webapp cũ; nút **Xem tất cả (N bài)** mở đủ danh sách, **Thu gọn** trở về 5 bài đầu nhưng giữ vị trí cuộn và bản nháp. Hai bài active vẫn luôn nhìn thấy riêng, không bị cắt bởi giới hạn 5. Nếu chưa có đề xuất thì hiện “Chưa có bài cần luyện thêm”; nếu phân tích đang chạy thì hiện “Đang cập nhật bài cần luyện”, không coi danh sách rỗng là kết luận AI.
4. Bên dưới danh sách đặt **hai ô riêng**: **Link luyện bổ trợ 1** và **Link luyện bổ trợ 2**, mỗi ô có nút **Xác nhận link**, kết quả và bằng chứng riêng. Học viên có thể chọn bài đang luyện từ list hoặc để hệ thống nhận diện từ hội thoại; chỉ ghi nhận khi match đủ chắc chắn với bài trong kho. Cả hai ô dùng hướng dẫn lấy link Share đã có, nháp được lưu qua backend và vẫn còn khi mở lại. Sau một lượt đã nhận, học viên có thể mở lượt luyện tiếp với hai ô trống; receipt cũ vẫn trong lịch sử.
5. Hai link bổ trợ là **hai hội thoại khác nhau** và không được dùng lại bất kỳ link/hội thoại đã nộp cho Homework hoặc bài luyện khác trong khóa. Hai ô có thể làm dần từng cái; chúng **không khóa** biên nhận nộp Homework Speaking đã hoàn tất. Đây là giả định an toàn cho bài bổ trợ; nếu một lesson sau này bắt buộc đủ hai link, cấu hình nghĩa vụ riêng ở `speaking_assignment`, không áp ngược cho IC2304 khi chưa chốt.

### Tạo và cập nhật thứ tự ưu tiên

- Mỗi receipt Homework Speaking mới sinh đúng một lần phân tích Bác sĩ AI theo `receipt ID + phiên bản bộ phân tích + phiên bản danh mục`. Dùng nội dung hai Share đã đọc trong lần nộp; không phụ thuộc bản ghi Lark được tạo sau. AI trả mã loại lỗi, vị trí lượt chat, đoạn dẫn chứng, giải thích và bài trong danh mục phù hợp. Backend kiểm mã bài tồn tại/đang mở trước khi nhận.
- Danh mục 56/67 hiện có `Tên BT`, `Link BT`, `Mục tiêu`, `Kỹ năng`, `Phân loại`; đồng bộ có phiên bản vào `doctor_exercise_catalog` và cấp **exercise ID ổn định**. Bổ sung metadata theo đề án 2.0: `module`, `sub-skill`, mục tiêu **can-do**, tiêu chí đạt, nhóm A/B/sửa lỗi, biến thể đã QA và giới hạn lượt. Tên AI trả ra chỉ là gợi ý để match, không làm khóa ghi. Bài mới chưa có mã được đưa vào hàng rà soát, không hiện URL tự tạo.
- Gộp nhiều lỗi cùng bài luyện thành một hàng. **Backlog** sắp theo kỹ năng đang học/sắp kiểm tra → tín hiệu yếu rõ ở bài nộp hoặc mini test → khả năng tạo tiến bộ nhanh → lỗi nền đang chặn mục tiêu; mức ảnh hưởng, lặp lại và độ mới của lỗi chỉ là bằng chứng trong cùng mức ưu tiên. Chọn **một bài chính, tối đa hai bài active**, không bật mọi đề xuất thành `Chờ luyện`. Lưu lý do, điểm thành phần và version để giải thích thứ tự. Không tăng số lần đề xuất khi retry cùng một receipt. Thuật toán cũ xếp theo `Số lần đề xuất` được giữ để so sánh kết quả migration, không là luật ưu tiên cuối cùng.
- Khi có bài Homework mới, tạo bản danh sách version mới bằng transaction: cập nhật bằng chứng và backlog, giữ số lần luyện/receipt và **giữ bài active** nếu chưa đạt điều kiện chuyển. Một lỗi mới không tự thay bài đang tập trung. Nếu AI lỗi, giữ list version trước và hiện nhãn “Chưa cập nhật từ bài mới”, không xóa danh sách. Khi nâng phiên bản AI/danh mục, dựng lại từ tập receipt nguồn riêng biệt thay vì cộng dồn lần nữa.
- Khi học viên nộp link bổ trợ, bộ kiểm nhận diện bài dựa trên prompt/nội dung, đối chiếu exercise ID đã chọn và tiêu chí của bài đó. Chỉ sau receipt đọc lại mới tăng **Số lần luyện** và lưu kết quả lượt; một lần luyện không tự đánh dấu xong hay ẩn bài. Đổi biến thể cho lượt tiếp theo; chỉ chuyển khi **2/3 lượt gần nhất đạt**, hoặc sau khoảng **6–8 lượt** chưa tiến bộ thì đưa GV can thiệp/đổi cách hỗ trợ theo cấu hình pilot. Nếu hội thoại chứa nhiều bài, hệ thống chỉ ghi các bài có đoạn luyện tách được và bằng chứng rõ; trường hợp mơ hồ đưa vào cần kiểm.

### Chuyển nguồn từ Bác sĩ AI hiện có

Giai đoạn đầu đọc lại live `04/05/07/11`, queue `xu_ly_de_xuat`, cache danh mục, các bảng lớp và API của `lark-view` đang dùng; chụp một lát dữ liệu đã ẩn định danh để đối chiếu kết quả. Chuyển danh mục và lịch sử đề xuất/luyện có chủ sở hữu rõ sang database mapping theo `course ID + student ID + exercise ID`; giữ ID nguồn, số lần và trạng thái. Các hàng cũ chỉ có tên học viên hoặc tên bài không khớp duy nhất sẽ vào hàng đối soát, không gộp đoán. Trong thời gian chạy song song, một receipt chỉ có **một đường ghi chủ**; nhánh cũ có thể đọc/đối chiếu nhưng không cùng tăng số lần trên Lark và database. Chỉ chuyển khu danh sách mới sang API database sau khi số hàng, trạng thái và link bài được đối chiếu với **webapp cũ**, sau đó kiểm riêng quy tắc active 1–2 bài của 2.0. Không bật lại workflow legacy/inactive để lấp số liệu.

## 7. Di chuyển khỏi Lark và thí điểm IC2304

1. **Đối chiếu nguồn:** đọc lại IC2304 trong ERP/mapping, Classroom course/courseWork, roster, từng Google Doc, template anchor và workflow Speaking đang chạy. Chốt mapping bằng ID, không bằng tên học viên hay tiền tố lớp. Kiểm source live n8n trước khi sửa.
2. **Backfill lịch sử:** quét các bài Speaking cũ của cùng khóa từ Classroom + Google Docs (Lark chỉ hỗ trợ đối soát), tách link Paraphrase/Full Speaking, chuẩn hóa share ID, lưu assignment/student/source ID và ghi báo cáo số đã đọc, thiếu, trùng, không chắc. Không tự gán link thiếu chủ cho một học viên.
3. **Xây DB/API:** migration riêng, index tra trùng, ràng buộc duy nhất, API phiên/nháp/kiểm/chốt/status và outbox. Test phân quyền, cùng tên, hai tab, cache cũ, link đổi, retry và rollback.
4. **Kết nối bộ kiểm:** đóng gói bộ đọc Share/AI hiện có cho backend hoặc workflow n8n; chuẩn hóa JSON kết quả, timeout, giới hạn đồng thời và chi phí. Dùng bộ ca thật đã được Đức chọn cùng fixture giả, đo false positive/negative trước khi mở lớp.
5. **CTA và Google Docs:** làm workflow gắn link chứa định danh opaque vào file IC2304; tạo anchor dòng trạng thái; writer ghi rồi đọc lại receipt. Dùng Doc thử trước khi chạm bài thật.
6. **Chấm Speaking:** chuyển nguồn nhận từ quét Lark sang outbox/receipt; điều chỉnh output chấm vào DB và phát việc phân tích Bác sĩ AI riêng. Trong giai đoạn song song, đặt khóa idempotent chung để một bài không bị cả lịch Lark và CTA chấm hai lần. Chỉ tắt phụ thuộc Lark sau đối soát đủ một chu kỳ và có đường lui.
7. **Email định kỳ:** giữ lịch định kỳ, gom nhiều học viên trong một thư; chỉ xét Classroom `TURNED_IN` chưa `RETURNED`, có link mở đúng bài của học viên. IC2304 có thời điểm bắt đầu áp dụng để bài cũ không bị báo nhầm; địa chỉ nhận thí điểm đã được Đức cung cấp trong hội thoại và sẽ cấu hình riêng tư, không đặt trong source Pages.
8. **Canary phần Homework và mở lớp:** chạy đủ ca giả; thử 1–2 Google Docs IC2304 được chọn, đọc lại DB → n8n → Docs → màn học viên → báo cáo GV. Bật cờ nộp Homework chỉ IC2304, theo dõi chi phí, lỗi và thời gian chờ.
9. **Chuẩn bị Bác sĩ AI:** kiểm live workflow/cache/catalog và đường phục vụ trang `lark-view`; chụp mốc hiển thị 5 bài, link, nhóm `Chờ luyện/Đã luyện` để đối chiếu. Migrate danh mục và lịch sử đề xuất/luyện có chủ sở hữu rõ sang database mapping; thử một bài Speaking kiểm soát tạo đề xuất đúng exercise ID. Chuẩn hóa mục tiêu khóa, tiêu chí đạt và biến thể cho vài bài pilot theo đề án 2.0. Giữ cờ Bác sĩ AI tắt trong lúc nguồn chưa khớp.
10. **Mở khu Bác sĩ AI trong IC2304:** tái dùng cách hiển thị của webapp `lark-view` trong trang Speaking, nối API theo học viên và hai ô link bổ trợ. Kiểm phân quyền, top 5/xem tất cả, **1–2 bài active khác backlog**, lưu nháp, chống trùng, receipt luyện, lặp cùng bài với biến thể mới và cập nhật sau ít nhất hai bài nộp nối tiếp. Quan sát một chu kỳ retry/đối soát trước khi mở cho lớp khác.

## 8. Nghiệm thu, tải và khôi phục

**Cách nghiệm thu:** `large_phased` cho toàn hệ thống, gồm hai phần phát hành tách cờ: **nộp/chấm Homework IC2304**, sau đó **Bác sĩ AI IC2304**. Phần UI cục bộ hiện tại là `small_complete` khi các hành vi xem trước đạt. Không gọi phần Homework `verified` nếu chưa có một lượt thật được đọc lại từ database, Google Docs và n8n; không gọi Bác sĩ AI `verified` nếu chưa đọc lại đề xuất, thứ tự ưu tiên và receipt luyện qua hai lần cập nhật.

Ca bắt buộc trước pilot: 2 link đủ; thiếu 1 link; `/c/`; share chết/riêng tư; thiếu câu; cùng URL; khác URL cùng hội thoại; link đã nộp cho bài khác trong khóa; link của chính phiên mở lại; nghi gõ và xác nhận; nhập dở rồi đóng/mở lại; hai tab cùng sửa; hai người nộp cùng link đồng thời; lỗi AI/DB/Docs sau ghi; Docs nhiều tab; Classroom `TURNED_IN`/`RETURNED`; một email chứa nhiều ca và không gửi lặp; giảng viên không có quyền; roster `dropped`/`on_hold`; học viên cùng tên; rollback.

Ca bắt buộc riêng cho Bác sĩ AI: đối chiếu giao diện cũ và mới về nhóm/link/top 5; chưa có gợi ý/đang phân tích/lỗi phân tích; đúng 5 bài và trên 5 bài; mở rộng rồi thu gọn trên điện thoại; backlog trên 5 bài nhưng chỉ 1–2 bài active; bài đang luyện giữ nguyên sau một lượt hoặc một lỗi mới; đổi biến thể và xét 2/3 lượt gần nhất; chạm giới hạn lượt thì chuyển GV/đổi scaffold; hai lỗi trỏ cùng một bài; cùng lỗi tái diễn ở bài mới; hai bài mới tới gần nhau và retry cùng receipt; catalog đổi link/tên nhưng giữ ID; AI trả tên bài không tồn tại; học viên nộp một hoặc hai link bổ trợ rồi tải lại; hai link bổ trợ trùng nhau hoặc trùng Homework; link không match bài đã chọn; mất ACK sau khi đã tăng số lần luyện; danh sách của học viên khác không lộ; lỗi Bác sĩ AI không làm mất biên nhận Homework.

Thiết kế vận hành trước build: đo số học viên IC2304 và số lượt xác nhận tập trung gần hạn nộp bằng roster/lịch thật; tạm giả định 30 học viên × 2 link Homework và tối đa 2 link bổ trợ cho mỗi lượt, tối đa 10 lượt kiểm đồng thời và **phải đo lại** trước mở từng phần pilot. Mục tiêu phản hồi trùng từ index dưới 2 giây; kiểm nội dung có thanh tiến độ, mục tiêu dưới 90 giây, timeout và retry có giới hạn. Danh sách 5 bài cần tải nhanh từ database, còn phân tích bài mới là việc nền và trang báo đang cập nhật. Ghi metric số yêu cầu, độ trễ, lỗi đọc/AI, số claim trùng, outbox còn chờ, Docs `unknown`, danh sách Bác sĩ AI còn bản cũ, số đề xuất không match danh mục, số receipt luyện, email gửi/không gửi; không ghi bài nói hoặc secret trong log. Người vận hành có màn xem ca lỗi và nút retry đúng receipt; rollback bằng tắt riêng cờ Bác sĩ AI hoặc cờ nộp Homework IC2304, giữ dữ liệu đã nhận và khôi phục workflow từ snapshot, không xóa bài học viên.

**Cổng phát hành:** backup DB/workflow/Docs mẫu; migration thử và restore drill; test hợp đồng; regression RED/GREEN nếu sửa lỗi đã lọt tới người dùng; full suite đúng revision; kiểm bằng tài khoản học viên/GV giả; readback Docs thật; quét secret; checker quality gate; xin duyệt riêng trước thay đổi n8n/DB/Google Docs production. Chưa đủ bằng chứng thì giữ trạng thái `not_ready` hoặc `deployed_awaiting_validation` đúng thực tế.

## 9. Thông tin cần chốt trước khi build backend

1. ID chính xác của bài Classroom và Google Docs mẫu của **IC2304 Homework Lesson 2**, cùng vị trí dòng trạng thái được phép ghi. Không dùng một Doc của IC2200 làm mẫu sản xuất.
2. Phạm vi “đã dùng trong khóa”: đề xuất chặn cùng hội thoại ở **bất kỳ học viên/bài Speaking hoặc bài bổ trợ nào cùng course ID**, không chỉ lịch sử của người đang đăng nhập; thông báo không nêu danh tính học viên khác.
3. Mốc bắt đầu kiểm bài theo cơ chế webapp, để các bài cũ không bị báo nhầm. Địa chỉ email thí điểm đã có; cần xác minh khả năng gửi và đọc lại đúng người nhận khi thử workflow.
4. Danh mục bài luyện hiện hành, mã bài ổn định và tiêu chí “đã luyện đủ” cho từng loại bài; nguồn đang có trong Lark/Redis và webapp `lark-view` cần đối chiếu live và gắn ID trước khi chấm hai link bổ trợ. Quy tắc active 1–2 bài cùng điều kiện chuyển bài thuộc đề án Bác sĩ AI 2.0 và cần được xác nhận chuyên môn trên bài pilot; mặc định hai ô bổ trợ làm dần, không là điều kiện nộp Homework.

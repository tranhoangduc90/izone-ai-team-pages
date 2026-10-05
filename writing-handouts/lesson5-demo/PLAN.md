# Lesson 5 · Mua đồ không cần thiết — kế hoạch webapp

Ngày 05/10/2026 · plan-v1 · Bản thiết kế đề xuất, chưa phát hành hệ thống thật.

## 1. Kết quả và phạm vi

Học viên chọn tên, xác nhận mình, nhập vào ô vàng, nhận các lượt Comment ngay cạnh bài làm và hoàn thiện từng ý theo B → A → X. Từ vựng chỉ xuất hiện khi ba điểm của đúng ý đó đã đạt. Bài và nhận xét được lưu theo học viên; quay lại tiếp tục được.

Đầu ra đợt này: kế hoạch frontend–backend–n8n và HTML demo tương tác, chạy riêng trên máy. Phạm vi nghiệm thu `small_complete`, chế độ `standard` cho demo có trạng thái. Chấm và tên học viên trong demo là dữ liệu giả; không gửi bài tới AI, Docs, database hoặc n8n. Bản sản phẩm thật cần chế độ `controlled`, kiểm tích hợp và cổng production riêng.

Không thêm bước viết cả đoạn, chấm band hay thân bài 1. Không di chuyển các bài Docs cũ vào database tự động. Các điểm đã đạt giữ nguyên; yêu cầu mở lại để sửa là tính năng riêng cần chốt nếu muốn thêm.

## 2. Hiện trạng đã đối chiếu

Nguồn nội dung: [Docs mẫu](https://docs.google.com/document/d/1eDv6tlbBKi--sbFuipIKTvgkbohT3dF66n6ZcCpBhuk/edit), [Docs lớp IC2172](https://docs.google.com/document/d/1ezYfYOCpT97iYcoC-3CMnBHefnHfF8FlHqebLzR2Ou4/edit). Nội dung nhập là Idea 1/2, Topic sentence, B1/2, A1/2, X1/2. Bảng cuối có A words, X words, B words cho mỗi ý.

| Workflow đang active | ID | Thay đổi cần có cho web |
|---|---|---|
| Lesson 5 – Topic sentence | KqVaPEr0olbTuCXz | Nhận dữ liệu cả hai idea và topic từ bài web; trả trạng thái cấu trúc và nhận xét |
| Lesson 5 – Điểm cuối 1 | cpGhBqjjFrvLZQYm | Rút rubric B thành bộ chấm nhận `ideaIndex` |
| Lesson 5 – Điểm cuối 2 | TQD70sADFEGDQxES | Dùng chung bộ chấm B; bỏ thao tác copy giữa bảng Docs trong đường web |
| Lesson 5 – Điểm đầu | f2DwLxvlrBaNdrPx | Chấm A của một ý; giữ nhánh Lesson 7 hiện hành ngoài phạm vi |
| Lesson 5 – Điểm giữa | WDhql3xbrI8Cb7it | Chấm X của một ý; tách tạo từ vựng theo đúng ý đã đạt |

Live hiện tại dựa vào các ô Comment lần 1–3 và số ký hiệu 👍 trong nhận xét. A/X đang xử lý hai ý; X sinh từ vựng cho cả hai khi có ít nhất hai 👍. Web phải thay điều kiện này bằng trạng thái từng bước được máy chủ xác nhận, không đếm ký hiệu. Link template có một CTA trỏ sang Docs lớp khác: không dùng lại hyperlink để định danh bài web.

Rubric X hiện hành: chỉ nhận xét X, coi A/B đã được duyệt, tối đa một lỗi chính; hỏi gợi mở, không viết hộ, không sửa A/B hay chấm band. Đã đủ thì xác nhận và không đề nghị nâng cấp thêm. Từ vựng hiện hành: đúng hai cụm cho mỗi A/X/B, mỗi cụm tối đa năm từ, band 5.0–7.0, không viết hộ câu hoàn chỉnh. Giữ các nguyên tắc này khi chuyển.

Backend hiện hành đã có `activity_section_definition`, `response_data`, `session_section`, `check_attempt`, Comment lịch sử và prerequisites. `lesson-service.js`/`app.js` đã hỗ trợ section động, lưu có `baseVersion`, yêu cầu có `requestId`, lượt chấm bất đồng bộ và trạng thái đạt khóa. Đề xuất mở rộng hệ này, không dựng database/backend mới.

## 3. Hành trình và điều kiện mở khóa

Đề bài → nhập hai idea của thân bài 2 → check Topic sentence → B1 → A1 → X1 → từ vựng ý 1 → B2 → A2 → X2 → từ vựng ý 2 → tổng hợp A–X–B và lịch sử.

| Phần | Dữ liệu được sửa | Ngữ cảnh chỉ đọc | Điều kiện được mở |
|---|---|---|---|
| Chốt idea + Topic sentence | Idea1, Idea2, topicSentence | Nguyên đề | Đã xác nhận người học |
| B1 | B1 | Idea1, topic, đề | Topic đạt |
| A1 | A1 | B1 và trọng tâm “Mua đồ không cần thiết” | B1 đạt |
| X1 | X1 | A1, B1 | A1 và B1 đạt |
| Từ vựng 1 | Không có ô sửa | A1/X1/B1 đã duyệt | B1 ∧ A1 ∧ X1 đạt |
| B2 | B2 | Idea2, B1 đã duyệt, topic, đề | B1/A1/X1 đạt và học viên bấm chuyển ý |
| A2 | A2 | B2, trọng tâm đề | B2 đạt |
| X2 | X2 | A2, B2 | A2 và B2 đạt |
| Từ vựng 2 | Không có ô sửa | A2/X2/B2 đã duyệt | B2 ∧ A2 ∧ X2 đạt |

“Xong ý 1” được hiểu là ba điểm đạt; từ vựng lỗi không được biến thành lỗi bài làm. Khi từ vựng chưa có, báo riêng và cho thử lại; vẫn được chuyển ý 2. Phần ý 2 chưa hiện ô làm bài trước khi ý 1 xong. Điều hướng chỉ báo phần đang khóa và lý do.

Một lượt chấm có trạng thái nháp → đang chờ/đang chấm → đạt hoặc cần sửa; lỗi kỹ thuật là trạng thái riêng, không cộng vào số lần bài cần sửa. Gửi trùng cùng requestId chỉ tạo một lượt. Phần đạt khóa nhập và nút chấm; nhận xét cũ vẫn xem được. Sau 3/6/9 lần cần sửa, gợi ý nhờ giảng viên như handout SW; không giới hạn cứng ba ô như Docs.

## 4. Frontend và chuẩn giao diện

Nguồn: `progress-log/index.html`, `styles.css`, `reference-components.css`; `writing-handouts/lesson.html`, `task2-demo.html`, `styles.css`. Đã render mẫu Writing 1280×720 và đọc computed style; Progress Log URL chung thiếu mã phiếu nên chưa quan sát login live. Login được đối chiếu bằng source và fixture test của chính sản phẩm, không suy trang lỗi là màn đăng nhập.

Giữ cách Progress Log chọn tên → ghi nhớ → xác nhận; không gọi chọn tên là xác thực chống gian lận. Nền sáng, thẻ login rộng tối đa 620 px, vạch navy đầu thẻ, radius 23 px; nút đỏ, cao 48 px. Chọn lớp khi link không chứa lớp; link có lớp thì hiện lớp đó và chọn tên. Ghi nhớ định danh công khai, không lưu mã truy cập/token. Đổi người học quay về xác nhận, không dùng nháp của người khác.

Giữ Writing: ô bài làm bên trái, dòng thời gian Comment bên phải; nhận xét mới nhất mở sẵn, các lượt cũ có thể mở lại cả câu trả lời đã chấm. Đề có toàn văn; sidebar bước và trạng thái không thay nội dung bài. Mobile xếp đề → ô nhập → nhận xét, không cuộn ngang. Desktop khung nội dung tối đa 1440 px, vùng bài/nhận xét khoảng 62/38; sidebar 220 px.

Token demo: navy `#152B4E`, đỏ `#DB0829`, canvas `#F6F8FB`, chữ `#182B45`, viền `#DCE4EE`, ô nhập `#FFF8D8`, đạt `#136F4A`; control radius 9 px; body 16 px, label 14 px, khoảng cách 8/12/16/24/32 px. Font hệ thống như mẫu (Inter nếu máy có; Segoe UI fallback). Không gọi font chưa tải là Inter thật. Sai khác chủ đích: ô vàng theo Docs, sidebar và chia từng B/A/X theo yêu cầu, chữ trợ giúp lớn hơn mẫu Progress Log.

Module UI: login/confirm; đọc đề và ý tưởng; trình bày bước B/A/X; timeline Comment; từ vựng A/X/B; lưu/tiếp tục. Trạng thái thiếu dữ liệu, trống, đang chấm, cần sửa, đạt, lỗi kỹ thuật và chưa lưu phải có nhãn bằng chữ. Nút check cạnh đúng ô; nộp khi trường trống phải focus ô đó. Giữ native select, textarea, details và focus bàn phím rõ.

## 5. Kiến trúc backend đề xuất

Chọn mở rộng Writing API và database hiện có. So với dựng Apps Script webapp mới, hướng này dùng lại lớp, roster, lưu bài, chống trùng và lịch sử; cần kiểm đủ suite Writing và attendance nếu phát hành API/container dùng chung. Apps Script/Docs chỉ tiếp tục phục vụ sản phẩm cũ, không làm nơi lưu bài web.

| Module | Sở hữu | Giao diện | Phụ thuộc và giới hạn |
|---|---|---|---|
| Nhận diện người học | classRef/studentRef và quyền mở bài | roster, mở session | Không coi display name là khóa; reuse roster/provisional/PIN hiện hành |
| Bài và tiến độ | responses, draftVersion, prerequisite, locked | đọc/lưu/check session | Máy chủ quyết định mở khóa; frontend không được tự đánh dấu đạt |
| Điều phối chấm | attemptRef/requestId, snapshot, lease/retry | cấp lượt chấm, nhận callback | Không ghi nội dung mới đè snapshot cũ; giữ token/secret ở server |
| Nhận xét và từ vựng | lịch sử đã lưu, vocab theo idea và source hash | đọc Comment/vocab | Chỉ công bố sau commit + readback, không chỉ HTTP 200 |

Các kết nối: UI ← roster/session từ backend; UI → lưu rồi check; dispatcher ← snapshot backend; backend ← callback có định danh bất biến; UI ← trạng thái/nhận xét đọc lại. Mỗi kết nối phải có fixture đúng/lỗi/đến muộn trong lát tích hợp.

Section đề xuất: `body2_topic`, `body2_idea1_b`, `body2_idea1_a`, `body2_idea1_x`, `body2_idea2_b`, `body2_idea2_a`, `body2_idea2_x`. Topic section chứa ba trường idea1/idea2/topicSentence. B/A/X mỗi section có đúng một trường được chấm và context_fields đã khóa. Từ vựng là artifact sau X, không phải section chấm mới. Dùng unique session theo activity + học viên canonical; scope theo lớp đã cho phép.

Tuyến đã có cần tận dụng: POST `/api/v1/lesson-sessions`; GET session; PUT `/responses` với `baseVersion`, `requestId`; POST `/checks` với `section`, `requestId` trả 202; GET attempts và đọc lịch sử. Dữ liệu nhập được lưu trước chấm; If-Match/version xung đột 409 thì giữ local và dừng ghi, cho đối chiếu bản server. Không tự ghi đè khi mất mạng hoặc hai tab cùng sửa.

Hợp đồng chấm mới (đề xuất, phải khóa bằng fixture trước build): `schemaVersion`, `activitySlug`, `sessionRef`, `attemptRef`, `requestId`, `section`, `ideaIndex` (null cho topic; 1/2 cho B/A/X), `snapshotHash`, `draftVersion`, `promptVersion`, nguyên đề, dữ liệu đúng bước, ngữ cảnh đã duyệt và lịch sử đúng bước. Kết quả: đúng các khóa nguồn, `resultStatus=passed|needs_revision`, `feedback`, `criteria`, `promptVersion`. Technical failure không dùng needs_revision. Callback xác thực phía server; kiểm toàn bộ tuple và hash, dữ liệu/schema rỗng thì reject trước ghi; trùng callback chỉ đọc lại kết quả cũ; stale callback giữ audit, không mở khóa bài hiện hành.

Vocab artifact: ideaIndex, source hash A/X/B đã đạt, promptVersion, status queued/ready/failed, nhóm A/X/B, mỗi nhóm đúng hai {phrase, meaningVi}. Kiểm mỗi phrase ≤5 từ. Không nhận ý 2 khi job thuộc ý 1; chưa ready không gửi nội dung từ vựng tới frontend. Lỗi vocab cho thử lại đúng job mà không chấm lại X.

## 6. Thiết kế n8n mới

Đề xuất tạo đường web riêng, giữ năm webhook Docs và nhánh Lesson 7. Không fork năm bản có luật mở khóa độc lập. Backend giữ tiến độ; n8n chỉ nhận/chấm một snapshot và trả kết quả.

1. **“Lesson 5 · Nhận bài từ web”**: webhook POST được backend xác thực → validate schema và khóa nguồn → switch topic/B/A/X → chuẩn hóa input → gọi bộ prompt đúng bước qua dispatcher đã pin → kiểm operation_key → validate JSON kết quả → callback backend → GET readback xác nhận đúng attempt/section/hash → kết thúc. Backend nhận request người học và trả 202 trước; học viên không mở URL n8n hay giữ kết nối để đợi AI.
2. **“Lesson 5 · Gợi ý từ vựng cho một ý”**: nhận đúng vocab job khi ba điểm đã đạt → lấy A/X/B từ snapshot đã khóa → Gemini structured theo rubric hiện hành → validate 3 nhóm × 2 cụm, ≤5 từ → callback → readback. Không viết vào bảng Docs.
3. **“Lesson 5 · Báo lượt chấm cần kiểm tra”**: Error Trigger, ghi trạng thái đúng attempt/job và kênh vận hành đã có; chống cảnh báo trùng. Không tự thêm thông báo qua email/Slack trong đợt plan này.

Prompt Topic giữ bao quát cả hai idea. Prompt B1 chỉ nhận xét điểm cuối ý 1, tính cụ thể và liên quan idea. Prompt B2 nhận thêm B1 đã duyệt để check cụ thể, độc lập/không trùng, thống nhất hướng đánh giá; nếu ngược hướng phải giải thích cảnh báo nhượng bộ theo rubric, không chấm lại B1. Prompt A chỉ nhận xét sự bám đề/điểm đầu của ý đó, không sửa B. Prompt X chỉ nhận xét cầu nối ý đó, không đề nghị đổi A/B đã đạt. Lịch sử chỉ của đúng step/idea. Giữ Target 5.0–6.5, tiếng Việt, câu hỏi Socratic, không viết hộ; Topic cần thuật ngữ bao trùm, không liệt kê chi tiết hai idea, không hứa thêm ý. A chỉ cần làm điểm xuất phát có thể nối qua X, không bắt A sinh B ngay lập tức. Feedback tối đa 150 chữ cho bước đang chấm, dừng khi đã đủ ZPD; vocab theo 5.0–7.0.

Đã xác minh trực tiếp prompt live ngày 05/10/2026: B2 còn ví dụ đề sức khỏe; lịch sử Comment A2 lần 1 tham chiếu commentLan2.diemDauY1. Khi triển khai phải loại ví dụ ngoài đề và ánh xạ history đúng ideaIndex/section. Không mang nguyên lỗi này vào web; thêm fixture B2 trùng/ngược hướng và lịch sử A1 khác A2 vào P3/P4.

Thay các node đọc/paste/copy Apps Script của đường web bằng snapshot/callback/backend readback. Thay nhánh đếm 👍 bằng `resultStatus` và criterion/schema được kiểm; không coi chữ “đạt” trong feedback là khóa mở. Biểu tượng 👍 vẫn có thể hiển thị trong nhận xét nhưng không điều khiển tiến độ.

Idempotency: operation key theo attemptRef + stage + promptVersion, giữ nguyên khi retry mất phản hồi; đổi học viên/ý/bước không được dùng cùng key. Lease, timeout và retry phải phù hợp dispatcher; đối soát attempt/AI-call trước retry nếu trạng thái unknown. Callback lặp không nhân Comment, vocab hoặc mở khóa. Tối đa ba retry kỹ thuật theo cơ chế Writing đã có; hết lượt hiển thị cần kiểm tra và cho giáo viên xem.

## 7. Vận hành, tải và phục hồi

Đường chính: Pages → Writing API/PostgreSQL → n8n/dispatcher → callback API → UI đọc kết quả. Giả định kiểm thử ban đầu: một lớp 30 người cùng check, 30 request trong 10 giây; chưa có số đo tải lớp/chi phí live, phải đo trước phát hành. Mỗi session/section chỉ một attempt pending; nguồn enqueue transactional/outbox nếu đường hiện hành cần chống mất job. Không tăng suất Gemini/n8n trước khi kiểm giới hạn instance hiện tại.

Mục tiêu đề xuất: ACK API dưới 3 giây trong fixture tải, AI có nhãn chờ; sau 2 phút nói đang xử lý lâu, không bảo học viên nộp lại; quá 10 phút đưa vào hàng kiểm tra. Dùng polling Writing hiện hành: 2 giây đầu 20 giây, 5 giây tới 2 phút, 10 giây sau; jitter/Retry-After, dừng khi tab ẩn. Các mốc phải đối chiếu timeout và lease thực trước chốt cấu hình.

Lưu local sau khoảng 500 ms; server autosave theo cơ chế đã có (10 phút) và ngay khi Check/Lưu/Đóng. Nhãn phân biệt “Đã giữ trên thiết bị” và “Đã lưu máy chủ”. Local key theo activity + classRef + studentRef. Token bài giữ theo cơ chế API hiện hành; không đưa token lên query/log/source public. Chọn tên là xác nhận người học như Progress Log; nếu cần chống chọn hộ phải chốt cơ chế PIN/đăng nhập thêm trước production, không tuyên bố demo có xác thực thật.

API down: giữ nháp, báo chưa lưu máy chủ. n8n/AI down: attempt lỗi kỹ thuật, giữ bài, không tính là bài sai. Callback mất: retry callback cùng key sau đối soát. Vocab down: giữ ba điểm đạt, thử lại riêng. Hai tab: 409 dừng ghi. Giáo viên xem attemptRef, section, idea, tuổi job và lỗi; log không chứa toàn bộ bài hay credential. Owner dự kiến: quản trị hệ Writing; cần gán người trực trước rollout.

## 8. Các lát triển khai và kiểm chứng

| Task | Module | Nhận → tạo | Phụ thuộc | Bằng chứng để xong |
|---|---|---|---|---|
| D1 · Demo + plan | UI, tiến độ mô phỏng | Docs/mẫu/yêu cầu → trang thử riêng | Không | Test khóa B/A/X, login/confirm, comment, reload; desktop/mobile |
| P1 · Manifest bài + contract | Bài, nhận xét | plan-v1 → manifest/data fixture | D1 được review | Đủ 7 section, prerequisites, lịch sử và vocab một ý; validator |
| P2 · Lát Topic xuyên hệ thống | Nhận diện, bài, điều phối, UI | P1 → chọn tên/lưu/chấm Topic thật ở test | P1 | roster/quyền, save409, empty, pass/revise/technical/duplicate/stale callback, readback |
| P3 · Ý 1 và vocab | Bài, điều phối, nhận xét, UI | P2 → B1/A1/X1/vocab1 | P2 | Không chấm A trước B, X trước A, không lộ vocab trước đủ; vocab lỗi retry riêng |
| P4 · Ý 2 và hoàn tất | Các module như P3 | P3 → B2/A2/X2/vocab2/tổng hợp | P3 | Không lẫn ý, tên dài/mobile, reload, lịch sử từng bước, song song hai học viên |
| P5 · Pilot + release | Vận hành và tất cả consumer | P4 → gói triển khai có rollback | P4 | full suite Writing hiện tại + ca mới, n8n execution + readback, tải30, attendance guard nếu API chung, quan sát lớp |

Mỗi task production có `plan_revision=plan-v1`; decision_inputs gồm luật tuần tự, khóa phần đạt, contract callback và roster đã xác minh. Nếu contract/luật đổi, P1–P5 chịu ảnh hưởng chuyển stale và lập lại phần liên quan. Không dùng kết quả demo làm chứng nhận backend/n8n thật.

Review Focus: (1) đúng học viên/ý/bước và snapshot; (2) server chặn vượt bước; (3) callback/lease/retry không ghi trùng hoặc mở khóa sai; (4) không mất nháp/Comment khi đổi thiết bị/tab; (5) không đụng Lesson 7/Docs cũ/điểm danh dùng chung. Mỗi mục nối các ca P2–P5 tương ứng. Rà độc lập bắt buộc khi bước sang triển khai nhiều interface thật theo cổng chất lượng.

Ca demo: T-FLOW đủ 7 bước; T-LOCK không vượt điều kiện; T-INVALID ô trống; T-HISTORY sửa và giữ snapshot; T-ASYNC không nhận kết quả của bài đã đổi/reset; T-RESTORE reload đúng người/tiến độ; T-UI login, confirm, desktop/mobile/focus; T-ERROR lỗi kỹ thuật và thử lại không tăng fail; T-VOCAB đúng cấu trúc và chỉ mở sau ba điểm. Native runner `node --test writing-handouts/lesson5-demo/core.test.mjs`; browser Playwright CLI localhost. Full suite áp dụng cho demo là toàn bộ các ca này, không thay suite production.

Rollback demo: bỏ route demo/worktree riêng. Rollout thật: thêm manifest và workflow web inactive trước; chỉ bật cho lớp pilot đã duyệt, giữ URL Docs; rollback bằng tắt scope web và quay link Docs, giữ database/history đã có. Trước production: private snapshot live n8n trước/sau, sanitized source trên branch, validate/test/readback theo quy trình 10 bước, backup database và container cấu hình. Không reset bài học viên để rollback.

## 9. Cách xem bản HTML

Mở `index.html` qua server HTTP tĩnh tại root Pages. Nút “Xem bài mẫu” giúp xem bố cục; “Chọn tình huống xem thử” có bài trống, cần sửa, xong ý 1, hoàn tất. Nút Check tạo nhận xét mô phỏng theo lựa chọn trong thanh demo; không đánh giá chất lượng văn bản bằng AI. Nháp demo chỉ trên trình duyệt hiện tại. Bảng từ vựng demo là fixture minh họa cho mẫu ý; sản phẩm thật phải sinh từ nội dung được duyệt của mỗi học viên.

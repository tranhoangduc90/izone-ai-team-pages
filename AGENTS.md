# AGENTS.md — izone-ai-team-pages (Frontend Pages)

## 1. Phạm vi

Frontend HTML tĩnh + JS thuần xuất bản bằng GitHub Pages. Không dùng framework. Không phải
nguồn sự thật cho attempt, deadline, điểm hay quyền truy cập — backend giữ trạng thái nghiệp vụ.

- `term-tests/`: Term Test 1/2, Mini Test Buổi 5, Webtest 34, dashboard giáo viên (teacher,
  teacher-k56), landing.
- `progress-log/`: phiếu điểm danh + dashboard giảng viên (student `index.html` + `teacher.html`).
- `writing-handouts/`: web app luyện Writing Task 1/2 (package + manifest riêng, dùng
  `writing-api` ngoài snapshot — không gọi `backend-term-test`).
- `ai-gateway-dashboard/`: dashboard vận hành có Google Auth.
- Root pages `check-now*.html`, `vocab*.html`: chấm Reading/Listening/Vocab qua webhook n8n.
- `tests/`: test frontend mọi route (`.mjs`/`.cjs`, `node --test`).

Khi task chạm API backend của Term Test/learning, backend nằm ở `../backend-term-test/` — đọc
`../backend-term-test/AGENTS.md` và `../ARCHITECTURE.md` trước khi kết luận contract.

## Preset Progress Log hiện hành

Với `progress-log/`, đọc [preset chuẩn Thủy](docs/progress-log-thuy-preset.md) trước sửa/render/phát hành. Nguồn chuẩn là demo `progress-log/thuy-review/` đã được Đức chỉnh và duyệt từng luồng, cùng lựa chọn trong preset. Không thay bằng editor/khung cũ hoặc chỉ copy màu/font. Số câu phải là nhãn riêng; nhóm câu con giữ ID/payload. Kiểm hình thức và hành vi riêng, không dùng số test thay bằng chứng giống demo. Hồ sơ master đầy đủ tại `E:/Codex-Data/design-presets/progress-log-thuy-20261020/` trên máy Đức.

## 2. Quy tắc route term-tests

- Mọi sửa đổi hoặc bài Term/Mini K56/K67 mới phải đọc [hợp đồng nộp/phục hồi và checklist tạo bài](docs/TERM_MINI_SUBMISSION_2026-10-23.md). Dùng `shared/section-submission.mjs` qua adapter đúng khóa, giữ storage/identity/generation, Writing, controller K56 v2 và owner/hold K67. Giữ hồi quy nộp, pending storage, cache và bài cũ trong cả hai manifest; thêm cấu hình bài mới vào ca kiểm phù hợp và allowlist API. Không dùng HTTP 200 đơn thuần làm xác nhận đã lưu hoặc copy handler trước bản sửa. Bài/nháp/điểm cũ phải còn nguyên sau thay đổi; mock không chứng minh Portal/thiết bị thật đã đạt.

- Trọng tâm 03–45: `webtest-34/` + `34-shared/` là prototype demo tĩnh (LOCAL_DEMO_ONLY);
  `progress-log/` là frontend learning platform. Khối 56/67 (term-test-1/2, mini-test,
  answer-sheet, teacher) là tham chiếu — không thêm tính năng mới khi chưa được yêu cầu.
- Route computer-based nạp asset bằng đường dẫn tương đối. `shared/` (app.js, config.js,
  attempt-review.js) là module dùng chung — **không fork** khi tạo route mới.
- `term-test-2-computer-based/` là bộ nạp chuẩn: `term-test-1-computer-based/` và
  `mini-test-lesson-5-computer-based/` tái dùng `shared/config.js` + bootstrap/audio-loader của
  nó, chỉ thay `test-config.js`.
- `term-test-1-k56-computer-based/` dùng `k56-shared/` (config + app.js riêng, API demo
  `mapping-api-demo`), **không** dùng `shared/`. `teacher-k56/` dùng `k56-shared/config.js`
  nhưng vẫn dùng chung `shared/attempt-review.js`.
- `test-config.js` chỉ khai báo control/range, **không bao giờ** chứa answer key hoặc dữ liệu
  riêng tư. Content demo (`webtest-34/content.js`, `34-test-content.js`, K56 content) là mẫu
  giả lập — câu/đáp án thật do máy chủ cấp theo phiên.
- Nếu Webtest 34 nhận definition đúng HTTP nhưng Listening hoặc các phần sau bị lệch
  field, đọc `../docs/WEBTEST34_CONTENT_DRIFT.md`. Đối chiếu block/position từ API
  với canonical 96/9 trước khi sửa `learning-key-map.js`; không thêm fallback position
  để che một assignment database cũ.
- Answer-sheet, K56, Mini Test, Webtest 34 và Writing là biến thể độc lập. Không đổi hành vi của
  chúng khi sửa route khác nếu chưa truy vấn impact graph (`get_impact_radius`,
  `get_affected_flows`) và test tương ứng.

## 3. Bảo mật frontend

- Không chứa token, credential, API key, đáp án hoặc dữ liệu định danh học viên trong HTML/JS.
- Google ID token chỉ trong bộ nhớ tab; token phiếu nằm sau `#` (fragment), không trong query.
- Trang gọi n8n (check-now/vocab) chỉ biết URL webhook; credential Google Docs/Lark nằm trong n8n.
- CSP hiện có trong từng `index.html` — giữ nguyên khi thêm tài nguyên.

## 4. Kiểm thử cục bộ

```bash
cd izone-ai-team-pages
node --test tests/term-test-reliability.mjs   # và các test .mjs/.cjs khác trong tests/
```

Test trong `writing-handouts/` chạy riêng bằng package của nó:

```bash
cd writing-handouts
npm test
npm run check
```

- Không ghi "pass" nếu chưa chạy trong lượt hiện tại.
- QA browser/live (desktop, mobile hẹp, reload, lỗi mạng, hết giờ, double-submit) chỉ được báo
  là đạt khi thực sự chạy; test tĩnh không thay thế acceptance.
- Docs-only thay đổi: kiểm tra Markdown, đường dẫn và lệnh trong tài liệu, không cần test ứng dụng.

## 5. Git

`izone-ai-team-pages/` là Git checkout lồng — đây là nơi duy nhất được commit/push khi người dùng
yêu cầu rõ. Kiểm tra `git status` trước; chỉ stage file thuộc phạm vi yêu cầu; giữ WIP không liên
quan. Không commit từ thư mục gốc snapshot.

## 6. Sau khi sửa

1. Xem diff chỉ trong file được phép.
2. Chạy test phù hợp (mục 4).
3. Gọi `build_or_update_graph_tool` ở root snapshot để cập nhật graph.
4. Báo cáo ngắn: file đã sửa, test đã chạy, kết quả, phần chưa xác minh.

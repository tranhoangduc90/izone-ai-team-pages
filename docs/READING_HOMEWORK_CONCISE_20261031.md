# Reading Homework: concise wording, 31 October 2026

This package continues the approved TFNG wording work across five other Homework lessons. It changes frontend presentation only. Question text, passages, option values, target IDs, content versions, minimum completion thresholds, grading, identity, drafts and submitted work keep their existing contracts.

| Lesson | Presentation changes | Requirements retained |
|---|---|---|
| Materials / Matching Information | Nén câu hỏi; Nén cấp 1 câu dẫn chứng; Đoạn chứa thông tin; expandable syntax and per-question hints | Information classification, object and feature; paragraph selection |
| Green roofs | Short level 1/2 labels, method reminder in one place | Choose TWO checklist, two distinct answers and two slots |
| The Desolenator | Shared compression guide; concise Share actions and gate explanation | Server-accepted ChatGPT prerequisite, two compression levels and heading bank |
| Materials / Matching People | Short person/location/question labels; remove repeated single-statement heading | Letter/name values, reusable letters and the order of two statements |
| Athletes and stress | Từ khóa chính/phụ; shared compression instructions | ONE WORD ONLY, three predicted paraphrases, separate saved diagnostic excluded from threshold |

All five use answered background `#DFF4E9`, border `#80C6AA`, and white empty controls. The engine's existing blank normalization drives these states. The optional diagnostic also gets a color without being counted as a graded target. A green field means answered, not correct. Per-field status remains accessible; total progress and Rà soát stay visible. The native focus outline and feedback states remain distinct.

The duplicate header Notes control and repeated passage title are hidden only in this profile. Learner identity remains visible, while teacher views keep their explicit role. Long result statistics move behind Chi tiết kết quả; feedback per field, repair navigation, Homework sync failures and newer-draft/older-attempt context remain available. Sửa bài is the consistent edit action. The legacy Materials root entry loads the same profile.

TFNG retains PR397's wording, three required labels, NG guidance and renderer-specific color rules. Its entry does not load the new stylesheet.

## Validation and preservation

Read-only native snapshots before the change contain 21 drafts, 32 attempts, 32 results and 32 jobs across six lessons. Private payloads stay outside this public repository. `tests/reading-homework-concise-browser.mjs` opens all 53 saved cases through real renderers with an isolated client, checks exact values and readonly results, and blocks external writes. It separately checks blank/whitespace/fill/clear/select colors, focus/selection/reading position across three save events, 18px Homework presentation and widths 1440/390/320 including the legacy root entry.

Other relevant suites cover Green roofs checklist/save/reload, Desolenator prerequisite states, Sentence Completion diagnostic/limits/revision cycle, TFNG's five viewports, Materials operation statuses, and owner/role entry. This is isolated browser verification, not real learner submission, AI grading, Google login or physical-phone acceptance.

Release is coordinated with the Lesson 12 investigation. Integrate after owner-entry PR398 and retain its access cache binding and identity logic. Public asset readback and a second read-only record/hash comparison are required to describe the published state; see the project-memory release receipt for the actual commit and evidence paths. Reverting this presentation package must not revert owner entry, reset drafts or restore an old database snapshot.

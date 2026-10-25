import { hasMeaningfulText } from "./core.js";

export function sectionDefinitions(manifest = {}) {
  return Array.isArray(manifest.sections) ? manifest.sections : [];
}

export function fieldDefinitions(manifest = {}) {
  return sectionDefinitions(manifest).flatMap((section) => section.fields || []);
}

export function blankLessonProgress(manifest = {}) {
  const responses = Object.fromEntries(fieldDefinitions(manifest).map((field) => [field.key, ""]));
  const sections = Object.fromEntries(sectionDefinitions(manifest).map((section) => [section.key, {
    status: "draft",
    attemptsWithoutPass: 0,
  }]));
  return { revision: 0, responses, sections, comments: [], attempts: [], updatedAt: null };
}

export function normalizeLessonProgress(value = {}, manifest = {}) {
  const blank = blankLessonProgress(manifest);
  const sourceSections = Array.isArray(value.sections)
    ? Object.fromEntries(value.sections.map((item) => [item.section, item]))
    : value.sections || {};
  for (const section of sectionDefinitions(manifest)) {
    const source = sourceSections[section.key] || {};
    blank.sections[section.key] = {
      status: ["draft", "queued", "technical_error", "revision", "passed"].includes(source.status) ? source.status : "draft",
      attemptsWithoutPass: Number.isInteger(source.attemptsWithoutPass) ? source.attemptsWithoutPass : Number(source.failStreak || 0),
    };
  }
  const responses = value.responses || value.responseData || {};
  for (const field of fieldDefinitions(manifest)) {
    blank.responses[field.key] = typeof responses[field.key] === "string" ? responses[field.key] : "";
  }
  blank.revision = value.draftVersion ?? value.version ?? value.revision ?? 0;
  blank.comments = Array.isArray(value.comments) ? value.comments : [];
  blank.attempts = Array.isArray(value.attempts) ? value.attempts : [];
  const latestAttempts = new Map();
  for (const attempt of blank.attempts) {
    if (!attempt?.section || !blank.sections[attempt.section]) continue;
    const current = latestAttempts.get(attempt.section);
    const attemptTime = Date.parse(attempt.createdAt || attempt.created_at || "") || 0;
    const currentTime = Date.parse(current?.createdAt || current?.created_at || "") || 0;
    const attemptNumber = Number(attempt.commentNumber || attempt.comment_number || 0);
    const currentNumber = Number(current?.commentNumber || current?.comment_number || 0);
    if (!current || attemptTime > currentTime || (attemptTime === currentTime && attemptNumber > currentNumber)) {
      latestAttempts.set(attempt.section, attempt);
    }
  }
  for (const [section, attempt] of latestAttempts) {
    if (blank.sections[section].status === "passed") continue;
    if (["queued", "leased"].includes(attempt.status)) blank.sections[section].status = "queued";
    else if (attempt.status === "failed") blank.sections[section].status = "technical_error";
  }
  blank.updatedAt = value.updatedAt || value.updated_at || null;
  return blank;
}

export function sectionIsFilled(section, responses = {}) {
  const required = Array.isArray(section.requiredFields) && section.requiredFields.length
    ? section.requiredFields
    : (section.fields || []).map((field) => field.key);
  const filled = required.map((key) => hasMeaningfulText(responses[key]));
  return section.validationMode === "any" ? filled.some(Boolean) : filled.length > 0 && filled.every(Boolean);
}

export function sectionPrerequisitesPassed(section, sections = {}) {
  const prerequisites = Array.isArray(section.prerequisites) ? section.prerequisites : [];
  return prerequisites.every((key) => sections?.[key]?.status === "passed");
}

export function claimSectionSubmission(pendingSections, sectionKey) {
  if (pendingSections.has(sectionKey)) return false;
  pendingSections.add(sectionKey);
  return true;
}

export function sectionSubmitLabel(section = {}, status = "draft", submitting = false) {
  if (submitting) return "Đang gửi bài…";
  const draftResult = section.flow?.type === "draft-revision";
  if (status === "queued") return draftResult ? "Đang tạo kết quả — không cần bấm lại" : "Đang chấm — không cần bấm lại";
  if (status === "passed") return draftResult ? "Đã có kết quả chấm" : "Phần này đã đạt";
  if (status === "technical_error") return "Check lại";
  return draftResult ? "Gửi chấm Draft" : "Check";
}

export function gradingFailureMessage(attempt = {}) {
  if (attempt.status !== "failed") return "";
  return attempt.errorCode === "GRADING_TIMEOUT_3_MINUTES"
    ? "Lượt chấm vừa rồi mất quá 3 phút nên đã dừng. Em hãy bấm Check lại."
    : "Lượt chấm vừa rồi gặp lỗi. Em hãy bấm Check lại.";
}

export function vocabularyPrerequisitesPassed(vocabulary = {}, sections = {}) {
  const configured = vocabulary.unlockAfter;
  const prerequisites = Array.isArray(configured) ? configured : configured ? [configured] : [];
  return prerequisites.every((key) => sections?.[key]?.status === "passed");
}

export function responsesForSection(section, responses = {}) {
  return Object.fromEntries((section.fields || []).map((field) => [field.key, responses[field.key] || ""]));
}

export function fieldLabelMap(manifest = {}) {
  return Object.fromEntries(fieldDefinitions(manifest).map((field) => [field.key, field.label]));
}

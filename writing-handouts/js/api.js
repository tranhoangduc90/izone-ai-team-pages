import { createRequestId } from "./core.js";
import { teacherSessionRequestOptions } from "../../shared/teacher-session-client.js?rev=20260920-v1";

function endpoint(base, path) { return new URL(path.replace(/^\//, ""), base || window.location.href).toString(); }

export function parseRetryAfterMs(value, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - now) : null;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 304) return { data: null, etag: response.headers.get("etag"), notModified: true };
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Yêu cầu thất bại (${response.status}).`);
    error.status = response.status;
    error.data = data;
    error.retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    throw error;
  }
  return { data, etag: response.headers.get("etag") };
}

function jsonOptions(method, body, headers = {}, keepalive = false) {
  return { method, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), keepalive };
}

/** API adapter: all backend-specific paths and request mappings belong in this file. */
export function createApi(base = "") {
  const root = endpoint(base, "api/v1/");
  return {
    roster: (slug) => fetchJson(endpoint(root, `activities/${encodeURIComponent(slug)}/roster`)),
    registerProvisional: (activitySlug, classRef, displayName, pin, duplicateConfirmed = false, requestId = createRequestId()) => fetchJson(endpoint(root, `activities/${encodeURIComponent(activitySlug)}/provisional-students`), jsonOptions("POST", { classRef, displayName, pin, duplicateConfirmed, requestId })),
    createSession: (activitySlug, classRef, studentRef, accessCode) => fetchJson(endpoint(root, "sessions"), jsonOptions("POST", { activitySlug, classRef, studentRef, ...(accessCode ? { accessCode } : {}), requestId: createRequestId() })),
    session: (sessionRef) => fetchJson(endpoint(root, `sessions/${encodeURIComponent(sessionRef)}`)),
    draftResult: (sessionRef) => fetchJson(endpoint(root, `sessions/${encodeURIComponent(sessionRef)}/draft-result`)),
    saveDraft: (sessionRef, progress, keepalive = false) => fetchJson(endpoint(root, `sessions/${encodeURIComponent(sessionRef)}/draft`), jsonOptions("PUT", {
      baseVersion: progress.revision,
      overview: progress.texts.overview,
      body1: progress.texts.body1,
      body2: progress.texts.body2,
      draft1: progress.texts.draft1,
      draft2: progress.texts.draft2,
      draft2Unlocked: progress.draft2Unlocked,
      requestId: createRequestId(),
    }, progress.revision == null ? {} : { "if-match": String(progress.revision) }, keepalive)),
    checkSection: (sessionRef, section, snapshot, revision) => fetchJson(endpoint(root, `sessions/${encodeURIComponent(sessionRef)}/checks`), jsonOptions("POST", {
      section,
      requestId: createRequestId(),
      snapshot,
    }, revision == null ? {} : { "if-match": String(revision) })),
    attempt: (attemptRef, etag) => fetchJson(endpoint(root, `attempts/${encodeURIComponent(attemptRef)}`), { headers: etag ? { "if-none-match": etag } : {} }),
    retryAttempt: (attemptRef) => fetchJson(endpoint(root, `attempts/${encodeURIComponent(attemptRef)}/retry`), jsonOptions("POST", {})),
    teacherComments: (sessionRef, etag) => fetchJson(endpoint(root, `sessions/${encodeURIComponent(sessionRef)}/teacher-comments`), { headers: etag ? { "if-none-match": etag } : {} }),
    replyTeacherComment: (sessionRef, threadRef, body, requestId = createRequestId()) => fetchJson(endpoint(root, `sessions/${encodeURIComponent(sessionRef)}/teacher-comments/${encodeURIComponent(threadRef)}/replies`), jsonOptions("POST", { body, requestId })),
    publishLive: (sessionRef) => fetchJson(endpoint(root, `sessions/${encodeURIComponent(sessionRef)}/live`), jsonOptions("PUT", {}, {}, true)),
    beaconUrl: (sessionRef) => endpoint(root, `sessions/${encodeURIComponent(sessionRef)}/draft`),
  };
}

export function createLessonApi(base = "") {
  const root = endpoint(base, "api/v1/");
  return {
    roster: (slug) => fetchJson(endpoint(root, `activities/${encodeURIComponent(slug)}/roster`)),
    registerProvisional: (activitySlug, classRef, displayName, pin, duplicateConfirmed = false, requestId = createRequestId()) => fetchJson(endpoint(root, `activities/${encodeURIComponent(activitySlug)}/provisional-students`), jsonOptions("POST", { classRef, displayName, pin, duplicateConfirmed, requestId })),
    createSession: (activitySlug, classRef, studentRef, accessCode) => fetchJson(endpoint(root, "lesson-sessions"), jsonOptions("POST", {
      activitySlug,
      classRef,
      studentRef,
      ...(accessCode ? { accessCode } : {}),
    })),
    session: (sessionRef) => fetchJson(endpoint(root, `lesson-sessions/${encodeURIComponent(sessionRef)}`)),
    draftResult: (sessionRef) => fetchJson(endpoint(root, `lesson-sessions/${encodeURIComponent(sessionRef)}/draft-result`)),
    saveResponses: (sessionRef, progress, keepalive = false) => fetchJson(endpoint(root, `lesson-sessions/${encodeURIComponent(sessionRef)}/responses`), jsonOptions("PUT", {
      baseVersion: progress.revision,
      responses: progress.responses,
      requestId: createRequestId(),
    }, progress.revision == null ? {} : { "if-match": String(progress.revision) }, keepalive)),
    checkSection: (sessionRef, section) => fetchJson(endpoint(root, `lesson-sessions/${encodeURIComponent(sessionRef)}/checks`), jsonOptions("POST", {
      section,
      requestId: createRequestId(),
    })),
    publishLive: (sessionRef, activeField) => fetchJson(endpoint(root, `lesson-sessions/${encodeURIComponent(sessionRef)}/live`), jsonOptions("PUT", {
      activeField: activeField || null,
    }, {}, true)),
    attempt: (attemptRef, etag) => fetchJson(endpoint(root, `attempts/${encodeURIComponent(attemptRef)}`), { headers: etag ? { "if-none-match": etag } : {} }),
    retryAttempt: (attemptRef) => fetchJson(endpoint(root, `attempts/${encodeURIComponent(attemptRef)}/retry`), jsonOptions("POST", {})),
    teacherComments: (sessionRef, etag) => fetchJson(endpoint(root, `sessions/${encodeURIComponent(sessionRef)}/teacher-comments`), { headers: etag ? { "if-none-match": etag } : {} }),
    replyTeacherComment: (sessionRef, threadRef, body, requestId = createRequestId()) => fetchJson(endpoint(root, `sessions/${encodeURIComponent(sessionRef)}/teacher-comments/${encodeURIComponent(threadRef)}/replies`), jsonOptions("POST", { body, requestId })),
    beaconUrl: (sessionRef) => endpoint(root, `lesson-sessions/${encodeURIComponent(sessionRef)}/responses`),
  };
}

export function createTeacherApi(base = "") {
  const root = endpoint(base, "api/v1/");
  const teacherFetch = (url, options = {}) => fetchJson(url, teacherSessionRequestOptions(options));
  const teacherJson = (method, body, headers = {}, keepalive = false) => teacherSessionRequestOptions(jsonOptions(method, body, headers, keepalive));
  return {
    liveActivity: (slug, classRef = "") => {
      const url = new URL(endpoint(root, `admin/live/activities/${encodeURIComponent(slug)}`));
      if (classRef) url.searchParams.set("classRef", classRef);
      return teacherFetch(url);
    },
    liveSession: (sessionRef) => teacherFetch(endpoint(root, `admin/live/sessions/${encodeURIComponent(sessionRef)}`)),
    draftResult: (sessionRef) => teacherFetch(endpoint(root, `sessions/${encodeURIComponent(sessionRef)}/draft-result`)),
    provisionalStudents: (slug, classRef = "") => { const url = new URL(endpoint(root, `admin/activities/${encodeURIComponent(slug)}/provisional-students`)); if (classRef) url.searchParams.set("classRef", classRef); return teacherFetch(url); },
    searchOfficialStudents: (query, excludeStudentRef = "") => { const url = new URL(endpoint(root, "admin/official-students/search")); url.searchParams.set("q", query); if (excludeStudentRef) url.searchParams.set("excludeStudentRef", excludeStudentRef); return teacherFetch(url); },
    resetProvisionalCode: (studentRef) => teacherFetch(endpoint(root, `admin/provisional-students/${encodeURIComponent(studentRef)}/reset-code`), teacherJson("POST", {})),
    reconcileProvisional: (studentRef, officialStudentRef) => teacherFetch(endpoint(root, `admin/provisional-students/${encodeURIComponent(studentRef)}/reconcile`), teacherJson("POST", { officialStudentRef })),
    deleteProvisional: (studentRef) => teacherFetch(endpoint(root, `admin/provisional-students/${encodeURIComponent(studentRef)}/delete`), teacherJson("POST", {})),
    exportProgress: async (slug, classRef = "") => { const url = new URL(endpoint(root, `admin/activities/${encodeURIComponent(slug)}/export.csv`)); if (classRef) url.searchParams.set("classRef", classRef); const response = await fetch(url, teacherSessionRequestOptions()); if (!response.ok) throw new Error(`Không thể tải CSV (${response.status}).`); return response.blob(); },
    retryFailedAttempt: (attemptRef) => teacherFetch(endpoint(root, `admin/attempts/${encodeURIComponent(attemptRef)}/retry`), teacherJson("POST", {})),
    writingPairs: (classCode = "", teacherName = "", offset = 0, limit = 200) => { const url = new URL(endpoint(root, "admin/writing-flow/pairs")); if (classCode) url.searchParams.set("classCode", classCode); if (teacherName) url.searchParams.set("teacherName", teacherName); url.searchParams.set("offset", offset); url.searchParams.set("limit", limit); return teacherFetch(url); },
    writingPairsPage: (filters = {}) => { const url = new URL(endpoint(root, "admin/writing-flow/pairs")); for (const key of ["classCode", "teacherName", "stageKey", "stageStatus", "view", "taskType", "sourceKind", "search", "searchScope", "dateFrom", "dateTo", "cursorAt", "cursorId", "sort", "offset"]) { if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") url.searchParams.set(key, filters[key]); } if (filters.includeCompleted) url.searchParams.set("includeCompleted", "true"); url.searchParams.set("limit", filters.limit || 50); return teacherFetch(url); },
    writingCounts: (classCode = "", teacherName = "", sourceKind = "") => { const url = new URL(endpoint(root, "admin/writing-flow/counts")); if (classCode) url.searchParams.set("classCode", classCode); if (teacherName) url.searchParams.set("teacherName", teacherName); if (sourceKind) url.searchParams.set("sourceKind", sourceKind); return teacherFetch(url); },
    writingPairHistory: pairId => teacherFetch(endpoint(root, `admin/writing-flow/pairs/${encodeURIComponent(pairId)}/history`)),
    writingPairDetail: pairId => teacherFetch(endpoint(root, `admin/writing-flow/pairs/${encodeURIComponent(pairId)}/detail`)),
    writingSummary: () => teacherFetch(endpoint(root, "admin/writing-flow/summary")),
    writingClassCoverage: () => teacherFetch(endpoint(root, "admin/writing-flow/class-coverage")),
    writingClasses: (view = "active") => { const url = new URL(endpoint(root, "admin/writing-flow/classes")); url.searchParams.set("view", view); return teacherFetch(url); },
    writingFilterOptions: () => teacherFetch(endpoint(root, "admin/writing-flow/filter-options")),
    writingDailyStats: (filters = {}) => { const url = new URL(endpoint(root, "admin/writing-flow/daily-stats")); for (const key of ["classCode", "teacherName", "taskType", "sourceKind", "dateFrom", "dateTo"]) { if (filters[key]) url.searchParams.set(key, filters[key]); } return teacherFetch(url); },
    writingReviews: (filters = {}) => { const url = new URL(endpoint(root, "admin/writing-flow/reviews")); for (const key of ["classCode", "teacherName", "stageKey", "search"]) { if (filters[key]) url.searchParams.set(key, filters[key]); } url.searchParams.set("offset", filters.offset || 0); url.searchParams.set("limit", filters.limit || 100); return teacherFetch(url); },
    writingSourceIssues: (filters = {}) => { const url = new URL(endpoint(root, "admin/writing-flow/source-issues")); for (const key of ["classCode", "teacherName", "search", "reasonCode", "status"]) { if (filters[key]) url.searchParams.set(key, filters[key]); } url.searchParams.set("offset", filters.offset || 0); url.searchParams.set("limit", filters.limit || 100); return teacherFetch(url); },
    writingWorkflowFailures: (offset = 0, limit = 200) => { const url = new URL(endpoint(root, "admin/writing-flow/workflow-failures")); url.searchParams.set("offset", offset); url.searchParams.set("limit", limit); return teacherFetch(url); },
    writingOperatorEvents: (filters = {}) => { const url = new URL(endpoint(root, "admin/writing-flow/operator-events")); for (const key of ["classCode", "eventType"]) { if (filters[key]) url.searchParams.set(key, filters[key]); } url.searchParams.set("offset", filters.offset || 0); url.searchParams.set("limit", filters.limit || 100); return teacherFetch(url); },
    retryWritingReview: (reviewId, requestId = createRequestId()) => teacherFetch(endpoint(root, `admin/writing-flow/reviews/${encodeURIComponent(reviewId)}/retry`), teacherJson("POST", { requestId })),
    retryWritingSourceIssue: (issueKey, requestId = createRequestId()) => teacherFetch(endpoint(root, `admin/writing-flow/source-issues/${encodeURIComponent(issueKey)}/retry`), teacherJson("POST", { requestId })),
    skipWritingSourceIssue: (issueKey, reason, requestId = createRequestId()) => teacherFetch(endpoint(root, `admin/writing-flow/source-issues/${encodeURIComponent(issueKey)}/skip`), teacherJson("POST", { reason, requestId })),
    restoreWritingSourceIssue: (issueKey, reason, requestId = createRequestId()) => teacherFetch(endpoint(root, `admin/writing-flow/source-issues/${encodeURIComponent(issueKey)}/restore`), teacherJson("POST", { reason, requestId })),
    addWritingManualSource: (payload, requestId = createRequestId()) => teacherFetch(endpoint(root, "admin/writing-flow/manual-sources"), teacherJson("POST", { ...payload, requestId })),
    skipWritingPair: (pairId, reason, requestId = createRequestId()) => teacherFetch(endpoint(root, `admin/writing-flow/pairs/${encodeURIComponent(pairId)}/skip`), teacherJson("POST", { reason, requestId })),
    restoreWritingPair: (pairId, reason, requestId = createRequestId()) => teacherFetch(endpoint(root, `admin/writing-flow/pairs/${encodeURIComponent(pairId)}/restore`), teacherJson("POST", { reason, requestId })),
    retryWritingPairStage: (pairId, stageKey, reason, requestId = createRequestId()) => teacherFetch(endpoint(root, `admin/writing-flow/pairs/${encodeURIComponent(pairId)}/retry`), teacherJson("POST", { stageKey, reason, requestId })),
    writingLegacy: (classCode = "", offset = 0, limit = 50) => { const url = new URL(endpoint(root, "admin/writing-flow/legacy")); if (classCode) url.searchParams.set("classCode", classCode); url.searchParams.set("offset", offset); url.searchParams.set("limit", limit); return teacherFetch(url); },
    requestWritingClassScan: (classCode, reason, requestId = createRequestId()) => teacherFetch(endpoint(root, `admin/writing-flow/classes/${encodeURIComponent(classCode)}/scan`), teacherJson("POST", { reason, requestId })),
    teacherComments: (sessionRef, etag) => teacherFetch(endpoint(root, `admin/live/sessions/${encodeURIComponent(sessionRef)}/teacher-comments`), { headers: etag ? { "if-none-match": etag } : {} }),
    createTeacherComment: (sessionRef, payload) => teacherFetch(endpoint(root, `admin/live/sessions/${encodeURIComponent(sessionRef)}/teacher-comments`), teacherJson("POST", payload)),
    replyTeacherComment: (threadRef, body, requestId = createRequestId()) => teacherFetch(endpoint(root, `admin/teacher-comments/${encodeURIComponent(threadRef)}/replies`), teacherJson("POST", { body, requestId })),
    setTeacherCommentStatus: (threadRef, status, requestId = createRequestId()) => teacherFetch(endpoint(root, `admin/teacher-comments/${encodeURIComponent(threadRef)}/status`), teacherJson("POST", { status, requestId })),
    reopenSection: (sessionRef, section, reason) => teacherFetch(endpoint(root, `admin/lesson-sessions/${encodeURIComponent(sessionRef)}/sections/${encodeURIComponent(section)}/reopen`), teacherJson("POST", { reason })),
  };
}

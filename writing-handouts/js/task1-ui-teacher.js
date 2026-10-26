import {createTeacherAuthState} from "../../shared/teacher-auth-state.js?v=20261026-startup1";
import { createTeacherApi } from "./task1-ui-api.js?rev=20260920-server-session-v1&startup=20261026-v1";
import { classQuery, resolveClassRef } from "./class-selection.js";
import { createRequestId, hasMeaningfulText, safeLmsUrl } from "./core.js?v=20260921-draft-result-v1";
import { sectionDefinitions } from "./lesson-core.js";
import { appendMarkdown } from "./markdown.js?v=20260818-numbering-v3";
import { commentsForSection, isBackdropClick, latestVocabularyRows, mergeTeacherStudentDetail, technicalRecoveryMessage } from "./teacher-detail-core.js?v=20260920-student-detail-v1";
import { groupStudents } from "./teacher-progress.js";
import { teacherAuthFailure } from "./teacher-auth-ui.js";
import { selectionOffsets, threadsForField } from "./teacher-comments-core.js";
import { createTeacherCommentThreadCard, renderAnnotatedText, masterScrollBehavior } from "./teacher-comments-ui.js?v=20261024-master170-thread2";
import { renderLmsDraftResult } from "./lms-draft-result.js?v=20260818-numbering-v3";
import { createVocabularySection, manifestVocabularyRows } from "./vocabulary-ui.js?v=20260818-vocabulary-scroll";
import { createTeacherLoginPreference } from "../../shared/teacher-login-preference.js?rev=20260918-v1";
import { createTeacherSessionClient } from "../../shared/teacher-session-client.js?rev=20261026-startup1";

import { renderTimeline, installTeacherTools, filterStudents, decorateTeacher } from "./task1-ui.js?v=20261025-rollout1";
const $ = (id) => document.getElementById(id);
const authView=createTeacherAuthState({panel:$("teacher-login"),notice:$("teacher-updated"),retry:()=>location.reload()});
const loginPreference = createTeacherLoginPreference(() => window.localStorage);
const state = { authenticated: false, api: null, sessionClient: null, manifest: null, activitySlug: "", students: [], pollTimer: null,
  selectedStudent: null, detailRequestId: 0, focusSection: "", pending: [], canManage: false, draftResults: new Map(),
  requestedClass: "", classQueryResolved: false, classQueryError: "", reconciliationSearches: new Map(), loginGeneration: 0 };

function teacherDefinitions() {
  const dynamic = sectionDefinitions(state.manifest);
  if (dynamic.length) return dynamic;
  return [
    { key: "overview", title: "Overview", kicker: "Task 1", instruction: "Tổng quan nổi bật", fields: [{ key: "overview", label: "Overview" }] },
    { key: "outline", title: "Body Outline", kicker: "Task 1", instruction: "Dàn ý hai thân bài", fields: [{ key: "body1", label: "Body 1" }, { key: "body2", label: "Body 2" }] },
    { key: "draft", title: "Draft", kicker: "Task 1", instruction: "Draft 1 và Draft 2", fields: [{ key: "draft1", label: "Draft 1" }, { key: "draft2", label: "Draft 2" }] }
  ];
}

function teacherBodies() {
  return state.manifest.bodies?.length ? state.manifest.bodies : [{ key: "task1", title: "Bài làm Task 1", description: "", sectionKeys: teacherDefinitions().map(item => item.key) }];
}

function showLoginError(value = "") { const node = $("teacher-login-error"); node.hidden = !value; node.textContent = value; }
function showDashboardError(value = "") { const node = $("teacher-error"); node.hidden = !value; node.textContent = value; }

function studentStatus(student) {
  const sections = Object.values(student.sections || {});
  if (sections.some((section) => section.status === "queued")) return "queued";
  if (sections.some((section) => section.status === "technical_error")) return "technical_error";
  if (sections.some((section) => section.status === "revision")) return "revision";
  if (sections.length && sections.every((section) => section.status === "passed")) return "passed";
  if (Object.values(student.responses || {}).some(hasMeaningfulText)) return "writing";
  return "not_started";
}

function statusLabel(status) {
  return ({ not_started: "Chưa làm", writing: "Đang viết", queued: "Đang chấm", technical_error: "Lỗi chấm", revision: "Cần sửa", passed: "Đã đạt" })[status] || "Chưa làm";
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Chưa có";
}

function populateClasses(students) {
  const select = $("teacher-class");
  const current = select.value;
  const existing = new Set([...select.options].map((option) => option.value));
  const classes = new Map(students.map((student) => [student.classRef, student.className]));
  for (const [classRef, className] of classes) {
    if (existing.has(classRef)) continue;
    const option = document.createElement("option"); option.value = classRef; option.textContent = className; select.append(option);
  }
  if ([...select.options].some((option) => option.value === current)) select.value = current;
  return [...classes].map(([classRef, className]) => ({ classRef, className }));
}

function renderSummary(students) {
  const root = $("teacher-summary");
  root.replaceChildren();
  const support = document.createElement("button"); support.type = "button"; support.className = "teacher-summary-card"; support.dataset.state = "support";
  const supportCount = document.createElement("strong"); supportCount.textContent = String(students.filter(item => item.supportRequired).length);
  const supportLabel = document.createElement("span"); supportLabel.textContent = "Cần hỗ trợ"; support.append(supportCount, supportLabel);
  support.addEventListener("click", () => document.querySelector('[data-group="support"]')?.scrollIntoView({ behavior: masterScrollBehavior(), block: "start" })); root.append(support);
  const statuses = ["not_started", "writing", "queued", "technical_error", "revision", "passed"];
  for (const status of statuses) {
    const card = document.createElement("article");
    card.className = "teacher-summary-card";
    card.dataset.state = status;
    const count = document.createElement("strong"); count.textContent = String(students.filter((student) => studentStatus(student) === status).length);
    const label = document.createElement("span"); label.textContent = statusLabel(status);
    card.append(count, label); root.append(card);
  }
}

function renderStudents(students) {
  students=filterStudents(students,studentStatus);
  const root = $("teacher-students");
  root.replaceChildren();
  if (!students.length) {
    const empty = document.createElement("p"); empty.className = "card muted"; empty.textContent = "Chưa có học viên trong phạm vi đã chọn."; root.append(empty); return;
  }
  for (const group of groupStudents(students)) {
    if (!group.students.length) continue;
    const section = document.createElement("section"); section.className = "teacher-group"; section.dataset.group = group.key;
    const groupTitle = document.createElement("h2"); groupTitle.className = "teacher-group-title"; groupTitle.textContent = `${group.title} · ${group.students.length}`; section.append(groupTitle);
    for (const student of group.students) {
    const status = studentStatus(student);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "teacher-student-card";
    card.dataset.commentContext = commentContext(student);
    card.dataset.state = status;
    card.dataset.priority = student.supportRequired ? "support" : "normal";
    card.dataset.started = String(Boolean(student.hasStarted));
    const header = document.createElement("span"); header.className = "teacher-student-header";
    const name = document.createElement("strong"); name.textContent = student.displayName;
    const badge = document.createElement("span"); badge.className = "section-status"; badge.dataset.state = status; badge.textContent = statusLabel(status);
    header.append(name, badge);
    const className = document.createElement("span"); className.className = "muted"; className.textContent = student.className;
    const meta = document.createElement("span"); meta.className = "teacher-student-meta";
    meta.textContent = `${student.online ? "Đang hoạt động" : "Không hoạt động"} · Lưu gần nhất: ${formatTime(student.savedAt)} · ${student.checkCount || 0} lần Check`;
    const progress = document.createElement("span"); progress.className = "teacher-progress";
    const track = document.createElement("span"); track.className = "teacher-progress-track"; const fill = document.createElement("span"); fill.className = "teacher-progress-fill"; fill.style.width = `${student.progressPercent || 0}%`; track.append(fill);
    const progressText = document.createElement("span"); progressText.textContent = `${student.progressPercent || 0}%`; progress.append(track, progressText);
    const metrics = document.createElement("span"); metrics.className = "muted"; metrics.textContent = `${student.filledFields || 0}/${student.totalFields || 0} ô · ${student.passedSectionCount || 0} phần đạt · ${student.checkCount || 0} lần Check`;
    const badges = document.createElement("span"); badges.className = "teacher-badges";
    if (student.supportRequired) {
      for (const item of student.supportSections || []) { const warning = document.createElement("span"); warning.className = "teacher-support-warning"; warning.textContent = `⚠ Cần liên hệ giảng viên · ${item.section} · Comment lần ${item.commentNumber}`; badges.append(warning); }
    }
    if (student.provisional) { const provisional = document.createElement("span"); provisional.className = "teacher-provisional-badge"; provisional.textContent = "Học viên tạm · Cần đối soát"; badges.append(provisional); }
    if (!student.hasStarted) { const blank = document.createElement("span"); blank.className = "teacher-not-started-badge"; blank.textContent = "Chưa làm"; badges.append(blank); }
    card.append(header, className, progress, metrics, meta, badges); decorateTeacher(card,student,teacherDefinitions());
    card.addEventListener("click", () => showStudentDetail(student, student.supportSections?.[0]?.section || ""));
    section.append(card);
    }
    root.append(section);
  }
}

function renderCommentTimeline(student,definition,loading){
 const panel=document.createElement('aside');panel.className='teacher-comment-timeline comments-panel comments';
 const title=document.createElement('h4');title.textContent='Dòng thời gian · '+definition.title;panel.append(title);
 const list=document.createElement('ol');list.className='comment-list';panel.append(list);
 const items=commentsForSection(student.comments||[],definition.key);
 renderTimeline(list,items,{section:definition.key,api:state.api,sessionRef:student.sessionRef});
 if(!items.length){const empty=document.createElement('p');empty.textContent=loading?'Đang tải nhận xét…':'Chưa có nhận xét.';panel.append(empty);}
 return panel;
}
function renderVocabulary(bodySection, student, bodyKey, loading) {
  const vocabulary = document.createElement("section");
  vocabulary.className = "lesson-vocabulary teacher-detail-vocabulary";
  const title = document.createElement("h4");
  title.textContent = state.manifest.vocabulary?.title || "Từ vựng hỗ trợ";
  vocabulary.append(title);
  const rows = latestVocabularyRows(student.comments || [], bodyKey);
  if (!rows.length) {
    const empty = document.createElement("p"); empty.className = "muted";
    empty.textContent = loading ? "Đang tải bảng từ vựng…" : "Chưa có bảng từ vựng cho phần này.";
    vocabulary.append(empty); bodySection.append(vocabulary); return;
  }
  const tableRoot = document.createElement("div"); tableRoot.className = "table-scroll";
  const table = document.createElement("table");
  const head = document.createElement("thead"); const headRow = document.createElement("tr");
  for (const label of state.manifest.vocabulary?.columns || ["Ý cần diễn đạt", "Từ/cụm từ tiếng Anh"]) {
    const cell = document.createElement("th"); cell.textContent = label; headRow.append(cell);
  }
  head.append(headRow); table.append(head);
  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    const idea = document.createElement("td"); idea.textContent = row.idea;
    const terms = document.createElement("td"); terms.textContent = Array.isArray(row.terms) ? row.terms.join(", ") : row.terms;
    tr.append(idea, terms); tbody.append(tr);
  }
  table.append(tbody); tableRoot.append(table); vocabulary.append(tableRoot); bodySection.append(vocabulary);
}

function commentContext(student) { return student.sessionRef || `${student.studentRef}:${student.classRef}`; }
function hasActiveCommentComposer() { return Boolean($("teacher-detail").querySelector(".teacher-comment-composer:not([hidden]), .reopen-composer")); }
function hasTeacherCommentDraft() {
  return hasActiveCommentComposer() || [...$("teacher-detail").querySelectorAll(".teacher-comment-composer textarea, .teacher-comment-reply textarea")].some(input => input.value.trim());
}
function replyDrafts(omitThread) {
  return new Map([...$("teacher-detail").querySelectorAll(".teacher-comment-thread")].filter(card => card.dataset.threadRef !== omitThread).map(card => [card.dataset.threadRef, card.querySelector("textarea")?.value || ""]).filter(([, text]) => text.trim()));
}
function restoreReplyDrafts(drafts) {
  for (const card of $("teacher-detail").querySelectorAll(".teacher-comment-thread")) {
    const input = card.querySelector("textarea"); if (input && drafts.has(card.dataset.threadRef)) input.value = drafts.get(card.dataset.threadRef);
  }
}
function requireFinishedComposer() {
  if (hasActiveCommentComposer()) throw new Error("Hãy gửi hoặc hủy comment đang soạn trước; bản nháp đang được giữ.");
}
async function reloadSelectedStudent(options = {}) {
  if (state.selectedStudent?.sessionRef) await loadStudentDetail(state.selectedStudent, options);
}

function renderTeacherResponseField(responseColumn, student, definition, field) {
  const fieldRoot = document.createElement("div"); fieldRoot.className = "teacher-response-field";
  if (student.activeField === field.key && student.online) fieldRoot.dataset.active = "true";
  const label = document.createElement("strong"); label.textContent = field.label;
  const value = document.createElement("div"); value.className = "teacher-annotatable-text"; value.tabIndex = 0;
  value.setAttribute("aria-label", `${field.label}. Bôi đen một đoạn để thêm comment.`);
  const responseText = student.responses?.[field.key] || "";
  const fieldThreads = threadsForField(student.teacherComments || [], field.key, responseText);
  const threads = document.createElement("div"); threads.className = "teacher-comment-thread-list teacher-comment-thread-list-dashboard";
  const focusThread = (threadRef) => threads.querySelector(`[data-thread-ref="${CSS.escape(threadRef)}"]`)?.scrollIntoView({ behavior: masterScrollBehavior(), block: "nearest" });
  if (responseText) renderAnnotatedText(value, responseText, fieldThreads, focusThread);
  else { value.textContent = "Chưa viết"; value.classList.add("muted"); }

  const composer = document.createElement("form"); composer.className = "teacher-comment-composer"; composer.hidden = true;
  const selectedQuote = document.createElement("blockquote");
  const input = document.createElement("textarea"); input.rows = 3; input.maxLength = 5000; input.placeholder = "Viết comment cho đoạn đã chọn…"; input.setAttribute("aria-label", "Nội dung comment mới");
  const actions = document.createElement("div"); actions.className = "actions";
  const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "secondary compact"; cancel.textContent = "Hủy";
  const submit = document.createElement("button"); submit.type = "submit"; submit.className = "primary compact"; submit.textContent = "Comment";
  const feedback = document.createElement("p"); feedback.className = "teacher-comment-feedback"; feedback.setAttribute("role", "status");
  actions.append(cancel, submit); composer.append(selectedQuote, input, actions, feedback);
  let selected = null;
  const captureSelection = () => {
    if (!responseText || student.readOnly) return;
    const next = selectionOffsets(value);
    if (!next || next.end - next.start > 2000) return;
    selected = next; selectedQuote.textContent = next.quote; composer.hidden = false; input.focus();
  };
  value.addEventListener("mouseup", captureSelection);
  const wholeField = document.createElement('button'); wholeField.type='button'; wholeField.className='secondary compact';
  wholeField.textContent=responseText.length>2000?'Góp ý đoạn đầu của ô':'Góp ý ô này'; wholeField.disabled=!responseText||student.readOnly;
  wholeField.addEventListener('click',()=>{selected={start:0,end:Math.min(responseText.length,2000),quote:responseText.slice(0,2000)};selectedQuote.textContent=selected.quote;composer.hidden=false;input.focus();});
  value.addEventListener("keyup", (event) => { if (event.key === "Shift" || event.key.startsWith("Arrow")) captureSelection(); });
  cancel.addEventListener("click", () => { selected = null; input.value = ""; composer.hidden = true; });
  composer.addEventListener("submit", async (event) => {
    event.preventDefault(); const body = input.value.trim(); if (!selected || !body) return;
    submit.disabled = true; submit.textContent = "Đang lưu…"; feedback.dataset.state = "pending"; feedback.textContent = "Đang lưu góp ý…";
    try {
      await state.api.createTeacherComment(student.sessionRef, {
        sectionKey: definition.key,
        fieldKey: field.key,
        start: selected.start,
        end: selected.end,
        baseVersion: student.draftVersion,
        body,
        requestId: createRequestId(),
      });
      await reloadSelectedStudent({ discardComposer: true });
    } catch (error) {
      submit.disabled = false; submit.textContent = "Comment";
      feedback.dataset.state = "error"; feedback.textContent = error.message || "Chưa lưu được comment. Bài có thể vừa thay đổi; hãy bôi lại đoạn chữ.";
      showDashboardError(feedback.textContent);
    }
  });

  for (const thread of fieldThreads) {
    threads.append(createTeacherCommentThreadCard(thread, {
      allowStatus: true,
      onReply: async (item, body) => { requireFinishedComposer(); await state.api.replyTeacherComment(item.threadRef, body); await reloadSelectedStudent({ omitReplyThread: item.threadRef }); },
      onStatus: async (item, status) => { requireFinishedComposer(); await state.api.setTeacherCommentStatus(item.threadRef, status); await reloadSelectedStudent(); },
    }));
  }
  const empty = document.createElement("p"); empty.className = "muted teacher-comment-empty"; empty.textContent = responseText ? "Bôi đen một đoạn trong bài để thêm comment." : "Học viên chưa viết ô này.";
  empty.hidden = fieldThreads.length > 0;
  const layout = document.createElement("div"); layout.className = "teacher-response-comment-layout";
  const response = document.createElement("div"); response.className = "teacher-response-comment-source"; response.append(value, wholeField, composer, empty);
  layout.append(response, threads); fieldRoot.append(label, layout); responseColumn.append(fieldRoot);
}

function renderStudentDetail(student, { loading = false, error = "" } = {}) {
  const dialog = $("teacher-detail");
  dialog.dataset.commentContext = commentContext(student);
  const previousScroll = dialog.scrollTop;
  const root = $("teacher-detail-content");
  root.replaceChildren();
  const heading = document.createElement("div"); heading.className = "teacher-detail-heading";
  const title = document.createElement("h2"); title.textContent = student.displayName;
  const meta = document.createElement("p"); meta.className = "muted"; meta.textContent = `${student.className} · ${statusLabel(studentStatus(student))} · Lưu gần nhất ${formatTime(student.savedAt)}`;
  heading.append(title, meta); root.append(heading);
  const controls=document.createElement('div');controls.className='actions detail-actions';
  const close=document.createElement('button');close.className='secondary';close.textContent='Đóng bài làm';close.onclick=()=>dialog.close();
  const reload=document.createElement('button');reload.className='secondary';reload.textContent='Cập nhật bài';reload.onclick=()=>{if(!hasTeacherCommentDraft())void loadStudentDetail(student);else showDashboardError('Hãy gửi hoặc hủy lời đang soạn trước khi cập nhật.');};controls.append(close,reload);root.append(controls);
  if(student.readOnly){const note=document.createElement('p');note.className='notice';note.textContent='Bản sao lịch sử chỉ đọc. Bài và nhận xét gốc được giữ nguyên; không chấm lại tại bản thử.';root.append(note);}
  const chart=state.manifest.task?.chart_image;if(chart?.url){const link=document.createElement('a');link.href=chart.url;link.target='_blank';link.rel='noopener';const img=document.createElement('img');img.className='teacher-chart';img.src=chart.url;img.alt=chart.alt_text||'Biểu đồ và bảng mức lương';link.append(img);root.append(link);}

  const prompt = document.createElement("article"); prompt.className = "teacher-detail-prompt";
  const promptLabel = document.createElement("p"); promptLabel.className = "eyebrow"; promptLabel.textContent = "Đề bài";
  const promptTitle = document.createElement("h3"); promptTitle.textContent = state.manifest.task?.title || "Essay question";
  const promptText = document.createElement("div"); promptText.className = "markdown-body";
  appendMarkdown(promptText, state.manifest.task?.statement || "");
  prompt.append(promptLabel, promptTitle, promptText); root.append(prompt);
  for (const body of teacherBodies()) {
    const bodySection = document.createElement("section"); bodySection.className = "teacher-detail-body";
    const bodyTitle = document.createElement("h3"); bodyTitle.textContent = body.title;
    const bodyDescription = document.createElement("p"); bodyDescription.className = "muted"; bodyDescription.textContent = body.description || "";
    bodySection.append(bodyTitle, bodyDescription);
    for (const sectionKey of body.sectionKeys || []) {
      const definition = teacherDefinitions().find((item) => item.key === sectionKey);
      if (!definition) continue;
      if (sectionKey === "draft") {
        const vocabulary = createVocabularySection(document, manifestVocabularyRows(state.manifest?.vocabulary), {
          className: "teacher-detail-vocabulary teacher-draft-vocabulary",
          headingTag: "h4",
          scrollHint: "Cuộn trong bảng để xem thêm. Phần Draft ở ngay bên dưới ↓",
        });
        if (vocabulary) bodySection.append(vocabulary);
      }
      const section = document.createElement("article"); section.className = "teacher-detail-section";
      section.dataset.sectionKey = sectionKey;
      const sectionKicker = document.createElement("p"); sectionKicker.className = "section-kicker"; sectionKicker.textContent = definition.kicker || "";
      const sectionTitle = document.createElement("h4");
      const sectionInfo = student.sections?.[sectionKey] || {};
      const sectionState = sectionInfo.status || "draft";
      section.dataset.state = sectionState;
      sectionTitle.textContent = `${definition.title} · ${statusLabel(sectionState)}`;
      const sectionInstruction = document.createElement("p"); sectionInstruction.className = "muted teacher-detail-instruction"; sectionInstruction.textContent = definition.instruction || "";
      section.append(sectionKicker, sectionTitle, sectionInstruction);
      if(sectionState==='passed'&&state.canReopen&&!student.readOnly){
        const reopen=document.createElement('button');reopen.type='button';reopen.className='secondary';reopen.textContent='Mở lại '+definition.title;
        reopen.onclick=()=>{
          if(hasTeacherCommentDraft()){showDashboardError('Hãy gửi hoặc hủy phần đang soạn trước khi mở lại.');return;}
          const form=document.createElement('form');form.className='reopen-composer';
          const label=document.createElement('label');label.textContent='Lý do mở lại '+definition.title;
          const reason=document.createElement('textarea');reason.required=true;reason.maxLength=1000;reason.rows=2;label.append(reason);
          const note=document.createElement('p');note.className='fine-print';note.textContent='Chỉ mở lại phần này. Bài và mọi lịch sử được giữ nguyên.';
          const submit=document.createElement('button');submit.type='submit';submit.className='primary';submit.textContent='Xác nhận mở lại';
          const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='Hủy mở lại';
          const error=document.createElement('p');error.setAttribute('role','alert');
          const actions=document.createElement('div');actions.className='actions';actions.append(submit,cancel);form.append(label,note,actions,error);
          cancel.onclick=()=>{form.remove();reopen.disabled=false;reopen.focus();};
          form.onsubmit=async event=>{event.preventDefault();if(!reason.value.trim()){error.textContent='Bạn cần nhập lý do mở lại.';reason.focus();return;}submit.disabled=true;cancel.disabled=true;
            try{await state.api.reopenSection(student.sessionRef,sectionKey,reason.value.trim());form.remove();await loadStudentDetail(student);await refresh();}
            catch(failure){error.textContent=failure.message;submit.disabled=false;cancel.disabled=false;}
          };
          reopen.disabled=true;reopen.after(form);reason.focus();
        };section.append(reopen);
      }

      const sectionLayout = document.createElement("div"); sectionLayout.className = "teacher-detail-section-layout";
      const responseColumn = document.createElement("div"); responseColumn.className = "teacher-detail-responses";
      if (sectionState === "technical_error" && sectionInfo.technicalAttemptRef) {
        const recovery = document.createElement("div");
        recovery.className = "teacher-ai-recovery";
        const message = document.createElement("p");
        message.textContent = technicalRecoveryMessage(state.canManage);
        recovery.append(message);
        if (state.canManage) {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "secondary";
        retry.textContent = "Xếp chấm lại";
        retry.addEventListener("click", async () => {
          retry.disabled = true;
          retry.textContent = "Đang xếp lại…";
          try {
            await state.api.retryFailedAttempt(sectionInfo.technicalAttemptRef);
            await refresh();
          } catch (error) {
            retry.disabled = false;
            retry.textContent = "Xếp chấm lại";
            showDashboardError(error.message || "Chưa thể xếp chấm lại. Hệ thống sẽ giữ nguyên bài làm.");
          }
        });
        recovery.append(retry);
        }
        responseColumn.append(recovery);
      }
      for (const field of definition.fields || []) {
        renderTeacherResponseField(responseColumn, student, definition, field);
      }
      sectionLayout.append(responseColumn, renderCommentTimeline(student, definition, loading));
      section.append(sectionLayout);
      bodySection.append(section);
    }
    if (!(body.sectionKeys || []).includes("draft")) renderVocabulary(bodySection, student, body.key, loading);
    root.append(bodySection);
  }
  if (error) {
    const message = document.createElement("p"); message.className = "notice"; message.textContent = error; root.prepend(message);
  }
  if(student.readOnly)root.querySelectorAll('.teacher-comment-reply button,.teacher-comment-reply textarea,.teacher-comment-status-button').forEach(el=>el.disabled=true);
  if (dialog.open) requestAnimationFrame(() => { dialog.scrollTop = previousScroll; });
  if (state.focusSection) requestAnimationFrame(() => root.querySelector(`[data-section-key="${CSS.escape(state.focusSection)}"]`)?.scrollIntoView({ block: "center" }));
}

async function loadStudentDetail(student, { omitReplyThread, discardComposer = false } = {}) {
  if (!student?.sessionRef) {
    state.selectedStudent = student;
    renderStudentDetail(student);
    return;
  }
  const requestId = ++state.detailRequestId;
  const [sessionResult, commentResult] = await Promise.allSettled([
    state.api.liveSession(student.sessionRef),
    state.api.teacherComments(student.sessionRef),
  ]);
  if (requestId !== state.detailRequestId || !$("teacher-detail").open) return;
  if (hasActiveCommentComposer() && !discardComposer) return;
  const drafts = $("teacher-detail").dataset.commentContext === commentContext(student) ? replyDrafts(omitReplyThread) : new Map();
  const session = sessionResult.status === "fulfilled"
    ? (sessionResult.value.data.session || sessionResult.value.data)
    : {};
  const teacherComments = commentResult.status === "fulfilled"
    ? (commentResult.value.data.threads || [])
    : undefined;
  state.selectedStudent = mergeTeacherStudentDetail(student, session, teacherComments);
  const unavailable = [];
  if (sessionResult.status === "rejected") unavailable.push("chi tiết mới nhất");
  if (commentResult.status === "rejected") unavailable.push("comment giảng viên");
  const error = unavailable.length
    ? `Bài đang hiển thị từ dữ liệu tổng hợp; tạm thời chưa tải được ${unavailable.join(" và ")}.`
    : "";
  renderStudentDetail(state.selectedStudent, { error });
  restoreReplyDrafts(drafts);
}

function showStudentDetail(student, focusSection = "") {
  const dialog = $("teacher-detail");
  if (hasTeacherCommentDraft()) {
    if (dialog.dataset.commentContext === commentContext(student)) {
      state.selectedStudent = student; state.focusSection = focusSection; if (!dialog.open) dialog.showModal(); return;
    }
    if (!confirm("Có lời góp ý chưa gửi. Bỏ bản nháp để mở bài khác?")) return;
  }
  const resetScroll = !dialog.open || state.selectedStudent?.sessionRef !== student.sessionRef;
  state.selectedStudent = student;
  state.focusSection = focusSection;
  if (resetScroll) dialog.scrollTop = 0;
  renderStudentDetail(student, { loading: Boolean(student.sessionRef) });
  if (!dialog.open) dialog.showModal();
  if (resetScroll) requestAnimationFrame(() => { dialog.scrollTop = 0; });
  void loadStudentDetail(student);
}

// Mỗi hồ sơ tạm giữ kết quả tìm riêng theo UUID; chỉ ghép UUID được chọn sau xác nhận.
// Sau ghi, tải lại trạng thái thật để bỏ hồ sơ đã xử lý; lỗi vẫn giữ hồ sơ trong hàng chờ.
function renderReconciliation() {
  const panel = $("teacher-reconciliation"); const root = $("teacher-reconciliation-list"); root.replaceChildren();
  panel.hidden = !state.pending.length;
  const pendingRefs = new Set(state.pending.map(item => item.studentRef));
  for (const studentRef of state.reconciliationSearches.keys()) {
    if (!pendingRefs.has(studentRef)) state.reconciliationSearches.delete(studentRef);
  }
  for (const item of state.pending) {
    const row = document.createElement("article"); row.className = "teacher-student-card";
    const title = document.createElement("strong"); title.textContent = `${item.displayName} · ${item.className}`;
    if (!state.canManage) {
      const note = document.createElement("span"); note.className = "muted"; note.textContent = "Chỉ xem · Tài khoản quản trị sẽ đối soát hồ sơ này.";
      row.append(title, note); root.append(row); continue;
    }
    const searchState = state.reconciliationSearches.get(item.studentRef) || { query: item.displayName, results: [], selectedRef: "", message: "" };
    state.reconciliationSearches.set(item.studentRef, searchState);
    const searchGroup = document.createElement("div"); searchGroup.className = "reconciliation-search";
    const input = document.createElement("input"); input.type = "search"; input.value = searchState.query; input.maxLength = 100;
    input.placeholder = "Nhập họ tên để tìm trong toàn bộ database"; input.setAttribute("aria-label", `Tìm hồ sơ chính thức cho ${item.displayName}`);
    input.addEventListener("input", () => { searchState.query = input.value; });
    const search = document.createElement("button"); search.type = "button"; search.className = "secondary"; search.textContent = "Tìm trong database";
    const runSearch = async () => {
      const query = input.value.trim(); searchState.query = query;
      if (query.length < 2) { searchState.message = "Nhập ít nhất hai ký tự."; renderReconciliation(); return; }
      search.disabled = true; search.textContent = "Đang tìm…";
      try {
        const result = await state.api.searchOfficialStudents(query, item.studentRef);
        searchState.results = result.data.students || [];
        searchState.selectedRef = "";
        searchState.message = searchState.results.length ? `Tìm thấy ${searchState.results.length} hồ sơ.` : "Không tìm thấy hồ sơ phù hợp.";
        renderReconciliation();
      } catch (error) {
        searchState.message = error.message || "Chưa thể tìm hồ sơ.";
        renderReconciliation();
      }
    };
    search.addEventListener("click", runSearch);
    input.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); void runSearch(); } });
    searchGroup.append(input, search);
    const searchMessage = document.createElement("span"); searchMessage.className = "muted"; searchMessage.setAttribute("role", "status"); searchMessage.textContent = searchState.message;
    const select = document.createElement("select"); const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Chọn hồ sơ từ kết quả tìm kiếm"; select.append(placeholder);
    for (const candidate of searchState.results) {
      const option = document.createElement("option"); option.value = candidate.studentRef;
      const classes = (candidate.classNames || []).join(", ") || "Không có lớp đang hoạt động";
      option.textContent = `${candidate.displayName} · ${classes}`; select.append(option);
    }
    select.value = searchState.results.some(candidate => candidate.studentRef === searchState.selectedRef) ? searchState.selectedRef : "";
    const actions = document.createElement("span"); actions.className = "actions";
    const reset = document.createElement("button"); reset.type = "button"; reset.className = "secondary"; reset.textContent = "Đặt lại mã";
    reset.addEventListener("click", async () => {
      if (reset.disabled) return;
      reset.disabled = true;
      try { const result = await state.api.resetProvisionalCode(item.studentRef); alert(`Mã mới của ${item.displayName}: ${result.data.accessCode}\nMã chỉ hiển thị lần này.`); }
      catch (error) { showDashboardError(error.message); }
      finally { reset.disabled = false; }
    });
    const match = document.createElement("button"); match.type = "button"; match.className = "primary"; match.textContent = "Ghép hồ sơ"; match.disabled = !select.value;
    select.addEventListener("change", () => { searchState.selectedRef = select.value; match.disabled = !select.value; });
    match.addEventListener("click", async () => {
      if (!select.value) return;
      const candidate = searchState.results.find(result => result.studentRef === select.value);
      if (!candidate || !confirm(`Ghép hồ sơ “${candidate.displayName}” với bài làm tạm “${item.displayName}”?`)) return;
      try { await state.api.reconcileProvisional(item.studentRef, candidate.studentRef); await refresh(); } catch (error) { showDashboardError(error.message); }
    });
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "danger-button"; remove.textContent = "Xóa hồ sơ tạm";
    remove.addEventListener("click", async () => {
      if (!confirm(`Xóa hồ sơ tạm “${item.displayName}” khỏi web app? Lịch sử kỹ thuật cũ vẫn được giữ để tránh mất dữ liệu.`)) return;
      try { await state.api.deleteProvisional(item.studentRef); state.reconciliationSearches.delete(item.studentRef); await refresh(); } catch (error) { showDashboardError(error.message); }
    });
    actions.append(reset, match, remove); row.append(title, searchGroup, searchMessage, select, actions); root.append(row);
  }
}

async function refresh() {
  clearTimeout(state.pollTimer);
  if (!state.authenticated) return;
  const loginGeneration = state.loginGeneration;
  try {
    const selectedClassRef = $("teacher-class").value;
    const result = await state.api.liveActivity(state.activitySlug, selectedClassRef);
    const pendingResult = await state.api.provisionalStudents(state.activitySlug, $("teacher-class").value);
    const identityResult = await state.api.identity();
    if (loginGeneration !== state.loginGeneration) return;
    state.students = result.data.students || [];
    state.canManage = result.data.permissions?.canManage === true;
    state.canReopen = identityResult.data.reviewer?.canManage === true;
    state.pending = pendingResult.data.students || [];
    const classes = populateClasses(state.students);
    if (!state.classQueryResolved) {
      const classRef = resolveClassRef(classes, state.requestedClass);
      if (state.requestedClass && !classRef) {
        // Link giao bài chọn một lớp cụ thể: không đổi ngầm sang toàn bộ lớp khác.
        state.students = [];state.pending = [];
        $("teacher-students").replaceChildren();$("teacher-summary").replaceChildren();
        $("teacher-dashboard").hidden = true;$("teacher-login").hidden = false;authView.signedOut();
        showLoginError(`Không tìm thấy lớp “${state.requestedClass}” trong phạm vi được xem. Hãy kiểm tra lớp trong link hoặc đổi tài khoản Google.`);
        return;
      } else if (classRef && classRef !== selectedClassRef) {
        state.classQueryResolved = true;
        $("teacher-class").value = classRef;
        return refresh();
      }
      state.classQueryResolved = true;
    }
    renderSummary(state.students);
    renderStudents(state.students);
    renderReconciliation();
    $("teacher-login").hidden = true;authView.ready();
    $("teacher-dashboard").hidden = false;
    $("teacher-updated").textContent = `Cập nhật lúc ${formatTime(result.data.generatedAt)}`;
    showLoginError();
    showDashboardError(state.classQueryError);
    if ($("teacher-detail").open && state.selectedStudent && !$("teacher-detail").querySelector(".teacher-comment-composer textarea:focus, .teacher-comment-reply textarea:focus")) {
      const updated = state.students.find((student) => student.studentRef === state.selectedStudent.studentRef);
      if (updated) await loadStudentDetail({ ...state.selectedStudent, ...updated });
    }
  } catch (error) {
    if (loginGeneration !== state.loginGeneration) return;
    const authFailure = teacherAuthFailure(error.status);
    if (authFailure) {
      clearTeacherLogin();
      $("teacher-updated").textContent = authFailure.header;
      showLoginError(authFailure.message);
      globalThis.google?.accounts?.id?.disableAutoSelect?.();
      return;
    }
    if ($("teacher-dashboard").hidden) {
      showLoginError("Đã đăng nhập nhưng chưa thể tải dữ liệu lớp. Hệ thống sẽ tự thử lại.");
    } else {
      showDashboardError("Chưa thể cập nhật dữ liệu lớp. Hệ thống sẽ tự thử lại.");
    }
  }
  state.pollTimer = setTimeout(refresh, 5_000);
}

async function handleCredential(response) {
  if (!response?.credential) return showLoginError("Không nhận được thông tin đăng nhập.");
  state.loginGeneration += 1;
  state.authenticated = false;
  state.classQueryResolved = false;state.classQueryError = "";
  $("teacher-login").hidden = false;authView.signedOut();
  $("teacher-dashboard").hidden = true;
  $("teacher-updated").textContent = "Đang xác minh quyền…";
  showLoginError("Đang xác minh quyền truy cập…");
  try {
    await state.sessionClient.login(response.credential);
    state.authenticated = true;
    await refresh();
  } catch (error) {
    clearTeacherLogin();
    showLoginError(`Không thể đăng nhập: ${error.message}`);
  }
}

async function waitForGoogle(clientId) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const accounts = globalThis.google?.accounts?.id;
    if (accounts) {
      accounts.initialize({ client_id: clientId, callback: handleCredential, auto_select: loginPreference.read() });
      accounts.renderButton($("google-signin"), { theme: "outline", size: "large", text: "signin_with", locale: "vi" });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Không tải được dịch vụ đăng nhập Google.");
}

async function init() {
  authView.checking();
  if (globalThis.__IZONE_SW_TASK2_REDIRECTING__) return;
  try {
    const slug = new URLSearchParams(location.search).get("task") || "writing-lesson13-young-leaders";
    state.requestedClass = classQuery(location.search) || "";
    const [manifestResponse, configResponse] = await Promise.all([
      fetch(`./manifests/${encodeURIComponent(slug)}.json?ui=20261025-rollout2`, { cache: 'no-cache' }),
      fetch("./config.json", { cache: "no-store" }),
    ]);
    if (!manifestResponse.ok || !configResponse.ok) throw new Error("Thiếu cấu hình dashboard.");
    state.manifest = await manifestResponse.json();
    const config = await configResponse.json();
    if (config.socraticTask1Slugs?.includes(state.manifest.activity?.slug || slug)) state.manifest.feedbackMode = "socratic-v2";
    if (!config.googleClientId) throw new Error("Dashboard chưa được cấu hình đăng nhập giảng viên.");
    state.sessionClient = createTeacherSessionClient({ apiBaseUrl: config.apiBase || "", sessionPath: "api/v1/auth/session" });
    state.activitySlug = state.manifest.activity?.slug || slug;
    state.api = createTeacherApi(config.apiBase || "");
    $("teacher-title").textContent = state.manifest.activity?.title || "Theo dõi bài làm";
    installTeacherTools(()=>renderStudents(state.students)); $("review-refresh").onclick=()=>refresh();
    $("teacher-class").addEventListener("change", () => {
      state.classQueryError = "";
      void refresh();
    });
    $("teacher-export").addEventListener("click", async () => {
      const button = $("teacher-export"); if (button.disabled) return; button.disabled = true;
      try { const blob = await state.api.exportProgress(state.activitySlug, $("teacher-class").value); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${state.activitySlug}-progress.csv`; link.click(); URL.revokeObjectURL(url); }
      catch (error) { showDashboardError(error.message); }
      finally { button.disabled = false; }
    });
    const detail = $("teacher-detail");
    const nativeClose=detail.close.bind(detail);detail.close=(...args)=>{if(hasTeacherCommentDraft()&&!confirm('Lời góp ý chưa gửi. Đóng và bỏ phần đang soạn?'))return;nativeClose(...args);};
    detail.addEventListener('cancel',event=>{event.preventDefault();detail.close();});

    let detailPressedOutside = false;
    detail.addEventListener("pointerdown", (event) => {
      detailPressedOutside = event.target === detail && isBackdropClick(event, detail.getBoundingClientRect());
    });
    detail.addEventListener("pointerup", (event) => {
      if (detailPressedOutside && event.target === detail && isBackdropClick(event, detail.getBoundingClientRect())) detail.close();
      detailPressedOutside = false;
    });
    detail.addEventListener("pointercancel", () => { detailPressedOutside = false; });
    detail.addEventListener("close", () => {
      state.detailRequestId += 1;
      state.selectedStudent = null;
    });
    const restored = await state.sessionClient.restore();
    if (restored) {
      state.authenticated = true;
      await refresh();
    }
    if (!restored) authView.signedOut();
    await waitForGoogle(config.googleClientId);
    if (!state.authenticated && loginPreference.read()) globalThis.google.accounts.id.prompt();
  } catch (error) {
    authView.failed(error);
    showLoginError(error.message);
  }
}

function clearTeacherLogin() {
  state.loginGeneration += 1;
  state.authenticated = false;
  state.classQueryResolved = false;state.classQueryError = "";
  state.students = [];
  state.pending = [];
  state.canManage = false;
  state.canReopen = false;
  state.draftResults.clear();
  state.reconciliationSearches.clear();
  state.selectedStudent = null;
  if ($("teacher-detail").open) $("teacher-detail").close();
  clearTimeout(state.pollTimer);
  for (const id of ["teacher-students", "teacher-summary", "teacher-reconciliation-list", "teacher-class", "teacher-detail-content"]) $(id).replaceChildren();
  $("teacher-reconciliation").hidden = true;
  $("teacher-dashboard").hidden = true;
  $("teacher-login").hidden = false;authView.signedOut();
}

// A roster refresh can replace the original opener while its modal is open.
$("teacher-detail").addEventListener("close", () => {
  const dialog = $("teacher-detail");
  if (dialog.open || $("teacher-dashboard").hidden) return;
  const target = [...document.querySelectorAll("#teacher-students button.teacher-student-card")]
    .find(card => card.dataset.commentContext === dialog.dataset.commentContext);
  (target || $("teacher-class")).focus();
});

$("remember-teacher-login").checked = loginPreference.read();
$("remember-teacher-login").addEventListener("change", () => {
  const input = $("remember-teacher-login");
  if (loginPreference.set(input.checked)) return;
  input.checked = loginPreference.read();
  showLoginError("Trình duyệt chưa lưu được lựa chọn tự đăng nhập.");
});

$("teacher-logout").addEventListener("click", async () => {
  if (hasTeacherCommentDraft() && !confirm("Bỏ lời góp ý chưa gửi và đăng xuất?")) return;
  try { await state.sessionClient?.logout(); } catch { /* Vẫn xóa dữ liệu đang hiển thị trên máy dùng chung. */ }
  clearTeacherLogin();
  globalThis.google?.accounts?.id?.disableAutoSelect?.();
  const forgotten = loginPreference.set(false);
  $("remember-teacher-login").checked = !forgotten;
  $("teacher-updated").textContent = "Chưa đăng nhập";
  showLoginError(forgotten ? "Đã đăng xuất." : "Đã đăng xuất, nhưng trình duyệt chưa xóa được lựa chọn tự đăng nhập.");
});

init();

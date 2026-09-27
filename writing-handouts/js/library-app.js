/*
 * Dữ liệu nhận vào: cấu hình Google/API, danh mục handout và lớp Speaking Writing chuyên sâu.
 * Việc chính: xác minh quyền giảng viên, xếp bài theo ngày và tạo link đúng đề + đúng lớp.
 * Kết quả: giảng viên xem handout, sao chép link học viên hoặc mở dashboard của từng bài.
 * Khi lỗi: không mở thư viện, không lộ dữ liệu dashboard và hiển thị thông báo để đăng nhập lại.
 */

import { createTeacherApi } from "./api.js?rev=20260920-server-session-v1";
import {
  classAvailable,
  dashboardUrl,
  sortHandoutsByWritingLesson,
  studentUrl,
} from "./library-core.js?v=20260913-writing-sequence-v2";
import { createTeacherSessionClient } from "../../shared/teacher-session-client.js?rev=20260920-v1";

const $ = (id) => document.getElementById(id);
const state = { authenticated: false, config: null, library: null, sessionClient: null, loginGeneration: 0 };

function showAuthStatus(message, error = false) {
  const status = $("auth-status");
  status.textContent = message;
  status.style.color = error ? "#8d2135" : "";
}

function selectedClass() {
  return $("class-select").value;
}

function showNotice(message, error = false) {
  const notice = $("library-notice");
  notice.textContent = message;
  notice.classList.toggle("error", error);
  notice.hidden = !message;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Trình duyệt không cho phép sao chép tự động.");
}

function actionButton(label, className, onClick, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button ${className}`;
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function renderHandout(handout) {
  const classCode = selectedClass();
  const available = classAvailable(handout, classCode);
  const card = document.createElement("article");
  card.className = "handout-card";
  card.dataset.slug = handout.slug;
  card.dataset.lessonId = handout.lessonId;

  const lesson = document.createElement("div");
  lesson.className = "handout-lesson";
  const lessonLabel = document.createElement("span");
  lessonLabel.textContent = "Writing buổi";
  const lessonValue = document.createElement("strong");
  lessonValue.textContent = String(handout.writingLesson);
  const taskLabel = document.createElement("span");
  taskLabel.className = "handout-task";
  taskLabel.textContent = `Task ${handout.taskNumber}`;
  lesson.append(lessonLabel, lessonValue, taskLabel);

  const body = document.createElement("div");
  body.className = "handout-body";
  const meta = document.createElement("div");
  meta.className = "handout-meta";
  const type = document.createElement("span");
  type.className = "badge";
  type.textContent = handout.type;
  const stateBadge = document.createElement("span");
  stateBadge.className = `badge ${available ? "available" : "unavailable"}`;
  stateBadge.textContent = available ? `Đã mở cho ${classCode}` : `Chưa mở cho ${classCode}`;
  meta.append(type, stateBadge);

  const title = document.createElement("h3");
  title.textContent = handout.title;
  const prompt = document.createElement("p");
  prompt.className = "handout-prompt";
  prompt.textContent = handout.statement;
  const availability = document.createElement("p");
  availability.className = "handout-availability";
  availability.textContent = `Các lớp đang dùng: ${handout.classes.join(", ")}`;

  const actions = document.createElement("div");
  actions.className = "handout-actions";
  actions.append(
    actionButton("Xem handout", "button-secondary", () => {
      const classQuery = available ? classCode : "";
      window.open(studentUrl(handout, classQuery, document.baseURI), "_blank", "noopener");
    }),
    actionButton("Sao chép link học viên", "button-primary", async () => {
      try {
        await copyText(studentUrl(handout, classCode, document.baseURI));
        showNotice(`Đã sao chép link “${handout.title}” cho lớp ${classCode}.`);
      } catch (error) {
        showNotice(error.message || "Chưa sao chép được link.", true);
      }
    }, !available),
    actionButton("Xem dashboard", "button-quiet", () => {
      window.location.href = dashboardUrl(handout, classCode, document.baseURI);
    }, !available),
  );
  body.append(meta, title, prompt, availability, actions);
  card.append(lesson, body);
  return card;
}

function renderLibrary() {
  const handouts = sortHandoutsByWritingLesson(state.library.handouts);
  $("course-title").textContent = state.library.course.title;
  $("library-summary").textContent = `${handouts.length} handout · xếp theo thứ tự Writing buổi 1 → ${handouts.length}.`;
  $("handout-list").replaceChildren(...handouts.map(renderHandout));
}

function showLibrary() {
  const select = $("class-select");
  select.replaceChildren(...state.library.course.classCodes.map((classCode) => {
    const option = document.createElement("option");
    option.value = classCode;
    option.textContent = classCode;
    return option;
  }));
  renderLibrary();
  $("auth-title").textContent = "Thư viện đã mở";
  $("library-content").hidden = false;
  $("logout-button").hidden = false;
  $("google-signin").hidden = true;
}

function hideLibrary() {
  $("auth-title").textContent = "Đăng nhập để mở thư viện";
  $("library-content").hidden = true;
  $("logout-button").hidden = true;
  $("google-signin").hidden = false;
}

async function verifyTeacher() {
  const api = createTeacherApi(state.config.apiBase || "");
  await api.liveActivity(state.library.authProbeSlug);
}

async function connectSession(restoring = false) {
  const generation = ++state.loginGeneration;
  hideLibrary();
  showAuthStatus(restoring ? "Đang khôi phục phiên giảng viên…" : "Đang xác minh quyền giảng viên…");
  try {
    await verifyTeacher();
    if (generation !== state.loginGeneration) return;
    state.authenticated = true;
    showAuthStatus(`Đã đăng nhập · ${state.library.course.title}`);
    showLibrary();
  } catch (error) {
    if (generation !== state.loginGeneration) return;
    state.authenticated = false;
    hideLibrary();
    showAuthStatus(error.status === 403
      ? "Tài khoản Google này chưa được cấp quyền xem dashboard Writing."
      : "Không thể xác minh quyền giảng viên. Hãy đăng nhập lại hoặc thử sau.", true);
  }
}

function setupGoogleSignIn() {
  const render = () => {
    globalThis.google.accounts.id.initialize({
      client_id: state.config.googleClientId,
      auto_select: false,
      callback: async (response) => {
        try {
          await state.sessionClient.login(response.credential || "");
          await connectSession();
        } catch (error) {
          showAuthStatus(`Không thể đăng nhập: ${error.message}`, true);
        }
      },
    });
    globalThis.google.accounts.id.renderButton($("google-signin"), {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      locale: "vi",
    });
  };
  if (globalThis.google?.accounts?.id) return render();
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (globalThis.google?.accounts?.id) { clearInterval(timer); render(); }
    else if (attempts >= 100) { clearInterval(timer); showAuthStatus("Không tải được dịch vụ đăng nhập Google.", true); }
  }, 100);
}

async function init() {
  try {
    const [configResponse, libraryResponse] = await Promise.all([
      fetch("./config.json", { cache: "no-store" }),
      fetch("./library.json", { cache: "no-store" }),
    ]);
    if (!configResponse.ok || !libraryResponse.ok) throw new Error("Thiếu cấu hình thư viện.");
    state.config = await configResponse.json();
    state.library = await libraryResponse.json();
    state.sessionClient = createTeacherSessionClient({ apiBaseUrl: state.config.apiBase, sessionPath: "api/v1/auth/session" });
    $("logout-button").addEventListener("click", async () => {
      try { await state.sessionClient.logout(); } catch { /* Vẫn khóa thư viện trên máy dùng chung. */ }
      state.loginGeneration += 1;
      state.authenticated = false;
      globalThis.google?.accounts?.id?.disableAutoSelect?.();
      hideLibrary();
      showAuthStatus("Đã đăng xuất. Hãy đăng nhập Google để mở lại thư viện.");
    });
    $("class-select").addEventListener("change", () => {
      showNotice("");
      renderLibrary();
    });
    const restored = await state.sessionClient.restore();
    if (restored) await connectSession(true);
    setupGoogleSignIn();
  } catch (error) {
    hideLibrary();
    showAuthStatus(error.message || "Không thể mở thư viện.", true);
  }
}

init();

export function tokenExpiresAt(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3 || parts.some((part) => !part)) return 0;
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    return typeof payload.exp === "number" && Number.isFinite(payload.exp) ? payload.exp * 1_000 : 0;
  } catch {
    return 0;
  }
}

export function createTeacherSessionStore({ apiBase, clientId, getStorage, now = Date.now }) {
  const key = `writing-handouts:teacher-session:v1:${apiBase}:${clientId}`;
  const usable = (token) => tokenExpiresAt(token) > now() + 10_000;
  const clear = () => {
    try { getStorage().removeItem(key); } catch { /* Trình duyệt có thể chặn bộ nhớ phiên. */ }
  };
  return {
    clear,
    usable,
    read() {
      try {
        const token = getStorage().getItem(key) || "";
        if (usable(token)) return token;
      } catch { /* Người dùng vẫn có thể đăng nhập lại khi bộ nhớ bị chặn. */ }
      clear();
      return "";
    },
    save(token) {
      if (!usable(token)) { clear(); return false; }
      try { getStorage().setItem(key, token); return true; } catch { return false; }
    },
  };
}

export function sortHandoutsByWritingLesson(handouts) {
  return [...(handouts || [])].sort((left, right) => {
    const byLesson = Number(left.writingLesson) - Number(right.writingLesson);
    if (Number.isFinite(byLesson) && byLesson !== 0) return byLesson;
    const byId = String(left.lessonId || "").localeCompare(String(right.lessonId || ""), "vi");
    if (byId !== 0) return byId;
    return String(left.title || "").localeCompare(String(right.title || ""), "vi");
  });
}

export function classAvailable(handout, classCode) {
  return (handout.classes || []).some((value) => value.toUpperCase() === String(classCode || "").toUpperCase());
}

function activityUrl(path, handout, classCode, baseUrl) {
  const url = new URL(path, baseUrl);
  url.searchParams.set("task", handout.slug);
  if (classCode) url.searchParams.set("class", classCode);
  return url.toString();
}

export function studentUrl(handout, classCode, baseUrl) {
  return activityUrl(handout.studentPath, handout, classCode, baseUrl);
}

export function dashboardUrl(handout, classCode, baseUrl) {
  return activityUrl("./teacher.html", handout, classCode, baseUrl);
}

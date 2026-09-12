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

export function sortHandoutsChronologically(handouts) {
  return [...(handouts || [])].sort((left, right) => {
    const byDate = Date.parse(left.releasedAt) - Date.parse(right.releasedAt);
    if (Number.isFinite(byDate) && byDate !== 0) return byDate;
    return String(left.title || "").localeCompare(String(right.title || ""), "vi");
  });
}

export function formatReleaseDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Chưa rõ ngày";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
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

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

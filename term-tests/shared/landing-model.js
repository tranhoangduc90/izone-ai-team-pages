/* Ưu tiên ngày mở lớp do Portal trả; mã lớp chỉ là dự phòng cho dữ liệu cũ chưa có ngày. */
function portalRecency(item) {
  for (const value of [item?.startedAt, item?.endedAt]) {
    if (!value) continue;
    const epochMs = Date.parse(value);
    if (Number.isFinite(epochMs)) return epochMs;
  }
  return null;
}

function recencyNumber(item) {
  const numbers = String(item?.name || '').match(/\d+/g);
  if (numbers?.length) return Number(numbers.at(-1));
  const id = Number(item?.id);
  return Number.isFinite(id) ? id : Number.NEGATIVE_INFINITY;
}

export function sortClassesNewestFirst(classes) {
  return [...classes].sort((left, right) => {
    const leftPortalRecency = portalRecency(left);
    const rightPortalRecency = portalRecency(right);
    if (leftPortalRecency !== null || rightPortalRecency !== null) {
      if (leftPortalRecency === null) return 1;
      if (rightPortalRecency === null) return -1;
      if (leftPortalRecency !== rightPortalRecency) return rightPortalRecency - leftPortalRecency;
    }

    const byRecency = recencyNumber(right) - recencyNumber(left);
    if (Number.isFinite(byRecency) && byRecency !== 0) return byRecency;
    return String(right?.name || '').localeCompare(String(left?.name || ''), 'vi', {
      numeric: true,
      sensitivity: 'base'
    });
  });
}

/* Xếp lớp mới trước bằng phần số cuối của mã lớp; nếu không có số thì dùng ID và tên làm dự phòng. */
function recencyNumber(item) {
  const numbers = String(item?.name || '').match(/\d+/g);
  if (numbers?.length) return Number(numbers.at(-1));
  const id = Number(item?.id);
  return Number.isFinite(id) ? id : Number.NEGATIVE_INFINITY;
}

export function sortClassesNewestFirst(classes) {
  return [...classes].sort((left, right) => {
    const byRecency = recencyNumber(right) - recencyNumber(left);
    if (Number.isFinite(byRecency) && byRecency !== 0) return byRecency;
    return String(right?.name || '').localeCompare(String(left?.name || ''), 'vi', {
      numeric: true,
      sensitivity: 'base'
    });
  });
}

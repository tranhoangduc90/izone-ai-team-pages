const courseFilter = document.querySelector('#course-filter');
const rows = [...document.querySelectorAll('[data-course]')];
const params = new URLSearchParams(location.search);
const requested = params.get('course');
const allowedCourses = new Set(['all', 'k56', 'k67']);
if (allowedCourses.has(requested)) courseFilter.value = requested;

function renderCourse() {
  const course = courseFilter.value;
  for (const row of rows) row.hidden = !(course === 'all' || row.dataset.course === course);
  const isAll = course === 'all';
  const isK67 = course === 'k67';
  document.querySelector('#metric-tests').textContent = isAll ? '04' : '02';
  document.querySelector('#record-count').textContent = isAll ? '4 bài' : '2 bài';
  document.querySelector('#metric-scale').textContent = isK67 ? '9 / 9 / 9' : 'Theo bài';
  document.querySelector('#metric-scale-note').textContent = isK67 ? 'Listening · Reading · Writing' : 'theo từng bài';
  document.querySelector('#metric-classes').textContent = isAll ? '03' : '02';
  document.querySelector('#metric-class-note').textContent = isAll
    ? 'DEMO · IC2264 · IC2139'
    : isK67 ? 'DEMO và IC2139' : 'DEMO và IC2264';
  document.querySelector('#portal-badge').textContent = isAll
    ? 'Bản online · K56 + K67'
    : `Bản online · Khóa ${isK67 ? '67' : '56'}`;
  document.querySelector('#privacy-note').textContent = isAll
    ? 'DEMO không gửi Portal; K56 dùng lớp IC2264, còn đồng bộ Portal K67 lớp IC2139 đang chờ hoàn thiện.'
    : isK67
      ? 'DEMO không gửi Portal; đồng bộ Portal lớp IC2139 đang chờ hoàn thiện.'
      : 'DEMO không gửi Portal; lớp IC2264 áp dụng quy tắc điểm thi lại.';
  const next = new URL(location.href);
  if (isAll) next.searchParams.delete('course');
  else next.searchParams.set('course', course);
  history.replaceState(null, '', next);
}

courseFilter.addEventListener('change', renderCourse);
renderCourse();

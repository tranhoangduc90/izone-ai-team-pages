const courseFilter = document.querySelector('#course-filter');
const rows = [...document.querySelectorAll('[data-course]')];
const params = new URLSearchParams(location.search);
const requested = params.get('course');
if (requested === 'k67') courseFilter.value = 'k67';

function renderCourse() {
  const course = courseFilter.value;
  for (const row of rows) row.hidden = row.dataset.course !== course;
  const isK67 = course === 'k67';
  document.querySelector('#metric-scale').textContent = isK67 ? '9 / 9 / 9' : 'Theo bài';
  document.querySelector('#metric-scale-note').textContent = isK67 ? 'Listening · Reading · Writing' : 'Sub 2 dùng band 9';
  document.querySelector('#metric-class-note').textContent = isK67 ? 'DEMO và IC2139' : 'DEMO và IC2264';
  document.querySelector('#portal-badge').textContent = `Bản online · Khóa ${isK67 ? '67' : '56'}`;
  document.querySelector('#privacy-note').textContent = isK67
    ? 'DEMO không gửi Portal; đồng bộ Portal lớp IC2139 đang chờ hoàn thiện.'
    : 'DEMO không gửi Portal; lớp IC2264 áp dụng quy tắc điểm thi lại.';
  const next = new URL(location.href);
  next.searchParams.set('course', course);
  history.replaceState(null, '', next);
}

courseFilter.addEventListener('change', renderCourse);
renderCourse();

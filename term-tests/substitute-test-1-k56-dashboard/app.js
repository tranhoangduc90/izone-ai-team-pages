const courseFilter = document.querySelector('#course-filter');
const rows = [...document.querySelectorAll('[data-course]')];
const params = new URLSearchParams(location.search);
const requested = params.get('course');
const allowedCourses = new Set(['all', 'k56', 'k67']);
if (allowedCourses.has(requested)) courseFilter.value = requested;

function renderCourse() {
  const course = courseFilter.value;
  let visible=0;
  rows.forEach((row,index)=>{
    row.hidden=!(course==='all'||row.dataset.course===course);
    if(!row.hidden)visible++;
    row.querySelector('.test-number').textContent=String(course==='all'?index+1:visible).padStart(2,'0');
  });
  const isAll = course === 'all';
  const isK67 = course === 'k67';
  document.querySelector('#record-count').textContent = isAll ? '4 bài' : '2 bài';
  document.querySelector('#portal-badge').textContent = isAll
    ? 'Bản online · K56 + K67'
    : `Bản online · Khóa ${isK67 ? '67' : '56'}`;
  document.querySelector('#privacy-note').textContent = isAll
    ? 'DEMO không gửi Portal; K56 dùng lớp IC2264, K67 đồng bộ lớp IC2063 vào các cột Phase thi lại.'
    : isK67
      ? 'DEMO không gửi Portal; lớp IC2063 đồng bộ vào các cột Phase thi lại.'
      : 'DEMO không gửi Portal; lớp IC2264 áp dụng quy tắc điểm thi lại.';
  const next = new URL(location.href);
  if (isAll) next.searchParams.delete('course');
  else next.searchParams.set('course', course);
  history.replaceState(null, '', next);
}

courseFilter.addEventListener('change', renderCourse);
renderCourse();

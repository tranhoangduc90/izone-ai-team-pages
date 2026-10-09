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
    ? 'Danh sách lớp được tải từ hệ thống Substitute. DEMO không gửi Portal; giáo viên chỉ xem lớp phụ trách, quản trị xem toàn bộ.'
    : isK67
      ? 'Các lớp Khóa 67 đồng bộ vào cột Phase thi lại tương ứng. DEMO không gửi Portal.'
      : 'Các lớp Khóa 56 đồng bộ vào cột Term Test thi lại tương ứng. DEMO không gửi Portal.';
  const next = new URL(location.href);
  if (isAll) next.searchParams.delete('course');
  else next.searchParams.set('course', course);
  history.replaceState(null, '', next);
}

courseFilter.addEventListener('change', renderCourse);
renderCourse();

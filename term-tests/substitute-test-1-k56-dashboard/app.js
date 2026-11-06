const courseChoices = [...document.querySelectorAll('.course-choice')];
const testGroups = [...document.querySelectorAll('.test-group')];
const steps = [...document.querySelectorAll('.step')];
const picker = document.querySelector('#test-picker');
const heading = document.querySelector('#test-heading');
const courseLabel = document.querySelector('#test-course');
const hint = document.querySelector('#course-hint');
const allowedCourses = new Set(courseChoices.map(choice => choice.dataset.course));

function showCourse(course) {
  for (const choice of courseChoices) {
    const selected = choice.dataset.course === course;
    choice.setAttribute('aria-pressed', String(selected));
    choice.querySelector('.arrow').textContent = selected ? '✓' : '→';
  }
  for (const group of testGroups) {
    group.hidden = group.dataset.course !== course;
  }
  steps[0].removeAttribute('aria-current');
  steps[0].setAttribute('data-complete', '');
  steps[1].setAttribute('aria-current', 'step');
  courseLabel.textContent = 'Bạn đang chọn Khóa ' + course.slice(1) + '.';
  picker.hidden = false;
  hint.hidden = true;
}

const requested = new URLSearchParams(location.search).get('course');
if (allowedCourses.has(requested)) showCourse(requested);

for (const button of courseChoices) {
  button.addEventListener('click', () => {
    const course = button.dataset.course;
    showCourse(course);
    heading.focus();
    const next = new URL(location.href);
    next.searchParams.set('course', course);
    try { history.replaceState(null, '', next); } catch { /* Luồng chọn bài vẫn hoạt động nếu URL bị khóa. */ }
  });
}

const teacher = document.querySelector('#teacher');
const dialog = document.querySelector('#teacher-dialog');
teacher.addEventListener('click', () => dialog.showModal());
dialog.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const {left, right, top, bottom} = dialog.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
    dialog.close();
  }
});
dialog.addEventListener('close', () => teacher.focus());

import { demoContext } from './model.js?v=20261020-v2';
import { demoJournalPage } from './journal-entry-v4.mjs';

const course = document.getElementById('course');
const test = document.getElementById('test');
const order = document.getElementById('order');
const root = 'https://ducizone.ddns.net/exam-demo/term-tests/';
course.value = new URLSearchParams(location.search).get('course') === '56' ? '56' : '67';

function updateLinks() {
  const { slug, code, teacher } = demoContext(course.value, test.value);
  const params = new URLSearchParams({ class:code, mode:order.value });
  document.getElementById('openExam').href = root + demoJournalPage(slug+'-computer-based',code) + '?' + params;
  document.getElementById('openPaper').href = root + demoJournalPage(slug,code) + '?' + params;
  document.getElementById('openTeacher').href = '../' + teacher + '/?test=' + encodeURIComponent(slug);
}

course.addEventListener('change', () => {
  const url = new URL(location.href);
  url.searchParams.set('course',course.value);
  history.replaceState(null,'',url);
  updateLinks();
});
test.addEventListener('change',updateLinks);
order.addEventListener('change',updateLinks);
updateLinks();

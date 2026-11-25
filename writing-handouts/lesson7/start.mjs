import { lesson7Entry } from '../shared/lesson7-context.mjs?v=20261125-lesson7';

const opening = document.getElementById('lesson-access-body');
const transferred = new URLSearchParams(location.search).get('from') === 'lesson6';
if (!transferred) {
  void import('../shared/loader.mjs?v=20261125-lesson7&startup=20261026-v2');
} else if (lesson7Entry()) {
  const accessStyle = document.createElement('link');
  accessStyle.id = 'lesson-access-style';
  accessStyle.rel = 'stylesheet';
  accessStyle.href = new URL('../../homework-writing/workspace.css', import.meta.url).href;
  document.head.append(accessStyle);
  void import('../lesson4/start.mjs?v=20261125-lesson7');
} else {
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = 'Hãy mở lại Homework Lesson 6 từ Docs cá nhân để đọc dàn ý đã chuyển.';
  const link = document.createElement('a');
  link.href = './';
  link.textContent = 'Về cửa vào Lesson 7';
  opening.replaceChildren(message, link);
}

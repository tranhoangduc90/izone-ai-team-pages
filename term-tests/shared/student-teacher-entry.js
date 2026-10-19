import {installTeacherEntry} from '../../shared/teacher-entry.js?v=20261019-v1';

// Lối phụ nằm ngoài vùng app tự dựng lại. Không đọc/ghi phiên học viên hoặc tải Google.
const slug=window.TERM_TEST_CONFIG?.slug;
const teacherPath=document.body.dataset.teacherPage||'../teacher/index.html';
if(slug){
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('../../shared/teacher-entry.css?v=20261019-v1',import.meta.url).href;document.head.append(css);
 const host=document.createElement('nav');host.className='test-teacher-entry';host.setAttribute('aria-label','Lối vào giảng viên');document.body.prepend(host);
 installTeacherEntry({product:'term-test',teacherPath:teacherPath+'?'+new URLSearchParams({test:slug}),hosts:[host]});
}

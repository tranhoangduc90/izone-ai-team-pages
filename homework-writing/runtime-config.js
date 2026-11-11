// Cấu hình công khai; không chứa credential hoặc dữ liệu lớp.
const isK67=new URLSearchParams(globalThis.location?.search).get('workspace')==='k67';
export default Object.freeze({mode:'online',apiBase:'https://ducizone.ddns.net/'+(isK67?'homework-writing67-api':'homework-writing-api')+'/api',
  ssoScript:'https://tranhoangduc90.github.io/izone-ai-team-pages/shared/teacher-single-sign-on.js'});

// Cấu hình công khai; không chứa credential hoặc dữ liệu lớp.
const query=new URLSearchParams(globalThis.location?.search);
const isK67=query.get('workspace')==='k67';
const studentEntry=!isK67&&query.get('assignment')==='hw-trial-fast-food-intro';
export default Object.freeze({mode:'online',studentEntry,apiBase:'https://ducizone.ddns.net/'+(isK67?'homework-writing67-api':'homework-writing-api')+'/api',
  ssoScript:'https://tranhoangduc90.github.io/izone-ai-team-pages/shared/teacher-single-sign-on.js'});

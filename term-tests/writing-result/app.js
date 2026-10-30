// Chỉ đọc bản kết quả đã công bố qua quyền Journey; không có token/nút/API tạo, sửa hoặc nộp lượt thi.
import {stampProgressStudent,progressPinWasLoggedOut} from '../../progress-log/student-session-memory.js?rev=20261030-the20-v1';
const node=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
const status=document.getElementById('resultStatus'),retry=document.getElementById('resultRetry'),root=document.getElementById('resultContent'),back=document.getElementById('resultBack');
let controller=null,generation=0,loaded=null,loadedKey='';
function input(){
  const p=new URLSearchParams(location.hash.slice(1)),testSlug=p.get('test'),resultRef=p.get('result'),task=Number(p.get('task')||1);
  if(!/^term-test-[1-9]\d*$/u.test(testSlug||'')||!/^[0-9a-f]{64}$/u.test(resultRef||'')||![1,2].includes(task))throw Error('Đường dẫn kết quả chưa hợp lệ.');
  const accessToken=p.get('access');let identity;
  if(accessToken&&/^[A-Za-z0-9_-]{32,200}$/u.test(accessToken))identity={accessToken};
  else{
    const publicToken=p.get('assignment'),studentRef=p.get('student');
    if(!/^[0-9a-f-]{36}$/iu.test(publicToken||'')||!/^[0-9a-f-]{36}$/iu.test(studentRef||''))throw Error('Đường dẫn chưa có người học hợp lệ.');
    identity={publicToken,studentRef,identityConfirmed:true};
  }
  return {identity,testSlug,resultRef,task,key:JSON.stringify({identity,testSlug,resultRef})};
}
function rich(target,text){
  if(typeof text!=='string'||!text.trim())return;
  const template=document.createElement('template');template.innerHTML=text;
  const allowed=new Set(['P','BR','B','STRONG','I','EM','U','UL','OL','LI','H3','H4','H5','H6','BLOCKQUOTE','TABLE','THEAD','TBODY','TR','TH','TD']);
  const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','TEXTAREA','BUTTON','IMG']);
  function copy(source,dest){for(const child of source.childNodes){if(child.nodeType===3)dest.append(document.createTextNode(child.textContent));else if(child.nodeType===1&&!blocked.has(child.tagName)){
    if(allowed.has(child.tagName)){const element=document.createElement(child.tagName.toLowerCase());copy(child,element);dest.append(element);}else copy(child,dest);
  }}}
  copy(template.content,target);
}
function taskView(task){
  const section=node('section','','writing-feedback-shell'),header=node('header','','writing-feedback-header'),copy=node('div');
  copy.append(node('span','Kết quả Writing chỉ đọc'),node('h2',`Task ${task.taskNumber} · Band ${task.score}`),node('p',`${task.wordCount} từ`));header.append(copy);
  const layout=node('div','','writing-feedback-layout'),source=node('section','','writing-feedback-source'),scores=node('section','','writing-feedback-scores');
  source.append(node('h3','Đề bài'),node('p',task.prompt,'writing-feedback-prompt'));
  if(task.taskNumber===1&&task.imageUrl){const image=node('img','','writing-feedback-image');image.src=task.imageUrl;image.alt='Hình đề Writing Task 1';source.append(image);}
  if(task.report){const report=node('div','','writing-feedback-text writing-feedback-richtext');rich(report,task.report);source.append(node('h3','Nhận xét tổng hợp'),report);}
  const essay=node('div',task.essay||'Bài đã nộp không có nội dung.','writing-feedback-essay');essay.lang='en';source.append(node('h3','Bài viết của học viên'),essay);
  scores.append(node('h3',task.gradingMethod==='blank_rule'?'Quy tắc tính điểm':'Nhận xét theo tiêu chí'));
  if(task.gradingMethod==='blank_rule')scores.append(node('p','Task bắt buộc đã nộp không có nội dung nhận Band 0 theo quy tắc bài trắng.'));
  for(const criterion of task.criteria||[]){
    const card=node('article','','writing-criterion-card'),head=node('header');head.append(node('h4',criterion.name||criterion.code),node('strong',criterion.bandScore==null?'Chưa có điểm tiêu chí':'Band '+criterion.bandScore));card.append(head);
    if(criterion.feedback){const feedback=node('div','','writing-feedback-text writing-feedback-richtext');rich(feedback,criterion.feedback);card.append(feedback);}
    for(const component of criterion.components||[]){const box=node('section','','writing-component-detail');if(component.name)box.append(node('h5',component.name));
      for(const text of [component.summary,component.feedback])if(text){const block=node('div','','writing-feedback-text writing-feedback-richtext');rich(block,text);box.append(block);}card.append(box);}
    scores.append(card);
  }
  layout.append(source,scores);section.append(header,layout);return section;
}
function paint(result,params){
  const task=result.tasks.find(t=>t.taskNumber===params.task);if(!task)throw Error('Bài thi này không có kết quả Task đã chọn.');
  root.replaceChildren(node('h1',result.student.name),node('p',result.class.name+' · '+result.title,'result-context'));
  const nav=node('nav','','result-task-nav');nav.setAttribute('aria-label','Task Writing');
  for(const item of result.tasks){const link=node('a',`Task ${item.taskNumber}: ${item.score}`),url=new URL(location.href),p=new URLSearchParams(url.hash.slice(1));p.set('task',item.taskNumber);url.hash=p;link.href=url.href;if(item.taskNumber===params.task)link.setAttribute('aria-current','page');nav.append(link);}
  root.append(nav,taskView(task));root.hidden=false;status.textContent='';retry.hidden=true;
  const url=new URL('../../progress-log/'+(params.identity.accessToken?'journey.html':'thuy.html'),location.href);
  url.hash=new URLSearchParams(params.identity.accessToken?{access:params.identity.accessToken}:{assignment:params.identity.publicToken,student:params.identity.studentRef,view:'journey'});back.href=url.href;
  document.title='Task '+task.taskNumber+' · '+result.title+' · Kết quả Writing';
}
async function load(){
  controller?.abort();const version=++generation;root.hidden=true;root.replaceChildren();retry.hidden=true;
  try{
    const params=input();if(loaded&&loadedKey===params.key){paint(loaded,params);return;}
    loaded=null;loadedKey='';status.textContent='Đang mở kết quả Writing…';controller=new AbortController();const own=controller,timer=setTimeout(()=>own.abort(),15000);
    try{
      const response=await fetch(window.PROGRESS_LOG_CONFIG.API_BASE_URL+'/api/learning/student/writing-test-result',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({...params.identity,testSlug:params.testSlug,resultRef:params.resultRef}),cache:'no-store',referrerPolicy:'no-referrer',signal:own.signal});
      const data=await response.json().catch(()=>null);if(version!==generation)return;
      if(!response.ok||!data?.ok)throw Error(data?.message||'Chưa mở được kết quả Writing.');
      const result=data.result;
      if(result?.readOnly!==true||result.testSlug!==params.testSlug||result.resultRef!==params.resultRef||!result.student?.name||!result.class?.name
        ||params.identity.studentRef&&result.student.studentRef!==params.identity.studentRef||!Array.isArray(result.tasks)||!result.tasks.length
        ||result.tasks.some(task=>![1,2].includes(task.taskNumber)||!Number.isFinite(task.score)))throw Error('Kết quả chưa khớp người học và bài thi.');
      paint(result,params);loaded=result;loadedKey=params.key;
    }finally{clearTimeout(timer);}
  }catch(error){if(version===generation){root.hidden=true;root.replaceChildren();status.textContent=controller?.signal.aborted?'Quá thời gian chờ. Em có thể thử lại.':error.message;retry.hidden=false;}}
}
const returnToPortal=()=>{generation++;controller?.abort();loaded=null;root.hidden=true;root.replaceChildren();location.replace(new URL('../../progress-log/student.html',location.href));};
retry.addEventListener('click',()=>void load());window.addEventListener('hashchange',()=>void load());
window.addEventListener('pageshow',event=>{if(event.persisted&&progressPinWasLoggedOut())returnToPortal();});
if(progressPinWasLoggedOut()&&performance.getEntriesByType('navigation')[0]?.type==='back_forward')returnToPortal();
else{stampProgressStudent();void load();}

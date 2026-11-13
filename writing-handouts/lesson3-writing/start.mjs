import runtime from '../../homework-writing/runtime-config.js?v=20261111-ic2363';
import {frontendConfiguration,createOnlineAccess} from '../../homework-writing/online-access.js?v=20261113-single-entry';
import {rememberApprovedOutline} from '../../homework-writing/fast-food-dev-entry.js?v=20261111-ic2363';

const root=document.getElementById('lesson-access');
const config=frontendConfiguration(runtime);
const query=new URLSearchParams(location.search);
const assignment=query.get('assignment'),documentId=query.get('documentId');
const writing=new URL('../../homework-writing/',import.meta.url);
writing.search=new URLSearchParams({mode:'student',assignment,documentId,workspace:'k67'}).toString();

async function boot(){
  if(query.get('mode')!=='student'||query.get('workspace')!=='k67'||!/^hw-k67-fast-food-intro-[0-9]+$/.test(assignment||'')||
      !/^[\w-]{20,200}$/.test(documentId||''))throw Error('Mở Handout từ nút Writing trong Docs của em.');
  const access=createOnlineAccess(config,{onReady:enter});
  async function enter(session){
    const studentRef=access.verifiedDocsOwner(),stamp=access.stamp();
    if(session.person?.role!=='student'||!studentRef)throw Error('Link này dùng cho học viên đã xác minh.');
    const apiBase=config.apiBase+'/student/assignments/'+encodeURIComponent(assignment)+'/handout-editor';
    const request=(input,options={})=>{
      const url=new URL(input);
      if(!url.href.startsWith(apiBase+'/'))throw Error('Đường dẫn Handout chưa khớp bài.');
      if(!access.isCurrent(stamp))throw Object.assign(Error('Phiên Homework đã đổi.'),{status:401});
      const headers=new Headers(options.headers);
      const native=headers.get('Authorization');
      if(native)headers.set('X-HW-Handout',native);
      for(const [name,value]of Object.entries(access.headers()))headers.set(name,value);
      headers.set('X-HW-Csrf',session.csrf);
      return fetch(url,{...options,headers});
    };
    globalThis.handout67WritingHandoff=Object.freeze({
      apiBase,request,writingUrl:writing.href,verifiedDocsStudent:studentRef,showOpeningError,
      rememberVersion:version=>rememberApprovedOutline(documentId,version)
    });
    await import('../shared/loader.mjs?v=20261113-single-entry');
  }
  await enter(await access.open(root));
}

function showOpeningError(host,error,retry){
  if(error.stale)return;
  const denied=error.status===401||error.status===403;
  const status=document.createElement('p');
  status.setAttribute('role','alert');
  status.textContent=denied?'Chưa xác minh được quyền mở dàn ý. Hãy mở lại từ Docs cá nhân của bạn.':
    'Chưa mở được dàn ý. Bài đã lưu vẫn được giữ.';
  const action=document.createElement(denied?'a':'button');
  action.className='primary';
  action.textContent=denied?'Về cửa vào Writing':'Thử lại';
  if(denied)action.href=writing.href;
  else {action.type='button';action.onclick=retry;}
  host.replaceChildren(status,action);
  // Diagnostic stage and HTTP status only; do not log a Docs link, identity or session.
  console.warn('Lesson 3: không mở được dàn ý',denied?'access-denied':'open-failed',error.status||0);
}
const start=()=>boot().catch(error=>showOpeningError(root,error,start));
void start();

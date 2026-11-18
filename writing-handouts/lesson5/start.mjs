import runtime from '../../homework-writing/runtime-config.js?v=20261111-ic2363';
import {frontendConfiguration,createOnlineAccess} from '../../homework-writing/online-access.js?v=20261118-lesson5';

const query=new URLSearchParams(location.search);
const assignment=query.get('assignment');
const documentId=query.get('documentId');
const loadEditor=()=>import('../shared/loader.mjs?v=20261118-lesson5-writing&startup=20261026-v2');

if(query.get('workspace')==='k67'&&query.get('mode')==='student'&&/^hw-k67-writing-lesson5-[1-9]\d{0,17}$/.test(assignment||'')){
  const opening=document.querySelector('#lesson-loading');
  const card=document.createElement('section');
  card.className='login-shell';
  opening.before(card);
  card.append(opening);
  const accessStyle=document.createElement('link');
  accessStyle.rel='stylesheet';
  accessStyle.href=new URL('../../homework-writing/workspace.css',import.meta.url).href;
  document.head.append(accessStyle);
  const writingUrl=new URL('../../homework-writing/',import.meta.url);
  writingUrl.search=new URLSearchParams({mode:'student',assignment,...(documentId?{documentId}:{}),workspace:'k67'});
  const config=frontendConfiguration(runtime);

  function showOpeningError(root,error,retry){
    if(error.stale)return;
    const denied=[401,403].includes(error.status);
    const status=document.createElement('p');
    status.setAttribute('role','alert');
    status.textContent=denied?'Chưa xác minh được người học cho dàn ý này. Hãy vào lại bằng tài khoản của em.':'Chưa mở được dàn ý. Em có thể thử lại.';
    const button=document.createElement(denied?'a':'button');
    button.className='primary';
    button.textContent=denied?'Về cửa vào Writing':'Thử lại';
    if(denied)button.href=writingUrl.href;
    else{button.type='button';button.onclick=retry;}
    root.replaceChildren(status,button);
  }

  const access=createOnlineAccess(config,{onReady:enter,compactStudentEntry:true});
  async function enter(session){
    const studentRef=documentId?access.verifiedDocsOwner():access.verifiedStudent();
    if(session.person?.role!=='student'||!studentRef)throw Object.assign(Error('WRITING_ENTRY_REQUIRED'),{status:403});
    const stamp=access.stamp();
    const apiBase=config.apiBase+'/student/assignments/'+encodeURIComponent(assignment)+'/handout-editor';
    function request(input,options={}){
      const url=new URL(input);
      if(!url.href.startsWith(apiBase+'/'))throw Error('HANDOUT_PATH_MISMATCH');
      if(!access.isCurrent(stamp))throw Object.assign(Error('ACCOUNT_CHANGED'),{status:401});
      const headers=new Headers(options.headers);
      const native=headers.get('Authorization');
      if(native)headers.set('X-HW-Handout',native);
      for(const [name,value] of Object.entries(access.headers()))headers.set(name,value);
      headers.set('X-HW-Csrf',session.csrf);
      return fetch(url,{...options,headers,credentials:'include'});
    }
    globalThis.handout67WritingHandoff=Object.freeze({
      apiBase,request,verifiedDocsStudent:studentRef,writingUrl:writingUrl.href,openingHost:card,showOpeningError,
      reviewOutline:query.get('outline')==='review',
      finishOpening(){card.hidden=true;accessStyle.remove();}
    });
    await loadEditor();
  }
  const boot=()=>access.open(card).then(enter).catch(error=>showOpeningError(card,error,boot));
  void boot();
}else{
  void loadEditor();
}

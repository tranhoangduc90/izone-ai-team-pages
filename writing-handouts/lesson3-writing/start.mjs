import runtime from '../../homework-writing/runtime-config.js?v=20261111-ic2363';
import {frontendConfiguration,createOnlineAccess} from '../../homework-writing/online-access.js?v=20261111-ic2363';
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
    if(session.person?.role!=='student')throw Error('Link này dùng cho học viên đã xác minh.');
    const apiBase=config.apiBase+'/student/assignments/'+encodeURIComponent(assignment)+'/handout-editor';
    const request=(input,options={})=>{
      const url=new URL(input);
      if(!url.href.startsWith(apiBase+'/'))throw Error('Đường dẫn Handout chưa khớp bài.');
      const headers=new Headers(options.headers);
      const native=headers.get('Authorization');
      if(native)headers.set('X-HW-Handout',native);
      for(const [name,value]of Object.entries(access.headers()))headers.set(name,value);
      headers.set('X-HW-Csrf',session.csrf);
      return fetch(url,{...options,headers});
    };
    globalThis.handout67WritingHandoff=Object.freeze({
      apiBase,request,writingUrl:writing.href,rememberVersion:version=>rememberApprovedOutline(documentId,version)
    });
    document.getElementById('lesson-access-style')?.remove();
    await import('../shared/loader.mjs?v=20261111-dev-docs-entry');
  }
  await enter(await access.open(root));
}
boot().catch(error=>{if(!error.stale)root.textContent=error.message;});

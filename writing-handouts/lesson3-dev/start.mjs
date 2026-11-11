import runtime from '../../homework-writing/runtime-config.js';
import {frontendConfiguration,createOnlineAccess} from '../../homework-writing/online-access.js';
import {rememberApprovedOutline} from '../../homework-writing/fast-food-dev-entry.js';

const root=document.getElementById('lesson-access');
const config=frontendConfiguration(runtime);
const assignment='hw-trial-fast-food-intro';
const query=new URLSearchParams(location.search);
const documentId=query.get('documentId');
const writing=new URL('../../homework-writing/',import.meta.url);
writing.search=new URLSearchParams({mode:'student',assignment,documentId}).toString();
async function boot(){
  if(query.get('mode')!=='student'||query.get('assignment')!==assignment||!(/^[\w-]{20,200}$/u.test(documentId||''))){
    throw Error('Mở Handout từ liên kết Fast Food dành cho lớp DEV.');
  }
  const access=createOnlineAccess(config,{onReady:enter});
  async function enter(session){
    if(session.person?.role!=='student'||session.person.id!=='hw-trial-student')throw Error('Liên kết này dành cho học viên lớp DEV đã được xác minh.');
    const apiBase=config.apiBase+'/student/handout-dev';
    const request=(input,options={})=>{
      const url=new URL(input);
      if(!url.href.startsWith(apiBase+'/'))throw Error('Đường dẫn Handout DEV không hợp lệ.');
      const headers=new Headers(options.headers);
      headers.set('X-Homework-Authorization',access.headers().Authorization);
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
boot().catch(error=>{
  if(error.stale)return;
  root.textContent=error.message;
});

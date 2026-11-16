import {createTeacherAuthState} from '../../shared/teacher-auth-state.js?v=20261026-startup2';

const base='https://ducizone.ddns.net/api/handout67/v1/teacher';
const session=new URLSearchParams(location.hash.slice(1)).get('session')||'';
const validSession=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(session);
const byId=id=>document.getElementById(id);
const labels={topicSentence:'Thông điệp chung',idea1:'Ý 1',idea2:'Ý 2'};
const states={draft:'Chưa Check',pending:'Đang Check',revision:'Cần Check lại',technical_error:'Check gặp lỗi'};
const auth=createTeacherAuthState({panel:byId('login'),notice:byId('notice'),retry:load,hideOnReady:true});
let googleSetup;
let generation=0;

function element(tag,text){
  const node=document.createElement(tag);
  node.textContent=text;
  return node;
}

async function read(path){
  const response=await fetch(base+path,{credentials:'include',cache:'no-store',
    redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Object.assign(Error(response.status===404?
    'Liên kết dàn ý đã hết hiệu lực.'+' Hãy mở lại từ Homework Docs.':
    'Hãy thử lại sau khi kết nối ổn định.'),{status:response.status});
  return response.json();
}

function clear(){
  byId('outline').hidden=true;
  for(const id of ['student','progress','bodies'])byId(id).replaceChildren();
}

function render(outline){
  if(outline.ref!==session||outline.bodies?.length!==2||
      !outline.bodies.every((body,index)=>body.body===index+1&&body.fields))throw Error('Dàn ý trả về không khớp liên kết.');
  byId('student').textContent=outline.displayName+' · '+outline.classRef;
  byId('progress').textContent=outline.passed+'/2 thân bài đạt · Chỉ đọc';
  for(const body of outline.bodies){
    const panel=element('section','');panel.className='panel';
    const fields=element('dl','');
    for(const [key,label] of Object.entries(labels)){
      fields.append(element('dt',label),element('dd',body.fields[key]||'Chưa có nội dung.'));
    }
    panel.append(element('h3','Thân bài '+body.body),
      element('p',body.passed?'Đã đạt':states[body.status]||'Chưa đạt'),fields);
    if(body.feedback)panel.append(element('h4','Nhận xét lần Check gần nhất'),element('p',body.feedback));
    if(body.feedbackFromEarlierVersion)panel.append(element('p','Lần Check gần nhất thuộc nội dung trước khi học viên sửa.'));
    byId('bodies').append(panel);
  }
  byId('outline').hidden=false;
}

async function load(){
  const current=++generation;
  clear();
  if(!validSession){
    byId('notice').textContent='Liên kết dàn ý không hợp lệ. Hãy mở lại từ Homework Docs.';
    return;
  }
  auth.checking();
  try{
    const {outline}=await read('/lesson4-outline/'+encodeURIComponent(session));
    if(current!==generation)return;
    render(outline);
    byId('logout').hidden=false;
    auth.ready();
  }catch(error){
    if(current!==generation)return;
    auth.failed(error);
    if(error.status===401){
      byId('logout').hidden=true;
      auth.signedOut();
      await setupGoogle().catch(showLoginError);
    }else if(error.status===403)byId('logout').hidden=false;
  }
}

function showLoginError(error){
  byId('login-error').textContent=error.message;
  byId('login-error').hidden=false;
}

function setupGoogle(){
  googleSetup??=(async()=>{
    const {clientId}=await read('/config');
    if(!window.google?.accounts?.id)await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://accounts.google.com/gsi/client';
      script.onload=resolve;
      script.onerror=()=>{script.remove();reject(Error('Chưa tải được nút Google. Hãy tải lại trang.'));};
      document.head.append(script);
    });
    window.google.accounts.id.initialize({client_id:clientId,callback:async({credential})=>{
      byId('login-error').hidden=true;
      try{
        await window.IzoneTeacherSso.login('handout67',credential,byId('remember').checked);
        await load();
      }catch(error){showLoginError(error);}
    },auto_select:false});
    window.google.accounts.id.renderButton(byId('google-signin'),{theme:'outline',size:'large',text:'signin_with',locale:'vi'});
  })().catch(error=>{googleSetup=null;throw error;});
  return googleSetup;
}

byId('logout').addEventListener('click',async()=>{
  const button=byId('logout');
  button.disabled=true;
  generation++;
  clear();
  auth.checking();
  try{
    await window.IzoneTeacherSso.logout();
    window.google?.accounts?.id.disableAutoSelect();
    await load();
  }catch(error){auth.failed(error);}
  finally{button.disabled=false;}
});
window.addEventListener('hashchange',()=>location.reload());
window.addEventListener('storage',event=>{
  if(['izone:teacher-sso-logout','izone:teacher-sso-login'].includes(event.key))void load();
});
void load();

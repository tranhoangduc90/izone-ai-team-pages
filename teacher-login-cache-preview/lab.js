// Diagnostic UI: HTTPS only, no mocked API/Google, no tokens in storage or reports.
(async()=>{
 'use strict';
 const variant=document.documentElement.dataset.variant,params=new URLSearchParams(location.search),product=params.get('product')||'handout67';
 const api='https://ducizone.ddns.net/teacher-login-cache-preview-api/'+variant;
 const $=id=>document.getElementById(id),network=window.CacheLabNetwork;
 const config=await(await fetch(api+'/lab/config',{credentials:'include',cache:'no-store'})).json();
 const def=config.products.find(p=>p.id===product);if(!def)throw Error('Unknown product');
 $('product').textContent=def.label;$('revision').textContent=variant+' · '+config.revision;
 for(const p of config.products){const a=document.createElement('a');a.textContent=p.label;a.href='?product='+p.id;if(p.id===product)a.className='active';$('products').append(a);}
 const other=variant==='before'?'after':'before';$('variant').href='../'+other+'/?product='+product;$('variant').textContent=other==='after'?'Sang bản tối ưu':'Sang bản gốc';
 let run=0;
 const url=(port=def.port,path=def.readPath)=>'https://ducizone.ddns.net'+(port?':'+port:'')+'/teacher-login-cache-preview-api/'+variant+path;
 const state=(message,type='')=>{$('status').textContent=message;$('status').dataset.state=type;};
 async function open(){
  const turn=++run,start=performance.now(),offset=network.length;
  let status,error='';
  try{const r=await fetch(url(),{credentials:'include',cache:'no-store'});status=r.status;if(!r.ok)error=String(r.status);}
  catch(e){status=e.status||0;error=e.message;}
  const stats={variant,product,status,elapsedMs:+(performance.now()-start).toFixed(1),requests:network.slice(offset)};
  $('metrics').textContent=JSON.stringify(stats,null,2);
  if(params.get('sample')){parent.postMessage({type:'sso-cache-sample',key:params.get('sample'),stats},location.origin);return;}
  if(turn!==run)return;
  if(status===200){state('Đã mở '+def.label+' bằng phiên dùng chung.','ok');$('logout').hidden=false;$('login').hidden=true;}
  else if(status===401){state('Chưa có phiên. Đăng nhập Google để bắt đầu.');$('login').hidden=false;$('logout').hidden=true;await showGoogle();}
  else{state('Bị từ chối hoặc chưa xác minh được phiên: '+(error||status),'error');$('login').hidden=false;await showGoogle();}
  return stats;
 }
 let googlePromise;
 function showGoogle(){
  if(googlePromise)return googlePromise;
  return googlePromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onerror=reject;
   script.onload=()=>{google.accounts.id.initialize({client_id:config.googleClientId,auto_select:false,callback:async value=>{
    state('Đang xác minh Google và lưu phiên thử…');
    try{
     if(def.identity)await window.IzoneTeacherSso.login(def.id,value.credential,$('remember').checked);
     else{
      const path=def.apiPrefix+(def.kind==='reviewer'?'/auth/session':'/teacher/login');
      const response=await fetch(url(def.port,path),{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-Izone-Csrf':'1'},body:JSON.stringify({credential:value.credential,remember:$('remember').checked})});
      if(!response.ok)throw Error('Google xác minh hoặc quyền: '+response.status);
     }
     await open();
    }catch(e){state(e.message,'error');}
   }});google.accounts.id.renderButton($('google'),{theme:'outline',size:'large',width:300});resolve();};
   document.head.append(script);
  });
 }
 $('reload').onclick=()=>location.reload();
 $('logout').onclick=async()=>{try{state('Đang đăng xuất phiên thử ở mọi sản phẩm…');await window.IzoneTeacherSso.logout();state('Đã đăng xuất phiên thử.');await open();}catch(e){state(e.message,'error');}};
 $('check').onclick=()=>open();
 $('benchmark').onclick=async()=>{
  $('benchmark').disabled=true;$('rows').replaceChildren();const records=[];
  try{
   for(let round=0;round<3;round++)for(const current of (round%2?['after','before']:['before','after']))for(const p of config.products){
    state('Đang đo '+current+' · '+p.label+' · lượt '+(round+1));
    const key=crypto.randomUUID(),frame=document.createElement('iframe');frame.className='measure';frame.title='Đo phiên '+p.label;
    const result=await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{cleanup();reject(Error('Hết thời gian đo '+p.id));},30000);
     const listener=e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=='sso-cache-sample'||e.data.key!==key)return;cleanup();resolve(e.data.stats);};
     function cleanup(){clearTimeout(timer);removeEventListener('message',listener);frame.remove();}
     addEventListener('message',listener);frame.src='../'+current+'/?product='+p.id+'&sample='+key;document.body.append(frame);
    });
    records.push(result);const tr=document.createElement('tr');for(const value of [current,p.label,result.status,result.elapsedMs,result.requests.length]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}$('rows').append(tr);
   }
   $('results').textContent=JSON.stringify({kind:'real_https_session_route',rounds:3,records},null,2);state('Đã đo 60 lượt mở route phiên qua HTTPS.','ok');
  }catch(e){state(e.message,'error');$('results').textContent=JSON.stringify({partial:true,records},null,2);}
  finally{$('benchmark').disabled=false;}
 };
 await open();
})().catch(e=>{document.getElementById('status').textContent='Không khởi tạo được bản thử: '+e.message;});

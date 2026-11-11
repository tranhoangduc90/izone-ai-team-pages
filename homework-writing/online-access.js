import {createCourseStudentIdentity} from './identity/course-student-identity.js';
import {createStudentIdentityMemory} from './identity/student-identity.js';
import {mountStudentEntry} from './student-entry.js?v=20261111-self-match';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const changed=()=>Object.assign(Error('Người hoặc bài đang mở đã đổi. Chưa dùng phản hồi cũ.'),{stale:true,handled:true});
const scriptTasks=new Map();
function script(url,attributes={}){
  if(scriptTasks.has(url))return scriptTasks.get(url);
  const task=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;Object.assign(s.dataset,attributes);s.onload=()=>resolve();s.onerror=()=>{s.remove();reject(Error('Chưa tải được đăng nhập dùng chung. Hãy thử lại.'));};document.head.append(s);});
  scriptTasks.set(url,task);task.catch(()=>{if(scriptTasks.get(url)===task)scriptTasks.delete(url);});return task;
}
export function frontendConfiguration(config,location=globalThis.location){
  if(!config||!['local','online'].includes(config.mode))throw Error('Chưa có cấu hình đúng cho giao diện Homework.');
  if(config.mode==='local'){if(location.hostname!=='127.0.0.1')throw Error('Bản local không được mở như đăng nhập online.');return {mode:'local',apiBase:new URL('./api',location.href).href};}
  let api;try{api=new URL(config.apiBase);}catch{throw Error('Chưa cấu hình API Homework online.');}
  if((api.protocol!=='https:'&&!(api.protocol==='http:'&&api.hostname==='127.0.0.1'&&location.hostname==='127.0.0.1'))||api.username||api.password||api.search||api.hash||!api.pathname.endsWith('/api'))throw Error('API Homework online chưa đúng phạm vi.');
  return {mode:'online',studentEntry:config.studentEntry===true,studentEntryMemory:config.studentEntryMemory,apiBase:api.href.replace(/\/$/,''),ssoScript:new URL(config.ssoScript||'../shared/teacher-single-sign-on.js',location.href).href};
}
export function createOnlineAccess(config,{onWarning=()=>{},onTeacherChanged=()=>{},onReady=()=>{}}={}){
  const query=new URLSearchParams(location.search);let context=query.has('documentId')?{documentId:query.get('documentId'),assignmentId:query.get('assignment')}:null;
  if(context&&(!/^[A-Za-z0-9_-]{20,200}$/.test(context.documentId||'')||!context.assignmentId))throw Error('Link Docs chưa chỉ rõ bài Homework.');
  let intent=['teacher','operator'].includes(query.get('mode'))?query.get('mode'):query.get('teacher')==='1'?'teacher':'student';
  let epoch=0,token='',entry=null,active=null,pendingReject,publicConfig;
  const storageKey='homework-writing:session:v1:'+config.apiBase,memory=createStudentIdentityMemory();
  const course=createCourseStudentIdentity({product:'homework-writing',entry:'workspace',memory,requestIdentity:input=>raw('/access/identity/resolve',input)});
  const teacherIntent=()=>intent!=='student';
  const entryPicker=()=>config.studentEntry||Boolean(context&&publicConfig?.selfMatchAssignment===context.assignmentId);
  // The DEV class label is not an ERP class code. Keep its verified selection
  // within the DEV origin/API scope; a local value never authenticates a user.
  const scopedMemoryKey=storageKey+':verified-owner';
  const scopedIdentity=id=>config.studentEntry&&config.studentEntryMemory==='scoped'&&id;
  function matchesRemembered(id){
    if(scopedIdentity(id)){
      return scopedRemembered()===id.ownerId;
    }
    const saved=memory.read();
    return saved.status==='ok'&&saved.identity.id===id?.erpId;
  }
  function scopedRemembered(){try{return localStorage.getItem(scopedMemoryKey);}catch{return null;}}
  function rememberScoped(id){
    try{localStorage.setItem(scopedMemoryKey,id.ownerId);}
    catch{onWarning('Đã vào đúng bài; chưa lưu được tên cho lần sau.');}
  }
  const requiresAssignedTeacher=()=>intent==='teacher'&&query.get('workspace')==='k67'&&query.has('submission');
  function headers(){return {...(!teacherIntent()?{'X-HW-Student':'1'}:{}),...(!teacherIntent()&&token?{Authorization:'Bearer '+token}:{}),...(!teacherIntent()&&context?{'X-HW-Document':context.documentId,'X-HW-Assignment':context.assignmentId}:{})};}
  async function raw(route,body,method=body===undefined?'GET':'POST'){
    const stamp=epoch;let response;
    try{response=await fetch(config.apiBase+route,{method,credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-HW-Csrf':'1','X-HW-Access':'1',...headers()},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});}catch(e){if(stamp!==epoch)throw changed();throw Object.assign(Error('Chưa kết nối được Homework. Nội dung đang làm vẫn được giữ.'),{network:true});}
    if(stamp!==epoch)throw changed();let data;try{data=await response.json();}catch{throw Error('Phản hồi chưa đúng từ API Homework.');}
    if(stamp!==epoch)throw changed();if(!response.ok)throw Object.assign(Error(data.message||'Chưa kiểm được quyền vào bài.'),{status:response.status,...data});return data;
  }
  function invalidate(){epoch++;course.invalidate();token='';active=null;pendingReject?.(changed());pendingReject=null;}
  function routeUrl(params={}){
    const u=new URL(location.href),fresh=u.searchParams.has('fresh'),workspace=u.searchParams.get('workspace');u.search='';u.hash='';if(fresh)u.searchParams.set('fresh','1');for(const [key,value]of Object.entries(params))if(value!==undefined&&value!==null)u.searchParams.set(key,value);
    if(workspace==='k67')u.searchParams.set('workspace',workspace);
    if(teacherIntent())u.searchParams.set('mode',intent);
    else {u.searchParams.set('mode','student');if(context){u.searchParams.set('documentId',context.documentId);u.searchParams.set('assignment',context.assignmentId);if(!params.assignment&&!params.submission&&!params.view)u.searchParams.set('view','assignments');}}
    return u;
  }
  function cached(){try{return JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{return null;}}
  function rememberSession(session,identity){active={...session,identity};try{sessionStorage.setItem(storageKey,JSON.stringify({token,person:session.person,identity,entry:context}));}catch{onWarning('Bài đã mở; trình duyệt chưa giữ được phiên khi tải lại tab.');}return {...session,person:{...session.person,...(identity?.className?{classLabel:identity.className}:{})}};}
  async function workspace(){
    if(!context||teacherIntent())return active;
    const stamp=epoch,previous=active;
    if(!previous?.person||previous.person.role!=='student')throw Error('Cần vào lại đúng tên trước khi mở danh sách bài.');
    const session=await raw('/access/student/workspace',{});if(stamp!==epoch)throw changed();
    if(!/^[\w-]{43}$/.test(session.token||'')||session.person?.role!=='student'||session.person.id!==previous.person.id||session.person.classId!==previous.person.classId||['ownerId','courseId','erpId'].some(k=>session.identity?.[k]!==previous.identity?.[k]))throw Error('Phiên danh sách chưa khớp người đang dùng tab. Bản nháp vẫn được giữ.');
    context=null;entry=null;epoch++;course.invalidate();token=session.token;course.pin(session.identity.ownerId,{classRef:session.identity.courseId});return rememberSession(session,session.identity);
  }
  async function completeStudent(value,stamp,{remember=false}={}){
    if(stamp!==epoch)throw changed();
    if(!/^[\w-]{43}$/.test(value.token||'')||value.person?.role!=='student'||!value.identity?.ownerId||!value.identity?.courseId)throw Error('Phiên Homework chưa đúng người đã xác minh.');
    token=value.token;
    if(context){
      entry=(await raw('/access/entry?'+new URLSearchParams(context))).entry;if(stamp!==epoch)throw changed();
      if(entry.documentId!==context.documentId||entry.assignmentId!==context.assignmentId||entry.studentRef!==value.identity.ownerId||entry.classId!==value.identity.courseId)throw Error('Google chưa khớp chủ link Docs.');
    }
    if(remember&&scopedIdentity(value.identity))rememberScoped(value.identity);
    else if(remember){const prepared=course.prepare(value.identity.ownerId,value.identity.className);const result=await course.commit(prepared);if(stamp!==epoch)throw changed();if(!['ok','empty'].includes(result.status))onWarning('Đã vào đúng bài; chưa cập nhật được mã ghi nhớ trên trình duyệt.');}
    course.pin(value.identity.ownerId,{classRef:value.identity.courseId});const u=new URL(location.href);if(u.searchParams.has('fresh')){u.searchParams.delete('fresh');try{history.replaceState(history.state,'',u);}catch{}}return rememberSession(value,value.identity);
  }
  async function open(root,{forceChoose=false}={}){
    invalidate();const stamp=epoch;root.innerHTML='<p class="loading" role="status">Đang kiểm tra quyền vào Homework…</p>';
    publicConfig=await raw('/access/config');if(stamp!==epoch)throw changed();
    if(publicConfig.version!==1||publicConfig.product!=='homework-writing-5667-local'||publicConfig.mode!=='online'||publicConfig.teacherConsumer!=='homeworkwriting')throw Error('Máy chủ chưa bật đúng điểm nối Homework online.');
    if(teacherIntent())return openTeacher(root,stamp);
    const fresh=forceChoose||new URLSearchParams(location.search).has('fresh'),saved=cached();
    const sameDocument=(!saved?.entry&&!context)||context&&saved?.entry?.documentId===context.documentId&&saved?.entry?.assignmentId===context.assignmentId;let rejected=false;
    if(!fresh&&sameDocument&&/^[\w-]{43}$/.test(saved?.token||'')){
      token=saved.token;try{const session=await raw('/session');if(stamp!==epoch)throw changed();if(session.person?.role!=='student'||session.person.id!==saved.person?.id)throw Object.assign(Error('Phiên chưa đúng người đã ghim.'),{status:401});return completeStudent({...session,token,identity:saved.identity},stamp);}catch(e){token='';if(![401,403].includes(e.status))throw e;rejected=true;}
    }
    if(!fresh&&!rejected){
      try{
        const value=await raw('/access/student/restore',{});
        if(stamp!==epoch)throw changed();
        if(entryPicker()){
          if(value.choiceRequired||!matchesRemembered(value.identity))
            return chooseStudent(root,stamp,value);
        }
        if(value.choiceRequired)return studentGoogle(root,stamp,{choices:value.choices,restore:true});
        return completeStudent(value,stamp);
      }
      catch(e){if(![401,403].includes(e.status))throw e;}
    }
    return entryPicker() ? chooseStudent(root,stamp) : studentGoogle(root,stamp);
  }
  const roleField=()=>'<label class="field"><span>Vai trò</span><select id="online-role"><option value="student">Học viên</option><option value="teacher">Giảng viên</option><option value="operator">Vận hành</option></select></label>';
  function roleListener(root,reject){const input=root.querySelector('#online-role');input.value=intent;input.onchange=()=>{intent=input.value;invalidate();const u=routeUrl(context?{assignment:context.assignmentId}:{});history.replaceState(history.state,'',u);reject(changed());void open(root).then(session=>onReady(session,epoch)).catch(e=>{if(!e.stale)showError(root,e);});};}
  function studentGoogle(root,stamp,initial={}){
    root.innerHTML='<div class="login-layout compact-login"><section class="card login-card"><h1>Đăng nhập</h1>'+roleField()+'<p>Dùng tài khoản Google là chủ Docs được giao. Homework sẽ ghi nhớ sau khi xác nhận.</p><div id="google-login"></div><div id="owned-profiles"></div><div id="online-error" role="alert"></div></section></div>';
    return new Promise((resolve,reject)=>{
      pendingReject=reject;roleListener(root,reject);const error=root.querySelector('#online-error'),profiles=root.querySelector('#owned-profiles');let busy=false,credential='',restore=!!initial.restore;
      async function accept(value){if(stamp!==epoch)throw changed();if(value.choiceRequired){showProfiles(value.choices);return;}const session=await completeStudent(value,stamp,{remember:true});credential='';pendingReject=null;resolve(session);}
      async function submit(selection={}){if(busy||stamp!==epoch)return;busy=true;error.textContent='';try{const value=await raw(restore?'/access/student/restore':'/access/student/login',{...selection,...(!restore?{credential}:{})});await accept(value);}catch(e){if(stamp===epoch)error.textContent=e.message;}finally{busy=false;}}
      function showProfiles(choices){
        if(!Array.isArray(choices)||!choices.length)throw Error('Chưa có hồ sơ thuộc Google này.');
        profiles.innerHTML='<label class="field"><span>Hồ sơ đã xác minh</span><select id="online-profile">'+choices.map((p,i)=>'<option value="'+i+'">'+esc(p.classCode+' - '+p.name)+'</option>').join('')+'</select></label><button id="online-login" class="primary">Mở bài</button>';
        profiles.querySelector('#online-login').onclick=()=>{const p=choices[Number(profiles.querySelector('select').value)];void submit({classId:p.classId,studentRef:p.studentRef});};
      }
      if(initial.choices)showProfiles(initial.choices);
      void(async()=>{
        if(!publicConfig.googleClientId){error.textContent='Chưa cấu hình đăng nhập Google riêng cho Homework.';return;}
        const challenge=await raw('/access/student/challenge',{});if(stamp!==epoch)return;
        if(!window.google?.accounts?.id)await script('https://accounts.google.com/gsi/client');if(stamp!==epoch)return;
        window.google.accounts.id.initialize({client_id:publicConfig.googleClientId,nonce:challenge.nonce,callback:async value=>{if(stamp!==epoch||busy)return;credential=value.credential;restore=false;profiles.innerHTML='';await submit();}});
        window.google.accounts.id.renderButton(root.querySelector('#google-login'),{theme:'outline',size:'large',text:'signin_with'});
      })().catch(e=>{if(stamp===epoch)error.textContent=e.message;});
    });
  }
  function chooseStudent(root,stamp,initial){
    return new Promise((resolve,reject)=>{
      pendingReject=reject;
      let ready=initial,credential='';
      const picker=mountStudentEntry(root,{
        personal:!!context,
        rememberedDifferent:row=>{
          if(scopedIdentity(row)){const stored=scopedRemembered();return stored&&stored!==row.studentRef;}
          const stored=memory.read();
          return stored.status==='ok'&&row.erpId&&stored.identity.id!==row.erpId;
        },
        onTeacher:()=>location.assign(teacherUrl()),
        onChange:()=>{void open(root,{forceChoose:true}).then(session=>onReady(session,epoch)).catch(e=>showError(root,e));},
        onChoose:row=>run(async()=>{
          const selection={classId:row.classId,studentRef:row.studentRef,
            ...(ready?.selfMatch?{selfMatchToken:ready.selfMatch.token}:{})};
          const value=ready?.choiceRequired
            ? await raw(credential?'/access/student/login':'/access/student/restore',{...selection,...(credential?{credential}:{})})
            : ready;
          if(value?.identity?.ownerId!==row.studentRef||value.identity.courseId!==row.classId)
            throw Error('Phiên Homework chưa khớp tên đã chọn. Hãy mở lại từ Docs của bạn.');
          const session=await completeStudent(value,stamp,{remember:true});
          credential='';pendingReject=null;resolve(session);
        })
      });
      const error=root.querySelector('#online-error');
      function teacherUrl(){
        const u=new URL(location.href);
        u.searchParams.set('mode','teacher');
        return u;
      }
      function display(value){
        if(stamp!==epoch)return;
        ready=value;
        if(value.choiceRequired){
          const match=value.selfMatch;
          if(match&&(!/^[\w-]{43}$/.test(match.token)||typeof match.account!=='string'||match.account.length>320))
            throw Error('Phản hồi xác nhận hồ sơ chưa hợp lệ.');
          picker.profiles(value.choices,match);return;
        }
        const id=value.identity;
        if(!id?.ownerId||!id?.courseId||!id?.name||!id?.className||value.person?.role!=='student')
          throw Error('Chưa nhận được hồ sơ Homework hợp lệ.');
        picker.profiles([{classId:id.courseId,classCode:id.className,studentRef:id.ownerId,name:id.name,erpId:id.erpId}]);
      }
      let busy=false;
      async function run(action){
        if(busy||stamp!==epoch)return;
        busy=true;error.textContent='';picker.setBusy(true);
        try{await action();}
        catch(e){
          if(stamp!==epoch)return;
          error.textContent=e.code==='GOOGLE_OWNER_MISMATCH'
            ? 'Chưa xác nhận được tên cho tài khoản Google này. Dùng đúng tài khoản chủ Docs; nếu vẫn thiếu tên, nhờ giảng viên kiểm tra liên kết ERP và Classroom.'
            : e.message;
        }finally{busy=false;if(stamp===epoch)picker.setBusy(false);}
      }
      if(initial){try{display(initial);}catch(e){error.textContent=e.message;}return;}
      void run(async()=>{
        if(!publicConfig.googleClientId)throw Error('Chưa cấu hình xác minh Google cho Homework.');
        const challenge=await raw('/access/student/challenge',{});
        if(stamp!==epoch)return;
        if(!window.google?.accounts?.id)await script('https://accounts.google.com/gsi/client');
        if(stamp!==epoch)return;
        window.google.accounts.id.initialize({client_id:publicConfig.googleClientId,nonce:challenge.nonce,callback:value=>{
          void run(async()=>{credential=value.credential;display(await raw('/access/student/login',{credential}));});
        }});
        window.google.accounts.id.renderButton(root.querySelector('#google-login'),{theme:'outline',size:'large',text:'signin_with'});
      });
    });
  }
  async function sdk(){const u=new URL(config.ssoScript);if(u.origin!==location.origin)throw Error('Script phiên dùng chung chưa đúng nguồn Pages.');if(!window.IzoneTeacherSso)await script(u.href,{izoneTeacherProduct:'homeworkwriting'});if(!window.IzoneTeacherSso?.restore)throw Error('Chưa nạp được consumer Homework vào phiên dùng chung.');return window.IzoneTeacherSso;}
  async function teacherSession(stamp){
    const session=await raw('/session');if(stamp!==epoch)throw changed();
    const role=session.person?.role;
    if(requiresAssignedTeacher()&&role!=='teacher')throw Object.assign(Error('Chọn tài khoản Google của giảng viên phụ trách bài này.'),{status:403});
    if(!['teacher','operator'].includes(role)||intent==='operator'&&role!=='operator')throw Object.assign(Error('Tài khoản chưa có vai trò được yêu cầu trong Homework.'),{status:403});
    active=session;return session;
  }
  async function openTeacher(root,stamp){
    const sso=await sdk();if(stamp!==epoch)throw changed();const restored=await sso.restore('homeworkwriting');if(stamp!==epoch)throw changed();
    if(restored){try{return await teacherSession(stamp);}catch(e){if(e.status!==401&&!(requiresAssignedTeacher()&&e.status===403))throw e;}}
    root.innerHTML='<div class="login-layout compact-login"><section class="card login-card"><h1>Đăng nhập</h1>'+roleField()+'<p>Dùng tài khoản Google đã được cấp quyền Homework.</p><div id="google-login"></div><button id="online-sso-retry" type="button">Kiểm tra lại phiên dùng chung</button><div id="online-error" role="alert"></div></section></div>';
    return new Promise((resolve,reject)=>{pendingReject=reject;roleListener(root,reject);const error=root.querySelector('#online-error');root.querySelector('#online-sso-retry').onclick=async()=>{try{if(await sso.restore('homeworkwriting',{force:true})){const session=await teacherSession(stamp);pendingReject=null;resolve(session);}else error.textContent='Chưa có phiên giảng viên dùng chung.';}catch(e){if(stamp===epoch)error.textContent=e.message;}};
      if(!publicConfig.googleClientId){error.textContent='Chưa cấu hình đăng nhập Google cho consumer Homework. Có thể kiểm tra lại phiên dùng chung.';return;}
      void (async()=>{if(!window.google?.accounts?.id)await script('https://accounts.google.com/gsi/client');if(stamp!==epoch)return;window.google.accounts.id.initialize({client_id:publicConfig.googleClientId,callback:async value=>{if(stamp!==epoch)return;try{await sso.login('homeworkwriting',value.credential,true);const session=await teacherSession(stamp);pendingReject=null;resolve(session);}catch(e){if(stamp===epoch)error.textContent=e.message;}}});window.google.accounts.id.renderButton(root.querySelector('#google-login'),{theme:'outline',size:'large',text:'signin_with'});})().catch(e=>{if(stamp===epoch)error.textContent=e.message;});
    });
  }
  function showError(root,error){if(error.stale)return;root.innerHTML='<div class="login-layout compact-login"><section class="card login-card"><h1>Chưa mở được Homework</h1>'+roleField()+'<p role="alert">'+esc(error.message)+'</p><button id="access-retry" class="primary">Thử lại</button></section></div>';roleListener(root,()=>{});root.querySelector('#access-retry').onclick=()=>void open(root).then(session=>onReady(session,epoch)).catch(e=>showError(root,e));}
  async function afterLogout(){const before=active;if(before?.person.role==='student'){const current=memory.read();if(current.identity?.id===before.identity?.erpId){const forgotten=await course.forget();if(forgotten.status!=='empty')onWarning('Đã đăng xuất Homework; chưa xóa được mã đã nhớ trên thiết bị.');}try{sessionStorage.removeItem(storageKey);}catch{}if(scopedIdentity(before.identity)){try{localStorage.removeItem(scopedMemoryKey);}catch{}}}else try{localStorage.setItem('izone:teacher-sso-logout',String(Date.now()));}catch{}invalidate();const u=routeUrl(context?{assignment:context.assignmentId}:{});u.searchParams.set('fresh','1');history.replaceState(history.state,'',u);}
  memory.subscribe(record=>{if(active?.person.role==='student'&&record.identity?.id!==active.identity?.erpId)onWarning('Mã người học đã nhớ ở tab khác vừa đổi. Tab này vẫn giữ đúng người đang làm bài.');});
  addEventListener('storage',event=>{if(active&&teacherIntent()&&['izone:teacher-sso-login','izone:teacher-sso-logout'].includes(event.key))void onTeacherChanged();});
  return {open,headers,routeUrl,invalidate,afterLogout,showError,workspace,stamp:()=>epoch,isCurrent:stamp=>stamp===epoch,get personal(){return !!context;},get intent(){return intent;}};
}

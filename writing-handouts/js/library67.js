import {createTeacherAuthState} from '../../shared/teacher-auth-state.js?v=20261026-startup2';
import {createTeacherSessionClient} from '../../shared/teacher-session-client.js?rev=20261026-startup1&startup=20261026-v2';

// Pages entries with a published Handout67 definition and a teacher route.
// Titles, prompts, class opening and teacher permissions always come from the live API.
const lessons = [3, 4, 5, 7, 9, 11, 13, 15];
const api = 'https://ducizone.ddns.net/api/handout67/v1';
const $ = id => document.getElementById(id);
const client = createTeacherSessionClient({apiBaseUrl:api,sessionPath:'teacher/session'});
const auth = createTeacherAuthState({panel:$('google-signin'),notice:$('auth-status'),retry:boot});
let generation = 0;
let items = [];
let googleReady;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label, style, action, enabled = true) {
  const result = element('button', 'button '+style, label);
  result.type = 'button';
  result.disabled = !enabled;
  result.addEventListener('click', action);
  return result;
}

function notice(message, error = false) {
  $('library-notice').textContent = message;
  $('library-notice').classList.toggle('error',error);
  $('library-notice').hidden = !message;
}

async function read(path, authenticated = true) {
  const response = await fetch(api+path,{credentials:authenticated?'include':'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Object.assign(Error('Chưa đọc được dữ liệu Handout Writing 67.'),{status:response.status});
  const value = await response.json();
  if (!value.ok) throw Error('Dữ liệu Handout Writing không hợp lệ.');
  return value;
}

async function loadLesson(number) {
  const activity = 'lesson'+number;
  const [definition, access] = await Promise.allSettled([
    read('/lessons/'+activity,false), read('/teacher/classes?activity='+activity),
  ]);
  if (access.status === 'rejected' && access.reason.status === 401) throw access.reason;
  const lesson = definition.value?.lesson?.activity===activity?definition.value.lesson:null;
  return {
    number, activity, lesson,
    allowed:Array.isArray(access.value?.classes)?access.value.classes:[],
    failed:!lesson||access.status==='rejected'&&access.reason.status!==403,
  };
}

function handoutUrl(item, classRef, teacher = false) {
  const file = teacher ? item.number===4?'dashboard.html':'teacher.html' : '';
  const url = new URL('./'+item.activity+'/'+file,location.href);
  if (classRef) url.searchParams.set('class',classRef);
  return url.href;
}

function renderHandout(item, classRef) {
  const {lesson, allowed, failed, number} = item;
  const access = allowed.find(row=>row.classRef===classRef);
  const enabled = Boolean(access&&lesson&&!failed);
  const requiresDocs = number===4;
  const opened = lesson?.classes?.includes(classRef);
  const label = failed?'Chưa tải được dữ liệu':!classRef?'Chưa có lớp được cấp quyền':enabled?'Đã mở cho '+classRef:opened?'Chưa có quyền xem lớp '+classRef:'Chưa mở cho '+classRef;
  const card = element('article','handout-card');
  card.dataset.activity = item.activity;
  const count = element('div','handout-lesson');
  count.append(element('span','','Writing buổi'),element('strong','',String(number)),element('span','handout-task','Task 2'));
  const body = element('div','handout-body');
  const meta = element('div','handout-meta');
  meta.append(element('span','badge',lesson?.outlineOnly?'Chuẩn bị ý tưởng':'Luyện lập luận'),element('span','badge '+(enabled?'available':'unavailable'),label));
  body.append(meta,element('h3','',lesson?.title||'Writing Lesson '+number));
  if (lesson?.topic) {
    const prompt = element('p','handout-prompt',lesson.topic);
    prompt.lang = 'en';
    body.append(prompt);
  }
  const visibleClasses = allowed.map(row=>row.className).join(', ');
  if (visibleClasses&&!failed) body.append(element('p','handout-availability','Lớp bạn có quyền xem: '+visibleClasses));
  if (requiresDocs) body.append(element('p','handout-availability','Học viên mở bài bằng link riêng trong Homework Docs.'));
  const actions = element('div','handout-actions');
  if (!requiresDocs) {
    actions.append(button('Xem handout','button-secondary',()=>window.open(handoutUrl(item,enabled?classRef:''),'_blank','noopener'),Boolean(lesson)));
    actions.append(button('Sao chép link học viên','button-primary',async()=>{
      try {
        await navigator.clipboard.writeText(handoutUrl(item,classRef));
        notice('Đã sao chép link “'+lesson.title+'” cho lớp '+classRef+'.');
      } catch {
        notice('Trình duyệt chưa cho sao chép link. Bạn có thể mở handout và sao chép địa chỉ trên thanh trình duyệt.',true);
      }
    },enabled));
  }
  actions.append(button('Xem dashboard','button-quiet',()=>window.open(handoutUrl(item,classRef,true),'_blank','noopener'),enabled));
  body.append(actions);
  card.append(count,body);
  return card;
}

function render() {
  const classRef = $('class-select').value;
  $('handout-list').replaceChildren(...items.map(item=>renderHandout(item,classRef)));
  const total = items.filter(item=>item.lesson).length;
  const available = items.filter(item=>!item.failed&&item.allowed.some(row=>row.classRef===classRef)).length;
  $('library-summary').textContent = total+' handout'+(classRef?' · '+available+' dashboard xem được cho '+classRef+'.':'. Chưa có lớp được cấp quyền.');
}

async function setupGoogle() {
  if (googleReady) return googleReady;
  googleReady = (async()=>{
    const {clientId} = await read('/teacher/config',false);
    if (!globalThis.google?.accounts?.id) await new Promise((resolve,reject)=>{
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;
      script.onerror = ()=>{script.remove();reject(Error('Không tải được đăng nhập Google.'));};
      document.head.append(script);
    });
    globalThis.google.accounts.id.initialize({client_id:clientId,auto_select:false,callback:signIn});
    globalThis.google.accounts.id.renderButton($('google-signin'),{theme:'outline',size:'large',locale:'vi'});
  })().catch(error=>{googleReady=undefined;throw error;});
  return googleReady;
}

async function signIn(response) {
  auth.checking();
  try {
    await client.login(response.credential);
    await boot();
  } catch (error) {
    auth.failed(error);
  }
}

async function boot() {
  const current = ++generation;
  $('library-content').hidden = true;
  $('logout-button').hidden = true;
  $('handout-list').replaceChildren();
  $('auth-title').textContent = 'Đang mở thư viện…';
  auth.checking();
  try {
    const session = await client.restore();
    if (current!==generation) return;
    if (!session) {
      $('auth-title').textContent = 'Đăng nhập để mở thư viện';
      $('auth-status').textContent = 'Sử dụng tài khoản Google đã được cấp quyền giảng viên.';
      auth.signedOut();
      await setupGoogle();
      return;
    }
    const nextItems = await Promise.all(lessons.map(loadLesson));
    if (current!==generation) return;
    items = nextItems;
    const classes = new Map(items.filter(item=>!item.failed).flatMap(item=>item.allowed.map(row=>[row.classRef,row.className])));
    const select = $('class-select');
    select.replaceChildren(...[...classes].sort(([a],[b])=>a.localeCompare(b,'vi',{numeric:true})).map(([code,label])=>new Option(label,code)));
    select.disabled = !classes.size;
    const requested = new URLSearchParams(location.search).get('class')?.toUpperCase();
    if (classes.has(requested)) select.value = requested;
    render();
    $('auth-title').textContent = 'Thư viện đã mở';
    $('auth-status').textContent = 'Đã đăng nhập · Writing khóa 67';
    auth.ready();
    $('library-content').hidden = false;
    $('logout-button').hidden = false;
    const failed = items.some(item=>item.failed);
    $('retry-catalog').hidden = !failed;
    notice(failed?'Một số handout chưa tải được. Hãy thử lại để xem quyền và danh sách lớp.':'',failed);
  } catch (error) {
    if (current!==generation) return;
    $('auth-title').textContent = error.status===401?'Đăng nhập để mở thư viện':'Chưa mở được thư viện';
    auth.failed(error);
    if (auth.needsLogin) await setupGoogle().catch(auth.failed);
  }
}

$('class-select').addEventListener('change',()=>{
  const url = new URL(location.href);
  url.searchParams.set('class',$('class-select').value);
  try { history.replaceState(null,'',url); } catch { /* The current class can still be selected. */ }
  notice('');
  render();
});
$('retry-catalog').addEventListener('click',boot);
$('logout-button').addEventListener('click',async()=>{
  generation++;
  $('library-content').hidden = true;
  $('handout-list').replaceChildren();
  $('logout-button').hidden = true;
  auth.checking();
  try {
    await client.logout();
    globalThis.google?.accounts?.id?.disableAutoSelect?.();
    await boot();
  } catch (error) {
    auth.failed(error);
  }
});
window.addEventListener('storage',event=>{
  if (['izone:teacher-sso-logout','izone:teacher-sso-login'].includes(event.key)) void boot();
});
window.addEventListener('pageshow',event=>{if(event.persisted)void boot();});
void boot();

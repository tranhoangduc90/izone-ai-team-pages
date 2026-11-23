import { BUILD, Term2Offline as ExistingTerm2Offline } from '../offline-term2-export-v2-log-renewal-v1.mjs';
export { ExamStore } from '../offline-term2-export-v2-log-renewal-v1.mjs';

// Giữ bộ lưu nháp và biên nhận của Term 2. Chỉ đăng ký worker trong thư mục DEMO.
export class Term2Offline extends ExistingTerm2Offline {
 async prepareCache(){
  if(!navigator.serviceWorker)throw Error('Trình duyệt chưa hỗ trợ mở lại bài offline.');
  const scope = new URL('./', location.href);
  const worker = new URL('offline-worker-preview-ready-v1.js', scope);
  worker.searchParams.set('v', BUILD);
  const registration = await navigator.serviceWorker.register(worker.href, {
   scope: scope.href, type: 'module', updateViaCache: 'none',
  });
  if(registration.installing)await new Promise((ok,no)=>{const worker=registration.installing;worker.addEventListener('statechange',()=>{if(['installed','activated'].includes(worker.state))ok();if(worker.state==='redundant')no(Error('Chưa tải đủ gói web offline.'));});});
  if(registration.waiting){
   const waiting=registration.waiting;
   await new Promise((ok,no)=>{const channel=new MessageChannel(),id=setTimeout(()=>no(Error('Chưa đổi được vỏ offline; hãy thử lại.')),20000);channel.port1.onmessage=e=>{clearTimeout(id);e.data.ok?ok():no(Error(e.data.error));};waiting.postMessage({type:'ACTIVATE'},[channel.port2]);});
   if(waiting.state!=='activated')await new Promise((ok,no)=>{const id=setTimeout(()=>no(Error('Chưa kích hoạt bản offline mới.')),20000);waiting.addEventListener('statechange',()=>{if(waiting.state==='activated'){clearTimeout(id);ok();}else if(waiting.state==='redundant'){clearTimeout(id);no(Error('Bản offline chưa cài được.'));}});});
  }
  await navigator.serviceWorker.ready;
  const controlled=()=>Boolean(registration.active)&&navigator.serviceWorker.controller===registration.active;
  if(!controlled()){await new Promise((ok,no)=>{const id=setTimeout(()=>no(Error('Chưa kích hoạt được bản bài thi offline.')),20000),check=()=>{if(controlled()){clearTimeout(id);navigator.serviceWorker.removeEventListener('controllerchange',check);ok();}};navigator.serviceWorker.addEventListener('controllerchange',check);check();});}
  await new Promise((ok,no)=>{const channel=new MessageChannel(),id=setTimeout(()=>no(Error('Chưa kiểm xong tài nguyên offline.')),60000);channel.port1.onmessage=e=>{clearTimeout(id);e.data.ok&&e.data.build===BUILD?ok():no(Error(e.data.error||'Chưa tải đủ tài nguyên đúng build.'));};navigator.serviceWorker.controller.postMessage({type:'PREPARE',url:location.href},[channel.port2]);});
  try{await navigator.storage?.persist?.();}catch{}
 }
}

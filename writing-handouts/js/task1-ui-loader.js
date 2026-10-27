import {task1UiRoute} from './task1-ui-routing.js?v=20261025-rollout1';
const route=task1UiRoute(location.search,location.pathname);
if(!globalThis.__IZONE_SW_TASK2_REDIRECTING__){
 if(!route){await import(location.pathname.endsWith('/teacher.html')?'./teacher-app.js?v=20261024-master170-errors2&cutover=20261025&sw=20261025.1&startup=20261026-v2':'./app.js?v=20261024-master170-ui3&cutover=20261025.2&startup=20261026-v2');}
 else{
  // Local templates and style are mounted only for the six approved Task 1 slugs.
  // Document URL, API config, manifest, identity and IndexedDB remain unchanged.
  try{
   const source=new URL('../task1-ui/'+route.role+'.html',import.meta.url),response=await fetch(source,{cache:'no-cache'});
   if(!response.ok)throw new Error('Chưa tải được giao diện Task 1. Hãy tải lại trang.');
   const page=new DOMParser().parseFromString(await response.text(),'text/html');
   const styles=[...page.querySelectorAll('link[rel="stylesheet"]')].map(link=>{const copy=link.cloneNode();copy.href=new URL(link.getAttribute('href'),source);return copy;});
   for(const image of page.body.querySelectorAll('img[src]'))image.src=new URL(image.getAttribute('src'),source);
   const loaded=styles.map(link=>new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=()=>reject(new Error('Chưa tải đủ giao diện. Hãy tải lại trang.'));}));
   const oldStyles=[...document.head.querySelectorAll('link[rel="stylesheet"]')];document.head.append(...styles);await Promise.all(loaded);oldStyles.forEach(link=>link.remove());
   document.title=page.title;document.body.className=page.body.className;
   for(const [key,value] of Object.entries(page.body.dataset))document.body.dataset[key]=value;
   document.body.replaceChildren(...page.body.childNodes);
   document.body.dataset.task1Ui='20261025-rollout1';
   const brand=document.querySelector('.brand');if(brand){const home=new URL(route.role==='teacher'?'./teacher.html':'./index.html',location.href);home.search=location.search;brand.href=home.href;}
   await import(route.role==='teacher'?'./task1-ui-teacher.js?v=20261025-rollout2&startup=20261026-v2&reading=20261027-v1':'./task1-ui-app.js?v=20261025-rollout2&startup=20261026-v2&reading=20261027-v1');
  }catch(error){const note=document.createElement('p');note.className='notice';note.setAttribute('role','alert');note.textContent=error.message;document.body.prepend(note);}
 }
}

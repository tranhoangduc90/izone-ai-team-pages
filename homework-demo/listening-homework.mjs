import {createListeningWorkspace} from '../listening-homework/interactive-workspace.mjs?v=20261029-grading2&audio=20261028-part-rescue-v1';
import {ASSETS} from '../shared/audio/catalog.mjs';
import {installBanner,feedbackHtml,wireDialog} from './common.mjs';
export async function mount(data){
 const $=id=>document.getElementById(id);let body={answers:{},annotations:[],flags:[],notes:''},view;
 $('access').remove();$('work-area').hidden=false;$('header-status').hidden=false;$('person').textContent='Giảng viên · Bản demo';$('docs-status').textContent='Thao tác thử chỉ trong tab này.';$('teacher-entry').hidden=true;$('change-person').hidden=true;$('teacher-logout').hidden=true;$('history-button').hidden=true;
 function render(){view?.destroy();view=createListeningWorkspace({data:data.content,body,readonly:false,onChange(){body=view.getBody();$('save-status').textContent='Đã giữ thao tác thử trong tab này.';},onHistory(){},audioManifest:async()=>({...ASSETS['homework-listening-02-scandinavian'],envelopeVersion:'MP3',cloudflare:{version:1,policy:'public-mp3-v1'}})});$('submit').disabled=false;$('submit').textContent='Xem ví dụ góp ý';$('submit').setAttribute('aria-label','Xem ví dụ góp ý minh họa');}
 const modal=document.createElement('dialog');modal.id='demo-feedback';modal.innerHTML=`<h2>Ví dụ góp ý</h2>${feedbackHtml()}<button type="button" data-close>Về bài để sửa thử</button>`;document.body.append(modal);const show=wireDialog(modal);render();$('submit').onclick=show;
 installBanner(()=>{body={answers:{},annotations:[],flags:[],notes:''};render();});
}

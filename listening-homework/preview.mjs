// Review-only state. The renderer, controls, audio transport and styles are shared with the real lesson.
import {createListeningWorkspace} from './interactive-workspace.mjs?v=20261029-grading2&audio=20261028-part-rescue-v1&ej=ej-a176e4d58d3089a76456';
import {setWorkspaceText as text} from './workspace-status.mjs?v=20261028-compact1';
import {ASSETS} from '../shared/audio/catalog.mjs';
const $=id=>document.getElementById(id);
const data=await fetch('./interactive-content.json').then(r=>r.json());
let body={answers:{},annotations:[],flags:[],notes:''},view,submitted=null,readonly=new URLSearchParams(location.search).get('teacher')==='1';
const samples=()=>data.items.map((item,index)=>({id:item.id,answer:body.answers[item.id]||'',feedback:{status:index===6?'partial':'correct',metUnits:index===6?2:1,totalUnits:index===6?3:1,reason:index===6?'Ví dụ góp ý: đã thể hiện hai ý; hãy bổ sung ý còn thiếu trong lời Beth.':'Ví dụ góp ý về ý nghĩa của câu trả lời. Đây là dữ liệu minh họa, không phải kết quả chấm.',nextStep:index===6?'Đối chiếu đoạn transcript và bổ sung ô còn thiếu.':'',writingNotes:[]}}));
function mount(){
 view?.destroy();view=createListeningWorkspace({data,body,readonly,onChange(){body=view.getBody();text('save-status','Đã giữ trong bản xem thử này.');},onHistory:history,audioManifest:async()=>({...ASSETS['homework-listening-02-scandinavian'],envelopeVersion:'MP3',cloudflare:{version:1,policy:'public-mp3-v1'}})});
 $('access').hidden=true;$('work-area').hidden=false;$('header-status').hidden=false;$('person').textContent='Học viên minh họa · Bản xem thử';$('readonly').hidden=!readonly;$('submit').hidden=readonly;$('submit').disabled=false;$('history-button').disabled=false;$('teacher-entry').hidden=true;$('change-person').hidden=readonly;$('teacher-logout').hidden=!readonly;$('teacher-logout').textContent='Về bản học viên';$('new-run').hidden=readonly;
 $('threshold').textContent=`Điền ít nhất ${Math.ceil(data.items.length*.8)}/${data.items.length} mục để nộp. Nhận xét dựa trên ý nghĩa; bạn có thể sửa và nộp lại.`;$('docs-status').textContent='Dữ liệu minh họa · Không ghi bài thật hoặc Homework Docs.';text('save-status','Dữ liệu thử chỉ được giữ trong tab này.');
 if(submitted)view.setFeedback(submitted);
}
function history(){
 $('history').replaceChildren();$('history-status').textContent=submitted?'':'Chưa có lượt nộp thử. Nhập bài rồi bấm Nộp bài để xem minh họa.';
 if(submitted){const row=document.createElement('div');row.className='history-entry';const label=document.createElement('span');label.textContent='Lượt minh họa · Bản đã nộp được giữ riêng';const button=document.createElement('button');button.textContent='Xem bản đã nộp';button.onclick=()=>{$('history-detail').replaceChildren();for(const [n,item] of submitted.items.entries()){const section=document.createElement('section');section.className='item';const title=document.createElement('h3');title.textContent='Mục '+(n+1);const answer=document.createElement('p');answer.className='history-response';answer.textContent=item.answer||'(Chưa nhập trong bản thử)';section.append(title,answer);$('history-detail').append(section);}$('history-view').hidden=false;};row.append(label,button);$('history').append(row);}
 $('history-dialog').showModal();
}
$('fixture-status').hidden=true;const previewTag=document.createElement('span');previewTag.className='hw-preview-tag';previewTag.textContent='BẢN XEM THỬ · DỮ LIỆU MINH HỌA';$('lesson-title').append(previewTag);
$('access-status').textContent='Không cần chọn danh tính thật. Bấm mở để xem giao diện và thao tác thử.';
$('class').replaceChildren(new Option('Lớp minh họa','demo'));$('student').replaceChildren(new Option('Học viên minh họa','demo'));$('student').disabled=false;$('entry-submit').disabled=false;$('student-form').hidden=false;
$('student-form').onsubmit=e=>{e.preventDefault();mount();};$('teacher-entry').onclick=()=>{if(view)body=view.getBody();readonly=true;mount();};$('teacher-logout').onclick=()=>{readonly=false;mount();};
$('change-person').onclick=()=>{if(view)body=view.getBody();view?.destroy();view=null;$('access').hidden=false;$('work-area').hidden=true;$('header-status').hidden=true;$('change-person').hidden=true;$('teacher-logout').hidden=true;$('teacher-entry').hidden=false;$('history-button').disabled=true;};
$('submit').onclick=()=>{body=view.getBody();submitted={attemptId:'preview-'+Date.now(),label:'Ví dụ góp ý · Không phải lượt chấm thật',items:samples()};view.setFeedback(submitted);$('grade-status').textContent='Đã mở góp ý minh họa. Ở bài thật, nhận xét được trả theo nội dung bạn nộp.';};
$('close-history-dialog').onclick=()=>$('history-dialog').close();$('close-history').onclick=()=>$('history-view').hidden=true;$('history-refresh').onclick=history;$('new-run').onclick=()=>{body={answers:{},annotations:[],flags:[],notes:''};submitted=null;$('history-dialog').close();mount();};
$('history-dialog').onclose=()=>$('history-button').focus({preventScroll:true});

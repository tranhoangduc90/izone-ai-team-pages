import {call,studentUrl} from './api.mjs';

const button=document.getElementById('listening-assignment-open');
const dialog=document.getElementById('listening-assignment');
const note=document.getElementById('listening-assignment-status');
const list=document.getElementById('listening-assignment-list');
const sharedLink=document.getElementById('listening-assignment-link');
const labels={pending:'Chờ giao',assigned:'Đã giao',revoked:'Đã thu hồi',started:'Đang làm',submitted:'Đã nộp'};
let currentRequest=0;
let timer;
let busy=false;

function draw({mode,rows}) {
    button.hidden=mode==='off'&&!rows.some(row=>row.state==='started'||row.state==='submitted');
    list.replaceChildren();
    for (const row of rows) {
        const item=document.createElement('li');
        const name=document.createElement('strong');
        name.textContent=row.name;
        const status=document.createElement('span');
        status.textContent=labels[row.state];
        item.append(name,status);
        const action=row.state==='assigned'?'revoke':['pending','revoked'].includes(row.state)?'assign':null;
        if (mode==='open'&&action) {
            const perform=document.createElement('button');
            perform.type='button';
            perform.className='button secondary';
            perform.textContent=action==='assign'?'Giao bài':'Thu hồi';
            perform.addEventListener('click',()=>void refresh({id:row.id,version:row.version,action}));
            item.append(perform);
        }
        if (row.receipt) {
            const receipt=document.createElement('small');
            receipt.textContent=`Biên nhận DEMO ${row.receipt}`;
            item.append(receipt);
        }
        list.append(item);
    }
    note.textContent=mode==='open'?'':mode==='drain'?'Đang giữ các lượt đã bắt đầu.':'Đợt thử đang tắt.';
}

async function refresh(body) {
    if (busy) return;
    const version=++currentRequest;
    if (body) {
        busy=true;
        for (const target of list.querySelectorAll('button')) target.disabled=true;
    }
    try {
        if (body) await call('teacher/assignments',{teacher:true,body});
        const state=await call('teacher/assignments',{teacher:true});
        if (version===currentRequest) draw(state);
    } catch(error) {
        if (version!==currentRequest) return;
        if (error.status===401||error.status===403) { button.hidden=true; dialog.close(); list.replaceChildren(); }
        else {
            note.textContent=body?'Chưa xác nhận được thao tác. Hệ thống sẽ đọc lại trạng thái.':'Chưa đọc được trạng thái giao bài.';
            if (body) setTimeout(()=>void refresh(),500);
        }
    } finally { if(body) busy=false; }
}

sharedLink.href=studentUrl;
button.addEventListener('click',()=>{dialog.showModal(); void refresh(); timer=setInterval(()=>{if(!document.hidden)void refresh();},5000);});
dialog.addEventListener('close',()=>clearInterval(timer));
document.getElementById('listening-assignment-close').addEventListener('click',()=>dialog.close());
function recheckSession() {
    ++currentRequest;
    button.hidden=true;
    if (dialog.open) dialog.close();
    if (busy) setTimeout(()=>void refresh(),700);
    else void refresh();
}
addEventListener('storage',event=>{if(['izone:teacher-sso-login','izone:teacher-sso-logout'].includes(event.key)) recheckSession();});
document.getElementById('logout')?.addEventListener('click',()=>{
    ++currentRequest;
    button.hidden=true;
    if (dialog.open) dialog.close();
});
void refresh();

import {activeKey,call} from './api.mjs';

// Giá trị riêng để bản thi hiện hành tiếp tục nhận cả lớp thật và DEMO gốc.
const select=document.getElementById('class');
const nativeApp=document.getElementById('app');
const params=new URL(location.href).searchParams;
const pilotOption='IZONE_LISTENING_ASSIGNMENT_PILOT';
if (select&&nativeApp&&params.get('course')==='56'&&!params.has('class')&&!window.IZONE_EXAM_DEVICE_BLOCKED) {
    const option=new Option('DEMO · Giao bài thử',pilotOption);
    let available=false;
    let frame;
    let previousClass=select.value;

    function openPilot() {
        if (frame) return;
        sessionStorage.setItem(activeKey,'1');
        frame=document.createElement('iframe');
        frame.id='listening-pilot-frame';
        frame.title='Substitute 1 K56 Listening · Lớp DEMO';
        frame.src=new URL('./student.html',import.meta.url);
        nativeApp.hidden=true;
        nativeApp.inert=true;
        nativeApp.after(frame);
        frame.focus();
    }

    function ensureChoice() {
        if (available&&!select.disabled&&option.parentElement!==select) select.add(option);
    }

    select.addEventListener('change',event=>{
        if (select.value!==pilotOption) { previousClass=select.value; return; }
        event.stopImmediatePropagation();
        if (available) openPilot();
        else select.value=previousClass;
    },true);

    addEventListener('message',event=>{
        if (event.origin!==location.origin||event.source!==frame?.contentWindow||event.data!=='izone-listening-pilot:leave') return;
        frame.remove();
        frame=undefined;
        sessionStorage.removeItem(activeKey);
        select.value=previousClass;
        nativeApp.hidden=false;
        nativeApp.inert=false;
        select.focus();
    });

    const observer=new MutationObserver(ensureChoice);
    observer.observe(select,{childList:true,attributes:true,attributeFilter:['disabled']});
    if (sessionStorage.getItem(activeKey)==='1') openPilot();
    call('availability').then(flags=>{
        available=flags.available===true&&flags.classCode==='DEMO'&&flags.testId==='substitute-test-1-k56-listening-makeup';
        ensureChoice();
    }).catch(()=>{});
}

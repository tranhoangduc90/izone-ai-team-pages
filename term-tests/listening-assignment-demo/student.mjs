import {call} from './api.mjs';

const $=id=>document.getElementById(id);
const tokenKey='izone:substitute-listening-pilot:token';
const audio=$('audio');
const labels={pending:'Chờ người vận hành giao bài',revoked:'Quyền làm bài đã thu hồi',assigned:'Đã giao bài'};
let token=sessionStorage.getItem(tokenKey);
let audioUrl;
let prepared=false;
let previewDone=false;
let snapshot;
let answers={};
let revision=0;
let part=0;
let pollTimer;
let saveTimer;
let offlineAnswer=false;
let busy=false;
let examOpen=false;
let releaseLock;
let clockTimer;

const request=(route,options={})=>call('student/'+route,{token,...options});
const note=value=>{$('status').textContent=value;};
const draftKey=()=>`izone:substitute-listening-pilot:draft:${snapshot.attemptId}`;
const playbackKey=()=>`izone:substitute-listening-pilot:played:${snapshot.attemptId}`;

function disableStart() { $('start').disabled=true; $('preview').disabled=true; }

async function pickName() {
    disableStart();
    $('ready').hidden=true;
    try {
        const info=await call('availability');
        if (!info.available) { note('Lớp DEMO đang tạm đóng.'); return; }
        $('name').replaceChildren(new Option('Chọn họ tên',''),...info.learners.map(person=>new Option(person.label,person.id)));
        $('identity').hidden=false;
        note('Chọn họ tên và nhập mã DEMO để kiểm tra quyền bắt đầu.');
    } catch { note('Chưa kết nối được lớp DEMO. Hãy tải lại trang khi có mạng.'); }
}

function poll(delay=3500) {
    clearTimeout(pollTimer);
    if (!examOpen&&token) pollTimer=setTimeout(()=>void refresh(),delay);
}

async function refresh() {
    if (!token||examOpen) return;
    if (busy||document.hidden) { poll(); return; }
    busy=true;
    let delay=3500;
    try {
        const state=await request('status');
        if (state.otherSession) { disableStart(); note('Hồ sơ này đã có lượt ở tab khác. Hãy quay lại tab đã bắt đầu.'); return; }
        if (state.state==='submitted') { finish(state); return; }
        if (state.state==='started') {
            if (await claimTab()) openExam(state);
            return;
        }
        if (state.mode!=='open'||state.state!=='assigned') {
            disableStart();
            audio.pause();
            prepared=false;
            previewDone=false;
            $('ready').hidden=false;
            note(state.mode!=='open'?'Lớp DEMO đang tạm dừng nhận lượt mới.':labels[state.state]);
            return;
        }
        if (!prepared) {
            note('Đã giao bài. Đang chuẩn bị audio thử…');
            await request('prepare',{body:{}});
            await loadAudio();
            prepared=true;
        }
        $('ready').hidden=false;
        $('preview').disabled=!audio.paused;
        $('start').disabled=!previewDone;
        note(previewDone?'Đã giao bài. Bạn có thể bắt đầu.':audio.paused?'Đã giao bài. Bấm Nghe thử 10 giây.':'Đang nghe thử 10 giây…');
    } catch(error) {
        disableStart();
        if (error.status===401) {
            token=null;
            sessionStorage.removeItem(tokenKey);
            await pickName();
        } else {
            note('Chưa xác nhận được quyền bắt đầu. Hệ thống sẽ kiểm tra lại khi có mạng.');
            delay=7000;
        }
    } finally { busy=false; poll(delay); }
}

async function loadAudio() {
    if (audioUrl) return;
    const buffer=await request('audio',{binary:true});
    audioUrl=URL.createObjectURL(buffer);
    audio.src=audioUrl;
}

async function claimTab() {
    if (releaseLock) return true;
    if (!navigator.locks) { note('Hãy mở bài DEMO bằng Edge hoặc Chrome trên máy tính.'); return false; }
    return new Promise(resolve=>{
        navigator.locks.request('izone:substitute-listening-pilot:exam',{ifAvailable:true},async lock=>{
            if (!lock) { note('Bài DEMO đang mở ở tab khác của trình duyệt.'); resolve(false); return; }
            const hold=new Promise(release=>{releaseLock=release;});
            resolve(true);
            await hold;
        }).catch(()=>resolve(false));
    });
}

function unlock() { releaseLock?.(); releaseLock=undefined; }

function answerPayload() { return {attemptId:snapshot.attemptId,revision,answers:{...answers}}; }

function renderPart() {
    $('question-list').replaceChildren();
    for(let i=part*10+1;i<=part*10+10;i++) {
        const label=document.createElement('label');
        label.textContent=`Câu ${i} (DEMO)`;
        const input=document.createElement('input');
        input.maxLength=160;
        input.value=answers[i]||'';
        input.addEventListener('input',()=>{
            answers[i]=input.value;
            revision++;
            sessionStorage.setItem(draftKey(),JSON.stringify(answerPayload()));
            clearTimeout(saveTimer);
            saveTimer=setTimeout(()=>void saveDraft(),600);
        });
        label.append(input);
        $('question-list').append(label);
    }
    for(const [index,button] of Array.from($('navigation').children).entries()) button.setAttribute('aria-pressed',String(index===part));
}

async function saveDraft() {
    if (!examOpen||!snapshot?.attemptId||snapshot.receipt||busy) return;
    try {
        const payload=answerPayload();
        await request('snapshot',{body:payload});
        if (payload.revision!==revision) return;
        if (offlineAnswer) note('Đã đồng bộ bài làm DEMO.');
        offlineAnswer=false;
    } catch {
        offlineAnswer=true;
        note('Bản nháp được giữ trong tab này. Kết nối mạng để đồng bộ hoặc nộp bài.');
    }
}

function openExam(state) {
    examOpen=true;
    snapshot=state;
    let draft;
    try { draft=JSON.parse(sessionStorage.getItem(draftKey())||'null'); } catch {}
    const localDraft=draft?.attemptId===state.attemptId&&draft.revision>state.answerRevision;
    answers=localDraft?draft.answers:state.answers;
    revision=localDraft?draft.revision:state.answerRevision;
    $('identity').hidden=true;
    $('ready').hidden=true;
    $('exam').hidden=false;
    $('leave').hidden=true;
    note('Đang làm bài DEMO.');
    $('navigation').replaceChildren(...[1,2,3,4].map((number,index)=>{
        const button=document.createElement('button');
        button.type='button'; button.textContent=`Phần ${number}`;
        button.addEventListener('click',()=>{part=index;renderPart();});
        return button;
    }));
    renderPart();
    const receivedAt=performance.now();
    const updateClock=()=>{
        const remaining=Math.max(0,Math.ceil((state.deadlineAt-state.serverNow-performance.now()+receivedAt)/1000));
        $('clock').textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
        if (remaining===0) {
            clearInterval(clockTimer);
            for (const field of $('question-list').querySelectorAll('input')) field.disabled=true;
            note('Đã hết giờ. Nộp bản đáp án đã đồng bộ trước hạn.');
        }
    };
    clockTimer=setInterval(updateClock,1000);
    updateClock();
    if (sessionStorage.getItem(playbackKey())==='1') {
        $('play').hidden=true;
        $('audio-status').textContent='Audio bài thi đã được phát trong lượt này.';
    }
    if (localDraft) setTimeout(()=>void saveDraft(),200);
}

function finish(state) {
    snapshot=state;
    examOpen=true;
    clearTimeout(saveTimer);
    clearTimeout(pollTimer);
    clearInterval(clockTimer);
    audio.pause();
    unlock();
    $('identity').hidden=true;
    $('ready').hidden=true;
    $('exam').hidden=true;
    $('result').hidden=false;
    $('leave').hidden=false;
    $('result-name').textContent=`${state.learner} · Lớp DEMO`;
    $('score').textContent=`Kết quả thử ${state.score}/40`;
    $('receipt').textContent=`Biên nhận DEMO ${state.receipt}`;
    sessionStorage.removeItem(draftKey());
    note('Đã nộp bài.');
}

$('identity').addEventListener('submit',async event=>{
    event.preventDefault();
    if (busy) return;
    busy=true; $('confirm').disabled=true;
    const code=$('code').value.trim();
    $('code').value='';
    try {
        const session=await request('session',{body:{classCode:'DEMO',learnerId:$('name').value,code}});
        token=session.token;
        sessionStorage.setItem(tokenKey,token);
        $('identity').hidden=true;
        note('Đang kiểm tra quyền bắt đầu…');
    } catch(error) {
        note(error.code==='INVALID_DEMO_CODE'?'Mã DEMO hoặc họ tên chưa đúng.':error.status===429?
            'Có nhiều lượt nhập mã. Vui lòng thử lại sau ít phút.':'Chưa vào được lớp DEMO. Hãy kiểm tra kết nối và thử lại.');
    } finally { busy=false; $('confirm').disabled=false; }
    if (token) void refresh();
});

$('preview').addEventListener('click',async()=>{
    if (!prepared||busy) return;
    $('preview').disabled=true;
    $('start').disabled=true;
    previewDone=false;
    audio.currentTime=0;
    try { await audio.play(); note('Đang nghe thử 10 giây…'); }
    catch { $('preview').disabled=false; note('Chưa phát được audio. Hãy bấm nghe thử lại.'); }
});

audio.addEventListener('timeupdate',()=>{
    if (examOpen||audio.paused||audio.currentTime<10) return;
    audio.pause();
    audio.currentTime=0;
    previewDone=prepared;
    $('start').disabled=true;
    void refresh();
});
audio.addEventListener('ended',()=>{if(examOpen) $('audio-status').textContent='Audio đã kết thúc. Bạn có thể tiếp tục rà soát.';});

async function playExam() {
    if (!examOpen||!snapshot?.attemptId||snapshot.receipt||sessionStorage.getItem(playbackKey())==='1') return;
    $('play').disabled=true;
    try {
        await loadAudio();
        audio.currentTime=0;
        await audio.play();
        sessionStorage.setItem(playbackKey(),'1');
        $('play').hidden=true;
        $('audio-status').textContent='Đang phát audio Listening DEMO.';
    } catch { $('play').disabled=false; $('audio-status').textContent='Bấm Phát audio bài thi để tiếp tục.'; }
}

$('start').addEventListener('click',async()=>{
    if(busy||!previewDone||$('start').disabled) return;
    busy=true;
    disableStart();
    clearTimeout(pollTimer);
    try {
        if (!await claimTab()) return;
        const state=await request('start',{body:{}});
        if (state.receipt) finish(state);
        else { openExam(state); void playExam(); }
    } catch {
        unlock();
        note('Chưa xác nhận được lượt bắt đầu. Hệ thống sẽ đọc lại trạng thái.');
    } finally { busy=false; poll(100); }
});
$('play').addEventListener('click',()=>void playExam());

$('submit').addEventListener('click',()=>{if(!busy) $('submit-dialog').showModal();});
$('cancel-submit').addEventListener('click',()=>$('submit-dialog').close());
$('confirm-submit').addEventListener('click',async()=>{
    if (busy) return;
    busy=true;
    $('submit-dialog').close();
    try { finish(await request('submit',{body:answerPayload()})); }
    catch { note('Chưa có biên nhận. Bài làm còn trong tab này, hãy bấm Nộp bài lại khi có mạng.'); }
    finally { busy=false; }
});
$('leave').addEventListener('click',()=>window.parent.postMessage('izone-listening-pilot:leave',location.origin));
addEventListener('online',()=>{if(examOpen)void saveDraft();else void refresh();});
addEventListener('pagehide',()=>{clearTimeout(pollTimer); clearInterval(clockTimer); unlock(); audio.pause();});
if (token) void refresh(); else void pickName();

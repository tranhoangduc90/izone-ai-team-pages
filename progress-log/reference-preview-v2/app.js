// Nhận dữ liệu minh họa hoặc API giảng viên đã xác thực; dựng bảng xem thử theo mẫu.
// Chỉ đọc lớp/bài/chấm hiện hành. Không tạo attempt, gửi nhận xét, ghi Portal hoặc xử lý AI.
// Lỗi mạng/quyền hiển thị rõ; yêu cầu của lớp cũ bị hủy, không trộn tên và kết quả giữa lớp.
import {createTeacherSessionClient,teacherSessionRequestOptions} from '../../shared/teacher-session-client.js';
import {demoCourse,demoDetail} from './fixture.js';
import {contentTitle,skillsLabel,sessionHeading,sessionState,vietnamDate,startsAt} from './session-ui.js';
import {reviewItems} from './review.js';
import {summarizeClass,sessionLabel,percent} from '../reference-preview/analytics.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const config=window.PROGRESS_LOG_CONFIG||{};
const session=createTeacherSessionClient({apiBaseUrl:config.API_BASE_URL,sessionPath:'/api/auth/session'});
const state={mode:'demo',view:'student',tab:'dashboard',course:demoCourse,classes:[{id:'demo',name:demoCourse.className}],
  allAssignments:[],sessionNumber:5,studentRef:demoCourse.overview.students[0].studentRef,authenticated:false,
  generation:0,controller:null,detail:null,detailController:null,detailGeneration:0,previewClock:null};
const date=value=>startsAt(value)!==null?new Intl.DateTimeFormat('vi-VN',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value+'T00:00:00Z')):'Chưa xác nhận ngày';
const personName=person=>person.name+(person.discriminator?' · '+person.discriminator:'');
const courseForms=()=>summarizeClass(state.course,state.sessionNumber);
function notice(text){$('notice').textContent=text;}
function isCurrent(generation){return generation===state.generation;}

async function read(path,signal){
  if(!state.authenticated) throw new Error('Bạn chưa đăng nhập giảng viên.');
  const response=await fetch(config.API_BASE_URL+'/api/learning'+path,teacherSessionRequestOptions({cache:'no-store',signal}));
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.ok){
    if(response.status===401||response.status===403){invalidateDetail();state.authenticated=false;state.course=null;state.classes=[];render();$('access').hidden=false;}
    throw new Error(data?.message||'Chưa đọc được dữ liệu (mã '+response.status+').');
  }
  return data;
}

async function loadClass(classId){
  invalidateDetail();state.previewClock=null;
  state.controller?.abort();
  const controller=new AbortController();state.controller=controller;
  const generation=++state.generation;
  state.course=null;render();notice('Đang đọc hành trình và kết quả chấm của lớp…');
  const timeout=setTimeout(()=>controller.abort(),30_000);
  try{
    const payload=await read('/teacher/classes/'+encodeURIComponent(classId)+'/overview',controller.signal);
    if(!isCurrent(generation))return;
    if(String(payload.overview.classId)!==String(classId))throw new Error('Kết quả không khớp lớp đã chọn.');
    // Không kéo cả trường hay hàng trăm phiếu: chỉ các phiếu thuộc lớp đang mở, tối đa ba request đồng thời.
    const assignments=state.allAssignments.filter(a=>String(a.class_id)===String(classId)&&['published','closed'].includes(a.status));
    const forms=[];
    for(let offset=0;offset<assignments.length;offset+=3){
      const batch=await Promise.all(assignments.slice(offset,offset+3).map(async a=>{
        const result=await read('/teacher/assignments/'+encodeURIComponent(a.assignment_id)+'/question-analytics',controller.signal);
        if(result.analytics.assignmentId!==a.assignment_id)throw new Error('Thống kê không khớp phiếu.');
        return {id:a.assignment_id,sessionNumber:Number(a.session_number),title:a.title,status:a.status,publicToken:a.public_token,analytics:result.analytics,blocks:[],releases:[]};
      }));
      forms.push(...batch);
      if(!isCurrent(generation))return;
    }
    state.course={classId,className:payload.overview.className,overview:payload.overview,assignments:forms};
    state.sessionNumber=forms.length?Math.max(...forms.map(a=>a.sessionNumber)):null;
    state.studentRef=payload.overview.students[0]?.studentRef;
    $('detailDialog').close();$('detailContent').replaceChildren();render();
    notice('Đã đọc '+forms.length+' phiếu của '+payload.overview.className+'. Chỉ hiển thị dữ liệu, không ghi thay đổi.');
    await loadControls(generation);
  }catch(error){if(isCurrent(generation)){state.course=null;render();notice(controller.signal.aborted?'Đọc dữ liệu quá thời gian chờ. Bấm Đọc lại dữ liệu để thử lại.':error.message);}}
  finally{clearTimeout(timeout);}
}

async function loadControls(generation){
  const own=state.course?.assignments.filter(a=>a.sessionNumber===state.sessionNumber)||[];
  if(state.mode!=='real'||own.length!==1)return;
  const target=own[0],number=state.sessionNumber;
  try{
    const data=await read('/teacher/dashboard?assignment='+encodeURIComponent(target.id),state.controller?.signal);
    if(!isCurrent(generation)||state.sessionNumber!==number||!state.course||data.dashboard.assignmentId!==target.id)return;
    target.blocks=(data.dashboard.definition?.blocks||[]).map(b=>({blockId:b.blockId,title:b.title,checkpoint:b.checkpoint}));
    target.releases=data.dashboard.blockReleases||[];
    render();
  }catch(error){if(isCurrent(generation))notice('Đã đọc thống kê; chưa đọc được điều khiển buổi học: '+error.message);}
}

async function useRealData(){
  invalidateDetail();state.previewClock=null;
  state.controller?.abort();state.generation++;
  state.mode='real';state.course=null;state.classes=[];state.allAssignments=[];render();
  notice('Đang khôi phục phiên giảng viên…');
  const generation=state.generation;
  let timeout;
  try{
    const restored=await Promise.race([session.restore(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Khôi phục phiên quá thời gian chờ. Hãy thử lại.')),15_000);})]);
    if(!isCurrent(generation)||state.mode!=='real')return;
    if(!restored){state.authenticated=false;$('access').hidden=false;notice('Đăng nhập Google để xem các lớp được cấp quyền.');initializeGoogle();return;}
    state.authenticated=true;await loadOptions();
  }catch(error){if(isCurrent(generation)&&state.mode==='real'){notice(error.message);$('access').hidden=false;initializeGoogle();}}
  finally{clearTimeout(timeout);}
}

async function loadOptions(){
  const generation=++state.generation;
  const controller=new AbortController();state.controller?.abort();state.controller=controller;
  const timeout=setTimeout(()=>controller.abort(),15_000);
  try{
    const data=await read('/teacher/options',controller.signal);
    if(!isCurrent(generation)||state.mode!=='real')return;
    state.classes=(data.classes||[]).filter(c=>/^[1-9]\d{0,17}$/u.test(String(c.class_id)))
      .map(c=>({id:String(c.class_id),name:c.class_name}));
    state.allAssignments=data.assignments||[];
    $('access').hidden=true;
    const chosen=state.classes.find(c=>c.name==='IC2305')||state.classes[0];
    if(!chosen){state.course=null;render();notice('Tài khoản chưa có lớp được cấp quyền.');return;}
    await loadClass(chosen.id);
  }finally{clearTimeout(timeout);}
}

function initializeGoogle(attempt=0){
  if(!window.google?.accounts?.id){
    if(attempt<30)setTimeout(()=>initializeGoogle(attempt+1),200);
    else notice('Chưa tải được nút Google. Bạn có thể đăng nhập trong hệ đang vận hành rồi bấm Thử khôi phục phiên.');
    return;
  }
  window.google.accounts.id.initialize({client_id:config.GOOGLE_CLIENT_ID,auto_select:false,callback:async response=>{
    if(!response.credential||state.mode!=='real')return;
    try{await session.login(response.credential);state.authenticated=true;await loadOptions();}
    catch(error){notice(error.message);}
  }});
  window.google.accounts.id.renderButton($('googleSignIn'),{theme:'outline',size:'large',shape:'pill',text:'signin_with',locale:'vi'});
}

function picker(){
  return '<label class="previewClassPicker">Lớp đang xem <select id="classSelect">'+state.classes.map(c=>'<option value="'+esc(c.id)+'" '+(String(c.id)===String(state.course.classId)?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label>';
}
function slotFor(number){return state.course?.overview.sessions.find(s=>s.sessionNumber===number);}
function formFor(number){return state.course?.assignments.find(a=>a.sessionNumber===number);}
function fullLabel(number){return sessionHeading(slotFor(number),formFor(number));}
function sessionPicker(){
  return '<div class="previewSessionPicker"><label for="sessionSelect">BUỔI ĐANG XEM</label><select id="sessionSelect" class="previewSelect"><option value="all" '+(state.sessionNumber===null?'selected':'')+'>Tất cả phiếu đã có</option>'+
    state.course.overview.sessions.map(s=>'<option value="'+s.sessionNumber+'" '+(s.sessionNumber===state.sessionNumber?'selected':'')+'>'+esc(sessionHeading(s,formFor(s.sessionNumber)))+' · '+esc(date(s.sessionDate))+(s.assignments.length?'':' · '+(s.sessionKind==='test'?'Test':'Chưa tạo phiếu'))+'</option>').join('')+'</select></div>';
}
function metrics(summary){
  const data=[['Bài nộp hiện hành',summary.totals.submitted,'Trong '+summary.forms.length+' phiếu đang xem'],
    ['Câu trả lời đúng',summary.totals.correct,'Chỉ câu có kết quả chấm'],['Câu trả lời sai',summary.totals.incorrect,'Không tính câu mở/tự đánh giá'],
    ['Tỷ lệ đúng',summary.graded?percent(summary.totals.correct/summary.graded):'—',summary.graded+' câu trả lời đã chấm']];
  return '<div class="teacherMetrics">'+data.map(([label,value,description])=>'<div><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(description)+'</span></div>').join('')+'</div>';
}
function controls(){
  const forms=state.course.assignments.filter(a=>a.sessionNumber===state.sessionNumber);
  const cells=state.course.overview.students.map(s=>s.cells.find(c=>c.sessionNumber===state.sessionNumber)).filter(Boolean);
  const confirmed=cells.filter(c=>['synced','already_present'].includes(c.portalSync?.portalOutcome)).length;
  const has=state.sessionNumber!==null&&forms.length>0;
  const form=forms.length===1?forms[0]:null;
  return '<section class="teacherControlPanel"><header class="teacherControlHeading"><div><span class="teacherEyebrow">ĐIỀU KHIỂN BUỔI HỌC</span><h2>Mở nội dung và theo dõi điểm danh</h2><p>Học viên tự chuyển phần sau khi giáo viên mở. Nộp xong Progress Log sẽ tự ghi Có mặt khi đủ điều kiện.</p></div><span class="controlLiveBadge">● Bản xem thử chỉ đọc</span></header><div class="teacherControlGrid">'+
    '<article class="attendanceSyncCard"><div class="controlCardTop"><span class="controlIcon">✓</span><div><small>PHIẾU ĐIỂM DANH</small><strong>'+(!has?'Chọn một buổi có phiếu':confirmed+' đã có bằng chứng Portal')+'</strong></div></div><p class="previewMuted">'+(!has?'Buổi chưa có Progress Log không được coi là vắng hoặc thiếu bài.':'Trạng thái bài nộp và trạng thái Portal được đối chiếu riêng. Job hoàn tất chưa chứng minh Portal đã ghi.')+'</p><div class="attendanceMiniList">'+(has?'<span>'+cells.filter(c=>c.status==='complete').length+' đã nộp đủ</span><span>'+cells.filter(c=>c.portalSync&& !['synced','already_present'].includes(c.portalSync.portalOutcome)).length+' cần đọc lại kết quả Portal</span>':'<span>Lịch khóa học vẫn giữ nguyên</span>')+'</div><a class="syncAttendanceButton" href="../teacher.html" target="_blank" rel="noopener">Mở dashboard đang vận hành ↗</a></article>'+
    '<article class="sectionAccessCard"><div class="controlCardTop"><span class="controlIcon">▤</span><div><small>QUYỀN TRUY CẬP</small><strong>Mở / đóng từng phần</strong></div></div><p class="previewMuted">Đóng phần không xóa câu trả lời đã lưu; học viên được tiếp tục khi phần mở lại.</p>'+
    (form?.blocks?.length?form.blocks.map(b=>{const release=form.releases.find(r=>r.blockId===b.blockId);return '<div class="sectionAccessRow"><div><small>PHẦN '+esc(b.checkpoint??'')+'</small><strong>'+esc(b.title)+'</strong></div><span class="previewCell">'+esc(({open:'● Đang mở',closed:'○ Đang đóng',locked:'○ Đang khóa'})[release?.status]||'Chưa đọc trạng thái')+'</span></div>';}).join(''):'<div class="previewEmpty">'+(forms.length>1?'Buổi có nhiều phiếu, cần chọn trong dashboard vận hành.':!has?'Chưa có phiếu trong phạm vi đang xem.':'Chưa đọc cấu trúc phần.')+'</div>')+'</article></div></section>';
}
function questionCards(summary){
  const ranked=summary.questions.filter(q=>q.counts.graded>0&&q.counts.incorrect>0);
  return '<section class="previewAnalysis"><div class="previewAnalysisHeader"><span class="classInsightIcon">✦</span><div><span class="teacherEyebrow">TỔNG HỢP TỪ BÀI ĐÃ NỘP</span><h2>Câu sai nhiều nhất</h2></div><span class="classInsightCount">'+ranked.length+' câu có lỗi</span></div><p class="classInsightLead">Xếp theo số học viên sai. Tỷ lệ sai = số sai / số đã chấm của từng câu. Bấm vào câu để xem học viên và phương án thường chọn.</p><div class="classInsightList">'+
    (ranked.length?ranked.map((q,i)=>'<button class="classInsightItem previewQuestionButton '+(i===0?'insightHigh':'')+'" data-question="'+esc(q.key)+'"><div class="insightItemTop"><span class="teacherEyebrow">'+esc(fullLabel(q.sessionNumber))+' · CÂU '+q.position+'</span><span class="classInsightCount">'+q.counts.incorrect+'/'+q.counts.graded+' học viên sai · '+percent(q.errorRate)+'</span></div><h3>'+esc(q.prompt)+'</h3><div class="previewErrorBar"><i style="width:'+Math.round(q.errorRate*100)+'%"></i></div><p>'+q.counts.correct+' đúng · '+q.counts.incorrect+' sai'+(q.counts.pending?' · '+q.counts.pending+' chờ chấm':'')+'</p><div class="insightStudents">'+q.students.filter(s=>s.verdict==='incorrect').slice(0,6).map(s=>'<span>'+esc(personName(s))+'</span>').join('')+(q.counts.incorrect>6?'<span>+'+(q.counts.incorrect-6)+'</span>':'')+'</div></button>').join(''):
      '<div class="previewEmpty">'+(summary.graded?'Chưa có câu trả lời sai trong phạm vi đã chấm.':'Chưa có kết quả chấm đúng/sai trong phạm vi này.')+'</div>')+'</div></section>';
}
function studentTable(summary){
  return '<section class="previewTablePanel"><span class="teacherEyebrow">KẾT QUẢ CỦA TỪNG HỌC VIÊN</span><h2>Đúng / sai theo bài đã có</h2><p class="previewMuted">Chỉ cộng những câu có chấm đúng/sai trong '+summary.forms.length+' phiếu đang xem. Câu mở, tự đánh giá và câu không chấm được tách riêng. Không tính các buổi chưa tạo phiếu.</p><div class="previewScroll"><table class="previewTable"><thead><tr><th>Học viên</th><th>Phiếu đã nộp</th><th>Đúng</th><th>Sai</th><th>Tỷ lệ đúng</th><th>Chờ chấm / xem lại</th><th>Không chấm</th></tr></thead><tbody>'+summary.students.map(s=>'<tr><td><button data-student="'+esc(s.studentRef)+'">'+esc(personName(s))+'</button></td><td>'+s.submitted+'</td><td class="previewCorrect">'+s.correct+'</td><td class="previewIncorrect">'+s.incorrect+'</td><td>'+percent(s.graded?s.correct/s.graded:null)+'</td><td>'+s.pending+' / '+s.manual+'</td><td>'+s.ungraded+'</td></tr>').join('')+'</tbody></table></div></section>';
}
function roster(summary){
  return '<section class="teacherRoster"><div class="teacherSectionHeading"><div><span class="teacherEyebrow">BÀI NỘP HIỆN HÀNH</span><h2>Học viên'+(state.sessionNumber===null?' trong lớp':' · '+esc(fullLabel(state.sessionNumber)))+'</h2></div></div><div class="rosterList">'+summary.students.map(s=>'<div class="rosterEntry"><button class="rosterRow" data-student="'+esc(s.studentRef)+'"><span class="rosterAvatar">'+esc(s.name.trim()[0]||'?')+'</span><span class="rosterIdentity"><strong>'+esc(personName(s))+'</strong><small>'+(s.submitted?s.submitted+' phiếu đã nộp':'Chưa có bài nộp trong phạm vi này')+'</small></span><span class="rosterScore"><strong>'+(s.graded?s.correct+'/'+s.graded:'—')+'</strong><small>Đúng / đã chấm</small></span><span class="rosterArrow">⌄</span></button></div>').join('')+'</div></section>';
}
function overview(){
  const course=state.course.overview;
  return '<section class="previewTablePanel"><span class="teacherEyebrow">HÀNH TRÌNH CỦA LỚP</span><h2>'+course.totalSessions+' buổi trong khóa học</h2><p class="previewMuted">Đã có '+state.course.assignments.length+' Progress Log. Lịch còn lại là kế hoạch khóa học, không phải danh sách bài đang thiếu.</p><p class="previewNormalNote">Buổi chưa tạo Progress Log và buổi Test chưa có kết quả là trạng thái bình thường. Chỉ xét nộp bài khi đã có phiếu dành cho học viên.</p><div class="previewScroll"><table class="previewTable"><thead><tr><th>Học viên</th>'+course.sessions.map(s=>'<th>'+esc(sessionHeading(s,formFor(s.sessionNumber)))+'<br><small>'+esc(date(s.sessionDate))+'</small></th>').join('')+'</tr></thead><tbody>'+course.students.map(s=>'<tr><td><button data-journey="'+esc(s.studentRef)+'">'+esc(personName(s))+'</button><br><small>'+s.completeCount+' phiếu nộp đủ</small></td>'+s.cells.map(cell=>'<td><span class="previewCell '+esc(cell.status)+'">'+esc(sessionLabel(cell))+'</span></td>').join('')+'</tr>').join('')+'</tbody></table></div></section>';
}

function teacher(){
  const summary=courseForms(),course=state.course;
  const label=state.sessionNumber===null?'Tất cả phiếu':fullLabel(state.sessionNumber);
  return '<section class="teacherWorkspace">'+picker()+'<div class="teacherSessionBar"><div><span class="teacherEyebrow">BẢNG TỔNG KẾT CỦA LỚP</span><h1>'+esc(course.className)+' · '+esc(label)+'</h1><p>'+course.overview.students.length+' học viên · '+course.assignments.length+' Progress Log / '+course.overview.totalSessions+' buổi</p></div><div class="teacherSessionActions">'+sessionPicker()+'<a class="createProgressLogButton" href="../teacher.html" target="_blank" rel="noopener">+ Tạo Progress Log trong hệ đang vận hành ↗</a></div></div><nav class="previewTabs" aria-label="Nội dung"><button data-tab="dashboard" aria-pressed="'+(state.tab==='dashboard')+'">Theo dõi lớp</button><button data-tab="overview" aria-pressed="'+(state.tab==='overview')+'">Hành trình lớp</button><button data-tab="analytics" aria-pressed="'+(state.tab==='analytics')+'">Đúng / sai từng học viên</button></nav>'+
    (state.tab==='overview'?overview():state.tab==='analytics'?metrics(summary)+studentTable(summary)+questionCards(summary):controls()+metrics(summary)+'<div class="teacherGrid">'+roster(summary)+questionCards(summary)+'</div>'+studentTable(summary))+'</section>';
}

function studentJourney(){
  const course=state.course,s=course.overview.students.find(s=>s.studentRef===state.studentRef)||course.overview.students[0];
  if(!s)return '<section class="studentPortal"><div class="previewEmpty">Lớp chưa có danh sách học viên.</div></section>';
  const score=summarizeClass(course).students.find(p=>p.studentRef===s.studentRef);
  return '<section class="studentPortal">'+picker()+clockControls()+'<div class="studentPortalHero"><div><p class="studentPortalEyebrow">PORTAL HỌC VIÊN</p><h1>Chào '+esc(s.name)+', đây là hành trình học của em</h1><p>'+esc(course.className)+' · '+course.overview.totalSessions+' buổi trong khóa học</p></div><label class="portalStudentPicker"><span>ĐANG XEM HÀNH TRÌNH</span><select id="studentSelect">'+course.overview.students.map(p=>'<option value="'+esc(p.studentRef)+'" '+(p.studentRef===s.studentRef?'selected':'')+'>'+esc(personName(p))+'</option>').join('')+'</select></label></div><div class="studentPortalMetrics"><div><small>Đã hoàn thành</small><strong>'+s.completeCount+'</strong><span>Phiếu Progress Log nộp đủ</span></div><div><small>Progress Log đã có</small><strong>'+course.assignments.length+'</strong><span>Trong kế hoạch '+course.overview.totalSessions+' buổi</span></div><div><small>Câu trả lời đúng</small><strong>'+score.correct+'</strong><span>Trong các câu đã chấm</span></div><div><small>Câu trả lời sai</small><strong>'+score.incorrect+'</strong><span>Câu mở không tính đúng/sai</span></div></div><button class="studentCumulativeReport" data-student="'+esc(s.studentRef)+'"><span class="cumulativeReportIcon">▤</span><span class="cumulativeReportCopy"><small>TỔNG KẾT TỪ CÁC PHIẾU ĐÃ CÓ</small><strong>Nhìn lại kết quả của em</strong><em>Bài đã nộp, câu đúng và những câu cần xem lại</em></span><span class="cumulativeReportAction">Xem kết quả →</span></button><section class="studentJourney"><div><p class="studentPortalEyebrow">HÀNH TRÌNH CỦA EM</p><h2 style="font-size:28px;margin-top:8px">'+course.overview.totalSessions+' buổi học, từng bước rõ ràng</h2></div><p class="previewNormalNote">Buổi chưa tạo Progress Log là bình thường. Các buổi này vẫn nằm trong kế hoạch khóa học.</p><div class="studentSessionGrid">'+s.cells.map(cell=>journeyCard(s,cell)).join('')+'</div></section></section>';
}

function render(){
  $('sourceLabel').textContent=state.mode==='demo'?'DỮ LIỆU MINH HỌA':state.mode==='local'?'SNAPSHOT DỮ LIỆU THẬT':'DỮ LIỆU LỚP CỦA BẠN';
  $('demoData').hidden=state.mode==='demo';$('refresh').hidden=state.mode!=='real';$('realData').hidden=state.mode==='real';
  $('teacherView').classList.toggle('roleActive',state.view==='teacher');$('studentView').classList.toggle('roleActive',state.view==='student');
  $('workspace').innerHTML=state.course?(state.detail?detailPage():state.view==='teacher'?teacher():studentJourney()):'<section class="teacherWorkspace"><div class="previewEmpty">Chưa có dữ liệu lớp. Hãy đăng nhập hoặc thử đọc lại.</div></section>';
}
function showDialog(html){$('detailContent').innerHTML=html;if(!$('detailDialog').open)$('detailDialog').showModal();}
function openQuestion(key){
  const q=courseForms().questions.find(q=>q.key===key);if(!q)return;
  showDialog('<span class="teacherEyebrow">'+esc(fullLabel(q.sessionNumber))+' · CÂU '+q.position+'</span><h2>'+esc(q.prompt)+'</h2><p>'+q.counts.incorrect+'/'+q.counts.graded+' học viên sai · '+percent(q.errorRate)+'. Mỗi học viên được đếm một lần trong câu này.</p><h3>Phương án đã chọn</h3>'+q.choices.filter(c=>c.count).map(c=>'<p>'+esc(c.label)+' · '+c.count+' người chọn · '+c.incorrect+' người sai</p>').join('')+'<h3>Học viên trả lời sai</h3>'+q.students.filter(s=>s.verdict==='incorrect').map(s=>'<div class="previewVerdict">'+esc(personName(s))+'</div>').join('')+(q.counts.pending?'<p>'+q.counts.pending+' chờ chấm, chưa nằm trong mẫu số.</p>':''));
}
function openStudent(ref,number=state.sessionNumber){
  const summary=summarizeClass(state.course,number),s=summary.students.find(p=>p.studentRef===ref);if(!s)return;
  const wrong=summary.questions.filter(q=>q.students.some(p=>p.studentRef===ref&&p.verdict==='incorrect'));
  showDialog('<span class="teacherEyebrow">'+esc(state.course.className)+' · '+(number===null?'CÁC PHIẾU ĐÃ CÓ':esc(fullLabel(number)))+'</span><h2>'+esc(personName(s))+'</h2><p>'+s.submitted+' phiếu đã nộp · '+s.correct+' đúng · '+s.incorrect+' sai · '+s.pending+' chờ chấm · '+s.ungraded+' câu không chấm.</p><h3>Câu cần xem lại</h3>'+(wrong.length?wrong.map(q=>'<div class="previewVerdict"><small>'+esc(fullLabel(q.sessionNumber))+' · Câu '+q.position+'</small><p>'+esc(q.prompt)+'</p></div>').join(''):'<p>'+(s.graded?'Chưa có câu sai trong phần đã chấm.':'Chưa có kết quả chấm đúng/sai.')+'</p>'));
}

$('workspace').addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.dataset.tab){state.tab=target.dataset.tab;render();}
  if(target.dataset.question)openQuestion(target.dataset.question);
  if(target.dataset.student){if(state.view==='teacher'&&state.sessionNumber!==null){state.studentRef=target.dataset.student;void openSession(state.sessionNumber);}else openStudent(target.dataset.student,null);}
  if(target.dataset.journey){state.studentRef=target.dataset.journey;state.view='student';render();window.scrollTo(0,0);}
  if(target.dataset.sessionDetail)void openSession(Number(target.dataset.sessionDetail));
  if(target.dataset.backJourney!==undefined){invalidateDetail();render();window.scrollTo(0,0);}
  if(target.dataset.retryDetail!==undefined&&state.detail)void openSession(state.detail.number);
  if(target.dataset.clock){invalidateDetail();state.previewClock=target.dataset.clock==='actual'?null:Date.parse(slotFor(7).sessionDate+'T'+target.dataset.clock+':00+07:00');render();}

});
$('workspace').addEventListener('change',event=>{
  if(event.target.id==='classSelect'){
    invalidateDetail();
    if(state.mode==='real')void loadClass(event.target.value);
    if(state.mode==='local'){state.course=localCourses.find(c=>c.classId===event.target.value);state.sessionNumber=Math.max(...state.course.assignments.map(a=>a.sessionNumber));state.studentRef=state.course.overview.students[0]?.studentRef;render();}
  }
  if(event.target.id==='sessionSelect'){state.sessionNumber=event.target.value==='all'?null:Number(event.target.value);render();void loadControls(state.generation);}
  if(event.target.id==='studentSelect'){invalidateDetail();state.studentRef=event.target.value;render();}
});
$('teacherView').addEventListener('click',()=>{invalidateDetail();state.view='teacher';render();});
$('studentView').addEventListener('click',()=>{invalidateDetail();state.view='student';render();});
$('realData').addEventListener('click',()=>void useRealData());
$('retrySession').addEventListener('click',()=>void useRealData());
$('refresh').addEventListener('click',()=>{const id=state.course?.classId;void(id?loadClass(id):useRealData());});
$('demoData').addEventListener('click',()=>{
  invalidateDetail();state.previewClock=null;state.controller?.abort();state.generation++;state.mode='demo';state.course=demoCourse;state.classes=[{id:'demo',name:demoCourse.className}];state.sessionNumber=5;state.studentRef=demoCourse.overview.students[0].studentRef;
  $('access').hidden=true;$('detailDialog').close();$('detailContent').replaceChildren();notice('Dữ liệu minh họa hoàn toàn giả.');render();
});
$('detailDialog').addEventListener('close',()=>$('detailContent').replaceChildren());

// Các thao tác xem bài giữ đúng ngữ cảnh và chỉ GET; lỗi/tải hiện trên màn riêng.
function invalidateDetail(){state.detailController?.abort();state.detailController=null;state.detailGeneration++;state.detail=null;}
function clockControls(){
  if(state.mode!=='demo')return '';
  return '<div class="previewClock"><span>Thử mốc giờ của buổi07 · '+esc(date(slotFor(7).sessionDate))+'</span><button data-clock="18:24">Trước giờ ·18:24</button><button data-clock="18:25">Đúng giờ ·18:25</button><button data-clock="actual">Giờ hiện tại</button><small>'+(state.previewClock===null?'Đang dùng giờ thực tại Việt Nam':'Đồng hồ minh họa · '+new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'}).format(state.previewClock))+'</small></div>';
}
function journeyCard(student,cell){
  const slot=slotFor(cell.sessionNumber),form=formFor(cell.sessionNumber),title=contentTitle(slot,form);
  const status=sessionState(slot,cell,form,state.previewClock??Date.now());
  const score=summarizeClass(state.course,cell.sessionNumber).students.find(s=>s.studentRef===student.studentRef);
  const actionable=status.canLearn&&state.mode==='real'&&form?.publicToken&&!['complete','incomplete'].includes(cell.status);
  const tag=actionable?'a':'button';
  return '<'+tag+(actionable?' href="../#assignment='+encodeURIComponent(form.publicToken)+'" target="_blank" rel="noopener"':'')+' class="studentSessionCard session-'+status.kind+'" data-session-detail="'+cell.sessionNumber+'" aria-label="'+esc(sessionHeading(slot,form)+' · '+status.label)+'"><span class="studentSessionTop"><b>BUỔI '+String(cell.sessionNumber).padStart(2,'0')+'</b><em>'+esc(date(slot.sessionDate))+'</em></span><strong>'+esc(title)+'</strong><small>'+esc(skillsLabel(title)|| (slot.sessionKind==='test'?'Kết quả sẽ hiện khi nguồn Test hoàn tất':'Trong kế hoạch khóa học'))+'</small><span class="studentSessionBottom"><i>'+esc(status.label)+'</i><b>'+(score?.graded?score.correct+'/'+score.graded:status.canLearn?'→':'')+'</b></span></'+tag+'>';
}
function detailPage(){
  const view=state.detail,slot=slotFor(view.number),form=formFor(view.number),title=contentTitle(slot,form);
  const person=state.course.overview.students.find(p=>p.studentRef===view.ref),cell=person.cells.find(c=>c.sessionNumber===view.number);
  const status=sessionState(slot,cell,form,state.previewClock??Date.now()),data=view.data;
  const grade=data?.gradingItems?.filter(g=>['correct','incorrect'].includes(g.verdict))||[];
  const score=grade.length?grade.filter(g=>g.verdict==='correct').length+'/'+grade.length:'—';
  const link=status.canLearn&&state.mode==='real'&&form?.publicToken?'<a class="reviewLearnLink" href="../#assignment='+encodeURIComponent(form.publicToken)+'" target="_blank" rel="noopener">Nhấn để học buổi '+String(view.number).padStart(2,'0')+' · '+esc(title)+' →</a>':'';
  let body=view.loading?'<div class="previewEmpty" role="status">Đang đọc đầy đủ câu hỏi và bài đã nộp…</div>':view.error?'<div class="previewEmpty" role="alert">'+esc(view.error)+'<button data-retry-detail>Thử đọc lại bài</button></div>':data?.definition?'<div class="studentDetailScore"><small>Kết quả câu đã chấm đúng/sai</small><strong>'+score+'</strong><span>Nội dung dưới đây là câu hỏi và câu trả lời đã ghi; câu mở/tự khai không được tính đúng/sai.</span></div>'+reviewItems(data):'<div class="previewEmpty">'+esc(status.label)+'. Đây là mốc trong kế hoạch khóa học; chưa có dữ liệu Progress Log. Không được coi là thiếu bài hoặc vắng học.</div>';
  if(data?.testResult){const t=data.testResult;body+='<section class="studentAnswerReview"><h2>'+esc(t.title||'Kết quả Test')+'</h2>'+['listening','reading'].map(k=>t[k]?'<p>'+k+': '+esc(t[k].correct)+'/'+esc(t[k].total)+'</p>':'').join('')+(t.writing?'<p>Writing: '+esc(t.writing.status==='ready'?t.writing.score:'Đang chờ kết quả')+'</p>':'')+'</section>';}
  if(data?.teacherSessionFeedback?.noteText)body+='<section class="studentAnswerReview"><h2>Nhận xét của giảng viên</h2><p class="reviewAnswer">'+esc(data.teacherSessionFeedback.noteText)+'</p></section>';
  return '<section class="studentDetailPage"><button class="portalBackButton" data-back-journey>'+ (state.view==='teacher'?'← Quay lại lớp':'← Tất cả bài học')+'</button><header class="studentDetailHeader"><div><span class="studentPortalEyebrow">'+(cell.status==='complete'?'PROGRESS LOG ĐÃ HOÀN THÀNH':'PROGRESS LOG')+' · BUỔI '+String(view.number).padStart(2,'0')+'</span><h1>'+esc(title)+'</h1><p>'+esc(date(slot.sessionDate))+' · '+esc(skillsLabel(title))+'</p></div><span class="portalCompleteBadge">'+esc(status.label)+'</span></header><p class="reviewPerson">'+esc(personName(person))+' · '+esc(state.course.className)+'</p>'+link+body+'</section>';
}
async function openSession(number){
  invalidateDetail();const person=state.course?.overview.students.find(p=>p.studentRef===state.studentRef);
  if(!person)return;const ref=person.studentRef,classId=state.course.classId,generation=state.generation,own=state.detailGeneration;
  state.detail={number,ref,loading:true,data:null,error:null};render();window.scrollTo(0,0);
  const controller=new AbortController();state.detailController=controller;const timeout=setTimeout(()=>controller.abort(),15_000);
  try{
    const data=state.mode==='demo'?demoDetail(ref,number):state.mode==='local'?state.course.details?.find(d=>d.student.studentRef===ref&&d.sessionNumber===number):
      (await read('/teacher/classes/'+encodeURIComponent(classId)+'/sessions/'+number+'/students/'+encodeURIComponent(ref),controller.signal)).detail;
    if(state.detailGeneration!==own||state.generation!==generation||!state.detail||controller.signal.aborted)return;
    if(!data)throw new Error('Chưa có snapshot toàn bộ bài. Hãy dùng dữ liệu lớp của tôi để đọc bài hiện hành.');
    if(String(data.classId)!==String(classId)||data.student?.studentRef!==ref||Number(data.sessionNumber)!==number)throw new Error('Bài trả về không khớp học viên, lớp hoặc buổi đã chọn.');
    state.detail={number,ref,loading:false,data,error:null};render();
  }catch(error){if(state.detailGeneration===own&&state.generation===generation&&state.detail){state.detail.loading=false;state.detail.error=controller.signal.aborted?'Đọc bài quá15 giây. Bạn có thể thử lại.':error.message;render();}}
  finally{clearTimeout(timeout);}
}
// Cập nhật nhãn đúng ranh giới phút18:25 và khi tab được mở lại, không gọi API nền.
let clockSignature='';
function updateClock(){
  if(state.view!=='student'||state.detail||!state.course||state.previewClock!==null)return;
  const person=state.course.overview.students.find(s=>s.studentRef===state.studentRef);
  const signature=person?.cells.map(c=>sessionState(slotFor(c.sessionNumber),c,formFor(c.sessionNumber)).label).join('|');
  if(signature!==clockSignature){clockSignature=signature;render();}
}
function scheduleClock(){setTimeout(()=>{updateClock();scheduleClock();},60000-Date.now()%60000+20);}
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.detail){invalidateDetail();render();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateClock();});scheduleClock();

let localCourses=[];
render();
// Dùng riêng cho kiểm cục bộ: snapshot private chỉ được máy chủ localhost cung cấp.
if(location.hostname==='127.0.0.1'&&location.hash==='#local'){
  try{
    const response=await fetch('/private-data.json',{cache:'no-store'});
    if(!response.ok)throw new Error('Không đọc được snapshot riêng tư.');
    const snapshot=await response.json();if(snapshot.status!=='success')throw new Error('Snapshot chưa được xác minh.');
    localCourses=snapshot.classes;state.mode='local';state.classes=localCourses.map(c=>({id:c.classId,name:c.className}));
    state.course=localCourses.find(c=>c.className==='IC2305')||localCourses[0];state.sessionNumber=5;state.studentRef=state.course.overview.students[0].studentRef;
    render();notice('Dữ liệu chụp '+new Date(snapshot.capturedAt).toLocaleString('vi-VN')+'; không tự cập nhật.');
  }catch(error){notice(error.message);}
}

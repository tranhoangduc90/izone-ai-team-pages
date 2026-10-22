// Chỉ dùng số câu tự báo hợp lệ của bài đã nhận và điểm Test có nguồn.
// Các hàm thống kê dùng lại đúng quy tắc đã duyệt trong bản Thủy; không gọi AI hoặc sinh dữ liệu.
import {practiceReport,priority,speakingAnalytics,speakingSummary,publishedSourceFeedback} from '../thuy-review/model.mjs';
import {bindDialogDismiss} from '../session-comments.js';
const skills={listening:'Listening',reading:'Reading',speaking:'Speaking',writing:'Writing'};
const node=(tag,text='',className='')=>{const element=document.createElement(tag);element.textContent=text;element.className=className;return element;};
const percent=value=>Number.isFinite(value)?value.toLocaleString('vi-VN',{maximumFractionDigits:1})+'%':'Chưa có dữ liệu';
const tests=['Mini Test','Term Test 1','Term Test 2'];
const views=new WeakMap();
function portalSourceNote(people){
 const records=people.flatMap(testRecords).filter(r=>r.source==='erp_56_mini_test');if(!records.length)return null;
 const observed=records[0].observedAt,stale=records.some(r=>r.sourceCoverage==='stale_snapshot');
 return node('p','Mini Test · Nguồn Portal · Đọc lúc '+new Date(observed).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})
  +(stale?' · ERP đang tạm lỗi, hiện bản đã đọc trước đó.':'')+' · Nguồn chưa ghi ngày thi; không tự gán vào một buổi.','thuy-source-note');
}

export function buildSkillCourse(overview,forms){
 const sessions=forms.map(form=>({number:form.sessionNumber,date:overview.sessions.find(s=>s.sessionNumber===form.sessionNumber)?.sessionDate,
  definition:form.definition,students:form.dashboard.students.map(person=>{
   const live=form.live.students.find(s=>s.studentRef===person.studentRef),submissionId=live?.submissionId||person.submissionId;
   const detail={submissionId:submissionId||null,responses:submissionId?live?.finalResponses||{}:{}};
   return {...person,submitted:Boolean(submissionId),detail,publishedFeedback:publishedSourceFeedback(person),
    reports:Object.fromEntries(['listening','reading'].map(skill=>[skill,practiceReport(form.definition,detail,skill)]))};
  })}));
 return {overview,sessions,people:overview.students};
}
export function skillReports(course,studentRef,skill){
 return course.sessions.flatMap(session=>{const value=session.students.find(s=>s.studentRef===studentRef)?.reports[skill];return value?[{...value,sessionNumber:session.number,date:session.date}]:[];});
}
export function testRecords(person){
 return [...(person.externalTests||[]),...(person.cells||[]).flatMap(cell=>cell.testResult?[{...cell.testResult,sessionNumber:cell.sessionNumber}]:[])];
}
function testIndex(result){const label=(result.title||result.testSlug||'').toLocaleLowerCase().replace(/[-_]/g,' ');return /mini/.test(label)?0:/term\s*(?:test\s*)?1/.test(label)?1:/term\s*(?:test\s*)?2/.test(label)?2:-1;}
function namedTest(person,index){return testRecords(person).find(result=>testIndex(result)===index);}
function action(text,callback,className='button'){const button=node('button',text,className);button.type='button';button.addEventListener('click',callback);return button;}
function modal(title,body){
 const dialog=node('dialog','','thuy-full-feedback'),heading=node('header','','thuy-distribution-head');
 heading.append(node('h2',title),action('×',()=>dialog.close()));dialog.append(heading,body);document.body.append(dialog);bindDialogDismiss(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();return dialog;
}
function writingFeedback(result,full=false){
 const section=node('div','','thuy-writing-feedback'),writing=result?.writing;
 section.append(node('b',Number.isFinite(writing?.score)?String(writing.score):'Chưa có điểm'));
 for(const task of [1,2]){
  const feedback=writing?.tasks?.[task]?.feedback;
  const text=node('p',`Task ${task}: ${typeof feedback==='string'&&feedback.trim()?feedback:'Chưa có nhận xét'}`,full?'':'thuy-feedback-excerpt');section.append(text);
 }
 if(!full&&[1,2].some(task=>writing?.tasks?.[task]?.feedback?.trim()))section.append(action('Đọc đủ',()=>modal(result.title||'Nhận xét Writing',writingFeedback(result,true)),'button text-button'));
 return section;
}
function explanation(){
 const details=node('details','','thuy-metric-method');details.append(node('summary','Cách thống kê'),node('p','Listening/Reading: cộng số câu đúng và tổng câu hợp lệ trong từng buổi, rồi lấy trung bình tỷ lệ của các buổi. Chỉ dùng số tự báo ở phiếu đã nộp; thiếu dữ liệu không tính là 0. Điểm Quiz và Test giữ riêng. Nhãn Ưu tiên xem chỉ xuất hiện khi có ít nhất ba buổi hợp lệ và trung bình ba buổi gần nhất dưới 60%.'));
 details.append(node('p','Speaking: gom các nhãn đã có trong bản đối chiếu, mỗi học viên/buổi đóng góp tối đa một lần cho một nhóm. Nhãn chưa có trong bản đồ giữ nguyên; không dùng AI suy diễn và không chuyển thành điểm.'));
 return details;
}
function chart(reports){
 const root=node('figure','','thuy-skill-chart');root.append(node('figcaption','Tỷ lệ đúng tự báo theo buổi'));
 if(!reports.length){root.append(node('p','Chưa có số tự báo hợp lệ.'));return root;}
 const ordered=[...reports].sort((a,b)=>a.sessionNumber-b.sessionNumber),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 460 140');svg.setAttribute('role','img');svg.setAttribute('aria-label',ordered.map(r=>`Buổi ${r.sessionNumber}: ${percent(r.percent)}`).join('; '));
 const make=(tag,attrs)=>{const el=document.createElementNS(svg.namespaceURI,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);return el;};
 for(const value of [0,50,100]){const y=115-value;svg.append(make('line',{x1:30,x2:440,y1:y,y2:y,stroke:'#e2e7eb'}));const label=make('text',{x:0,y:y+4,'font-size':10,fill:'#586477'});label.textContent=String(value);svg.append(label);}
 const points=ordered.map((r,index)=>({x:40+index*390/Math.max(1,ordered.length-1),y:115-r.percent,report:r}));
 svg.append(make('polyline',{points:points.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:'#174266','stroke-width':2}));
 for(const point of points){const circle=make('circle',{cx:point.x,cy:point.y,r:4,fill:'#db0829'}),title=make('title',{});title.textContent=`Buổi ${point.report.sessionNumber}: ${percent(point.report.percent)}`;circle.append(title);svg.append(circle);const label=make('text',{x:point.x,y:135,'text-anchor':'middle','font-size':10,fill:'#586477'});label.textContent=String(point.report.sessionNumber);svg.append(label);}
 root.append(svg);return root;
}

export function renderPersonSkills(root,course,person,{onOpen,history=true}={}){
 const heading=node('h2','Tổng quan · '+person.name),grid=node('div','','thuy-four-skills');
 for(const skill of ['listening','reading']){const values=skillReports(course,person.studentRef,skill),summary=priority(values),card=node('section','','card');card.append(node('h3',skills[skill]),node('strong',percent(summary.average)),node('p',summary.count+' buổi có số tự báo hợp lệ'),chart(values));
  tests.forEach((title,index)=>{const test=namedTest(person,index),score=test?.[skill];if(score)card.append(node('p',title+': '+score.correct+'/'+score.total+(test.source?' · Nguồn Portal':'')));});
  if(summary.flagged)card.append(node('p','Ưu tiên xem · TB ba buổi gần nhất '+percent(summary.recentAverage),'thuy-priority'));grid.append(card);}
 const speaking=speakingSummary(course.sessions,person.studentRef),speech=node('section','','card');speech.append(node('h3','Speaking'));
 for(const group of speaking.frequencies)speech.append(node('p',`${group.label}: ${group.count} buổi`));if(!speaking.frequencies.length)speech.append(node('p','Chưa có phản hồi Speaking đã nộp.'));
 if(speaking.latest)speech.append(action('Xem nhận xét',()=>modal('Nhận xét Speaking · Buổi '+speaking.latest.number,node('p',speaking.latest.text))));grid.append(speech);
 const writing=node('section','','card');writing.append(node('h3','Writing'));
 tests.forEach((title,index)=>{const result=namedTest(person,index),line=node('div','','thuy-person-test');line.append(node('b',title),writingFeedback(result));writing.append(line);});grid.append(writing);
 root.replaceChildren(heading,grid,explanation());
 const source=portalSourceNote([person]);if(source)heading.after(source);
 if(!history)return;
 const list=node('section');list.append(node('h3','Lịch sử buổi học'));
 for(const cell of person.cells||[]){const session=course.overview.sessions.find(s=>s.sessionNumber===cell.sessionNumber);list.append(action('Buổi '+cell.sessionNumber+' · '+(session?.sessionDate||'Chưa có ngày')+' · '+({complete:'Đã nộp',incomplete:'Đã nộp · còn câu trống',test_result:'Có kết quả Test',no_assignment:'Chưa có phiếu',not_submitted:'Chưa nộp'}[cell.status]||'Dữ liệu hiện có'),()=>onOpen?.(person.studentRef,cell.sessionNumber),'button text-button'));}
 root.append(list);
}

export function renderTeacherSkills(root,course,{onSummary,onOpen}){
 const previous=views.get(root),saved=previous?.classId===course.overview.classId?previous:{};
 let {skill='listening',query='',filter='all',order='name'}=saved;
 const paint=()=>{
  views.set(root,{classId:course.overview.classId,skill,query,filter,order});
  const nav=node('nav','','thuy-skill-tabs');nav.setAttribute('aria-label','Bốn kỹ năng');for(const [key,label]of Object.entries(skills)){const button=action(label,()=>{skill=key;filter='all';order='name';paint();});button.setAttribute('aria-pressed',String(skill===key));nav.append(button);}
  const toolbar=node('div','','thuy-roster-tools'),input=node('input');input.type='search';input.value=query;input.placeholder='Tìm học viên';input.setAttribute('aria-label','Tìm trong hành trình lớp');input.addEventListener('input',()=>{query=input.value;paint();const restored=root.querySelector('input');restored.focus();});
  const select=node('select');select.setAttribute('aria-label','Lọc dữ liệu kỹ năng');for(const [id,label]of [['all','Tất cả học viên'],['data','Có dữ liệu'],['missing','Chưa có dữ liệu'],...(['listening','reading'].includes(skill)?[['priority','Ưu tiên xem']]:[])]){const option=node('option',label);option.value=id;select.append(option);}select.value=filter;select.addEventListener('change',()=>{filter=select.value;paint();});
  const sort=node('select');sort.setAttribute('aria-label','Sắp xếp kỹ năng');for(const [id,label]of [['name','Tên học viên'],...(['listening','reading'].includes(skill)?[['low','TB thấp lên trước'],['high','TB cao lên trước']]:skill==='writing'?tests.flatMap((name,index)=>[['test-low-'+index,name+' ↑'],['test-high-'+index,name+' ↓']]):[])]){const option=node('option',label);option.value=id;sort.append(option);}sort.value=order;sort.addEventListener('change',()=>{order=sort.value;paint();});toolbar.append(input,select,sort);
  const people=course.people.map(person=>{
   const summary=priority(skillReports(course,person.studentRef,skill));
   const hasData=['listening','reading'].includes(skill)?summary.count>0:skill==='speaking'?speakingSummary(course.sessions,person.studentRef).frequencies.length>0||Boolean(speakingSummary(course.sessions,person.studentRef).latest):testRecords(person).some(r=>Number.isFinite(r.writing?.score)||[1,2].some(t=>r.writing?.tasks?.[t]?.feedback?.trim()));
   return {person,summary,hasData};
  }).filter(({person,summary,hasData})=>person.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))&&(filter==='all'||filter==='priority'&&summary.flagged||filter==='data'&&hasData||filter==='missing'&&!hasData));
  people.sort((a,b)=>{if(order==='name')return (['listening','reading'].includes(skill)?Number(b.summary.flagged)-Number(a.summary.flagged)||Number(b.hasData)-Number(a.hasData):0)||a.person.name.localeCompare(b.person.name,'vi');const score=value=>order.startsWith('test-')?namedTest(value.person,Number(order.split('-').at(-1)))?.writing?.score:value.summary.average,aa=score(a),bb=score(b);return Number(!Number.isFinite(aa))-Number(!Number.isFinite(bb))||(Number.isFinite(aa)&&Number.isFinite(bb)?(aa-bb)*(order==='high'||order.startsWith('test-high')?-1:1):0)||a.person.name.localeCompare(b.person.name,'vi');});
  const content=node('div'),table=node('table','','thuy-roster'),head=node('tr'),sessions=[...course.sessions].sort((a,b)=>a.number-b.number);
  const columns=skill==='writing'?['Học viên',...tests]:skill==='speaking'?['Học viên','Tự nhìn lại','Nhận xét mới nhất']:['Học viên','TB Progress Log',...tests];for(const label of columns)head.append(node('th',label));const thead=node('thead');thead.append(head);table.append(thead);const tbody=node('tbody');
  for(const {person,summary}of people){const row=node('tr'),name=node('td');name.append(action(person.name,()=>onSummary(person),'button text-button'));if(person.current===false)name.append(node('small','Hồ sơ lịch sử · Không thuộc danh sách hiện tại'));if(summary.flagged)name.append(node('small','Ưu tiên xem · TB 3 buổi: '+percent(summary.recentAverage),'thuy-priority'));row.append(name);
   if(skill==='writing')for(let i=0;i<3;i++){const cell=node('td');cell.append(writingFeedback(namedTest(person,i)));row.append(cell);}
   else if(skill==='speaking'){const value=speakingSummary(course.sessions,person.studentRef);row.append(node('td',value.frequencies.map(g=>g.label+' ('+g.count+')').join(' · ')||'Chưa có phản hồi'));const cell=node('td');cell.append(node('p',value.latest?.text||'Chưa có nhận xét','thuy-feedback-excerpt'));if(value.latest)cell.append(action('Đọc đủ',()=>modal('Nhận xét Speaking · '+person.name,node('p',value.latest.text)),'button text-button'));row.append(cell);}
   else{row.append(node('td',percent(summary.average)));for(let i=0;i<3;i++){const result=namedTest(person,i)?.[skill];row.append(node('td',result&&Number.isFinite(result.correct)&&Number.isFinite(result.total)?result.correct+'/'+result.total:'Chưa có điểm'));}}
   tbody.append(row);
  }table.append(tbody);const scroll=node('div','','thuy-roster-scroll');scroll.tabIndex=0;scroll.append(table);content.append(scroll,node('p',`Đang hiển thị ${people.length}/${course.people.length} học viên · Cuộn ngang để xem các buổi. Nguồn chưa kết nối giữ trạng thái chưa có dữ liệu.`,'thuy-roster-hint'));
  if(skill==='speaking'){
   const counts=speakingAnalytics(course.sessions),stats=node('section','','card thuy-speaking-stats'),chart=node('div','','thuy-speaking-chart'),method=node('details');
   stats.append(node('h3',`${counts.contributors} học viên · ${counts.forms} phiếu có phản hồi`));method.append(node('summary','Đối chiếu nhãn gốc'));
   const maximum=Math.max(1,...counts.groups.map(group=>group.count));
   for(const group of counts.groups){const row=node('div','','thuy-speaking-bar'),track=node('span','','thuy-speaking-track'),fill=node('i');fill.style.width=group.count/maximum*100+'%';track.append(fill);row.append(node('span',group.label),track,node('strong',String(group.count)));row.title=group.count+' lần chọn';chart.append(row);
    const details=node('details');details.append(node('summary',`${group.label}: ${group.count}`));for(const source of group.originals)details.append(node('p',`${source.label} · ${source.count}`));method.append(details);
   }
   if(!counts.groups.length)chart.append(node('p','Chưa có phản hồi Speaking đã nộp.'));
   stats.append(node('small','Số lần chọn · Một học viên có thể có phản hồi ở nhiều buổi.'),chart,method);content.prepend(stats);
  }
  root.replaceChildren(nav,toolbar,content,explanation());const source=portalSourceNote(course.people);if(source)toolbar.after(source);
 };paint();
}

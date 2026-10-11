// Nhận các node của renderer thật; thay cách trình bày, giữ sự kiện và nghiệp vụ.
// Không tạo kết quả, biên nhận hoặc dữ liệu học viên mẫu trên trang phát hành.
const lesson=Number(document.body.dataset.speakingLesson);
await import(lesson===2?'./lesson-2-live.js':lesson===3?'./lesson-3-live.js':'./lesson-4-live.js');
const $=id=>document.getElementById(id);
document.body.classList.add('speaking-design');
const topics={2:'Diễn đạt theo cách của bạn',3:'Làm rõ điều muốn nói',4:'Nối ý, mở rộng câu trả lời',5:'Ôn tập Làm rõ và Chèn điểm giữa',6:'Lý do đằng sau hành động',7:'Cách làm một việc'};
const header=document.createElement('header');header.className='studio-header';
header.innerHTML='<a href="./index.html" class="studio-brand" aria-label="IZONE">IZONE<span>HỌC MỖI NGÀY</span></a><span>Speaking <i>/</i> Khóa 6.0–7.0</span>';
document.querySelector('.page-shell').prepend(header);
const badge=$('lesson-badge');if(badge)badge.hidden=true;
const hero=$('lesson-hero');
hero.innerHTML=`<div class="lesson-heading"><p class="section-kicker">HOMEWORK · BUỔI ${String(lesson).padStart(2,'0')}</p><h1>${topics[lesson]}<span class="heading-dot">.</span></h1><p class="hero-copy">Luyện cùng chatbot, rồi quay lại đây để xác nhận hội thoại và nộp bài.</p></div><div class="lesson-index" aria-hidden="true">${String(lesson).padStart(2,'0')}</div>`;
if(badge)hero.append(badge);
hero.querySelector('h1').tabIndex=-1;
const introTitle=document.querySelector('.login-intro h1');if(introTitle)introTitle.innerHTML='Mỗi lần luyện,<br>thêm tự tin<span class="heading-dot">.</span>';
const introCopy=document.querySelector('.login-copy');if(introCopy)introCopy.textContent=`Buổi ${lesson} · ${topics[lesson]}. Chọn lớp và tên của bạn để mở bài.`;
const cards=[...document.querySelectorAll('#parts .task-card')];
const nav=document.createElement('nav');nav.className='lesson-nav';nav.setAttribute('aria-label','Các phần trong bài');
for(const [i,card] of cards.entries()) {
  const a=document.createElement('a');a.href='#'+card.id;a.innerHTML=`<b>${String(i+1).padStart(2,'0')}</b> ${cards.length===1?'Bài chính':'Phần '+(i+1)}`;nav.append(a);
}
if($('doctor-section')){const a=document.createElement('a');a.href='#doctor-section';a.textContent=lesson>=4?'Bài bổ trợ':'Bác sĩ AI';nav.append(a);}
$('homework-content').prepend(nav);
const note=document.createElement('p');note.className='journey-note';
document.querySelector('.submission-progress').after(note,$('draft-status'));
const intro=document.querySelector('.section-intro');
if(intro){const help=document.createElement('details');help.className='link-help';const summary=document.createElement('summary');summary.textContent='Link nào dùng để nộp bài?';help.append(summary);const p=intro.querySelector('p');if(p)help.append(p);intro.replaceWith(help);$('homework-content').append(help);}
for(const card of cards){
  const instructions=card.querySelector('.instructions');const panel=card.querySelector('.submission-panel');
  const practice=card.querySelector('.practice-button');instructions.append(practice);practice.textContent='Bắt đầu luyện với chatbot ↗';
  const returnHint=document.createElement('p');returnHint.className='return-hint';returnHint.textContent='Chatbot mở ở tab mới. Luyện xong, quay lại đây để nộp link.';instructions.append(returnHint);
  const h=document.createElement('h3');h.textContent='Luyện xong? Nộp tại đây';panel.prepend(h);
  card.querySelector('.confirm-button').textContent='Xác nhận hội thoại →';
}
const dialog=$('share-guide-dialog');
for(const input of document.querySelectorAll('#homework-content input[type="url"]')){
  const label=document.querySelector(`label[for="${input.id}"]`);if(!label)continue;
  const row=document.createElement('div');row.className='share-field-heading';label.before(row);row.append(label);
  const button=input===cards[0].querySelector('input')?$('open-share-guide'):document.createElement('button');
  button.type='button';button.className='share-help-button';button.textContent='Cách lấy link Share';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',dialog.id);
  if(button.id!=='open-share-guide'){button.id=input.id+'-share-guide';button.addEventListener('click',()=>dialog.showModal());}
  row.append(button);label.textContent=input.id==='extra-link'?'Link hội thoại mới':'Link chia sẻ toàn bộ hội thoại';
  let hint=input.nextElementSibling?.classList.contains('field-hint')?input.nextElementSibling:null;
  if(!hint){hint=document.createElement('p');hint.className='field-hint';input.after(hint);hint.textContent='Luyện đến bước áp dụng vào câu Speaking, rồi chia sẻ cả hội thoại.';}
  hint.id=input.id+'-hint';input.setAttribute('aria-describedby',hint.id);
}
const doctor=$('doctor-section');
if(doctor){
  const required=doctor.querySelector('.doctor-required');
  if(required){const aside=document.createElement('div');aside.className='doctor-recommendations';for(const el of [...doctor.children])if(el!==required)aside.append(el);doctor.prepend(aside);
    required.querySelector('h3').textContent='Hai bài bổ trợ';required.querySelector('p').textContent='Mỗi bài: chọn bài → mở chatbot và luyện → lấy link Share → xác nhận. Hai bài phải khác nhau và dùng hai hội thoại riêng.';
  }else doctor.classList.add('without-required');
}
if($('extra-practice'))$('extra-practice').before($('completion-card'));
for(const slot of [1,2]){const select=$(`practice-${slot}-exercise`);if(!select)continue;document.querySelector(`label[for="${select.id}"]`).textContent='1. Chọn bài luyện';$(`practice-${slot}-open`).textContent='2. Mở bài và luyện ↗';}
const next=[];
for(const [i,card] of cards.entries()){
  const target=cards[i+1]||(lesson>=4?doctor:null);if(!target)continue;
  const link=document.createElement('a');link.className='next-step';link.href='#'+target.id;link.textContent=cards[i+1]?`Tiếp theo: ${cards[i+1].querySelector('h2').textContent} ↓`:'Tiếp theo: chọn hai bài bổ trợ ↓';
  card.querySelector('.check-result').after(link);link.hidden=true;next.push([card,link]);
}
function sync(){
  const learning=!$('homework-content').hidden,submitted=!$('completion-card').hidden;
  document.body.classList.toggle('is-learning',learning);document.body.classList.toggle('is-submitted',submitted);
  const total=$('progress-bar').getAttribute('aria-valuemax');const message=`Xác nhận từng hội thoại. Khi cả ${total} hội thoại đạt, hệ thống tự nộp bài và hiển thị biên nhận.`;
  if(note.textContent!==message)note.textContent=message;
  if(note.hidden!==submitted)note.hidden=submitted;
  for(const [card,link] of next){const hidden=submitted||card.querySelector('.task-status').textContent!=='Đạt yêu cầu';if(link.hidden!==hidden)link.hidden=hidden;}
}
new MutationObserver(sync).observe($('homework-content'),{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-valuemax']});
sync();
const columns=dialog.querySelector('.guide-columns'),voice=dialog.querySelector('.guide-callout'),check=dialog.querySelector('.link-check-guide');
if(check&&voice)check.after(voice);
if(columns){const jumps=document.createElement('div');jumps.className='guide-platforms';
  for(const [i,title] of [...columns.querySelectorAll('h3')].entries()){
    title.id=i===0?'guide-iphone':'guide-android';title.tabIndex=-1;
    const button=document.createElement('button');button.type='button';button.className='button button-outline';button.textContent=i===0?'Tôi dùng iPhone':'Tôi dùng Android';
    button.addEventListener('click',()=>{title.focus({preventScroll:true});title.scrollIntoView({block:'start',behavior:'instant'});});jumps.append(button);
  }dialog.querySelector('.guide-heading').append(jumps);
}

import {applyQuestionLayout} from '../../shared/master170/question-layout-v1.1.mjs?v=20261029-approved-r3';
import * as reading from '../../reading-practice/authored-ui.js?v=20261029-approved-r3';
import * as listening from '../../listening-practice/authored-ui.js?v=20261029-approved-r3';
const cases=await fetch('./cases.json?v=20261030-rationale').then(r=>r.json()),c=cases.find(c=>c.id===new URLSearchParams(location.search).get('case'))||cases[0],stage=document.querySelector('#stage'),status=document.querySelector('#demo-status');
const a={answers:{}},flag=n=>`<button type="button" class="cbt-flag-button" data-flag="${n}" aria-label="Đánh dấu câu ${n}" aria-pressed="false"></button>`;
document.title=c.title+' · Master170 demo';
if(c.id==='remember')stage.innerHTML='<section class="card login-card" style="padding:24px;max-width:540px"><h2>Vào bài</h2><p>Ví dụ căn hàng checkbox và nhãn.</p><label class="check-line"><input type="checkbox" id="remember-demo" checked> Ghi nhớ tôi trên thiết bị này</label></section>';
else{
 const ui=c.family==='listening'?listening:reading;
 const html=c.family==='listening'?ui.groupsHtml(c.groups,a,flag,{documentNotes:!!c.documentNotes,practiceLayout:true}):ui.groupsHtml(c.groups,a,flag);
 const source=c.family==='reading'?'<h2>A community centre</h2><p>A · The new visitor centre is open from Tuesday to Sunday. It was built with local timber and has a roof that collects rainwater for the gardens.</p><p>B · Volunteers helped plan the facilities. Architects designed the main structure, while residents suggested ways to improve access and welcome visitors of all ages.</p><p>C · Dr Maya Ellis praised the use of local knowledge. Professor Arun Shah was concerned about maintenance costs. Dr Eva Chen supported the plans for the garden.</p><p>D · The writer welcomes the changes but notes that their long-term benefits will depend on how the centre is managed.</p>':'';
 stage.innerHTML=`<div id="readingView"><div class="cbt-content-viewport" style="font-size:16px"><div class="cbt-reading-section"${c.family==='listening'?' style="display:block"':''}><article id="passage-scroll" class="cbt-reading-passage"${c.family==='listening'?' style="display:none"':''}>${source}</article><article id="question-scroll" class="cbt-reading-questions">${html}</article></div></div></div>`;
 const matching=['reading-information','reading-headings','reading-features','reading-endings','listening-matching'].includes(c.id);
 stage.querySelectorAll('.design-question-group').forEach(g=>g.dataset.demoMatching=String(matching));
 if(['reading-multiple','listening-pair'].includes(c.id)){
  const sections=[...stage.querySelectorAll('.design-question-group')],first=sections[0],container=first.querySelector('.cbt-matching-questions')||first.querySelector('.design-question-content');
  for(const section of sections.slice(1)){container.append(...section.querySelectorAll('.authored-choice-group,.authored-pair'));section.remove();}
  first.querySelector('.cbt-subsection-heading h4').textContent='Questions 21–24 · Multiple choice';
 }
 if(c.documentNotes)listening.mountNoteDocument(document.querySelector('#readingView'),c.groups,'Inclusive design · dữ liệu minh họa');
 applyQuestionLayout(document.body);
 const update=(n,v)=>{a.answers[n]=v;status.textContent=`Câu ${n}: ${v||'chưa nhập'} · Chỉ giữ trong bản demo.`;};
 ui.bindMultiple(stage,update);
 stage.addEventListener('input',e=>{if(e.target.dataset.answer)update(e.target.dataset.answer,e.target.value);});
 stage.addEventListener('change',e=>{if(e.target.dataset.answer)update(e.target.dataset.answer,e.target.value);});
}
stage.addEventListener('click',e=>{const b=e.target.closest('[data-flag]');if(b){const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));b.classList.toggle('is-flagged',on);status.textContent=on?'Đã đánh dấu câu '+b.dataset.flag:'Đã bỏ đánh dấu câu '+b.dataset.flag;}});
await document.fonts.ready;document.body.dataset.demoReady=c.id;

import {OUTLINE_DIRECTIONS,bodyKey,outlineRelation} from './workflow.mjs?v=20261109-l3-v1';

export const relationMessages={
 waiting:'Sẽ đối chiếu khi cả hai thân bài đã đạt ở bản hiện tại.',
 passed:'Hai thân bài đã đạt và cách sắp xếp phù hợp với quan điểm của cả bài.',
 order:'Hai thân bài đạt riêng. Hướng bạn ủng hộ hơn đang ở Thân bài 1. Hãy chuyển hướng đó xuống Thân bài 2.',
 stance:'Hướng thể hiện qua hai thân bài khác với quan điểm bạn đã chọn ở đầu bài.'
};

const heading=(title,number,description)=>`<div class="group-header"><div><span class="group-number" aria-hidden="true">${number}</span><h2>${title}</h2><p>${description}</p></div></div>`;

export function outlineSections(state,{field,comments,statusLabels,canContinueWriting=false}){
 const stance=`<section class="section-group" id="position">${heading('Quan điểm của cả bài',1,'Chọn hướng bạn muốn bảo vệ trước khi Check từng thân bài.')}
 <div class="answer-card"><label for="field-stance">Bạn nghĩ sao về nhận định cấm hoàn toàn fast food là giải pháp duy nhất?</label>
 <select id="field-stance" data-field="stance"><option value="">Chọn quan điểm…</option>${Object.entries(OUTLINE_DIRECTIONS).map(([value,label])=>`<option value="${value}" ${state.responses.stance===value?'selected':''}>${label}</option>`).join('')}</select>
 <p class="instruction">Nếu hai thân bài trái hướng, hãy để hướng bạn ủng hộ hơn ở Thân bài 2.</p></div></section>`;
 const bodies=[1,2].map(n=>{
  const key=bodyKey(n,'topic'),step=state.steps[key],locked=['passed','pending'].includes(step.status);
  return `<section class="section-group step" id="body${n}" data-status="${step.status}" data-body-index="${n}">
   ${heading('Thân bài '+n,n+1,'Chốt thông điệp của đoạn và hai idea bạn sẽ dùng.')}
   <div class="step-grid"><article class="answer-card"><div class="step-heading"><div><p class="kicker">Chuẩn bị nội dung</p><h3>Chốt thông điệp và hai idea</h3></div><span class="badge ${step.status}">${statusLabels[step.status]}</span></div>
   <p class="instruction">Hai idea có thể cùng chiều hoặc trái chiều. Hãy cho thấy chúng cùng làm rõ một thông điệp.</p>
   ${field(bodyKey(n,'topicSentence'),false)}<div class="field-grid">${field(bodyKey(n,'idea1'),false)}${field(bodyKey(n,'idea2'),false)}</div>
   <p class="error" id="error-${key}" role="alert" hidden></p>
   <div class="section-actions"><span class="word-count">Check cả ba ô của thân bài này</span><button class="primary" data-check="${key}" ${locked?'disabled':''}>${locked?statusLabels[step.status]:'Check'}</button></div></article>${comments(key)}</div></section>`;
 }).join('');
 const relation=outlineRelation(state);
 const actions=relation==='order'?'<div class="section-actions"><button class="primary" data-outline-swap>Đổi chỗ hai thân bài</button><span>Chuyển cả thông điệp, hai idea và kết quả Check của mỗi đoạn.</span></div>'
  :relation==='stance'?'<div class="field-grid section-actions"><div><button class="secondary" data-outline-focus="stance">Đổi quan điểm của cả bài</button><p class="instruction">Nếu hai thân bài đã nói đúng điều bạn muốn nói.</p></div><div><button class="secondary" data-outline-focus="body2_topicSentence">Giữ quan điểm, sửa Thân bài 2</button><p class="instruction">Nếu bạn vẫn muốn giữ lựa chọn ở đầu bài. Sửa đoạn rồi Check lại.</p></div></div>'
  :canContinueWriting&&relation==='passed'?'<div class="section-actions"><button type="button" class="primary" data-continue-writing>Viết mở bài →</button></div>':'';
 return stance+bodies+`<section class="answer-card" id="relation"><p class="kicker">KẾT QUẢ CHUNG</p><h2 id="relation-title" tabindex="-1">Đối chiếu hai thân bài</h2><p role="status">${relationMessages[relation]}</p>${actions}</section>`;
}

export function outlineJourney(state){
 return [['prompt','Đề bài','?',false],['position','Quan điểm',1,!!state.responses.stance],
  ...[1,2].map(n=>['body'+n,'Thân bài '+n,n+1,state.steps[bodyKey(n,'topic')]?.status==='passed']),
  ['relation','Đối chiếu',4,outlineRelation(state)==='passed']]
  .map(([target,title,number,done])=>`<button class="nav-item ${done?'done':''}" data-target="${target}"><span>${done?'✓':number}</span><span>${title}</span></button>`).join('');
}

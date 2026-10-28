// Nhận cấu trúc câu đã được API cấp, dựng bằng các lớp giao diện Reading hiện có.
// Không giữ key; callback trả câu trả lời về bộ lưu/đồng hồ gốc của ứng dụng.

export function sourceLabel(lesson){
 return lesson.sourceLabel||[lesson.book?`Cambridge ${lesson.book}`:'',lesson.test?`Test ${lesson.test}`:'',lesson.part?`Part ${lesson.part}`:lesson.passage?`Passage ${lesson.passage}`:''].filter(Boolean).join(' · ')||'Bài luyện';
}
export function prepHtml(lesson,a,kind,btn,textBtn){
 const listening=kind==='listening',count=lesson.questionIds.length;
 const preparationGroups=lesson.preparationGroups?.length?lesson.preparationGroups:lesson.preparationSteps?.length?[{label:'Note Completion',preparationSteps:lesson.preparationSteps}]:lesson.groups;
 const clock=ms=>`${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.ceil(ms/1000)%60).padStart(2,'0')}`;
 const duration=listening?`Audio ${clock(lesson.audioMs)} + rà bài ${clock(lesson.reviewMs)}`:`${lesson.totalMs/60000} phút`;
 // Nhận các bước từ giáo trình của bài mới; giữ phương pháp mặc định cho bài cũ.
 const method=g=>g.preparationSteps?.length?`<ol>${g.preparationSteps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol>`:g.kind==='mcq'&&listening?'<ul><li>Đọc câu hỏi, xác định kịch bản audio</li><li>Đọc A-C: đọc hiểu + đào sâu ý nghĩa (dịch tiếng Việt / paraphrase tiếng Anh / tưởng tượng hình ảnh / so sánh các phương án với nhau...)</li><li>Nghe audio: để ý thái độ người nói, nhận định rõ ít nhất 2/3 option trong A B C</li></ul>':`<p>${esc(g.instruction||'Đọc chỉ dẫn của nhóm câu trước khi trả lời.')}</p>`;
 return `<div class="meta-row section"><span><strong>${esc(sourceLabel(lesson))}</strong></span><span>${count} câu · ${lesson.questionIds[0]}–${lesson.questionIds.at(-1)}</span><span>${esc(duration)}</span></div><section class="card"><div class="section-heading"><h2><span class="step-number">01</span>Nhắc nhanh phương pháp</h2></div><div class="method-grid">${preparationGroups.map(g=>`<section><h3>${esc(g.label)}</h3>${method(g)}</section>`).join('')}</div></section><div class="prep-bottom"><section><h3>Trước khi bắt đầu</h3><p class="muted">${listening?'Mỗi lượt nghe một lần ở tốc độ gốc. Audio có khoảng đọc đề thì dùng khoảng có sẵn.':'Đọc kỹ, chốt ý rồi đối chiếu đáp án. Thời gian được tính khi bạn đang làm bài.'}</p><p class="small muted">Đóng bài, chuyển tab hoặc mất mạng: bài tạm dừng. Khi tiếp tục, bạn dùng lại vị trí và thời gian còn lại. Reset tạo lượt mới, giữ lịch sử lượt cũ.</p></section><section class="start-panel"><span class="kicker">${a?.status==='submitted'?'BẠN ĐÃ CÓ KẾT QUẢ':'SẴN SÀNG LÀM BÀI'}</span><h3>${a?.status==='submitted'?`Lần ${a.no} · ${a.finalScore}/${count} câu đúng`:`${count} câu · ${esc(duration)}`}</h3>${a?.status==='submitted'?btn('Xem kết quả →','show-result')+textBtn('Reset và làm lại từ đầu','request-reset'):btn('Bắt đầu làm bài →','begin')}</section></div>`;
}

export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Metadata chỉ tổ chức đề; chuyển part không điều khiển audio hay tạo lượt mới.
export function partForQuestion(lesson,n){return lesson.parts?.find(p=>n>=p.start&&n<=p.end)||lesson.parts?.[0]||null;}
export function partNavHtml(lesson,n){
 const parts=lesson?.parts||[{id:'single',title:`Part ${lesson?.part||3}`,start:lesson?.questionIds[0]||21,end:lesson?.questionIds.at(-1)||30}];
 return parts.map(p=>`<button type="button" class="cbt-part-button ${n>=p.start&&n<=p.end?'is-active':''}" data-action="jump" data-question="${p.start}" data-listening-part="${esc(p.id)}" aria-pressed="${n>=p.start&&n<=p.end}">${esc(p.id==='single'?p.title:p.title.split(' · ')[0])} · Q${p.start}–${p.end}</button>`).join('');
}
function completionSlot(n,a,flag){return `<span class="cbt-inline-answer authored-table-slot" id="q-${n}" data-question-number="${n}"><span class="cbt-blank-number">${n}</span><span data-answer-slot><input class="cbt-answer-input" type="text" id="answer-${n}" data-answer="${n}" value="${esc(a.answers[n]||'')}" aria-label="Câu ${n}" maxlength="80" autocomplete="off"></span>${flag(n)}</span>`;}
function tableHtml(g,a,flag){
 const cell=value=>String(value).split(/(\{\d+\})/).map(piece=>/^\{\d+\}$/.test(piece)?completionSlot(+piece.slice(1,-1),a,flag):esc(piece)).join('');
 return `<div class="authored-table-wrap"><table class="authored-completion-table"><caption>${esc(g.table.caption||g.label)}</caption><thead><tr>${g.table.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${g.table.rows.map(row=>`<tr>${row.map((value,i)=>`<td data-label="${esc(g.table.headers[i])}">${cell(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function pairHtml(g,a,flag){
 const numbers=g.questions.map(q=>q.n),chosen=numbers.map(n=>a.answers[n]).filter(Boolean),options=g.options||g.questions[0].options;
 return `<article class="cbt-question-card authored-pair" id="q-${numbers[0]}" data-question-number="${numbers[0]}"><div class="cbt-question-heading"><span class="cbt-question-number">${numbers.join('–')}</span><p class="authored-stem">${esc(g.questions[0].text)}</p><span class="authored-pair-flags">${numbers.map(n=>`${n!==numbers[0]?`<span id="q-${n}" data-question-number="${n}"></span>`:''}${flag(n)}`).join('')}</span></div><div class="cbt-choice-list">${options.map(o=>`<label class="cbt-choice"><input type="checkbox" name="pair-${g.id}" data-authored-pair="${numbers.join(',')}" value="${esc(o.value)}" ${chosen.includes(o.value)?'checked':''}><span class="cbt-choice-letter">${esc(o.value)}</span><span>${esc(o.text)}</span></label>`).join('')}</div><p class="small muted" data-pair-status="${numbers.join(',')}" role="status">Đã chọn ${new Set(chosen).size}/${numbers.length}</p></article>`;
}
export function groupsHtml(groups,a,flag,{documentNotes=false,practiceLayout=false}={}){
 return groups.map(g=>{
  if(g.table||g.answerMode==='unordered-pair')return `<section class="design-question-group" data-group="${esc(g.id)}"><header class="cbt-subsection-heading"><h4>Questions ${g.start}–${g.end} · ${esc(g.label)}</h4><p>${esc(g.instruction)}</p></header><div class="design-question-content">${g.table?tableHtml(g,a,flag):pairHtml(g,a,flag)}</div></section>`;
  const bank=g.options;
  const questions=g.questions.map(q=>{
   const options=q.options||bank,selected=String(a.answers[q.n]||'').split('|');
   let control;
   if(g.kind==='mcq')control='<div class="cbt-choice-list">'+options.map(o=>`<label class="cbt-choice"><input type="${q.multiple?'checkbox':'radio'}" name="answer-${q.n}" value="${esc(o.value)}" ${q.multiple?'data-authored-multi="'+q.n+'"':'data-answer="'+q.n+'"'} ${selected.includes(o.value)?'checked':''}><span class="cbt-choice-letter">${esc(o.value)}</span><span>${esc(o.text)}</span></label>`).join('')+'</div>';
   else if(options)control=`<span class="cbt-select-answer" data-question-number="${q.n}"><span class="cbt-blank-number">${q.n}</span><span data-answer-slot><select class="cbt-answer-select" id="answer-${q.n}" data-answer="${q.n}" aria-label="Câu ${q.n}"><option value="">Nhấn để chọn</option>${options.map(o=>`<option value="${esc(o.value)}" title="${esc(o.text)}" ${a.answers[q.n]===o.value?'selected':''}>${esc(o.value)}${bank?'':' · '+esc(o.text)}</option>`).join('')}</select></span></span>`;
   else control=`<span class="cbt-inline-answer"><span class="cbt-blank-number">${q.n}</span><span data-answer-slot><input class="cbt-answer-input" type="text" id="answer-${q.n}" data-answer="${q.n}" value="${esc(a.answers[q.n]||'')}" aria-label="Câu ${q.n}" maxlength="80" autocomplete="off"></span></span>`;
   if(g.kind!=='mcq'&&options)return `<div class="authored-matching-row" id="q-${q.n}" data-question-number="${q.n}"><label for="answer-${q.n}">${esc(q.text)}</label><span class="authored-matching-answer">${control}${flag(q.n)}</span></div>`;
   // Câu điền ghi chú giữ chữ hai bên ô nhập để không mất nghĩa hoặc lộ ký hiệu bản soạn.
   if(!options&&q.text.includes('{blank}')){
    const [before,...after]=q.text.split('{blank}');
    return `<article class="cbt-question-card" id="q-${q.n}" data-question-number="${q.n}"><div class="cbt-question-heading" style="grid-template-columns:minmax(0,1fr) 30px"><p class="authored-stem" id="stem-${q.n}">${esc(before)}${control}${esc(after.join('{blank}'))}</p>${flag(q.n)}</div></article>`;
   }
   return `<article class="cbt-question-card" id="q-${q.n}" data-question-number="${q.n}"><div class="cbt-question-heading"><span class="cbt-question-number">${q.n}</span><p id="stem-${q.n}">${esc(q.text)}</p>${flag(q.n)}</div>${control}</article>`;
  }).join('');
  const questionClass=(documentNotes||practiceLayout)&&g.kind==='completion'&&!bank?'authored-note-list':practiceLayout&&g.kind==='mcq'?'authored-question-list':'cbt-matching-questions';
  const introduction=g.introduction?`<p class="authored-introduction" style="white-space:pre-line">${esc(g.introduction)}</p>`:'';
  return `<section class="design-question-group" data-group="${esc(g.id)}"><header class="cbt-subsection-heading"><h4>Questions ${g.questions[0].n}–${g.questions.at(-1).n} · ${esc(g.label||g.kind)}</h4><p>${esc(g.instruction)}</p></header>${practiceLayout?'':introduction}${g.image?`<img alt="${esc(g.imageAlt||g.label)}" src="${esc(g.image)}" style="max-width:100%;height:auto">`:''}<div class="design-question-content ${bank?'cbt-matching-layout cbt-answer-first-matching-layout':''}">${practiceLayout?introduction:''}<section class="${questionClass}">${questions}</section>${bank?`<aside class="cbt-option-bank"><h4>Options</h4>${bank.map(o=>`<div><strong>${esc(o.value)}</strong><span>${esc(o.text)}</span></div>`).join('')}</aside>`:''}</div></section>`;
 }).join('');
}
export function bindMultiple(root,onAnswer){
 root.querySelectorAll('[data-authored-pair]').forEach(el=>el.addEventListener('change',event=>{
  event.stopImmediatePropagation();const ids=el.dataset.authoredPair,numbers=ids.split(',').map(Number);
  let checked=[...root.querySelectorAll('[data-authored-pair="'+ids+'"]:checked')];
  const status=root.querySelector('[data-pair-status="'+ids+'"]');
  if(checked.length>numbers.length){el.checked=false;if(status)status.textContent=`Chỉ chọn tối đa ${numbers.length} đáp án. Bỏ một lựa chọn trước khi chọn đáp án khác.`;return;}
  const values=checked.map(x=>x.value).sort();numbers.forEach((n,i)=>onAnswer(n,values[i]||''));
  if(status)status.textContent=`Đã chọn ${values.length}/${numbers.length}`;
 }));
 root.querySelectorAll('[data-authored-multi]').forEach(el=>el.addEventListener('change',event=>{
  event.stopImmediatePropagation();const n=el.dataset.authoredMulti;
  const value=[...root.querySelectorAll('[data-authored-multi="'+n+'"]:checked')].map(x=>x.value).sort().join('|');
  onAnswer(n,value);
 }));
}
export function analysisHtml(e,paragraphs){
 return '<article class="explanation-question"><section class="explanation-analysis">'+paragraphs(e.reason)+(e.options||[]).map(o=>`<section class="explanation-option ${o.correct?'is-correct':''}" data-option="${esc(o.letter)}"><header><strong>${esc(o.letter)}</strong>${o.label?paragraphs([o.label]):''}<span class="option-verdict">${o.correct?'Đáp án đúng':'Loại'}</span></header>${paragraphs(o.reason||[])}<blockquote>${paragraphs(o.evidence||[])}</blockquote>${(o.evidenceGroups||[]).map(g=>`<section class="explanation-evidence-group"><strong>Đoạn ${esc(g.paragraph)}${g.speaker?' · '+esc(g.speaker):''}</strong>${paragraphs(g.paragraphs)}</section>`).join('')}</section>`).join('')+'</section></article>';
}
export function passageHtml(passage,evidence=[]){
 return Object.entries(passage).map(([id,text])=>{
  const marks=evidence.filter(g=>g.paragraph===id).flatMap(g=>g.marks),points=[...new Set([0,text.length,...marks.flatMap(m=>[m.start,m.end])])].sort((a,b)=>a-b);
  let body='';for(let i=0;i<points.length-1;i++){const start=points[i],end=points[i+1],m=marks.find(m=>m.start<=start&&m.end>=end);const color=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v:'';body+=m?`<mark style="background-color:${color(m.background)||'transparent'};color:${color(m.foreground)||'inherit'}">${esc(text.slice(start,end))}</mark>`:esc(text.slice(start,end));}
  return `<div id="explanation-paragraph-${id}" class="cbt-passage-paragraph paragraph ${marks.length?'explanation-active-paragraph':''}"><span class="cbt-paragraph-label">${esc(id)}</span><p>${body}</p></div>`;
 }).join('');
}
export function dialogHtml(lesson,data,a,n,paragraphs){
 const e=data.explanations.entries[n],ids=lesson.questionIds,index=ids.indexOf(String(n)),kind=lesson.groups.find(g=>n>=g.start&&n<=g.end)?.label||e.kind;
 const passage=data.definition.passage,row=a.result.rows.find(r=>r.number===n);
 return `<div class="explanation-dialog-shell"><header class="explanation-dialog-header"><div><span class="kicker">BUỔI ${lesson.lesson} · ĐÁP ÁN VÀ GIẢI THÍCH</span><h2 id="explanation-dialog-title">Câu ${n} · ${esc(kind)}</h2></div><button type="button" class="explanation-dialog-close" data-action="explanation-close" aria-label="Đóng giải thích">×</button></header><div class="explanation-dialog-columns"><section class="explanation-dialog-passage" aria-label="Toàn bài đọc"><div class="explanation-dialog-pane-head"><strong>Bài đọc · ${esc(lesson.title)}</strong></div><div class="explanation-dialog-passage-scroll">${passageHtml(passage,e.evidenceGroups)}</div></section><section class="explanation-dialog-detail" aria-label="Đáp án và giải thích"><div class="explanation-dialog-detail-scroll"><div class="explanation-dialog-answer"><span>Đáp án đúng <strong>${esc(e.answer.join(' / '))}</strong></span><span>Bài làm của bạn <strong>${esc(a.answers[n]||'—')}</strong></span><span class="result-${row.state}">${row.state==='correct'?'Đúng':row.state==='blank'?'Bỏ trống':'Sai'}</span></div><h3>Đối chiếu ý trong đề và bài đọc</h3><div class="explanation-dialog-compare"><section><h4>Nội dung đề bài</h4>${paragraphs([e.prompt])}</section><section><h4>Bằng chứng</h4>${e.evidenceGroups.map(g=>paragraphs(g.paragraphs)).join('')}</section></div><section class="explanation-dialog-analysis"><h3>Giải thích chi tiết</h3>${analysisHtml(e,paragraphs)}</section></div></section></div><footer class="explanation-dialog-footer"><span>Câu ${index+1}/${ids.length}</span><nav aria-label="Chuyển câu giải thích"><button type="button" class="button outline" data-action="explanation-prev" ${index===0?'disabled':''}>← Câu trước</button><button type="button" class="button outline" data-action="explanation-next" ${index===ids.length-1?'disabled':''}>Câu sau →</button></nav></footer></div>`;
}

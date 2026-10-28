// Nhận cấu trúc câu đã được API cấp, dựng bằng các lớp giao diện Reading hiện có.
// Không giữ key; callback trả câu trả lời về bộ lưu/đồng hồ gốc của ứng dụng.

export function sourceLabel(lesson){
 return lesson.sourceLabel||[lesson.book?`Cambridge ${lesson.book}`:'',lesson.test?`Test ${lesson.test}`:'',lesson.part?`Part ${lesson.part}`:lesson.passage?`Passage ${lesson.passage}`:''].filter(Boolean).join(' · ')||'Bài luyện';
}
// Nhận metadata và số câu, trả passage tương ứng; bài lẻ giữ đường cũ.
export const passageFor=(lesson,n)=>lesson.passages?.find(p=>Number(n)>=p.start&&Number(n)<=p.end);
export const paragraphLabel=(lesson,id)=>lesson.passages?.find(p=>p.paragraphs.includes(id))?.labels?.[id]||id;
export const passageSubset=(passage,p)=>p?Object.fromEntries(p.paragraphs.map(id=>[id,passage[id]])):passage;
export function prepHtml(lesson,a,kind,btn,textBtn){
 const listening=kind==='listening',count=lesson.questionIds.length;
 const clock=ms=>`${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.ceil(ms/1000)%60).padStart(2,'0')}`;
 const duration=listening?`Audio ${clock(lesson.audioMs)} + rà bài ${clock(lesson.reviewMs)}`:`${lesson.totalMs/60000} phút`;
 // Giữ ba bước Reading MCQ của Robots and us; chỉ dẫn đề không thay phương pháp làm bài.
 const readingMcq='<ul><li>Đọc câu hỏi, định vị; chưa nhìn A–D.</li><li>Tự nén ý cần tìm rồi mới đối chiếu lựa chọn.</li><li>Loại ý sai đối tượng, sai quan hệ hoặc thiếu căn cứ.</li></ul>';
 const method=g=>lesson.preparationMethods?.[g.id]?.length?`<ul>${lesson.preparationMethods[g.id].map(step=>`<li>${esc(step)}</li>`).join('')}</ul>`:g.kind==='mcq'?(listening?'<ul><li>Đọc câu hỏi, xác định kịch bản audio</li><li>Đọc A-C: đọc hiểu + đào sâu ý nghĩa (dịch tiếng Việt / paraphrase tiếng Anh / tưởng tượng hình ảnh / so sánh các phương án với nhau...)</li><li>Nghe audio: để ý thái độ người nói, nhận định rõ ít nhất 2/3 option trong A B C</li></ul>':readingMcq):`<p>${esc(g.instruction||'Đọc chỉ dẫn của nhóm câu trước khi trả lời.')}</p>`;
 return `<div class="meta-row section"><span><strong>${esc(sourceLabel(lesson))}</strong></span><span>${count} câu · ${lesson.questionIds[0]}–${lesson.questionIds.at(-1)}</span><span>${esc(duration)}</span></div><section class="card"><div class="section-heading"><h2><span class="step-number">01</span>Nhắc nhanh phương pháp</h2></div><div class="method-grid">${lesson.groups.map(g=>`<section><h3>${esc(g.label)}</h3>${method(g)}</section>`).join('')}</div></section><div class="prep-bottom"><section><h3>Trước khi bắt đầu</h3><p class="muted">${listening?'Mỗi lượt nghe một lần ở tốc độ gốc. Audio có khoảng đọc đề thì dùng khoảng có sẵn.':'Đọc kỹ, chốt ý rồi đối chiếu đáp án. Thời gian được tính khi bạn đang làm bài.'}</p><p class="small muted">Đóng bài, chuyển tab hoặc mất mạng: bài tạm dừng. Khi tiếp tục, bạn dùng lại vị trí và thời gian còn lại. Reset tạo lượt mới, giữ lịch sử lượt cũ.</p></section><section class="start-panel"><span class="kicker">${a?.status==='submitted'?'BẠN ĐÃ CÓ KẾT QUẢ':'SẴN SÀNG LÀM BÀI'}</span><h3>${a?.status==='submitted'?`Lần ${a.no} · ${a.finalScore}/${count} câu đúng`:`${count} câu · ${esc(duration)}`}</h3>${a?.status==='submitted'?btn('Xem kết quả →','show-result')+textBtn('Reset và làm lại từ đầu','request-reset'):btn('Bắt đầu làm bài →','begin')}</section></div>`;
}

export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const judgmentOptions=options=>{
 const values=(options||[]).map(o=>String(o.value).toUpperCase().replace(/\s+/g,''));
 return values.length===3&&values.includes('NOTGIVEN')&&(['TRUE','FALSE'].every(v=>values.includes(v))||['YES','NO'].every(v=>values.includes(v)));
};
export function groupsHtml(groups,a,flag){
 return groups.map(g=>{
  const bank=g.options;
  const judgment=judgmentOptions(bank||g.questions[0]?.options)&&g.questions.every(q=>!q.multiple&&judgmentOptions(q.options||bank));
  const answerControl=q=>{
   const options=q.options||bank,selected=String(a.answers[q.n]||'').split('|');
   let control;
   if(g.kind==='mcq'||judgment)control='<div class="cbt-choice-list'+(judgment?' authored-judgment-choices':'')+'">'+options.map(o=>`<label class="cbt-choice${judgment?' cbt-choice-single-label':''}"><input type="${q.multiple?'checkbox':'radio'}" name="answer-${q.n}" value="${esc(o.value)}" ${q.multiple?'data-authored-multi="'+q.n+'"':'data-answer="'+q.n+'"'} ${selected.includes(o.value)?'checked':''}>${judgment?'':`<span class="cbt-choice-letter">${esc(o.value)}</span>`}<span>${esc(o.text)}</span></label>`).join('')+'</div>';
   else if(options)control=`<span class="cbt-select-answer" data-question-number="${q.n}"><span class="cbt-blank-number">${q.n}</span><span data-answer-slot><select class="cbt-answer-select" id="answer-${q.n}" data-answer="${q.n}" aria-label="Câu ${q.n}"><option value="">Nhấn để chọn</option>${options.map(o=>`<option value="${esc(o.value)}" ${a.answers[q.n]===o.value?'selected':''}>${esc(o.value)} · ${esc(o.text)}</option>`).join('')}</select></span></span>`;
   else control=`<span class="cbt-inline-answer"><span class="cbt-blank-number">${q.n}</span><span data-answer-slot><input class="cbt-answer-input" type="text" id="answer-${q.n}" data-answer="${q.n}" value="${esc(a.answers[q.n]||'')}" aria-label="Câu ${q.n}" maxlength="80" autocomplete="off"></span></span>`;
   return control;
  };
  // Nhận toàn bộ đoạn tóm tắt có chỗ trống; giữ cả câu ngữ cảnh không mang số câu.
  // Mỗi ô vẫn gửi/lưu bằng số gốc và dùng cờ/đường nhảy của engine Reading.
  let questions=Array.isArray(g.summaryParagraphs)?`<article class="cbt-question-card authored-summary">${g.summaryTitle?`<h4>${esc(g.summaryTitle)}</h4>`:''}${g.summaryParagraphs.map(text=>`<p>${String(text).split(/(\{\{\d+\}\})/).map(part=>{
   const match=/^\{\{(\d+)\}\}$/.exec(part);
   if(!match)return esc(part);
   const q=g.questions.find(item=>item.n===Number(match[1]));
   if(!q)throw new Error('Chỗ trống không thuộc nhóm câu hỏi.');
   return `<span id="q-${q.n}" data-question-number="${q.n}">${answerControl(q)}${flag(q.n)}</span>`;
  }).join('')}</p>`).join('')}</article>`:g.questions.map(q=>`<article class="cbt-question-card" id="q-${q.n}" data-question-number="${q.n}"><div class="cbt-question-heading"><span class="cbt-question-number">${q.n}</span><p id="stem-${q.n}">${esc(q.text)}</p>${flag(q.n)}</div>${answerControl(q)}</article>`).join('');
  // Các ô bảng vẫn dùng số câu, cờ và handler lưu của engine gốc.
  if(g.table){
   const cell=value=>String(value).split(/(\{\{\d+\}\})/).map(part=>{
    const m=/^\{\{(\d+)\}\}$/.exec(part);if(!m)return esc(part).replace(/\n/g,'<br>');
    const q=g.questions.find(q=>q.n===Number(m[1]));if(!q)throw new Error('Ô bảng không thuộc nhóm câu hỏi.');
    return `<span id="q-${q.n}" data-question-number="${q.n}">${answerControl(q)}${flag(q.n)}</span>`;
   }).join('');
   questions=`<div class="authored-table-scroll" tabindex="0" aria-label="Bảng câu hỏi có thể cuộn ngang"><table class="authored-table">${g.table.caption?`<caption>${esc(g.table.caption)}</caption>`:''}<thead><tr>${g.table.headers.map(v=>`<th scope="col">${esc(v)}</th>`).join('')}</tr></thead><tbody>${g.table.rows.map(row=>`<tr>${row.map(v=>`<td>${cell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  if(g.chooseCount){
   const selected=new Set(g.questions.map(q=>String(a.answers[q.n]||'')));
   questions=`<article class="cbt-question-card authored-choice-group" data-choice-group="${esc(g.id)}" data-choice-count="${g.chooseCount}" data-choice-numbers="${g.questions.map(q=>q.n).join(',')}"><p>${esc(g.stem||g.questions[0].text)}</p><div class="authored-choice-slots">${g.questions.map(q=>`<span id="q-${q.n}" data-question-number="${q.n}"><strong>Câu ${q.n}</strong> <span data-choice-slot="${q.n}">${esc(a.answers[q.n]||'Chưa chọn')}</span>${flag(q.n)}</span>`).join('')}</div><p class="small muted" role="status" data-choice-status>Chọn ${g.chooseCount} đáp án.</p><div class="cbt-choice-list">${bank.map(o=>`<label class="cbt-choice"><input type="checkbox" data-authored-choice="${esc(g.id)}" value="${esc(o.value)}" ${selected.has(o.value)?'checked':''}><span class="cbt-choice-letter">${esc(o.value)}</span><span>${esc(o.text)}</span></label>`).join('')}</div></article>`;
  }
  const sideBank=bank&&!g.chooseCount&&!judgment,range=g.questions.length===1?`Question ${g.questions[0].n}`:`Questions ${g.questions[0].n}–${g.questions.at(-1).n}`;
  const originalLabel=g.label||g.kind,label=originalLabel.replace(/\s*[—–-]\s*subtitle$/i,'');
  // Hidden legacy text preserves existing annotation offsets; no saved data changes.
  const labelHtml=esc(label)+(label!==originalLabel?`<span class="authored-annotation-context" hidden aria-hidden="true">${esc(originalLabel.slice(label.length))}</span>`:'');
  const bankHtml=bank&&!g.chooseCount?`<aside class="cbt-option-bank${judgment?' authored-annotation-context':''}"${judgment?' hidden aria-hidden="true"':''}><h4>Options</h4>${bank.map(o=>`<div><strong>${esc(o.value)}</strong><span>${esc(o.text)}</span></div>`).join('')}</aside>`:'';
  return `<section class="design-question-group" data-group="${esc(g.id)}"><header class="cbt-subsection-heading"><h4>${range} · ${labelHtml}</h4><p>${esc(g.instruction)}</p></header>${g.image?`<img alt="${esc(g.imageAlt||g.label)}" src="${esc(g.image)}" style="max-width:100%;height:auto">`:''}<div class="design-question-content ${sideBank?'cbt-matching-layout cbt-answer-first-matching-layout':''}"><section class="${judgment?'authored-judgment-list':'cbt-matching-questions'}">${questions}</section>${bankHtml}</div></section>`;
 }).join('');
}
export function bindMultiple(root,onAnswer){
 // Một checklist ghi đủ các ô điểm, giới hạn lựa chọn trước khi gọi bộ lưu.
 root.querySelectorAll('[data-authored-choice]').forEach(el=>el.addEventListener('change',event=>{
  event.stopImmediatePropagation();const group=el.closest('[data-choice-group]'),limit=Number(group.dataset.choiceCount);
  let values=[...group.querySelectorAll('[data-authored-choice]:checked')].map(x=>x.value);
  if(values.length>limit){el.checked=false;group.querySelector('[data-choice-status]').textContent=`Chỉ chọn tối đa ${limit} đáp án.`;return;}
  group.querySelector('[data-choice-status]').textContent=`Đã chọn ${values.length}/${limit} đáp án.`;
  group.dataset.choiceNumbers.split(',').map(Number).forEach((n,i)=>{const value=values[i]||'';group.querySelector(`[data-choice-slot="${n}"]`).textContent=value||'Chưa chọn';onAnswer(n,value);});
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
export function passageHtml(passage,evidence=[],labels={}){
 return Object.entries(passage).map(([id,text])=>{
  const marks=evidence.filter(g=>g.paragraph===id).flatMap(g=>g.marks),points=[...new Set([0,text.length,...marks.flatMap(m=>[m.start,m.end])])].sort((a,b)=>a-b);
  let body='';for(let i=0;i<points.length-1;i++){const start=points[i],end=points[i+1],m=marks.find(m=>m.start<=start&&m.end>=end);const color=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v:'';body+=m?`<mark style="background-color:${color(m.background)||'transparent'};color:${color(m.foreground)||'inherit'}">${esc(text.slice(start,end))}</mark>`:esc(text.slice(start,end));}
  return `<div id="explanation-paragraph-${id}" class="cbt-passage-paragraph paragraph ${marks.length?'explanation-active-paragraph':''}"><span class="cbt-paragraph-label">${esc(labels[id]||id)}</span><p>${body}</p></div>`;
 }).join('');
}
export function dialogHtml(lesson,data,a,n,paragraphs){
 const e=data.explanations.entries[n],ids=lesson.questionIds,index=ids.indexOf(String(n)),kind=String(lesson.groups.find(g=>n>=g.start&&n<=g.end)?.label||e.kind||'').replace(/\s*[—–-]\s*subtitle$/i,'');
 const selected=passageFor(lesson,n),passage=passageSubset(data.definition.passage,selected),row=a.result.rows.find(r=>r.number===n);
 // Kế thừa lối chuyển đoạn của Robots and us, kể cả khi một câu dùng nhiều vị trí.
 const groups=e.evidenceGroups,locations=[...new Map(groups.map(g=>[g.paragraph,g])).values()];
 const location=g=>`<button type="button" class="button outline" data-evidence-paragraph="${esc(g.paragraph)}">Đoạn ${esc(paragraphLabel(lesson,g.paragraph))}${g.speaker?' · '+esc(g.speaker):''}</button>`;
 const anchors=`<nav class="explanation-anchor-nav" aria-label="Vị trí dẫn chứng">${locations.map(location).join('')}</nav>`;
 return `<div class="explanation-dialog-shell">
 <header class="explanation-dialog-header"><div><span class="kicker">BUỔI ${lesson.lesson} · ĐÁP ÁN VÀ GIẢI THÍCH</span><h2 id="explanation-dialog-title">Câu ${n} · ${esc(kind)}</h2></div><button type="button" class="explanation-dialog-close" data-action="explanation-close" aria-label="Đóng giải thích">×</button></header>
 <div class="explanation-dialog-columns">
 <section class="explanation-dialog-passage" aria-label="Toàn bài đọc"><div class="explanation-dialog-pane-head"><strong>${esc(selected?selected.label+' · '+selected.title:'Bài đọc · '+lesson.title)}</strong></div>${anchors}<div class="explanation-dialog-passage-scroll">${passageHtml(passage,groups,selected?.labels)}</div></section>
 <section class="explanation-dialog-detail" aria-label="Đáp án và giải thích"><div class="explanation-dialog-detail-scroll">
 <div class="explanation-dialog-answer"><span>Đáp án đúng <strong>${esc(e.answer.join(' / '))}</strong></span><span>Bài làm của bạn <strong>${esc(a.answers[n]||'—')}</strong></span><span class="result-${row.state}">${row.state==='correct'?'Đúng':row.state==='blank'?'Bỏ trống':'Sai'}</span></div>
 <h3>Đối chiếu ý trong đề và bài đọc</h3><div class="explanation-dialog-compare"><section><h4>Nội dung đề bài</h4>${paragraphs([e.prompt])}</section><section><h4>Bằng chứng</h4>${groups.map(g=>`<section class="explanation-evidence-group">${location(g)}${paragraphs(g.paragraphs)}</section>`).join('')}</section></div>
 <section class="explanation-dialog-analysis"><h3>Giải thích chi tiết</h3>${analysisHtml(e,paragraphs)}</section></div></section></div>
 <footer class="explanation-dialog-footer"><span>Câu ${index+1}/${ids.length}</span><nav aria-label="Chuyển câu giải thích"><button type="button" class="button outline" data-action="explanation-prev" ${index===0?'disabled':''}>← Câu trước</button><button type="button" class="button outline" data-action="explanation-next" ${index===ids.length-1?'disabled':''}>Câu sau →</button></nav></footer></div>`;
}

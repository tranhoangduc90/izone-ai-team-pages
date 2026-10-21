// Nhận đề đã bỏ audio/đáp án chấm; giữ nhãn lựa chọn và vị trí câu trống để GV đối chiếu.
// Chỉ tạo HTML từ văn bản đã escape, không tạo ảnh, link hoặc trình phát từ dữ liệu đề.
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const values=value=>Array.isArray(value)?value:value&&typeof value==='object'?Object.values(value):[];
const entries=value=>Array.isArray(value)?value.map((row,i)=>Array.isArray(row)?row:[i+1,row?.text??row]):Object.entries(value||{});
const section=(title,body)=>body?`<details open><summary>${title}</summary>${body}</details>`:'';
const choices=list=>entries(list).map(([key,value])=>`<p class="teacher-choice"><b>${escape(key)}.</b> ${escape(value)}</p>`).join('');
const question=row=>`<div class="teacher-question"><strong>Câu ${escape(row.n)}</strong><p>${escape(row.text)}</p>${Array.isArray(row.options)?'<div class="teacher-options">'+row.options.map((option,i)=>`<p><b>${escape(String.fromCharCode(65+i))}.</b> ${escape(option)}</p>`).join('')+'</div>':''}</div>`;

export function renderPracticeDefinitionHtml(definition={},questionIds=[],code=''){
 if(definition.authored){
  // Bài do skill soạn vẫn chỉ xem: hiện đủ câu và lựa chọn, không tạo input/audio.
  const passage=Object.entries(definition.passage||{}).map(([id,text])=>`<p><strong>Đoạn ${escape(id)}</strong><br>${escape(text)}</p>`).join('');
  return passage+(definition.groups||[]).map(g=>section(escape(g.label||g.kind),`<p>${escape(g.instruction)}</p>`+(g.introduction?`<p style="white-space:pre-line">${escape(g.introduction)}</p>`:'')+(g.questions||[]).map(q=>{
   const bank=q.options||g.options;
   return `<div class="teacher-question"><strong>Câu ${escape(q.n)}</strong><p>${escape(q.text.replaceAll('{blank}','_____'))}</p>${bank?'<div class="teacher-options">'+bank.map(o=>`<p><b>${escape(o.value)}.</b> ${escape(o.text)}</p>`).join('')+'</div>':'<span class="teacher-question-gap">_____</span>'}</div>`;
  }).join(''))).join('');
 }
 const numbered=new Set([...values(definition.mcq),...values(definition.names),...values(definition.endings)]
  .map(row=>String(row.n)));
 for(const part of values(definition.summary))if(part.question!==undefined)numbered.add(String(part.question));
 for(const row of values(definition.flow))numbered.add(String(Array.isArray(row)?row[0]:row.n));
 const headingNumbers=questionIds.map(String).filter(n=>!numbered.has(n)).sort((a,b)=>Number(a)-Number(b));
 const paragraphEntries=Object.entries(definition.passage||{});
 const headingMatch=Object.keys(definition.headings||{}).length>0&&headingNumbers.length===paragraphEntries.length;
 let html=definition.title?`<h3>${escape(definition.title)}</h3>`:'';
 html+=paragraphEntries.map(([name,content],i)=>`<p><strong>Đoạn ${escape(name)}${headingMatch?' · Câu '+escape(headingNumbers[i]):''}</strong><br>${escape(content)}</p>`).join('');
 html+=section('Danh sách headings',choices(definition.headings));
 html+=section('Người được nhắc đến',choices(definition.experts));
 html+=section('Ghép tên và phát biểu',values(definition.names).map(question).join(''));
 html+=section('Ghép vế kết thúc câu',values(definition.endings).map(question).join('')+choices(definition.endingOptions));
 html+=section('Các lựa chọn',choices(definition.bank));
 html+=section('Câu hỏi lựa chọn',values(definition.mcq).map(question).join(''));
 const summary=values(definition.summary).map(part=>part.question!==undefined
  ?`<span class="teacher-question-gap">(Câu ${escape(part.question)}) _____</span>`:escape(part.text)).join('');
 html+=section('Điền phần tóm tắt',summary?(code==='67-practice-reading_matching_heading_mcq'
  ?'<p>Chọn ONE WORD AND/OR A NUMBER từ bài đọc cho mỗi câu trả lời.</p>':'')+`<p>${summary}</p>`:'');
 html+=section('Các bước trong sơ đồ',values(definition.flow).map(row=>Array.isArray(row)
  ?`<p class="teacher-flow">${escape(row[1])} <span class="teacher-question-gap">(Câu ${escape(row[0])}) _____</span>${escape(row[2])}</p>`
  :question(row)).join(''));
 return html||'<p class="muted">Chưa có nội dung đề để đối chiếu.</p>';
}

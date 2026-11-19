const headings={A:'Điểm đầu',X:'Cầu nối',B:'Điểm cuối'};
const points=Object.keys(headings);
const hasRows=table=>Array.isArray(table.rows)&&table.rows.length>0;

function ideaNames(table,esc) {
  const ideas=Array.isArray(table.outlineIdeas)?table.outlineIdeas:[];
  return ideas.map((idea,i)=>'<dt>Idea '+(i+1)+'</dt><dd>'+esc(idea)+'</dd>').join('');
}

function chainHeading(point) {
  return '<span class="handout-key">'+point+'</span>'+headings[point];
}

function cellHtml(cell,point,lesson5,esc) {
  const keywords=Array.isArray(cell.keywords)?cell.keywords:[];
  const fallback=cell.keywordStatus==='failed'?'Nguồn chưa lấy được từ vựng.':'Chưa có từ vựng cho ô này.';
  const words=keywords.map(word=>`<div class="handout-keyword"><strong lang="en">${esc(word.en)}</strong><small>${esc(word.vi)}</small></div>`).join('');
  return `<td role="cell">${lesson5?`<div class="handout-point-heading" aria-hidden="true">${chainHeading(point)}</div>`:'<p class="handout-cell-label">Nội dung handout</p>'}
    <p class="handout-cell-content">${esc(cell.content||'Chưa có nội dung đã lưu.')}</p>
    <p class="handout-cell-label keyword-label">${lesson5?'Từ vựng gợi ý':'Keyword gợi ý'}</p>
    <div class="handout-keywords">${words||`<p class="handout-placeholder">${fallback}</p>`}</div></td>`;
}

function fullTableHtml(table,index,lesson5,esc) {
  const title=table.title||`Bảng ${index+1}`;
  const rows=hasRows(table)?table.rows:[];
  const rowId=row=>'handout-'+row.id;
  const topic=table.topicSentence?`<div class="handout-entry"><h4>${lesson5?'Topic Sentence đã chốt':'Topic Sentence'}</h4><p class="handout-cell-content" lang="en">${esc(table.topicSentence)}</p></div>`:'';
  const nav=lesson5?`<nav class="handout-outline-nav" aria-label="Di chuyển trong dàn ý">${rows.map(row=>`<a href="#${esc(rowId(row))}">${esc(row.label)}</a>`).join('')}<a href="#essay" data-handout-go-to-essay>Đến ô viết ↓</a></nav>`:'';
  const missing=lesson5&&rows.length<2?`<p class="handout-placeholder">Bản này chưa có đủ nội dung A, X, B đã lưu.</p>`:'';
  const tableRows=rows.map(row=>{
    const number=/^idea-([12])$/.exec(row.id)?.[1];
    const idea=lesson5&&number?table.outlineIdeas?.[Number(number)-1]:'';
    return `<tr role="row" data-handout-idea="${esc(row.id)}"${lesson5?` id="${esc(rowId(row))}" tabindex="-1"`:''}>
      <th scope="row" role="rowheader">${esc(row.label)}${idea?`<small class="handout-idea-name">${esc(idea)}</small>`:''}</th>
      ${points.map(point=>cellHtml(row[point]||{},point,lesson5,esc)).join('')}</tr>`;
  }).join('');
  return `<section class="handout-summary-block${lesson5?' lesson5-outline-table':''}" data-handout-table="${esc(table.id)}"><h3>${esc(title)}</h3>${topic}${nav}${missing}
    ${rows.length?`${lesson5?'':'<p class="handout-table-hint">Cuộn ngang bảng để xem đủ các cột A – X – B.</p>'}
    <div class="handout-table-scroll" role="region" tabindex="0" aria-label="${esc(title)} · bảng ý và từ vựng">
      <table class="handout-summary-table" role="table"><caption>${esc(table.caption||'A → X → B')}</caption><colgroup><col class="handout-idea-col"><col><col><col></colgroup>
      <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Ý</th>${points.map(point=>`<th scope="col" role="columnheader">${chainHeading(point)}${point!=='B'?'<span class="handout-connector" aria-hidden="true">→</span>':''}</th>`).join('')}</tr></thead>
      <tbody role="rowgroup">${tableRows}</tbody></table></div>`:
    (lesson5&&Array.isArray(table.outlineIdeas)?`<dl>${ideaNames(table,esc)}</dl>`:'')}
    ${lesson5&&rows.length?`<a class="handout-outline-end" href="#essay" data-handout-go-to-essay>Đến ô viết ↓</a>`:''}</section>`;
}

export function handoutTablesHtml(tables,esc,{lesson5=false}={}) {
  if(!tables.length)return '<p class="empty-inline">Chưa có bảng tổng hợp để xem.</p>';
  const position=!lesson5&&tables[0].outlinePosition;
  const heading=position?'<div class="outline-position"><h3>Quan điểm của cả bài</h3><p>'+esc(position)+'</p></div>':'';
  return heading+tables.map((table,index)=>{
    if(!lesson5&&!hasRows(table)&&Array.isArray(table.outlineIdeas)){
      return '<section class="handout-summary-block lesson3-outline-body"><h3>'+esc(table.title)+'</h3><dl><dt>Thông điệp chung của các idea trong đoạn văn này là gì?</dt><dd>'+esc(table.topicSentence)+'</dd>'+ideaNames(table,esc)+'</dl></section>';
    }
    return fullTableHtml(table,index,lesson5,esc);
  }).join('');
}

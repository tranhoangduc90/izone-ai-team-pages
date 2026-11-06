export function handoutTablesHtml(tables, esc) {
  if (!tables.length) return '<p class="empty-inline">Chưa có bảng tổng hợp để xem.</p>';
  const headings={A:'Điểm đầu',X:'Cầu nối',B:'Điểm cuối'};
  return tables.map((table,index)=>`<section class="handout-summary-block" data-handout-table="${esc(table.id)}"><h3>${esc(table.title || `Bảng ${index+1}`)}</h3>${table.topicSentence ? `<div class="handout-entry"><h4>Topic Sentence</h4><p class="handout-cell-content" lang="en">${esc(table.topicSentence)}</p></div>` : ''}
    <p class="handout-table-hint">Cuộn ngang bảng để xem đủ các cột A – X – B.</p>
    <div class="handout-table-scroll" role="region" tabindex="0" aria-label="${esc(table.title || `Bảng ${index+1}`)} · bảng ý và từ vựng">
      <table class="handout-summary-table"><caption>${esc(table.caption || 'A → X → B')}</caption><colgroup><col class="handout-idea-col"><col><col><col></colgroup><thead><tr><th scope="col">Ý</th>${Object.entries(headings).map(([key,label])=>`<th scope="col"><span class="handout-key">${key}</span>${label}${key !== 'B' ? '<span class="handout-connector" aria-hidden="true">→</span>' : ''}</th>`).join('')}</tr></thead>
      <tbody>${table.rows.map(row=>`<tr data-handout-idea="${esc(row.id)}"><th scope="row">${esc(row.label)}</th>${['A','X','B'].map(key=>{const cell=row[key] || {};return `<td><p class="handout-cell-label">Nội dung handout</p><p class="handout-cell-content">${esc(cell.content || 'Chưa có nội dung.')}</p><p class="handout-cell-label keyword-label">Keyword gợi ý</p><div class="handout-keywords">${(cell.keywords || []).map(word=>`<div class="handout-keyword"><strong lang="en">${esc(word.en)}</strong><small>${esc(word.vi)}</small></div>`).join('') || `<p class="handout-placeholder">${cell.keywordStatus === 'failed' ? 'Nguồn chưa lấy được từ vựng.' : 'Chưa có từ vựng cho ô này.'}</p>`}</div></td>`;}).join('')}</tr>`).join('')}</tbody></table>
    </div></section>`).join('');
}

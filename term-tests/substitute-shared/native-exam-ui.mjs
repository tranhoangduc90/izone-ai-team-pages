// Giao diện gốc: tách nguyên hàm/template, không chứa API, đáp án hoặc bộ điều khiển thi.
export function createNativeResultViews({state,elements,testConfig,listeningInterruption=false,saveSession=()=>{},formatBand,sectionScore}){
function splitSkillPerformance(stats) {
    const sorted = [...(stats || [])].sort((left, right) =>
      right.percentage - left.percentage || left.type.localeCompare(right.type, 'vi')
    );
    if (!sorted.length) return { best: [], needsImprovement: [] };
    const highest = sorted[0].percentage;
    const lowest = sorted.at(-1).percentage;
    return {
      best: sorted.filter(item => item.percentage === highest),
      needsImprovement: lowest === highest ? [] : sorted.filter(item => item.percentage === lowest)
    };
  }
function renderAnalysisList(container, items, emptyText) {
    const rows = items?.length ? items : [{ type: emptyText, correct: 0, total: 0, percentage: 0 }];
    container.replaceChildren(...rows.map(item => {
      const node = document.createElement('li');
      node.textContent = item.total
        ? `${item.type}: ${item.correct}/${item.total} (${Math.round(item.percentage * 100)}%)`
        : item.type;
      return node;
    }));
  }
function renderSkillPerformance(label, section) {
    const wrapper = document.createElement('section');
    wrapper.className = 'skill-performance-section';
    wrapper.dataset.skillPerformance = label.toLowerCase();

    const heading = document.createElement('header');
    heading.className = 'skill-performance-heading';
    const headingCopy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.textContent = 'Phân tích riêng';
    const title = document.createElement('h3');
    title.textContent = label;
    headingCopy.append(eyebrow, title);
    const score = document.createElement('strong');
    score.textContent = `${section.correct}/${section.total} câu đúng`;
    heading.append(headingCopy, score);

    const analysis = splitSkillPerformance(section.typeStats);
    const cards = document.createElement('div');
    cards.className = 'analysis-grid';
    const bestCard = document.createElement('article');
    bestCard.className = 'analysis-card best';
    const bestTitle = document.createElement('h4');
    bestTitle.textContent = 'Dạng làm tốt nhất';
    const bestList = document.createElement('ul');
    bestList.className = 'analysis-list';
    bestCard.append(bestTitle, bestList);
    renderAnalysisList(bestList, analysis.best, 'Chưa có dữ liệu dạng bài.');

    const improveCard = document.createElement('article');
    improveCard.className = 'analysis-card improve';
    const improveTitle = document.createElement('h4');
    improveTitle.textContent = 'Dạng cần cải thiện';
    const improveList = document.createElement('ul');
    improveList.className = 'analysis-list';
    improveCard.append(improveTitle, improveList);
    renderAnalysisList(improveList, analysis.needsImprovement, 'Các dạng đang có kết quả ngang nhau.');
    cards.append(bestCard, improveCard);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'detail-table-wrap';
    const table = document.createElement('table');
    table.className = 'performance-table';
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const value of ['Dạng bài', 'Đúng', 'Tổng', 'Tỷ lệ']) {
      const cell = document.createElement('th');
      cell.textContent = value;
      headerRow.append(cell);
    }
    head.append(headerRow);
    const body = document.createElement('tbody');
    for (const item of section.typeStats || []) {
      const row = document.createElement('tr');
      for (const value of [item.type, item.correct, item.total, `${Math.round(item.percentage * 100)}%`]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      body.append(row);
    }
    table.append(head, body);
    tableWrap.append(table);
    wrapper.append(heading, cards, tableWrap);
    return wrapper;
  }
function renderDetailBlock(title, details) {
    const block = document.createElement('details');
    block.className = 'detail-block';
    const skill = title.toLowerCase();
    block.dataset.resultSkill = skill;
    block.open = state.resultDetailsOpen?.[skill] === true;
    block.addEventListener('toggle', () => {
      // Bỏ event trễ của bảng đã bị thay thế hoặc thuộc lượt trước.
      if (!Array.from(elements.questionDetails.children).includes(block)) return;
      state.resultDetailsOpen = { ...state.resultDetailsOpen, [skill]: block.open };
      saveSession();
    });
    const summary = document.createElement('summary');
    const detailRows = details || [];
    summary.textContent = detailRows.length
      ? `${title} · xem chi tiết ${detailRows.length} câu`
      : `${title} · chưa có dữ liệu từng câu`;
    const wrap = document.createElement('div');
    wrap.className = 'detail-table-wrap';
    const table = document.createElement('table');
    table.className = 'detail-table';
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const label of ['Câu', 'Bài làm', 'Đáp án đúng', 'Kết quả']) {
      const cell = document.createElement('th');
      cell.textContent = label;
      headerRow.append(cell);
    }
    head.append(headerRow);
    const body = document.createElement('tbody');
    for (const detail of detailRows) {
      const row = document.createElement('tr');
      const resultMeta = {
        correct: { icon: '✓', label: 'Đúng' },
        incorrect: { icon: '✕', label: 'Sai' },
        blank: { icon: '–', label: 'Bỏ trống' }
      }[detail.result] || { icon: '?', label: detail.result || 'Chưa xác định' };
      row.className = `detail-row detail-row-${detail.result || 'unknown'}`;
      const labels = [
        `${String(detail.number).padStart(2, '0')}.`,
        detail.studentAnswer || '—',
        detail.correctAnswer || '—'
      ];
      labels.forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });
      const resultCell = document.createElement('td');
      resultCell.className = `detail-result-cell result-${detail.result}`;
      const resultIcon = document.createElement('span');
      resultIcon.className = 'detail-result-icon';
      resultIcon.setAttribute('aria-hidden', 'true');
      resultIcon.textContent = resultMeta.icon;
      const resultLabel = document.createElement('span');
      resultLabel.textContent = resultMeta.label;
      resultCell.append(resultIcon, resultLabel);
      row.append(resultCell);
      body.append(row);
    }
    table.append(head, body);
    wrap.append(table);
    block.append(summary, wrap);
    return block;
  }
function renderScoreSummary(payload) {
    const table=document.createElement('table');table.className='substitute-score-table';
    const caption=document.createElement('caption');caption.textContent='Tổng hợp điểm thực tế';table.append(caption);
    const head=document.createElement('thead'),header=document.createElement('tr');
    for(const text of ['Kỹ năng','Điểm thực tế','Trạng thái']){const th=document.createElement('th');th.scope='col';th.textContent=text;header.append(th);}head.append(header);table.append(head);
    const body=document.createElement('tbody'),grading=payload.writing?.grading;
    for(const [skill,title] of [['listening','Listening'],['reading','Reading'],['writing','Writing']]){
      const section=payload.result?.[skill],ready=skill==='writing'?grading?.ready===true&&Number.isFinite(grading.writingScore):section?.correct!=null;
      const score=skill==='writing'?(ready?formatBand(grading.writingScore)+'/9':'—'):
        ready?(testConfig.slug==='substitute-test-1-k56'?sectionScore(section):
          (Number.isFinite(section.band)?formatBand(section.band)+'/9 · ':'')+sectionScore(section)):'—';
      const row=document.createElement('tr');
      for(const text of [title,score,ready?'Đã chấm':skill==='listening'&&listeningInterruption?'Gián đoạn · Cần bài thay thế':skill==='writing'&&state.writingSubmitted?'Đang chấm':'Chưa nộp']){const td=document.createElement('td');td.textContent=text;row.append(td);}body.append(row);
    }
    table.append(body);elements.summaryGrid.replaceChildren(table);
    if(grading?.ready&&Array.isArray(grading.tasks)){
      const criteria=document.createElement('table');criteria.className='substitute-score-table';
      const cap=document.createElement('caption');cap.textContent='Điểm Writing theo tiêu chí';criteria.append(cap);
      const thead=document.createElement('thead'),tr=document.createElement('tr');
      for(const text of ['Task','TA / TR','CC','LR','GRA','Band']){const th=document.createElement('th');th.scope='col';th.textContent=text;tr.append(th);}thead.append(tr);criteria.append(thead);
      const tbody=document.createElement('tbody');
      for(const task of grading.tasks){const row=document.createElement('tr'),points=['TA','CC','LR','GRA'].map(key=>{const c=task.criteria?.find(c=>(c.code||c.key)===(key==='TA'&&task.taskNumber===2?'TR':key));return c?formatBand(c.bandScore??c.score):'—';});
        for(const text of ['Task '+task.taskNumber,...points,formatBand(task.taskScore)]){const td=document.createElement('td');td.textContent=text;row.append(td);}tbody.append(row);}
      criteria.append(tbody);elements.summaryGrid.append(criteria);
    }
  }
return{renderSkillPerformance,renderDetailBlock,renderScoreSummary};
}
export function bootstrapMarkup({sourceSlug,state={},legacyUiState={},previewSeconds=()=>10,previewLabel=()=>"Nghe thử 10 giây đầu",readingFirstEnabled=false}){if(!/^substitute-test-[12]-k(?:56|67)$/.test(sourceSlug))throw Error('NATIVE_SOURCE_INVALID');const title='Substitute Test '+sourceSlug.split('-')[2]+' · Khóa '+sourceSlug.slice(-2),window={SUBSTITUTE_STATE:{meta:{readingFirstEnabled}}};return `
    <header class="topbar cbt-bootstrap-topbar">
      <h1>${title}</h1>
    </header>
    <main class="page-shell cbt-bootstrap-shell">
      <section class="panel cbt-bootstrap-card" aria-labelledby="securePrepTitle">
        <header class="cbt-lobby-header">
          <span class="cbt-lobby-badge">Phòng chờ bài thi lại</span>
          <h2 id="securePrepTitle">Kiểm tra âm thanh trước khi bắt đầu</h2>
          <p>Chọn đúng lớp và họ tên của bạn. Đề thi vẫn khóa cho đến khi hoàn tất bước xác nhận.</p>
        </header>
        <div class="cbt-bootstrap-identity">
          <label>Lớp
            <select id="bootstrapClass" required>
              <option value="">Nhấn để chọn lớp</option>
            </select>
          </label>
          <label>Họ và tên
            <select id="bootstrapStudent" required disabled>
              <option value="">Chọn lớp trước</option>
            </select>
          </label>
          <p class="cbt-roster-note">Danh sách chỉ hiển thị học viên được xếp tham gia bài thi lại của lớp đã chọn.</p>
          <button class="button button-secondary" id="bootstrapChangeStudent" type="button">Đổi người học</button>
        </div>
        <label id="bootstrapOrderLabel" ${window.SUBSTITUTE_STATE.meta.readingFirstEnabled===true||state.examOrder==='reading-first'?'':'hidden'}>Thứ tự làm bài
          <select id="bootstrapOrder">
            <option value="listening-first">Listening trước · Reading sau</option>
            <option value="reading-first">Reading trước · Listening sau</option>
          </select>
        </label>
        <div class="cbt-lobby-steps">
          <section class="cbt-lobby-step" id="bootstrapDownloadStep" data-state="locked">
            <span class="cbt-lobby-step-number">1</span>
            <div class="cbt-lobby-step-body">
              <h3>Tải đủ audio đã mã hóa</h3>
              <p>Chọn đúng lớp và họ tên rồi chờ thanh tải đạt 100%.</p>
              <strong class="cbt-audio-status cbt-lobby-download-status" id="bootstrapDownloadStatus" role="status">Đang tải danh sách lớp...</strong>
              <progress class="cbt-audio-progress" id="bootstrapDownloadProgress" max="1" value="0"></progress>
              <button class="button button-secondary" id="bootstrapRetry" type="button" hidden>Thử tải lại</button>
            </div>
          </section>
          <section class="cbt-lobby-step" id="bootstrapPreviewStep" data-state="locked">
            <span class="cbt-lobby-step-number">2</span>
            <div class="cbt-lobby-step-body">
              <h3>Nghe thử ${previewSeconds()} giây</h3>
              <p>Bạn cần nghe đủ ${previewSeconds()} giây đầu. Âm lượng này được giữ cho bài thi chính.</p>
              <div class="cbt-lobby-preview-controls">
                <button class="button button-secondary" id="bootstrapPreview" type="button" disabled>${previewLabel()}</button>
                <label class="cbt-volume cbt-lobby-volume"><span>Âm lượng</span><input id="bootstrapVolume" type="range" min="0.1" max="1" step="0.1" value="${Number(state.audioVolume) || legacyUiState.audioVolume || 1}" disabled></label>
              </div>
              <span class="cbt-preview-status" id="bootstrapPreviewStatus" role="status">Chờ tải audio xong.</span>
            </div>
          </section>
          <section class="cbt-lobby-step" id="bootstrapStartStep" data-state="locked">
            <span class="cbt-lobby-step-number">3</span>
            <div class="cbt-lobby-step-body">
              <h3>Bắt đầu thi</h3>
              <p id="bootstrapStartStatus">Đề và audio chính chỉ mở sau nút này.</p>
              <button class="button button-primary" id="bootstrapStart" type="button" disabled>Bắt đầu thi Listening</button>
            </div>
          </section>
        </div>
        <div class="notice" id="bootstrapNotice" role="status" hidden></div>
      </section>
    </main>
    <dialog class="cbt-identity-confirm" id="identityConfirm" aria-labelledby="identityConfirmTitle" aria-describedby="identityConfirmHelp">
      <p class="cbt-confirm-eyebrow">Kiểm tra trước khi vào bài</p>
      <h2 id="identityConfirmTitle">Xác nhận thông tin học viên</h2>
      <p id="identityConfirmHelp">Vui lòng kiểm tra đúng họ tên và lớp của bạn trước khi tiếp tục.</p>
      <dl><div><dt>Họ và tên</dt><dd id="confirmStudentName"></dd></div><div><dt>Lớp</dt><dd id="confirmClassName"></dd></div></dl>
      <p class="cbt-confirm-warning">Nếu thông tin chưa đúng, hãy quay lại và chọn lại tên.</p>
      <div class="cbt-confirm-actions"><button class="button button-secondary" id="cancelIdentity" type="button">Quay lại chọn tên</button><button class="button button-primary" id="confirmIdentity" type="button">Xác nhận, tiếp tục</button></div>
    </dialog>`;}

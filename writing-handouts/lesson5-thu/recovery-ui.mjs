// Nhận session của đúng người học từ backend; chỉ trình bày, không chấm hoặc mở khóa.
// Nội dung đã chốt giữ nguyên; thiếu từ vựng/lỗi vẫn hiện khung và cách thử lại.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const points=['A','X','B'];
const names={A:'Điểm đầu',X:'Cầu nối',B:'Điểm cuối'};
export function renderJourney(session,key){
  const n=key.at(-1),active=key[0].toUpperCase();
  return `<section class="argument-reminder" aria-label="Nhắc lại hành trình ý ${n}"><h4>Nhắc lại các nội dung đã có</h4><div class="reminder-prompt"><b>Đề bài</b><span>Mua đồ không cần thiết</span></div><ol class="argument-points">${points.map(point=>{
    const field=point.toLowerCase()+n,value=session.responses[field],current=point===active,done=session.steps[field]?.status==='passed';
    return `<li data-point="${point}" class="argument-point ${current?'is-current':''} ${value?'':'is-empty'}" ${current?'aria-current="step"':''}><span class="point-marker" aria-hidden="true">${point}</span><div><div class="point-title"><strong>${point} · ${names[point]}</strong>${current?`<span class="current-label">${done?'Đang xem':'Đang làm'}</span>`:done?'<span class="confirmed-label">✓ Đã chốt</span>':''}</div><p>${value?esc(value):`<span class="empty-point">${current?'Bạn đang xác định điểm '+point:'Chưa có nội dung'}<small>${current?'Nhập ý của bạn vào ô màu vàng bên dưới.':'Sẽ bổ sung ở bước tương ứng.'}</small></span>`}</p></div></li>`;
  }).join('')}</ol></section>`;
}
export function renderProcessing(session,key){
  const step=session.steps[key],job=session.processing?.[key];
  if(step.status==='technical_error')return `<div class="grading-message grading-error" role="alert"><strong>Chưa hoàn tất chấm bài</strong><p>Hệ thống đã dừng lượt chấm này. Nội dung bạn nhập vẫn được giữ. Nhấn nút Check để thử lại.</p>${step.error?`<details><summary>Thông tin để giảng viên kiểm tra</summary><p>Mã lỗi: ${esc(step.error)}</p></details>`:''}</div>`;
  if(step.status!=='pending')return '';
  const tries=job?.tries||0,max=job?.maxTries||3;
  const title=job?.status==='leased'?'AI đang đọc bài của bạn':tries?`Đang chuẩn bị thử lại · Lượt ${Math.min(tries+1,max)}/${max}`:'Đã nhận bài · Đang chờ lượt chấm';
  const until=Number.isFinite(job?.deadlineAt)?`<small>Lượt này sẽ dừng nếu chưa hoàn tất trước ${esc(new Date(job.deadlineAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}))}.</small>`:'';
  return `<div class="grading-message" role="status"><span class="grading-spinner" aria-hidden="true"></span><div><strong>${title}</strong><p>${job?.status==='leased'?`Lượt thử ${tries}/${max}. `:''}Bạn không cần bấm lại. Có thể quay lại trang này; bài đã gửi vẫn được giữ.</p>${until}</div></div>`;
}
function keywords(session,n,point){
  const v=session.vocabulary?.[n];
  if(v?.status==='ready'&&Array.isArray(v.groups?.[point]))return `<ul class="recap-keywords">${v.groups[point].map(entry=>`<li><strong lang="en">${esc(entry.phrase)}</strong><span>${esc(entry.meaningVi)}</span></li>`).join('')}</ul>`;
  return `<p class="recap-keyword-note">${v?.status==='failed'?'Chưa lấy được từ vựng. Nội dung đã chốt vẫn được giữ.':'Đang chuẩn bị từ vựng cho ý này…'}</p>`;
}
export function renderRecap(session){
  if(session.steps.topic.status!=='passed'||![1,2].every(n=>points.every(p=>session.steps[p.toLowerCase()+n]?.status==='passed')))return '';
  return `<section class="argument-recap" aria-label="Ý đồ nội dung và từ vựng cả thân bài"><span class="badge passed">✓ Cả hai ý đã đạt</span><h2>Nhắc lại ý đồ nội dung thân bài 2</h2><p>Nội dung đã chốt và keyword gợi ý, theo đúng thứ tự bạn sẽ viết.</p><div class="recap-topic"><h3>Topic Sentence</h3><p lang="en">${esc(session.responses.topicSentence)}</p></div><p class="recap-scroll-hint">Trên màn hình nhỏ, kéo bảng sang ngang để xem A → X → B.</p><div class="recap-scroll" tabindex="0" role="region" aria-label="Bảng hai ý, cuộn ngang"><table class="recap-table"><caption>Ý 1 và Ý 2 · A → X → B</caption><thead><tr><th scope="col">Ý</th>${points.map(p=>`<th scope="col"><span class="recap-marker">${p}</span>${names[p]}${p!=='B'?'<span class="recap-arrow" aria-hidden="true">→</span>':''}</th>`).join('')}</tr></thead><tbody>${[1,2].map(n=>`<tr data-idea="${n}"><th scope="row">Ý ${n}</th>${points.map(p=>`<td data-point="${p}"><small class="recap-label">Nội dung đã chốt</small><p class="confirmed-content">${esc(session.responses[p.toLowerCase()+n])}</p><small class="recap-label">Keyword gợi ý</small>${keywords(session,n,p)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${[1,2].filter(n=>session.vocabulary?.[n]?.status==='failed').map(n=>`<div class="recap-retry"><span>Từ vựng ý ${n} chưa hoàn tất.</span><button class="secondary" data-vocab-retry="${n}">Thử lấy từ vựng ý ${n} lại</button></div>`).join('')}<p class="recap-footer">Bạn tự chọn cách diễn đạt và viết thân bài từ khung lập luận của mình.</p></section>`;
}

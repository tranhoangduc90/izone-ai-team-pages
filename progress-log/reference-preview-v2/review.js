// Nhận definition public, responses và kết quả chấm của đúng học viên; dựng bài chỉ đọc.
// Giữ nguyên câu, lựa chọn, ô điền và xuống dòng. Không tự chấm hoặc suy đáp án đúng.
import {legacySentences} from './legacy-sentences.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const verdicts={correct:'✓ Đúng',incorrect:'✕ Sai',pending:'Đang chờ chấm',manual_review:'Cần giảng viên kiểm tra',ungraded:'Chưa chấm đúng/sai',blank:'Để trống'};
function plain(value){
  if(value===null||value===undefined||value==='')return 'Chưa trả lời';
  if(typeof value==='object'&&!Array.isArray(value)){
    if('correct' in value&&'total' in value)return 'Em tự khai: '+value.correct+'/'+value.total;
    return Object.entries(value).map(([key,v])=>key+': '+plain(v)).join('\n');
  }
  return String(value);
}
function selected(value,id){return Array.isArray(value)?value.includes(id):value===id;}
export function reviewItems(detail){
  const responses=detail.responses||{};
  return (detail.definition?.blocks||[]).map(block=>{
    const articles=(block.items||[]).map((item,index)=>{
      const c={...(item.interactionConfig||{})},value=responses[item.itemVersionId];
      // Hai phiếu cũ lưu câu nội tuyến trong renderer vận hành thay vì definition.
      if(!c.sentenceLines&&legacySentences[item.itemVersionId])c.sentenceLines=legacySentences[item.itemVersionId];
      const applicable=!c.visibleWhenItemVersionId||selected(responses[c.visibleWhenItemVersionId],c.visibleWhenValue);
      const result=detail.gradingItems?.find(g=>g.itemVersionId===item.itemVersionId);
      const present=value!==undefined&&value!==null&&value!==''&&(!Array.isArray(value)||value.some(v=>String(v??'').trim()));
      const verdict=applicable?(result?.verdict||(present?'ungraded':detail.submissionId?'blank':'pending')):'not_applicable';
      const label=applicable?(verdicts[verdict]||'Chưa có kết quả chấm'):'Không áp dụng cho lựa chọn của em';
      let answer='';
      if(!applicable)answer='<p class="reviewAnswer">Câu này không áp dụng; không được tính là sai hoặc thiếu bài.</p>';
      else if(item.options?.length){
        answer='<div class="reviewOptions" aria-label="Các phương án">'+item.options.map(o=>'<div class="reviewOption '+(selected(value,o.id)?'isSelected':'')+'"><span aria-hidden="true">'+(selected(value,o.id)?'✓':'○')+'</span><span>'+esc(o.label)+'</span>'+(selected(value,o.id)?'<b>Lựa chọn của em</b>':'')+'</div>').join('')+'</div>';
        const values=Array.isArray(value)?value:[value];
        answer+='<p class="reviewAnswer"><small>Câu trả lời của em</small><strong>'+esc(present?values.map(v=>item.options.find(o=>o.id===v)?.label||plain(v)).join(' · '):'Chưa trả lời')+'</strong></p>';
      }else if(Array.isArray(c.sentenceLines)&&c.sentenceLines.length){
        let slot=0;
        answer=c.sentenceLines.map(line=>'<p class="reviewSentence">'+(line.title?'<b>'+esc(line.title)+' </b>':'')+line.parts.map((part,i)=>esc(part)+(i<line.parts.length-1?'<span class="reviewBlank">'+esc(Array.isArray(value)?plain(value[slot++]):'Chưa trả lời')+'</span>':'')).join('')+'</p>').join('');
      }else if(item.layoutType==='reasoning_chain_completion')answer='<p class="reviewSentence">'+esc(c.beforeText)+' → <span class="reviewBlank">'+esc(plain(value))+'</span> → '+esc(c.afterText)+'</p>';
      else if(item.layoutType==='numbered_short_texts'||Array.isArray(value)){
        const values=Array.isArray(value)?value:[];const count=Math.max(values.length,Number(c.responseCount)||0);
        answer='<ol class="reviewAnswerList">'+Array.from({length:count},(_,i)=>'<li><small>'+esc(c.responseLabels?.[i]||'Ô '+(i+1))+'</small><strong>'+esc(plain(values[i]))+'</strong></li>').join('')+'</ol>';
      }else answer='<p class="reviewAnswer"><small>'+ (item.interactionType==='number_score'?'Điểm em tự khai':'Câu trả lời của em')+'</small><strong>'+esc(plain(value))+'</strong></p>';
      const score=result&&Number.isFinite(result.scoreEarned)&&Number.isFinite(result.maxScore)&&result.maxScore>0?' · '+result.scoreEarned+'/'+result.maxScore+' điểm':'';
      return '<article data-review-item="'+esc(item.itemVersionId)+'"><div class="reviewQuestionTop"><span class="reviewQuestionNumber">'+esc(item.displayNumber??item.position??index+1)+'</span><div><small>CÂU '+esc(item.displayNumber??item.position??index+1)+(item.required?' · BẮT BUỘC':'')+'</small><h3>'+esc(item.prompt)+'</h3></div></div>'+((item.helpText||item.instructions)?'<p class="reviewInstructions">'+esc(item.helpText||item.instructions)+'</p>':'')+answer+'<p class="reviewVerdict '+esc(verdict)+'">'+esc(label+score)+'</p></article>';
    }).join('');
    return '<section class="studentAnswerReview"><div class="studentJourneyHeading"><div><span class="studentPortalEyebrow">CÂU TRẢ LỜI CỦA EM · PHẦN '+esc(block.checkpoint??'')+'</span><h2>'+esc(block.title||'Nội dung đã ghi')+'</h2></div></div>'+(block.instructions?'<p class="reviewInstructions">'+esc(block.instructions)+'</p>':'')+articles+'</section>';
  }).join('');
}

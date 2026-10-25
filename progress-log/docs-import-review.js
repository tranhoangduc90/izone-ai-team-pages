// Chỉ dành cho GV: cảnh báo key đi cùng câu qua lưu/tải lại; không chèn HTML nguồn.
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])])):value;
export const reviewContent=(item,key)=>JSON.stringify(sorted({item,answer:key.items[item.itemVersionId]||null,
  reference:key.referenceAnswers?.[item.itemVersionId]||null}));
function node(tag,text){const result=document.createElement(tag);result.textContent=text;return result;}
export function importReviewCard(review,{item,gradingKey,onChange,readonly=false}={}){
  const resolved=item&&review.reviewedContent===reviewContent(item,gradingKey);
  const card=node('section','');card.className='notice '+(resolved?'':'error');card.dataset.keyReview=review.keyStatus;
  card.setAttribute('role',resolved?'status':'alert');
  card.append(node('strong',(resolved?'Đã xác nhận · ':'CẦN KIỂM KEY · ')+review.sourceLabel));
  for(const message of review.messages||[])card.append(node('p',message));
  card.append(node('p',resolved?'Xác nhận chỉ có hiệu lực với nội dung và key đang lưu.':'Chưa xác minh đáp án. Lưu nháp được phép; duyệt/phát phải xử lý cảnh báo này.'));
  if(review.candidates?.length)card.append(node('p','Đáp án đề xuất, chưa dùng chấm: '+review.candidates.join(' · ')));
  const source=node('details','');source.append(node('summary','Đối chiếu câu gốc và key nguồn'),node('pre',review.sourceQuote||''));
  if(review.sourceKey)source.append(node('pre','KEY NGUỒN:\n'+review.sourceKey));
  for(const pre of source.querySelectorAll('pre')){pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';}card.append(source);
  if(/^[A-Za-z0-9_-]{10,120}$/u.test(review.documentId||'')){const link=node('a','Mở Google Docs nguồn');
    link.href='https://docs.google.com/document/d/'+review.documentId+'/edit'+(review.tabId?'?tab='+encodeURIComponent(review.tabId):'');
    link.target='_blank';link.rel='noopener noreferrer';source.append(link);}
  if(item&&!readonly){
    if(review.keyStatus==='proposed'&&review.candidates.length){
      const choice=review.candidates[0],canChoice=item.graderType==='exact_option'&&review.candidates.length===1&&item.options.some(o=>o.id===choice);
      const canReference=item.graderType==='none'&&item.interactionConfig?.responseCount===review.candidates.length&&review.candidates.every(s=>s.length<=300);
      if(canChoice||canReference){const apply=node('button','Dùng đáp án đề xuất sau khi đối chiếu');apply.type='button';apply.className='button';
        apply.onclick=()=>{if(canChoice)gradingKey.items[item.itemVersionId]={graderType:'exact_option',expectedOptionId:choice};
          else{gradingKey.referenceAnswers??={};gradingKey.referenceAnswers[item.itemVersionId]=[...review.candidates];}
          delete review.reviewedContent;onChange();};card.append(apply);}
    }
    const confirm=node('button','Tôi đã xử lý và xác nhận key / chế độ không chấm');confirm.type='button';confirm.className='button';
    confirm.disabled=resolved||(item.graderType!=='none'&&!gradingKey.items[item.itemVersionId]);
    confirm.onclick=()=>{review.reviewedContent=reviewContent(item,gradingKey);onChange();};card.append(confirm);
  }
  return card;
}

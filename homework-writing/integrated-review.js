import {mountEditor,closeMenu,closeReviewDialog,dialog} from './review-format.js';
import {languageCards} from './language-cards.js';
import {feedbackTextHtml} from './feedback-format.js';
import {highlightHtml} from './text-highlights.js';

const blue='#d8eefc';
const byField=(ranges,field)=>(ranges||[]).map(mark=>mark[field]).filter(Boolean);
const asMarked=(value,ranges)=>'<p>'+highlightHtml(value,ranges)+'</p>';
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'
  ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])) : value;
export const equalReview=(a,b)=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b));

export function mountIntegratedReview(root,{result,editable=false,storageKey,guideStudent=false,revisionTarget,onDirty=()=>{}}){
  const overall=root?.querySelector('[data-feedback-panel="overall"]');
  const sentences=root?.querySelector('[data-feedback-panel="sentences"]');
  if(!overall||!sentences)return;
  const cleanLanguage=guideStudent&&!editable&&result.languageOutcome==='no_sentence_changes';
  const canonical=languageCards(result);
  const sources=new Map(canonical.map(card=>[card.id,card]));
  const defaults=canonical.map(card=>({id:card.id,sourceId:card.id}));
  let overlay=structuredClone(result.richReview||{version:1});
  let trccText,changed=!!result.richReview;
  const handles=[],cardEditors=[];
  const cardList=()=>overlay.cards??defaults;
  const count=root.querySelector('[data-feedback-tab="sentences"] .tab-count');
  const teacherActions=editable?root.querySelector('[data-integrated-review-actions]'):null;
  const change=()=>{changed=true;onDirty();};
  const mounts=(element,content,label,onUpdate,extras={})=>mountEditor(element,{content,label,editable,onUpdate,...extras});
  let index=0;
  if(storageKey)try{index=Number(sessionStorage.getItem(storageKey))||0;}catch{}
  root.classList.add('integrated-review');
  overall.innerHTML='<div class="integrated-editor-shell integrated-trcc">'+
    (teacherActions?'<header class="integrated-action-row" data-review-action-row><h3>Nhận xét TR và CC</h3></header>':'<h3>Nhận xét TR và CC</h3>')+
    '<div data-rich-trcc></div></div>';
  function placeActions(){
    if(!teacherActions)return;
    const panel=sentences.hidden?overall:sentences;
    const target=panel.querySelector('[data-review-action-row]')||panel;
    if(teacherActions.parentNode!==target)target.append(teacherActions);
  }
  if(!editable&&overlay.original){
    const original=document.createElement('details');original.className='integrated-original';
    original.innerHTML='<summary>Bài viết dùng khi nhận xét</summary><div data-rich-original></div>';
    overall.prepend(original);
    handles.push(mounts(original.querySelector('[data-rich-original]'),overlay.original,'Bài viết'));
  }
  handles.push(mounts(overall.querySelector('[data-rich-trcc]'),
    overlay.trcc??feedbackTextHtml(result.trcc,result.teacherHighlights?.trcc?.ranges).replace('<p>Bản mô phỏng theo rubric Fast Food Lesson 3.</p>',''),
    'Nhận xét về mặt nội dung',editor=>{overlay.trcc=editor.getHTML();trccText=editor.getText();change();}));
  function appendNextStep(panel,label,action){
    const group=document.createElement('div');
    group.className='review-next-step';
    const button=document.createElement('button');
    button.type='button';button.className='primary';
    const arrow=document.createElement('span');
    arrow.setAttribute('aria-hidden','true');arrow.textContent='→';
    button.append(label,arrow);button.addEventListener('click',action);
    group.append(button);panel.append(group);
  }
  function goToRevision(){
    revisionTarget.focus({preventScroll:true});
    document.getElementById('revision-guide')?.scrollIntoView({block:'start'});
  }
  if(revisionTarget)root.querySelector('[data-go-to-revision]')?.addEventListener('click',event=>{
    event.preventDefault();
    goToRevision();
  });
  if(guideStudent&&!cleanLanguage&&cardList().length){
    appendNextStep(overall,'Chuyển sang Sửa từng câu',()=>{
      root.querySelector('[data-feedback-tab="sentences"]').click();
      sentences.focus({preventScroll:true});
      sentences.firstElementChild?.scrollIntoView({block:'nearest'});
    });
  }
  function renderCard(focus=false){
    closeMenu();cardEditors.splice(0).forEach(editor=>editor.destroy());
    const list=cardList();
    if(cleanLanguage){
      count?.remove();
      sentences.innerHTML='<section class="integrated-editor-shell"><h3>Chúc mừng em!</h3>'+
        '<div class="ProseMirror clean-language-summary"><p><strong>Phần diễn đạt của em rất ổn. Em không cần sửa câu nào.</strong></p>'+
        '<p>Hãy xem nhận xét của GV về cách trả lời đề và mạch ý trong phần mở bài.</p></div></section>';
      appendNextStep(sentences.querySelector('.clean-language-summary'),'Xem nhận xét TR/CC',()=>{
        root.querySelector('[data-feedback-tab="overall"]').click();
        const heading=overall.querySelector('h3');
        heading.tabIndex=-1;
        heading.focus({preventScroll:true});
        heading.scrollIntoView({block:'nearest'});
      });
      return;
    }
    if(count)count.textContent=list.length;
    if(!list.length){sentences.innerHTML='<p class="empty-inline">Không còn thẻ nhận xét từng câu trong bản này.</p>';placeActions();return;}
    index=Math.min(list.length-1,Math.max(0,index));
    if(storageKey)try{sessionStorage.setItem(storageKey,String(index));}catch{}
    const card=list[index],source=sources.get(card.sourceId);
    if(!source){sentences.innerHTML='<p role="alert">Chưa đọc được câu nguồn.</p>';placeActions();return;}
    const baseline={
      original:asMarked(source.original_text,byField(source.highlights,'original')),
      revised:asMarked(source.revised_text,result.teacherHighlights?.['card:'+source.id+':revised']?.ranges||byField(source.revisedHighlights,'revised')),
      explanation:feedbackTextHtml(source.explanation,result.teacherHighlights?.['card:'+source.id+':explanation']?.ranges)
    };
    const item=result.items[source.sourceIndex];
    const confirmedKeep=teacherActions&&item.decision==='KEEP'&&
      item.original_text.trim()&&item.original_text===item.revised_text&&source.revised_text===item.original_text&&
      Array.isArray(item.issues)&&!item.issues.length&&!source.correctionCount&&!source.needsReview&&
      !result.atomicReview?.items?.includes(item.item)&&!result.dropped?.some(entry=>entry.item===item.item)&&
      card.original==null&&card.revised==null&&!result.teacherHighlights?.['card:'+source.id+':revised']?.ranges?.length;
    const position=index+1;
    const pager=`<nav class="integrated-pager" tabindex="-1" aria-label="Chuyển thẻ nhận xét · Thẻ ${position} trên ${list.length}"><button type="button" data-prev-card>‹ Trước</button><span class="integrated-card-position" aria-hidden="true">${position}/${list.length}</span><button type="button" data-next-card>Tiếp ›</button></nav>`;
    sentences.innerHTML=(editable?'<div class="integrated-sentence-actions"><div class="sentence-highlight-actions"><button type="button" data-add-mark>Thêm Highlight</button><button type="button" data-remove-mark>Xoá Highlight</button></div>'+pager+
        '<div class="sentence-card-actions"><button class="danger" type="button" data-delete-card>Xoá bài</button><button type="button" data-clone-card>Tạo bản sao</button></div></div>':'')+
      '<div class="integrated-pair"><section><h4>Bài làm</h4><div data-rich-source></div></section><section><h4>Gợi ý chỉnh sửa</h4><div data-rich-revision></div></section></div>'+
      '<section class="integrated-explanation">'+
      (teacherActions?'<header class="integrated-action-row" data-review-action-row><h4>Giải thích</h4></header>':'<h4>'+(editable?'Giải thích':'Nhận xét')+'</h4>')+
      '<div class="integrated-editor-shell"><div data-rich-explanation></div></div></section>'+
      (editable?'':pager);
    placeActions();
    const update=(field,editor)=>{
      if(!overlay.cards)overlay.cards=structuredClone(defaults);
      overlay.cards[index][field]=editor.getHTML();change();
    };
    let activePair;
    function mountPair(selector,field,label){
      const editor=mounts(sentences.querySelector(selector),card[field]??baseline[field],label,editor=>update(field,editor),
        {rich:false,onFocus:editor=>{activePair=editor;}});
      cardEditors.push(editor);activePair=editor;
      return editor;
    }
    for(const [selector,field,label] of [['[data-rich-source]','original','Bài làm'],['[data-rich-revision]','revised','Gợi ý chỉnh sửa']]){
      if(field==='revised'&&confirmedKeep){
        const badge=document.createElement('button');
        badge.type='button';
        badge.className='sentence-keep-badge';
        badge.textContent='Không cần chỉnh sửa';
        badge.setAttribute('aria-description','Mở ô gợi ý để chỉnh sửa câu.');
        sentences.querySelector(selector).before(badge);
        badge.onclick=()=>{
          badge.remove();
          mountPair(selector,field,label).commands.focus();
        };
      }else mountPair(selector,field,label);
    }
    cardEditors.push(mounts(sentences.querySelector('[data-rich-explanation]'),card.explanation??baseline.explanation,
      editable?'Giải thích':'Nhận xét',editor=>update('explanation',editor)));
    if(teacherActions){
      const heading=sentences.querySelector('.integrated-explanation h4');
      const formatting=sentences.querySelector('.integrated-explanation [role="toolbar"]');
      if(formatting)heading.after(formatting);
    }
    const previous=sentences.querySelector('[data-prev-card]'),next=sentences.querySelector('[data-next-card]');
    previous.setAttribute('aria-label','Trước');next.setAttribute('aria-label','Tiếp');
    previous.onclick=()=>{if(index){index--;renderCard(true);}else root.querySelector('[data-feedback-tab="overall"]').click();};
    next.disabled=index===list.length-1;next.onclick=()=>{index++;renderCard(true);};
    if(editable){
      for(const [selector,remove] of [['[data-add-mark]',false],['[data-remove-mark]',true]]){
        const button=sentences.querySelector(selector);
        button.onmousedown=e=>e.preventDefault();
        button.onclick=()=>{
          const chain=activePair.chain().focus();
          if(activePair.state.selection.empty){
            if(!activePair.isActive('highlight')){
              document.querySelector('#review-status').textContent='Chọn cụm từ trong Bài làm hoặc Gợi ý chỉnh sửa để tô sáng.';
              return;
            }
            chain.extendMarkRange('highlight');
          }
          if(remove)chain.unsetHighlight().run();else chain.setHighlight({color:blue}).run();
        };
      }
      sentences.querySelector('[data-clone-card]').onclick=()=>{
        if(list.length>=150)return;
        overlay.cards??=structuredClone(defaults);
        overlay.cards.splice(index+1,0,{...structuredClone(overlay.cards[index]),id:crypto.randomUUID()});
        index++;change();renderCard(true);
      };
      sentences.querySelector('[data-delete-card]').onclick=()=>dialog('Xoá thẻ nhận xét này?',
        '<p>Thẻ sẽ được gỡ khỏi bản đang duyệt. Bài mở đầu đã nộp vẫn được lưu trong biên nhận.</p>',()=>()=>{
          overlay.cards??=structuredClone(defaults);overlay.cards.splice(index,1);change();renderCard(true);
        },'Xoá thẻ');
    }
    if(focus)sentences.querySelector('.integrated-pager').focus({preventScroll:true});
  }
  renderCard();
  const onKeys=event=>{
    if(!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key)||sentences.hidden)return;
    const action=sentences.querySelector(event.key==='ArrowLeft'?'[data-prev-card]':'[data-next-card]');
    if(action&&!action.disabled){event.preventDefault();action.click();}
  };
  root.addEventListener('keydown',onKeys);
  let active=true;
  const observer=new MutationObserver(()=>{if(!root.isConnected)destroy();});
  observer.observe(document.getElementById('app'),{childList:true,subtree:true});
  function destroy(){
    if(!active)return;active=false;observer.disconnect();root.removeEventListener('keydown',onKeys);
    if(editable){closeMenu();closeReviewDialog();}
    handles.concat(cardEditors).forEach(editor=>editor.destroy());
  }
  return {
    placeActions,
    collect(){return {richReview:changed?structuredClone(overlay):undefined,trccText};},
    commit(sent,saved){
      if(equalReview(overlay,sent.richReview)){overlay=structuredClone(saved.richReview||{version:1});changed=!!saved.richReview;}
    },
    destroy
  };
}

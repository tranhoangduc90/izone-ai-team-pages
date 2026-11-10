import {highlightHtml,mergeHighlights,rebaseHighlights} from './text-highlights.js';
// Textarea gốc giữ nhập liệu/selection/IME; lớp nền chỉ vẽ mark, không nhận HTML.
export function setupReviewHighlights(root,initial={},onDirty=()=>{}){
  const states=new Map(),observer=new MutationObserver(enhance),sizes=new ResizeObserver(entries=>entries.forEach(e=>draw(states.get(e.target))));
  function draw(state){if(!state)return;const {input,mirror}=state,style=getComputedStyle(input);
    for(const name of ['font','letterSpacing','lineHeight','textAlign','textAlignLast','padding','borderWidth','boxSizing','wordSpacing','tabSize'])mirror.style[name]=style[name];
    mirror.style.width=(input.clientWidth+parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth))+'px';mirror.style.height=input.offsetHeight+'px';
    mirror.innerHTML=highlightHtml(input.value,state.ranges.length?state.ranges:state.autoRanges||[])+'\n';mirror.scrollTop=input.scrollTop;mirror.scrollLeft=input.scrollLeft;
  }
  function enhance(){
    root.querySelectorAll('textarea').forEach(input=>{
      if(states.has(input))return;
      const key=input.id==='review-feedback'?'feedback':input.id==='review-trcc'?'trcc':input.dataset.cardKey?`card:${input.dataset.cardKey}:${input.hasAttribute('data-revised')?'revised':'explanation'}`:input.dataset.teacherComment?'comment:'+input.dataset.teacherComment:null;
      if(!key)return;
      input.id ||= 'review-edit-'+key.replace(/[^a-zA-Z0-9_-]/g,'-');
      const label=input.closest('label');if(label)label.htmlFor=input.id;
      const prior=[...states.values()].filter(s=>s.key===key).at(-1)||initial[key],state={key,input,text:input.value,ranges:prior?.text===input.value?structuredClone(prior.ranges):[]};
      if(input.dataset.autoHighlight&&!state.ranges.length)state.autoRanges=JSON.parse(input.dataset.autoHighlight);
      const box=document.createElement('div');box.className='highlight-input';input.before(box);
      const mirror=document.createElement('div');mirror.className='highlight-mirror';mirror.setAttribute('aria-hidden','true');state.mirror=mirror;
      box.append(mirror,input);states.set(input,state);sizes.observe(input);
      const toolbar=document.createElement('div');toolbar.className='highlight-toolbar';toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Tô sáng phần được chọn');
      for(const [label,remove] of document.body.classList.contains('fast-food-demo')?[['Thêm Highlight',false],['Xoá Highlight',true]]:[['Tô sáng',false],['Bỏ tô sáng',true]]){
        const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',label);
        button.onmousedown=e=>e.preventDefault();button.onclick=()=>{
          const start=input.selectionStart,end=input.selectionEnd;
          if(start===end){input.focus();return;}
          state.ranges=mergeHighlights(state.ranges.length?state.ranges:state.autoRanges||[],start,end,remove);state.autoRanges=null;draw(state);input.focus({preventScroll:true});onDirty();
          input.dispatchEvent(new CustomEvent('highlightchange',{bubbles:true,detail:{ranges:state.ranges}}));
        };toolbar.append(button);
      }
      box.before(toolbar);
      input.addEventListener('input',()=>{state.autoRanges=null;state.ranges=rebaseHighlights(state.text,input.value,state.ranges);state.text=input.value;draw(state);onDirty();input.dispatchEvent(new CustomEvent('highlightchange',{detail:{ranges:state.ranges}}));});
      input.addEventListener('applyhighlights',e=>{state.ranges=e.detail.ranges;state.text=input.value;draw(state);onDirty();});
      input.addEventListener('scroll',()=>draw(state));draw(state);
    });
  }
  enhance();observer.observe(root,{subtree:true,childList:true});
  return {collect:()=>Object.fromEntries([...states.values()].filter(s=>s.input.isConnected&&s.ranges.length).map(s=>[s.key,{text:s.input.value,ranges:s.ranges}])),destroy(){observer.disconnect();sizes.disconnect();}};
}

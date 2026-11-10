// Chỉ đổi bố cục tại trình duyệt; không render lại editor hoặc ghi bài/nhận xét.
const mounted=new WeakMap();let nextId=0;
export function setupSplitPanes(root){
  mounted.get(root)?.();
  const cleanups=[];
  for(const layout of root.querySelectorAll('.student-layout,.review-layout,.alignment-review-grid')){
    const panes=[...layout.children];if(panes.length!==2)continue;
    const [left,right]=panes,kind=layout.classList.contains('student-layout')?'student':layout.classList.contains('review-layout')?'review':'alignment';
    const media=matchMedia(kind==='review'?'(min-width:1001px)':'(min-width:801px)'),defaultRatio=document.body.classList.contains('fast-food-demo')
      ? (kind==='review' ? .33 : kind==='student'&&layout.classList.contains('has-feedback') ? .65 : .46)
      : .5;
    // Mỗi lần mở màn bắt đầu 50:50, chỉ giữ điều chỉnh trong màn hiện tại.
    let preferred=null,ratio=defaultRatio,active=false,drag=null;
    const handle=document.createElement('div');handle.className='split-divider';handle.hidden=true;handle.tabIndex=-1;
    handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label','Điều chỉnh độ rộng hai phần');
    handle.title='Kéo để chỉnh độ rộng · phím ← → · nhấp đúp hoặc Enter để về mặc định';
    handle.innerHTML='<span aria-hidden="true">⋮⋮</span>';
    const id=++nextId;if(!left.id)left.id='writing-split-'+id+'-left';if(!right.id)right.id='writing-split-'+id+'-right';
    handle.setAttribute('aria-controls',left.id+' '+right.id);layout.insertBefore(handle,right);layout.classList.add('resizable-split');
    function bounds(){
      const style=getComputedStyle(layout),width=layout.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-24;
      const min=Math.max(.2,Math.min(.5,320/Math.max(1,width)));return {width,min,max:1-min};
    }
    function write(value){
      const {min,max}=bounds();ratio=Math.max(min,Math.min(max,value));
      layout.style.setProperty('--split-left',ratio.toFixed(6)+'fr');layout.style.setProperty('--split-right',(1-ratio).toFixed(6)+'fr');
      handle.setAttribute('aria-valuemin',String(Math.round(min*100)));handle.setAttribute('aria-valuemax',String(Math.round(max*100)));
      handle.setAttribute('aria-valuenow',String(Math.round(ratio*100)));handle.setAttribute('aria-valuetext',`Phần trái ${Math.round(ratio*100)}%, phần phải ${Math.round((1-ratio)*100)}%`);
    }
    function save(){preferred=ratio;}
    function finish(keep){
      if(!drag)return;const previous=drag;drag=null;document.body.classList.remove('split-is-dragging');
      if(keep)save();else write(previous.ratio);
      if(handle.hasPointerCapture(previous.id))handle.releasePointerCapture(previous.id);
    }
    function sync(){
      const visible=media.matches&&!left.hidden&&!right.hidden&&left.getClientRects().length>0&&right.getClientRects().length>0;
      if(!visible){finish(false);active=false;delete layout.dataset.splitActive;handle.hidden=true;handle.tabIndex=-1;return;}
      if(!active)ratio=preferred??defaultRatio;
      active=true;layout.dataset.splitActive='true';handle.hidden=false;handle.tabIndex=0;
      if(!drag)write(preferred??ratio);
    }
    handle.addEventListener('pointerdown',event=>{
      if(!active||event.button!==0||!event.isPrimary)return;
      event.preventDefault();handle.focus({preventScroll:true});drag={id:event.pointerId,x:event.clientX,ratio};handle.setPointerCapture(event.pointerId);document.body.classList.add('split-is-dragging');
    });
    handle.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId)write(drag.ratio+(event.clientX-drag.x)/Math.max(1,bounds().width));});
    handle.addEventListener('pointerup',event=>{if(drag?.id===event.pointerId)finish(true);});
    handle.addEventListener('pointercancel',()=>finish(false));handle.addEventListener('lostpointercapture',()=>finish(true));
    const reset=()=>{write(defaultRatio);save();};handle.addEventListener('dblclick',reset);
    handle.addEventListener('keydown',event=>{
      if(!active||event.altKey||event.ctrlKey||event.metaKey)return;
      const step=event.shiftKey ? .1 : .02;
      if(event.key==='Escape'&&drag){event.preventDefault();finish(false);return;}
      const value={ArrowLeft:ratio-step,ArrowRight:ratio+step,Home:bounds().min,End:bounds().max,Enter:defaultRatio}[event.key];
      if(value===undefined)return;event.preventDefault();write(value);save();
    });
    const blur=()=>finish(false);window.addEventListener('blur',blur);media.addEventListener('change',sync);
    const fit=()=>{const height=Math.max(240,innerHeight-Math.max(12,layout.getBoundingClientRect().top)-16);layout.style.setProperty('--workspace-height',Math.round(height)+'px');};
    fit();window.addEventListener('resize',fit);window.addEventListener('scroll',fit,{passive:true});
    const resize=new ResizeObserver(()=>{fit();sync();});resize.observe(layout);
    const visibility=new MutationObserver(sync);visibility.observe(layout,{attributes:true,attributeFilter:['class']});visibility.observe(left,{attributes:true,attributeFilter:['hidden']});visibility.observe(right,{attributes:true,attributeFilter:['hidden']});
    cleanups.push(()=>{resize.disconnect();visibility.disconnect();finish(false);window.removeEventListener('resize',fit);window.removeEventListener('scroll',fit);window.removeEventListener('blur',blur);media.removeEventListener('change',sync);handle.remove();layout.classList.remove('resizable-split');delete layout.dataset.splitActive;layout.style.removeProperty('--split-left');layout.style.removeProperty('--split-right');});
    sync();
  }
  const removed=new MutationObserver(()=>{if(!root.querySelector('.resizable-split'))cleanup();});removed.observe(root,{childList:true});
  function cleanup(){removed.disconnect();cleanups.splice(0).forEach(fn=>fn());mounted.delete(root);}
  mounted.set(root,cleanup);return cleanup;
}

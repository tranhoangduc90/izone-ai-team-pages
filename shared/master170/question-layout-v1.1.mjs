// Approved R3 presentation. Reuse native nodes/handlers and annotation text.
const consumers=new Set(['reading-practice','listening-practice','reading-homework','listening-homework','term-mini-k67','substitute-k67']);
const permitted=root=>root?.dataset.izoneDesign==='master170@1.1'&&consumers.has(root.dataset.izoneConsumer);
const set=(node,key,value)=>{if(node.dataset[key]!==value)node.dataset[key]=value;};
// Prepare banks inside inactive parts too; skip only a bank explicitly hidden
// by its renderer (judgment legacy text or the native map legend).
const visibleBank=bank=>!bank.matches('[hidden]')&&!bank.closest('.authored-annotation-context')&&bank.querySelector('h4')?.textContent.trim()!=='Locations';

export function applyQuestionLayout(root=document.body){
 if(!permitted(root))return false;
 if(!root.classList.contains('m170-question-layout'))root.classList.add('m170-question-layout');
 for(const view of root.querySelectorAll('#readingView,#listeningView')){
  for(const group of view.querySelectorAll('.design-question-group')){
   const kind=group.dataset.m170QuestionKind|| (group.dataset.demoMatching==='true'?'matching':'other');
   set(group,'m170Kind',kind);
   if(group.dataset.m170Visual==='true'||group.querySelector(':scope > img'))set(group,'m170Visual','true');
  }
  for(const bank of view.querySelectorAll('.cbt-matching-layout > .cbt-option-bank,.k67-matching-columns > .k67-option-bank')){
   if(!visibleBank(bank))continue;
   const layout=bank.parentElement,group=layout.closest('.design-question-group');
   const title=bank.querySelector('h4')?.textContent.trim();
   set(layout,'m170Kind',group?.dataset.m170Kind||(title==='Words'?'other':'matching'));
   if(!layout.classList.contains('m170-option-columns'))layout.classList.add('m170-option-columns');
   if(!layout.parentElement.classList.contains('m170-option-scroll')){
    const scroll=layout.ownerDocument.createElement('div');scroll.className='m170-option-scroll';scroll.tabIndex=0;
    scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Bài tập bên trái, Options bên phải; cuộn ngang nếu cần');
    const doc=layout.ownerDocument,active=doc.activeElement,ownedFocus=layout.contains(active);
    const inputSelection=ownedFocus&&typeof active.selectionStart==='number'?[active.selectionStart,active.selectionEnd,active.selectionDirection]:null;
    const selection=doc.getSelection(),anchor=selection?.anchorNode&&layout.contains(selection.anchorNode)?[selection.anchorNode,selection.anchorOffset,selection.focusNode,selection.focusOffset]:null;
    layout.before(scroll);
    if(typeof scroll.moveBefore==='function')scroll.moveBefore(layout,null);
    else{
     scroll.append(layout);
     // Fallback restores only focus/selection already owned by this subtree.
     if(ownedFocus&&active.isConnected&&doc.activeElement!==active)active.focus({preventScroll:true});
     if(inputSelection)active.setSelectionRange(...inputSelection);
     if(anchor&&anchor[0].isConnected&&anchor[2].isConnected)selection.setBaseAndExtent(...anchor);
    }
   }
   set(view,'m170HasBank','true');
  }
  for(const table of view.querySelectorAll('.authored-table,.authored-completion-table,.k67-semantic-questions table,.cbt-test-table')){
   if(table.matches('.cbt-test-table')&&!table.querySelector('[data-answer-slot]'))continue;
   if(!table.classList.contains('m170-completion-table'))table.classList.add('m170-completion-table');
   const headers=[...table.querySelectorAll('thead th')].map(e=>e.textContent.trim());
   if(!table.closest('.design-question-group')&&!table.parentElement.classList.contains('m170-table-container'))table.parentElement.classList.add('m170-table-container');
   for(const row of table.querySelectorAll('tbody tr'))[...row.cells].forEach((cell,i)=>{if(headers[i]&&!cell.hasAttribute('data-label'))cell.dataset.label=headers[i];});
  }
  for(const visual of view.querySelectorAll('.cbt-visual-card,.cbt-map-workspace,.k67-map-and-answers')){
   const mark=node=>{for(const row of node.querySelectorAll('.cbt-question-card'))set(row,'m170VisualRow','true');if(node.matches('.cbt-question-card'))set(node,'m170VisualRow','true');};
   mark(visual);
   for(let node=visual.nextElementSibling;node&&!node.matches('.cbt-subsection-heading');node=node.nextElementSibling)mark(node);
  }
 }
 return true;
}

export function installQuestionLayout(root=document.body){
 if(!permitted(root))return ()=>{};
 applyQuestionLayout(root);let frame=0;
 const observer=new MutationObserver(entries=>{
  if(!entries.some(e=>[...e.addedNodes].some(n=>n.nodeType===1&& (n.matches?.('#readingView,#listeningView')||n.closest?.('#readingView,#listeningView')||n.querySelector?.('#readingView,#listeningView')))))return;
  if(!frame)frame=requestAnimationFrame(()=>{frame=0;applyQuestionLayout(root);});
 });
 observer.observe(root,{childList:true,subtree:true});
 return ()=>{observer.disconnect();cancelAnimationFrame(frame);};
}

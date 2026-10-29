// Read-only geometry probe shared by RED/GREEN demo checks. No business API.
export function inspectDemo(doc,example){
 const win=doc.defaultView,style=e=>win.getComputedStyle(e),visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&style(e).visibility!=='hidden',violations=[];
 const banks=[...doc.querySelectorAll('.cbt-option-bank')].filter(visible);
 const bankObservations=banks.map(bank=>{const r=bank.getBoundingClientRect(),bad=[];
  for(const node of bank.querySelectorAll('h4,div>span')){if(!visible(node))continue;const range=doc.createRange();range.selectNodeContents(node);for(const b of range.getClientRects())if(b.left<r.left+10||b.right>r.right-10)bad.push({text:node.textContent.trim(),left:b.left-r.left,right:r.right-b.right});}
  const observation={width:r.width,scrollWidth:bank.scrollWidth,clientWidth:bank.clientWidth,padding:style(bank).padding,textOutsideInset:bad};
  if(bank.scrollWidth>bank.clientWidth+1||bad.length)violations.push('option-bank-clips-or-lacks-inset');return observation;
 });
 const matchingIds=['reading-information','reading-headings','reading-features','reading-endings','listening-matching'];
 const isMatching=matchingIds.includes(example.id);
 const shells=[...doc.querySelectorAll('#readingView .cbt-matching-questions,#readingView .cbt-question-card')].filter(visible).map(e=>{const s=style(e);return{className:e.className,left:parseFloat(s.borderLeftWidth),right:parseFloat(s.borderRightWidth),radius:s.borderRadius,bottom:parseFloat(s.borderBottomWidth)};});
 if(!isMatching&&!example.family.startsWith('homework')&&shells.some(s=>s.left>0||s.right>0))violations.push('non-matching-question-still-boxed');
 const source=doc.querySelector('#passage-scroll'),sourceStyle=source&&visible(source)&&example.family==='reading'?{left:parseFloat(style(source).paddingLeft),right:parseFloat(style(source).paddingRight)}:null;
 if(sourceStyle&&(sourceStyle.left<16||sourceStyle.right<16))violations.push('reading-source-needs-padding');
 const numberCount=example.groups?.length?new Set(example.groups.flatMap(g=>g.questions.map(q=>q.n))).size:null;
 if(numberCount!==null&&numberCount<2)violations.push('fewer-than-two-questions');
 if(['reading-multiple','listening-pair'].includes(example.id)&&example.groups.length<2)violations.push('pair-needs-two-stems-to-show-separator');
 if(['reading-multiple','listening-pair'].includes(example.id)&&doc.querySelectorAll('.authored-choice-group,.authored-pair').length<2)violations.push('pair-second-stem-not-rendered');
 const table=doc.querySelector('table'),cell=table?.querySelector('td');
 const tableObservation=table?{className:table.className,minWidth:style(table).minWidth,font:style(table).fontSize,padding:style(cell).padding,border:style(cell).borderColor,cellOverflow:[...table.querySelectorAll('td,th')].some(e=>e.scrollWidth>e.clientWidth+1)}:null;
 if(table&&example.id==='reading-table'&&!table.classList.contains('authored-completion-table'))violations.push('reading-table-differs-from-listening-reference');
 if(tableObservation?.cellOverflow)violations.push('table-cell-content-overflow');
 const overflow=[...doc.querySelectorAll('#passage-scroll,#question-scroll,.design-question-content,.cbt-matching-questions,.cbt-question-card,.authored-table-wrap')].filter(visible).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.id||e.className);
 if(overflow.length)violations.push('nested-content-overflow');
 return{id:example.id,viewport:win.innerWidth,questionCount:numberCount,violations:[...new Set(violations)],banks:bankObservations,shells,source:sourceStyle,table:tableObservation,overflow};
}

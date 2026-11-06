// Editor dùng các thẻ cố định; lưu văn bản có định dạng và khoảng tô sáng, không gửi HTML.
import {mergeHighlights} from './text-highlights.js';
export function setupRichReview(root){
 const controllers=[];
 root.querySelectorAll('[data-feedback-preview]').forEach(editor=>{
  const input=root.querySelector('#'+editor.dataset.feedbackPreview);if(!input)return;
  editor.contentEditable='true';editor.setAttribute('role','textbox');editor.setAttribute('aria-multiline','true');editor.setAttribute('aria-label',input.closest('section').querySelector('h3').textContent);
  const toolbar=document.createElement('div');toolbar.className='rich-review-toolbar';toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Định dạng nhận xét');editor.before(toolbar);
  let savedRange;
  const remember=()=>{const s=getSelection();if(s?.rangeCount&&editor.contains(s.anchorNode)&&editor.contains(s.focusNode))savedRange=s.getRangeAt(0).cloneRange();};
  editor.addEventListener('keyup',remember);editor.addEventListener('mouseup',remember);
  function serialize(){let out='',ranges=[];
   function walk(n){if(n.nodeType===3){out+=n.nodeValue;return;}if(n.nodeType!==1)return;const tag=n.tagName;
    if(tag==='BR'){out+='\n';return;}const block=['P','DIV','H4','H5','UL','OL','LI'].includes(tag);if(block&&out&&!out.endsWith('\n')&&!/^(?:- |\d+\. )$/.test(out.split('\n').at(-1)))out+='\n';
    const prefix=['STRONG','B'].includes(tag)?(n.parentElement?.closest('strong,b')?'':'**'):['EM','I'].includes(tag)?'*':tag==='CODE'?'`':tag==='H4'?'### ':tag==='H5'?'#### ':tag==='LI'?(n.parentElement.tagName==='OL'?`${[...n.parentElement.children].indexOf(n)+1}. `:'- '):'';
    out+=prefix;const start=out.length;for(const c of n.childNodes)walk(c);if(tag==='MARK'&&out.length>start)ranges.push({start,end:out.length});
    if(['STRONG','B','EM','I','CODE'].includes(tag))out+=prefix;if(block&&!out.endsWith('\n'))out+='\n';
   }
   for(const n of editor.childNodes)walk(n);const text=out.trimEnd();return {text,ranges:ranges.reduce((all,r)=>mergeHighlights(all,r.start,Math.min(r.end,text.length)),[])};
  }
  function sync(){const {text,ranges}=serialize();input.dataset.richSync='true';input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new CustomEvent('applyhighlights',{detail:{ranges}}));delete input.dataset.richSync;}
  function restore(){editor.focus();const s=getSelection();if(savedRange&&editor.contains(savedRange.commonAncestorContainer)){s.removeAllRanges();s.addRange(savedRange);}return s;}
  for(const [label,tag]of [['In đậm','strong'],['Danh sách','li'],['Tô sáng','mark'],['Bỏ tô sáng','unmark']]){
   const b=document.createElement('button');b.type='button';b.textContent=label;b.onmousedown=e=>e.preventDefault();
   b.onclick=()=>{const s=restore();if(!s?.rangeCount||!editor.contains(s.anchorNode)||!editor.contains(s.focusNode))return;const r=s.getRangeAt(0);if(r.collapsed)return;
    if(tag==='unmark'){for(const m of [...editor.querySelectorAll('mark')])if(r.intersectsNode(m))m.replaceWith(...m.childNodes);}
    else{const frag=r.extractContents();
     if(tag==='li'){const ul=document.createElement('ul');let li;
      for(const child of [...frag.childNodes]){if(child.nodeType===1&&['P','DIV','H4','H5'].includes(child.tagName)){li=document.createElement('li');li.append(...child.childNodes);ul.append(li);li=null;}else{li ||= document.createElement('li');if(!li.parentNode)ul.append(li);li.append(child);}}
      r.insertNode(ul);r.selectNodeContents(ul);
     }else{const walker=document.createTreeWalker(frag,NodeFilter.SHOW_TEXT),texts=[];while(walker.nextNode())texts.push(walker.currentNode);
      for(const text of texts){if(!text.nodeValue)continue;const node=document.createElement(tag);text.replaceWith(node);node.append(text);}
      const first=frag.firstChild,last=frag.lastChild;if(first){r.insertNode(frag);r.setStartBefore(first);r.setEndAfter(last);}
     }s.removeAllRanges();s.addRange(r);}
    remember();sync();};toolbar.append(b);
  }
  editor.addEventListener('input',sync);editor.addEventListener('paste',e=>{e.preventDefault();const text=e.clipboardData.getData('text/plain'),s=restore();if(!s?.rangeCount)return;const r=s.getRangeAt(0);r.deleteContents();const t=document.createTextNode(text);r.insertNode(t);r.setStartAfter(t);r.collapse(true);s.removeAllRanges();s.addRange(r);remember();sync();});
  controllers.push({sync});
 });
 return {collect:()=>{},destroy:()=>{}};
}

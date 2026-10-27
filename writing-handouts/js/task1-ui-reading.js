// Chỉ giữ node và callback khi dữ liệu của chính vùng đó không đổi.
// Chữ ký trong WeakMap của tab, không cache quyền/API hoặc lưu bài vào storage.
import {patchReadingView} from '../../shared/reading-view.mjs?v=20261027-task1-reading-v1';
const signatures=new WeakMap(),contexts=new WeakMap();
export function markReadingRegion(node,key,data){
 if(!node)return;node.dataset.readingRegion=key;signatures.set(node,JSON.stringify(data));
}
export function updateReadingRoot(root,next,context,{force=false}={}){
 const selection=getSelection(),active=document.activeElement;
 const anchor=selection?.rangeCount&&!selection.isCollapsed
  ? selection.anchorNode?.parentElement : active;
 const reading=anchor&&root.contains(anchor)?anchor:null,top=reading?.getBoundingClientRect().top;
 if(force||contexts.get(root)!==context)root.replaceChildren(...next.childNodes);
 else patchReadingView(root,next,{
  nodeKey:node=>node.nodeType===1?(node.dataset.readingRegion?'region:'+node.dataset.readingRegion:node.dataset.readingKey?'node:'+node.dataset.readingKey:node.id?'#'+node.id:''):'',
  boundary:(old,incoming)=>incoming.nodeType===1&&incoming.dataset.readingRegion
   ? old.dataset?.readingRegion===incoming.dataset.readingRegion&&signatures.get(old)===signatures.get(incoming)?'keep':'replace':null,
 });
 contexts.set(root,context);
 // Giữ vị trí nội dung đang đọc khi phần khác phía trên tăng/giảm chiều cao.
 if(reading?.isConnected){const delta=reading.getBoundingClientRect().top-top;if(delta){const dialog=root.closest('dialog');if(dialog)dialog.scrollTop+=delta;else window.scrollBy(0,delta);}}
}

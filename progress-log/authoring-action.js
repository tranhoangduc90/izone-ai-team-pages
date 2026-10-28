// Chỉ đổi cách hiển thị; giữ nguyên handler, trạng thái khóa và dữ liệu của nút.
export function authoringAction(node,kind,{iconOnly=false,label}={}){
 node.classList.add('thuy-authoring-action','thuy-authoring-action--'+kind);
 if(label){node.setAttribute('aria-label',label);node.title=label;}
 if(kind==='remove'){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [name,value]of Object.entries({viewBox:'0 0 24 24',width:'18',height:'18',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(name,value);
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6');svg.append(path);
  if(iconOnly){node.replaceChildren(svg);node.classList.add('thuy-authoring-icon-only');}else node.prepend(svg);
 }else if(!node.textContent.trim().startsWith('+')){
  const plus=document.createElement('span');plus.textContent='+';plus.setAttribute('aria-hidden','true');node.prepend(plus);
 }return node;
}

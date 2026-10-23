const node=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLocaleLowerCase('vi');

// Chỉ dựng danh sách đã được máy chủ cấp quyền; trạng thái lớp không suy từ số phiếu hoặc mapping.
export function renderTeacherClassPortal(root,{classes,assignments,onOpen}) {
  root.replaceChildren();
  root.append(node('h1','Quản lý lớp'));
  const tools=node('div','','thuy-class-list-tools'),filters=node('nav');filters.setAttribute('aria-label','Nhóm lớp');
  const input=node('input');input.type='search';input.placeholder='Tìm lớp';input.setAttribute('aria-label','Tìm lớp');
  const list=node('div','','thuy-class-grid'),status=node('p','','muted');status.setAttribute('role','status');
  const ongoing=classes.filter(c=>c.class_status==='on_going'),completed=classes.filter(c=>c.class_status==='completed');
  let group=ongoing.length?'on_going':'all';
  const groups=[['on_going','Đang học',ongoing.length],['completed','Lịch sử',completed.length],['all','Tất cả',classes.length]];
  function paint(){
    for(const button of filters.children)button.setAttribute('aria-pressed',String(button.dataset.group===group));
    const visible=classes.filter(c=>(group==='all'||c.class_status===group)&&normalize(c.class_name).includes(normalize(input.value)));
    const cards=visible.map(c=>{
      const card=node('button','','thuy-class-card');card.type='button';
      card.append(node('b',c.class_name),node('span',c.class_status==='on_going'?'Đang học':c.class_status==='completed'?'Đã kết thúc':'Chưa có trạng thái lớp','muted'));
      const forms=assignments.filter(a=>String(a.class_id)===String(c.class_id));
      card.append(node('small',forms.length?forms.length+' phiếu · Mở lớp →':'Chưa giao bài · Mở lớp →'));
      card.addEventListener('click',()=>onOpen(String(c.class_id)));return card;
    });
    list.replaceChildren(...cards);status.textContent=visible.length?`Đang hiển thị ${visible.length}/${classes.length} lớp được cấp quyền.`:
      classes.length?'Không có lớp phù hợp bộ lọc.':'Tài khoản chưa được cấp lớp nào.';
  }
  for(const [value,label,count]of groups){const button=node('button',`${label} (${count})`,'button');button.type='button';button.dataset.group=value;button.addEventListener('click',()=>{group=value;paint();});filters.append(button);}
  input.addEventListener('input',paint);tools.append(filters,input);root.append(tools,list,status);paint();
}

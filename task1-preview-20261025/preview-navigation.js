const tasks=await fetch('./catalog.json').then(r=>r.json());
const select=document.getElementById('preview-task-picker');
const current=new URLSearchParams(location.search).get('task')||'average-earnings-by-sector-2000-2010';
if(select){for(const task of tasks){const option=document.createElement('option');option.value=task.slug;option.textContent=task.title;option.selected=task.slug===current;select.append(option);}select.addEventListener('change',()=>{const url=new URL(location.href);url.search='';url.searchParams.set('task',select.value);location.assign(url.href);});}

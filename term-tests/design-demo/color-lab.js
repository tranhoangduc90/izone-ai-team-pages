// Bảng màu riêng cho demo: chỉ đổi CSS và lưu trên trình duyệt, không gửi dữ liệu bài làm.
(()=>{
 if(document.getElementById('demo-color-lab'))return;
 const requestedOption=new URLSearchParams(location.search).get('labOption');
 const option=['sage','mist','sand','lavender','reading'].includes(requestedOption)?requestedOption:null;
 const key='izone-demo-color-lab-v2'+(option?'-'+option:'');
 const groups=[
 ['Thẻ tiêu đề', [['header','Nền quanh nhãn','#edf1f6'],['badge','Nền nhãn Questions','#152b4e'],['badgeText','Chữ trên nhãn','#ffffff'],['hint','Chữ hướng dẫn','#273d5c'],['edge','Đường nhấn phía trên','#e8839a'],['line','Viền nhóm câu','#bbc8da']]],
 ['Nội dung', [['surface','Nền vùng bài làm','#fffefa'],['ink','Chữ nội dung','#303947']]],
 ['Nút và đáp án', [['primary','Nền nút chính','#152b4e'],['primaryText','Chữ nút chính','#ffffff'],['selected','Nền đáp án đã chọn','#eaf0f7'],['selectedText','Chữ đáp án đã chọn','#152b4e'],['selectedLine','Viền đáp án đã chọn','#8fa3bd']]],
 ['Điều hướng và trạng thái', [['rose','Nền tab / mở phân tích','#fff1f3'],['roseText','Chữ tab / mở phân tích','#9d2340'],['success','Nền trạng thái hoàn thành','#edf8f2'],['successText','Chữ trạng thái hoàn thành','#176b4b'],['flag','Nền cờ cần xem lại','#fff4cd'],['flagText','Chữ cờ cần xem lại','#795600']]]
 ];
 const fields=groups.flatMap(g=>g[1]),base=Object.fromEntries(fields.map(([id,,color])=>[id,color]));
 // Các palette cũ được đối chiếu từ CSS lưu lại; giữ bố cục và cỡ nhãn 20 px hiện tại.
 const presets=[
 ['blue','Xanh xám · phương án 2 cũ',{...base}],
 ['initial','Trắng – navy · bản đầu',{...base,header:'#f5f6f8',hint:'#596473',edge:'#dce1e7',line:'#dce1e7',surface:'#ffffff',rose:'#edf1f6',roseText:'#152b4e'}],
 ['soft','Hồng rất nhẹ · bản mở rộng',{...base,header:'#fff7f5',hint:'#354760',edge:'#c56577',line:'#e5c5cb'}],
 ['pink','Hồng rõ · phương án 1',{...base,header:'#f7e5e9',badge:'#f7e5e9',badgeText:'#85273e',hint:'#354760',edge:'#ac3451',line:'#d8a3af'}],
 ['joined','Hồng dịu + nhãn navy · phương án 3',{...base,header:'#f8edf0',hint:'#354760',edge:'#ac3451',line:'#d1b7bd'}],
 ['navy','Nền navy + nhãn hồng',{...base,header:'#243a56',badge:'#f1d2db',badgeText:'#152b4e',hint:'#e7edf4',edge:'#c67a91',line:'#cbd3de'}],
 ['warm','Xám ấm · bản gần nhất',{...base,header:'#f1f0ec',hint:'#354760',edge:'#8c9caf',line:'#d7d8d5'}]
 ];
 const alternatives=[
 // Mẫu Reading Homework buổi 7: xám trung tính, giấy trắng, navy và điểm nhấn đỏ nhỏ.
 ['reading','Reading · xám sáng–đỏ',{...base,header:'#f5f6f8',badge:'#152b4e',badgeText:'#ffffff',hint:'#586477',edge:'#db0829',line:'#dce1e7',surface:'#ffffff',ink:'#202b3b',primary:'#152b4e',primaryText:'#ffffff',selected:'#edf1f7',selectedText:'#152b4e',selectedLine:'#152b4e',rose:'#f8f9fb',roseText:'#db0829',success:'#edf8f2',successText:'#136f4a',flag:'#fff4d9',flagText:'#915900'}],
 ['sage','Sage dịu',{...base,header:'#e3ebe5',hint:'#304d40',edge:'#789b8a',line:'#bdccc2',rose:'#eaf0eb',roseText:'#345d4c',selected:'#e9f0ec',selectedLine:'#8ca799'}],
 ['mist','Xanh sương · mặc định ★',{...base,header:'#e4edf5',hint:'#304b66',edge:'#7895b5',line:'#bdcddd',rose:'#eaf0f7',roseText:'#315475',selected:'#e8eff7',selectedLine:'#8fa5bf'}],
 ['sand','Kem cát',{...base,header:'#eee7da',hint:'#554b3c',edge:'#b09873',line:'#d1c6b3',rose:'#f2ede3',roseText:'#6a5435',selected:'#eaeef3',selectedLine:'#94a3b6'}],
 ['lavender','Tím xám',{...base,header:'#eae7f1',hint:'#4e465f',edge:'#9a8aad',line:'#cdc5da',rose:'#f0edf6',roseText:'#594672',selected:'#edeaf3',selectedLine:'#aaa0bc'}]
 ];
 presets.unshift(...['mist','sage','sand','lavender','reading'].map(id=>alternatives.find(p=>p[0]===id)));
 const starting=alternatives.find(p=>p[0]===(option||'mist'));
 const initialColors=starting?starting[2]:base,initialPreset=starting?starting[0]:'blue';
 document.documentElement.dataset.labOption=option||'mist';
 if(option){document.title=starting[1]+' · '+document.title;
  document.addEventListener('click',event=>{const a=event.target.closest('a[href]');if(!a)return;const url=new URL(a.href,location.href);if(url.origin!==location.origin||!(/\/term-tests\/|design-demo\.html|real-results\.html/.test(url.pathname)))return;if(!url.searchParams.has('labOption'))url.searchParams.set('labOption',option);a.href=url.href;},true);
 }
 const normalize=s=>{s=String(s).trim();if(/^#?[\da-f]{3}$/i.test(s))s=s.replace('#','').split('').map(c=>c+c).join('');return /^#?[\da-f]{6}$/i.test(s)?'#'+s.replace('#','').toLowerCase():null;};
 let colors={...initialColors},preset=initialPreset,expanded=true;
 function read(raw){try{const x=JSON.parse(raw);if(x?.version!==1)return;colors={...initialColors};for(const [id]of fields)if(normalize(x.colors?.[id]))colors[id]=normalize(x.colors[id]);preset=presets.some(p=>p[0]===x.preset)?x.preset:'custom';}catch{}}
 try{read(localStorage.getItem(key));expanded=localStorage.getItem(key+'-open')!=='0';}catch{}
 const root=document.createElement('aside');root.id='demo-color-lab';root.setAttribute('aria-label','Thử màu giao diện');root.setAttribute('popover','manual');
 root.innerHTML='<button type="button" class="lab-launch" aria-controls="lab-panel">◉ Màu giao diện</button><section id="lab-panel"><header><div><strong>Thử màu giao diện</strong><p>Đổi màu · xem ngay trên demo</p></div><button type="button" class="lab-collapse" aria-label="Thu nhỏ bảng màu">−</button></header><div class="lab-scroll"><label class="lab-preset-label" for="lab-preset">Bộ màu đã thử</label><select id="lab-preset"></select><p class="lab-note">★ Tôi đề xuất · giữ bố cục hiện tại, chỉ đổi màu.</p><div class="lab-groups"></div></div><footer><p class="lab-status" role="status" aria-live="polite"></p><button type="button" class="lab-reset">Về Xanh sương mặc định</button><small>Tự nhớ trên trình duyệt này · chỉ áp dụng demo</small></footer></section>';
 document.body.append(root);
 const launcher=root.querySelector('.lab-launch'),panel=root.querySelector('#lab-panel'),select=root.querySelector('#lab-preset'),status=root.querySelector('.lab-status');
 for(const [id,name]of [...presets,['custom','Đang tùy chỉnh']]){const o=document.createElement('option');o.value=id;o.textContent=name;if(id==='custom')o.disabled=true;select.append(o);}
 if(option){launcher.textContent='◉ '+starting[1];root.querySelector('header strong').textContent=starting[1];root.querySelector('.lab-note').textContent='Bộ màu riêng cho tab này · đổi màu để thử ngay.';root.querySelector('footer small').textContent='Các phương án khác giữ bộ màu riêng';root.querySelector('.lab-reset').textContent='Khôi phục '+starting[1];}
 const controls=new Map();
 for(const [name,items]of groups){const d=document.createElement('details');d.open=name==='Thẻ tiêu đề';const s=document.createElement('summary');s.textContent=name;d.append(s);
  for(const [id,label]of items){const row=document.createElement('div');row.className='lab-row';const l=document.createElement('label');l.htmlFor='lab-hex-'+id;l.textContent=label;const picker=document.createElement('input');picker.type='color';picker.id='lab-color-'+id;picker.setAttribute('aria-label',label+' — chọn màu');const hex=document.createElement('input');hex.type='text';hex.id=l.htmlFor;hex.spellcheck=false;hex.maxLength=7;hex.setAttribute('aria-label',label+' — mã HEX');hex.setAttribute('aria-describedby','lab-error-'+id);const err=document.createElement('small');err.id='lab-error-'+id;err.className='lab-error';err.hidden=true;err.textContent='Nhập mã HEX, ví dụ #EDF1F6.';row.append(l,picker,hex,err);d.append(row);controls.set(id,{picker,hex,err});
   const update=value=>{colors[id]=value;preset='custom';select.value=preset;apply();save();contrast();};
   picker.addEventListener('input',()=>{hex.value=picker.value.toUpperCase();hex.removeAttribute('aria-invalid');err.hidden=true;update(picker.value);});
   hex.addEventListener('input',()=>{const c=normalize(hex.value);err.hidden=!!c;hex.setAttribute('aria-invalid',String(!c));if(c){picker.value=c;update(c);}});
   hex.addEventListener('change',()=>{const c=normalize(hex.value);if(c)hex.value=c.toUpperCase();});
  }root.querySelector('.lab-groups').append(d);
 }
 const sheet=[...document.styleSheets].find(s=>s.href?.split('?')[0].endsWith('/color-lab.css'));
 const rule=[...sheet.cssRules].find(r=>r.selectorText===':root');
 function apply(){for(const [id]of fields)rule.style.setProperty('--lab-'+id,colors[id]);}
 function sync(){for(const[id,{picker,hex,err}]of controls){picker.value=colors[id];hex.value=colors[id].toUpperCase();hex.removeAttribute('aria-invalid');err.hidden=true;}select.value=preset;apply();contrast();}
 function save(){try{localStorage.setItem(key,JSON.stringify({version:1,preset,colors}));}catch{status.textContent='Đã áp dụng; trình duyệt không cho lưu bộ màu.';}}
 function lum(hex){const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
 function contrast(){const pairs=[['nhãn','badgeText','badge'],['hướng dẫn','hint','header'],['nội dung','ink','surface'],['nút','primaryText','primary'],['đáp án','selectedText','selected'],['tab','roseText','rose'],['hoàn thành','successText','success'],['cờ','flagText','flag']];const weak=pairs.filter(([,a,b])=>(Math.max(lum(colors[a]),lum(colors[b]))+.05)/(Math.min(lum(colors[a]),lum(colors[b]))+.05)<4.5).map(x=>x[0]);status.textContent=weak.length?'Chữ khó đọc: '+weak.join(', ')+'.':'Các cặp chữ–nền đã chọn đủ tương phản.';status.dataset.warning=String(!!weak.length);}
 function setOpen(value,focus=false){expanded=value;panel.hidden=!value;launcher.hidden=value;launcher.setAttribute('aria-expanded',String(value));try{localStorage.setItem(key+'-open',value?'1':'0');}catch{}if(focus)(value?select:launcher).focus({preventScroll:true});}
 launcher.addEventListener('click',()=>setOpen(true,true));root.querySelector('.lab-collapse').addEventListener('click',()=>setOpen(false,true));root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false,true);}});
 select.addEventListener('change',()=>{const p=presets.find(p=>p[0]===select.value);if(!p)return;preset=p[0];colors={...p[2]};sync();save();});
 root.querySelector('.lab-reset').addEventListener('click',()=>{colors={...initialColors};preset=initialPreset;sync();save();});
 window.addEventListener('storage',e=>{if(e.key===key){read(e.newValue);sync();}});
 // Đặt công cụ trong dialog đang mở để vẫn dùng được khi màn nhận xét khóa phần nền.
 let host=null;
 function mount(){const dialogs=[...document.querySelectorAll('dialog[open]')];const target=dialogs.at(-1)||document.body;if(target===host)return;const active=root.contains(document.activeElement)?document.activeElement:null;if(root.matches(':popover-open'))root.hidePopover();target.append(root);host=target;if(root.showPopover)root.showPopover();if(active)active.focus({preventScroll:true});}
 new MutationObserver(mount).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 sync();setOpen(expanded);mount();
})();

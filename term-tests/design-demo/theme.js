// Một nguồn cho 19 token và mọi preset; bản sạch không đọc URL hoặc Storage.
(()=>{
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
 ['reading','Reading · xám sáng–đỏ · mặc định ★',{...base,header:'#f5f6f8',badge:'#152b4e',badgeText:'#ffffff',hint:'#586477',edge:'#db0829',line:'#dce1e7',surface:'#ffffff',ink:'#202b3b',primary:'#152b4e',primaryText:'#ffffff',selected:'#edf1f7',selectedText:'#152b4e',selectedLine:'#152b4e',rose:'#f8f9fb',roseText:'#db0829',success:'#edf8f2',successText:'#136f4a',flag:'#fff4d9',flagText:'#915900'}],
 ['sage','Sage dịu',{...base,header:'#e3ebe5',hint:'#304d40',edge:'#789b8a',line:'#bdccc2',rose:'#eaf0eb',roseText:'#345d4c',selected:'#e9f0ec',selectedLine:'#8ca799'}],
 ['mist','Xanh sương',{...base,header:'#e4edf5',hint:'#304b66',edge:'#7895b5',line:'#bdcddd',rose:'#eaf0f7',roseText:'#315475',selected:'#e8eff7',selectedLine:'#8fa5bf'}],
 ['sand','Kem cát',{...base,header:'#eee7da',hint:'#554b3c',edge:'#b09873',line:'#d1c6b3',rose:'#f2ede3',roseText:'#6a5435',selected:'#eaeef3',selectedLine:'#94a3b6'}],
 ['lavender','Tím xám',{...base,header:'#eae7f1',hint:'#4e465f',edge:'#9a8aad',line:'#cdc5da',rose:'#f0edf6',roseText:'#594672',selected:'#edeaf3',selectedLine:'#aaa0bc'}]
 ];
 presets.unshift(...['reading','mist','sage','sand','lavender'].map(id=>alternatives.find(p=>p[0]===id)));
 const normalize=s=>{s=String(s).trim();if(/^#?[\da-f]{3}$/i.test(s))s=s.replace('#','').split('').map(c=>c+c).join('');return /^#?[\da-f]{6}$/i.test(s)?'#'+s.replace('#','').toLowerCase():null;};

 const reading=alternatives.find(p=>p[0]==='reading')[2];
 function apply(colors,preset='reading'){
  const sheet=[...document.styleSheets].find(s=>s.href?.split('?')[0].endsWith('/theme.css'));
  const rule=[...sheet.cssRules].find(r=>r.selectorText===':root');
  for(const [id]of fields)rule.style.setProperty('--lab-'+id,colors[id]);
  document.documentElement.dataset.labOption=preset;
 }
 window.IZONE_DEMO_THEME={groups,fields,base,presets,alternatives,normalize,apply,reading};
 apply(reading);
})();

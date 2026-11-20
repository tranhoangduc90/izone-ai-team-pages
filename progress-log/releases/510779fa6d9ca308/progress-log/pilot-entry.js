// Chuyển lớp dùng thử đã chọn sang giao diện mới; giữ fragment và đường quay lại bản cũ.
export function pilotEntry(href,classId,kind='student',publicToken=''){
 const url=new URL(href);if(String(classId)!=='1294'||url.searchParams.get('presentation')==='legacy')return null;
 const name=kind==='teacher'?'teacher-thuy.html':'thuy.html';if(url.pathname.endsWith('/'+name))return null;
 if(kind==='student'&&url.searchParams.get('presentation')==='thuy')return null;
 const target=new URL('./'+name,url);target.search=url.search;target.hash=publicToken?'assignment='+encodeURIComponent(publicToken):url.hash;return target.href;
}

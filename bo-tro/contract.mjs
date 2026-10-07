// Nhận tên/lớp và link chia sẻ; trả payload đúng hợp đồng form Bác sĩ AI cũ.
// Dữ liệu sai được báo trước khi gửi; không chứa danh sách học viên hay credential.
export function parseLinks(text) {
  const parts=String(text).trim().split(/\s+/).filter(Boolean);
  if(!parts.length) throw new Error('Dán ít nhất một link chia sẻ bài luyện.');
  const links=[];
  for(const part of parts){
    let url;
    try{url=new URL(part);}catch{throw new Error('Link chưa hợp lệ. Hãy sao chép đầy đủ link chia sẻ từ ChatGPT.');}
    if(url.protocol!=='https:'||!['chatgpt.com','chat.openai.com'].includes(url.hostname)||url.username||url.password||url.port||!/^\/share\/[A-Za-z0-9-]+\/?$/.test(url.pathname)){
      throw new Error('Dùng link chia sẻ ChatGPT dạng https://chatgpt.com/share/…; link cuộc trò chuyện riêng /c/ không dùng được.');
    }
    url.search='';url.hash='';const link=url.href.replace(/\/$/,'');
    if(!links.includes(link))links.push(link);
  }
  if(links.length>10)throw new Error('Mỗi lần gửi tối đa 10 link. Hãy chia thành các lượt nhỏ hơn.');
  return links;
}
export function buildPayload(classCode,studentName,links){
  const name=String(studentName).normalize('NFC').trim().replace(/\s+/g,' ');
  if(classCode!=='IC2314')throw new Error('Link lớp chưa hợp lệ. Hãy mở link IC2314 do giáo viên gửi.');
  if(name.length<3||name.length>96||/[<>\u0000-\u001f]/.test(name))throw new Error('Nhập đầy đủ họ tên như trong bảng bài tập.');
  if(!Array.isArray(links)||!links.length)throw new Error('Chưa có link chia sẻ hợp lệ.');
  return {records:parseLinks(links.join('\n')).map(link=>({fields:{'Lớp':classCode,'Học viên':name,'Bài luyện tập':link}}))};
}
export async function sendSubmission(payload,fetcher=fetch){
  // Phản hồi HTTP xác nhận nhận yêu cầu; chưa chứng minh AI đã xử lý hay ghi xong.
  const response=await fetcher('https://ducizone.ddns.net/webhook/0510dc1f-669b-4fa8-be7a-31d596f562a9',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)
  });
  if(!response.ok)throw new Error('Hệ thống chưa xác nhận nhận bài (HTTP '+response.status+').');
  const text=await response.text();
  try{const result=JSON.parse(text);if(result.error||result.success===false||result.ok===false||(typeof result.code==='number'&&result.code!==0))throw new Error('Hệ thống báo lỗi nhận bài.');}
  catch(error){if(!(error instanceof SyntaxError))throw error;}
  return {state:'received'};
}

// Chỉ hiển thị điểm chính thức khi backend đã đọc lại receipt đúng lượt.
export function portalStatus(value){
 const grade=value.portalGrade,state=value.portalState,valid=Number.isFinite(grade?.value)&&Number.isFinite(grade?.max)&&grade.value>=0&&grade.max>0&&grade.value<=grade.max&&grade.retained===(state==='kept');
 if(valid&&state==='confirmed')return `Đã xác nhận điểm chính thức ${grade.value} / ${grade.max} trên Portal.`;
 if(valid&&state==='kept')return `Giữ điểm chính thức ${grade.value} / ${grade.max} trên Portal vì điểm bài bù không cao hơn.`;
 return {confirmed:'Đã xác nhận ghi điểm Portal.',kept:'Giữ điểm chính thức hiện có vì điểm bù không cao hơn.',hold:'Kết quả được giữ. Điểm Portal đang chờ đối soát.',pending:'Đang chờ ghi điểm Portal.',unknown:'Đang xác minh yêu cầu ghi điểm Portal.'}[state]||'Điểm Portal chưa được xác nhận.';
}

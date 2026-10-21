// Chỉ đổi chữ trên bài xem lại; không suy điểm hoặc sửa kết quả chấm nguồn.
export function studentReviewLabel(item,verdict,{snapshot=false}={}){
  if(!['ungraded','blank','pending'].includes(verdict))return null;
  if(item.interactionType==='number_score')return verdict==='blank'?'Số câu tự báo · Để trống':'Số câu tự báo';
  if(item.graderType==='none')return 'Không chấm đúng/sai';
  if(verdict!=='ungraded')return null;
  return snapshot?'Bản chụp thiếu kết quả chấm':'Chưa có kết quả chấm';
}

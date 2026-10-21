// Dữ liệu giả chỉ để thử bảng và chi tiết Listening/Reading; không sửa bản chụp lớp.
// Dùng cùng hàm tính nhãn với học viên thật, không gắn nhãn bằng tay.
import {priority} from './model.mjs';

export const journeyScenarios = [
  {id:'low', name:'Học viên giả A · Dưới ngưỡng', values:[40,55,50], note:'Ba buổi gần nhất dưới 60%: có nhãn ưu tiên.'},
  {id:'decline', name:'Học viên giả B · Mới giảm', values:[90,85,80,40,45,50], note:'TB cả khóa 65%, nhưng ba buổi gần nhất 45%: vẫn có nhãn ưu tiên.'},
  {id:'recovery', name:'Học viên giả C · Đã tiến bộ', values:[40,45,45,70,75,80], note:'TB cả khóa khoảng 59,2%, nhưng ba buổi gần nhất 75%: không có nhãn ưu tiên.'},
  {id:'boundary', name:'Học viên giả D · Đúng 60%', values:[60,60,60], note:'Đúng 60% không phải dưới 60%: không có nhãn ưu tiên.'},
  {id:'insufficient', name:'Học viên giả E · Chưa đủ ba buổi', values:[40,50,null], note:'Buổi 10 thiếu số liệu; hai buổi hợp lệ không đủ để xét nhãn, không tự thêm 0%.'},
  {id:'zero', name:'Học viên giả F · Có điểm 0%', values:[0,50,50], note:'0% là số liệu hợp lệ, khác với ô thiếu: TB ba buổi khoảng 33,3%, có nhãn ưu tiên.'},
  {id:'missing', name:'Học viên giả G · Chưa có dữ liệu', values:[null,null,null], note:'Chưa có số liệu: hiện dấu — và nằm trong bộ lọc Chưa có dữ liệu; không có nhãn ưu tiên.'},
].map(value=>({...value, studentRef:`journey-scenario-${value.id}`, synthetic:true,
  reports:value.values.map((percent,index)=>({sessionNumber:(value.values.length===6?[2,3,4,8,9,10]:[8,9,10])[index],percent}))}));

export function scenarioSummary(person,skill){
  return priority(['listening','reading'].includes(skill)?person.reports:[]);
}

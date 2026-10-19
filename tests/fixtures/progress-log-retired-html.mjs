// Đọc nguyên mẫu đã thu hồi từ revision cố định để kiểm các module lịch sử còn giữ.
// Chỉ phục vụ trong HTTP localhost của test; không ghi lại HTML vào route hoặc thêm bản sao public.
// Checkout thiếu lịch sử Git báo lỗi rõ; helper không fetch mạng hay đọc cấu hình riêng.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repository=fileURLToPath(new URL('../../',import.meta.url));
const revision='12e5dd611cca7ae6683eec7c8fd354d1fc847ec3^';
const retired=new Set([
  'progress-log/reference-preview/index.html',
  'progress-log/reference-preview-v2/index.html',
  'progress-log-ic2305-demo/index.html',
  'progress-log-ic2305-demo/teacher.html'
]);
export function retiredProgressLogHtml(path){
  if(!retired.has(path))throw new Error('Chỉ được đọc bốn HTML Progress Log đã thu hồi.');
  try{return execFileSync('git',['show',revision+':'+path],{cwd:repository,encoding:'utf8',maxBuffer:256*1024,stdio:['ignore','pipe','pipe']});}
  catch(error){throw new Error('Bộ kiểm mẫu cần lịch sử Git trước commit thu hồi 12e5dd6; hãy dùng checkout đầy đủ.',{cause:error});}
}

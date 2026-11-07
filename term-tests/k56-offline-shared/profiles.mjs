// Cấu hình đóng theo bài; không lấy namespace/quyền/Task từ query hoặc input học viên.
const numbers=n=>Array.from({length:n},(_,i)=>String(i+1));
export const TERM2_PROFILE=Object.freeze({slug:'term-test-2-k56',policy:'term2-offline-v1',build:'term2-offline-20261106-v1',dbName:'izone-term2-k56-v1',localPrefix:'term2-k56:',lockPrefix:'term2:',runPrefix:'term2-',filePrefix:'Term-Test-2-K56',taskId:'task1',taskLabel:'Writing Task 1',exportTitle:'Bài làm Term Test 2 · Khóa 56',pageTitle:'Bài làm Term Test 2 K56',cause:'term2_offline',answerKeys:{listening:numbers(40),reading:numbers(40)}});
export const TERM1_PROFILE=Object.freeze({slug:'term-test-1-k56',policy:'term1-offline-v1',build:'term1-offline-20261107-v1',dbName:'izone-term1-k56-v1',localPrefix:'term1-k56:',lockPrefix:'term1:',runPrefix:'term1-',filePrefix:'Term-Test-1-K56',taskId:'task2',taskLabel:'Writing Task 2',exportTitle:'Bài làm Term Test 1 · Khóa 56',pageTitle:'Bài làm Term Test 1 K56',cause:'term1_offline',answerKeys:{listening:[...numbers(31),'32a','32b',...numbers(40).slice(32)],reading:numbers(26)}});
const miniProfile={slug:'mini-test-k56',policy:'mini-k56-offline-v1',taskId:'task2',taskLabel:'Writing · Đoạn văn',
 exportTitle:'Bài làm Mini Test · Khóa 56',pageTitle:'Bài làm Mini Test K56',cause:'mini_k56_offline',answerKeys:{listening:numbers(10),reading:numbers(13)}};
export const MINI_CBT_PROFILE=Object.freeze({...miniProfile,build:'mini-k56-cbt-offline-v1',
 dbName:'izone-mini-k56-cbt-v1',localPrefix:'mini-k56-cbt:',lockPrefix:'mini-k56:',runPrefix:'mini-cbt-',filePrefix:'Mini-Test-K56-CBT'});
export const MINI_PAPER_PROFILE=Object.freeze({...miniProfile,paper:true,build:'mini-k56-paper-offline-v1',
 dbName:'izone-mini-k56-paper-v1',localPrefix:'mini-k56-paper:',lockPrefix:'mini-k56:',runPrefix:'mini-paper-',filePrefix:'Mini-Test-K56-Phieu-Giay'});

// Nhận cấu hình hoặc phiên đã lưu; giữ phiên cũ theo B → A → X.
// Hai ý chấm cả chuỗi dùng ba phần thật, không tạo trạng thái đạt giả từng ô.
export const GUIDED='guided-bax-v1', WHOLE='whole-chain-v1';
export const ORDER=['topic','b1','a1','x1','b2','a2','x2'];
export const FIELDS={topic:['idea1','idea2','topicSentence'],b1:['b1'],a1:['a1'],x1:['x1'],b2:['b2'],a2:['a2'],x2:['x2']};
const whole={order:['topic','si1','si2'],fields:{topic:FIELDS.topic,si1:['a1','x1','b1'],si2:['a2','x2','b2']}};
export function workflowFor(value={}){
  const mode=value.workflowMode||GUIDED;
  if(![GUIDED,WHOLE].includes(mode))throw new Error('WORKFLOW_INVALID');
  return mode===WHOLE?whole:{order:ORDER,fields:FIELDS};
}
export const isWhole=s=>s.workflowMode===WHOLE;
export const sectionFor=(s,field)=>workflowFor(s).order.find(k=>workflowFor(s).fields[k].includes(field));
export const ideaPassed=(s,n)=>isWhole(s)?s.steps['si'+n]?.status==='passed':['b','a','x'].every(k=>s.steps[k+n]?.status==='passed');
export const available=(s,key)=>{const order=workflowFor(s).order,i=order.indexOf(key);return i>=0&&(i===0||s.steps[order[i-1]]?.status==='passed')&&(!key.endsWith('2')||s.idea2Open);};
export const vocabEligible=(s,n)=>isWhole(s)?n===0&&ideaPassed(s,1)&&ideaPassed(s,2):[1,2].includes(n)&&ideaPassed(s,n);
export const vocabFields=n=>(n===0?[1,2]:[n]).flatMap(i=>['a','x','b'].map(k=>k+i));

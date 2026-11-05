const redundantInstruction='Trả lời ngắn gọn theo trải nghiệm thật của em.';

export function studentInstructions(value=''){
  if(!value.includes(redundantInstruction))return value;
  return value.replaceAll(redundantInstruction,'').replace(/^[ \t]*\r?\n/gmu,'').trim();
}

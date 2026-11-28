export const lesson7Experience = assignment => assignment?.experience==='lesson7-information-writing-v1';
export const guidedWritingExperience = assignment => assignment?.experience==='lesson5-consumerism-body-v1'||lesson7Experience(assignment);

export const wordCount=text=>text.trim()?text.trim().split(/\s+/u).length:0;

export function splitWritingParts(text) {
  const separator=text.indexOf('\n\n');
  return separator<0?[text,'']:[text.slice(0,separator),text.slice(separator+2)];
}

export function joinWritingParts(intro,body2) {
  const paragraph=value=>value.replace(/\r\n/g,'\n').replace(/\n[\t ]*\n+/g,'\n').trim();
  return paragraph(intro)+'\n\n'+paragraph(body2);
}

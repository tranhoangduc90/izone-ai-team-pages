const base = 'https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/';
export const partLabels = Object.freeze({
  full: 'Toàn bài', listening: 'Listening', reading: 'Reading', writing: 'Writing',
});
const legacy = Object.freeze({
  'substitute-test-1-k56-listening-makeup':'ic2311-listening-retake-substitute1-k56/?course=56',
  'substitute-test-1-k56-reading-makeup':'ic2311-reading-retake-substitute1-k56/',
  'substitute-test-1-k67-listening-makeup':'k67-term1-listening-makeup-substitute1/',
});

export function assignmentTest(course, exam, skill) {
  if (![56,67].includes(course) || ![1,2].includes(exam) || !Object.hasOwn(partLabels,skill)) {
    throw new Error('INVALID_TEST_SCOPE');
  }
  const sourceSlug = `substitute-test-${exam}-k${course}`;
  const testId = skill === 'full' ? sourceSlug : `${sourceSlug}-${skill}-makeup`;
  return {course,exam,skill,sourceSlug,testId};
}

export const assignmentCatalog = Object.freeze([56,67].flatMap(course => [1,2].flatMap(exam =>
  Object.keys(partLabels).map(skill => {
    const test = assignmentTest(course,exam,skill);
    const family = skill==='full' ? 'full' : Object.hasOwn(legacy,test.testId) ? 'legacy' : 'skill';
    const path = family==='full' ? test.sourceSlug+'-computer-based/?demo=exam&grading=server' :
      legacy[test.testId] ?? test.testId+'/';
    return Object.freeze({...test,family,partLabel:partLabels[skill],studentUrl:new URL(path,base).href});
  }))));

export function findAssignmentTest(testId) {
  return assignmentCatalog.find(test=>test.testId===testId);
}

import { lesson5Code } from './lesson-5-parts.js';
import { lesson9Code } from './lesson-9-parts.js';

const routes = new Map([
  [lesson5Code, 5],
  [`${lesson5Code}-clone`, 5],
  [lesson9Code, 9],
  [`${lesson9Code}-clone`, 9]
]);

export function resolveSpeakingCta(search, currentLesson) {
  const query = new URLSearchParams(search);
  const codes = [...new Set(query.getAll('assignmentCode'))];
  const scopedPage = currentLesson === 5 || currentLesson === 9;
  const scopedCode = codes.some(code => routes.has(code) || code.endsWith('-clone')
    || code.startsWith(`${lesson5Code}-`) || code.startsWith(`${lesson9Code}-`));
  if (!scopedPage && !scopedCode) return { status: 'legacy' };
  if (scopedPage && !codes.length && !query.has('documentId')) return { status: 'legacy' };
  const lesson = codes.length === 1 ? routes.get(codes[0]) : undefined;
  if (!lesson) return { status: 'invalid' };
  return { status: 'valid', lesson, code: codes[0] };
}

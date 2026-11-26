import { lesson5Code } from './lesson-5-parts.js';
import { lesson6Code } from './lesson-6-parts.js';
import { lesson7Code } from './lesson-7-parts.js';
import { lesson9Code } from './lesson-9-parts.js';

const originals = [
  [lesson5Code, 5],
  [lesson6Code, 6],
  [lesson7Code, 7],
  [lesson9Code, 9]
];
const routes = new Map(originals.flatMap(([code, lesson]) => [[code, lesson], [`${code}-clone`, lesson]]));
const scopedLessons = new Set(originals.map(([, lesson]) => lesson));

export function resolveSpeakingCta(search, currentLesson) {
  const query = new URLSearchParams(search);
  const codes = [...new Set(query.getAll('assignmentCode'))];
  const scopedPage = scopedLessons.has(currentLesson);
  const scopedCode = codes.some(code => routes.has(code) || code.endsWith('-clone')
    || originals.some(([original]) => code.startsWith(`${original}-`)));
  if (!scopedPage && !scopedCode) return { status: 'legacy' };
  if (scopedPage && !codes.length && !query.has('documentId')) return { status: 'legacy' };
  const lesson = codes.length === 1 ? routes.get(codes[0]) : undefined;
  if (!lesson) return { status: 'invalid' };
  return { status: 'valid', lesson, code: codes[0] };
}

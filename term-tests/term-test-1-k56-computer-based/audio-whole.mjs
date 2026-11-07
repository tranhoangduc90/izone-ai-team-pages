import {downloadTermAudio} from '../k56-offline-shared/whole-audio.mjs?v=20261107-k56-r2-v1';

export const AUDIO=Object.freeze({
 bytes:29559371,
 sha256:'c7766f97758ec5ecdd3b69dfd3f762567a50bdbb0fd38930a2b609879e8439fc',
 pagesUrl:'https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/k56-audio-assets/term-test-1-k56-c7766f97758ec5ec.mp3'
});
export function downloadWhole(options){
 return downloadTermAudio('term-test-1-k56',AUDIO,options);
}

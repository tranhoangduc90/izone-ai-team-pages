import {downloadTermAudio} from '../k56-offline-shared/whole-audio-audio-status-v1.mjs?v=20261111-audio-milestones-v2';

export const AUDIO=Object.freeze({
 bytes:29173785,
 sha256:'3600563c0af62fd5c9656be0d7b7f52a1bae281d6af1de80ba4fe0de523f92af',
 pagesUrl:'https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/k56-audio-assets/term-test-2-k56-3600563c0af62fd5.mp3'
});
export function downloadWhole(options){
 return downloadTermAudio('term-test-2-k56',AUDIO,options);
}

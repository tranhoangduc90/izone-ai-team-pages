import {downloadTermAudio} from '../k56-offline-shared/whole-audio.mjs?v=20261107-mini-v1';

const AUDIO=Object.freeze({
 bytes:2228297,
 sha256:'93a3901c37fb37a8eb2ec989ef8d382810d4dc99e6b6506a8377fac68dc756ab',
 pagesUrl:'https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/k56-audio-assets/mini-test-k56-93a3901c37fb37a8.mp3'
});
export function downloadWhole(options){
 return downloadTermAudio('mini-test-k56',AUDIO,options);
}

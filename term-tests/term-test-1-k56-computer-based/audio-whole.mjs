// Pages trước, Cloudinary dự phòng; cùng file đã đối chiếu SHA-256.
export const AUDIO={"bytes":29559371,"sha256":"c7766f97758ec5ecdd3b69dfd3f762567a50bdbb0fd38930a2b609879e8439fc","sources":["https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/k56-audio-assets/term-test-1-k56-c7766f97758ec5ec.mp3","https://res.cloudinary.com/dhvgrthes/video/upload/v1794019036/term-test-1-k56-c7766f97758ec5ec_reetr8.mp3"]};
import {downloadWhole as download} from '../k56-offline-shared/whole-audio.mjs';
export function downloadWhole(options={}){const {sources=AUDIO.sources,metadata=AUDIO,...rest}=options;return download({sources,metadata,...rest});}

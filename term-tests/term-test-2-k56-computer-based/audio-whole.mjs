// Tải nguyên file trước thi: Pages trước, Cloudinary dự phòng; không giữ quyền API.
export const AUDIO={bytes:29173785,sha256:'3600563c0af62fd5c9656be0d7b7f52a1bae281d6af1de80ba4fe0de523f92af',
 sources:['https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/k56-audio-assets/term-test-2-k56-3600563c0af62fd5.mp3','https://res.cloudinary.com/dhvgrthes/video/upload/v1793958877/term-test-2-k56_kqfl62.mp3']};
import {downloadWhole as download} from '../k56-offline-shared/whole-audio.mjs';
export function downloadWhole(options={}){const {sources=AUDIO.sources,metadata=AUDIO,...rest}=options;return download({sources,metadata,...rest});}

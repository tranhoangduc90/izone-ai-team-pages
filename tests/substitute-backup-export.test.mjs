import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeSubstituteBackup} from '../term-tests/substitute-shared/backup-export.mjs';

test('backup retains draft and sealed responses, while omitting tokens, keys and graded result data',async()=>{
 const auth={offlinePermit:'PRIVATE_PERMIT',examSessionToken:'PRIVATE_SESSION',audioPreparationToken:'PRIVATE_AUDIO'};
 const scope={testSlug:'substitute-test-2-k67',classCode:'DEMO',studentRef:'fixture',clientRunId:'12345678-0000',
  deviceId:'PRIVATE_DEVICE',historyEpoch:'PRIVATE_EPOCH'};
 const lobby={...auth,studentName:'Học viên giả',examOrder:'reading-first'};
 const app={...auth,drafts:{reading:{1:'answer-one',2:['second-a','second-b'],3:{correctAnswer:'PRIVATE_KEY'},'12a':'paired-answer'},
  writing:{task1:'<script>draft</script>',outline:'PRIVATE_OUTLINE'}},
  result:{question:'PRIVATE_PROMPT',correctAnswer:'PRIVATE_KEY'}};
 const sections=[{skill:'reading',answers:{4:'sealed-answer'},status:'acknowledged',acknowledgedAt:100,
  receipt:{payload:'PRIVATE_RECEIPT'},scope}];
 const writing={payload:{...auth,task2:'sealed-essay',correctAnswer:'PRIVATE_KEY'},status:'pending'};
 const {blob,name}=makeSubstituteBackup({scope,lobby,app,sections,writing,title:'Bài làm giả'});
 const html=await blob.text();
 for(const value of ['reading-first','answer-one','second-a','second-b','paired-answer','sealed-answer','acknowledged',
  '&lt;script&gt;draft&lt;/script&gt;','sealed-essay','pending','Học viên giả'])assert.ok(html.includes(value));
 assert.ok(!/PRIVATE_|offlinePermit|examSessionToken|audioPreparationToken|<script>/.test(html));
 assert.equal(name,'substitute-test-2-k67-DEMO-fixture-12345678.html');
});

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { startFixture, learners, lessons } from './fixtures/speaking-draft-server.mjs';

// Dùng trang thật và dữ liệu giả: quyền công nhận, đổi link và lỗi đọc phải hiện đúng.
// Không gọi API hoặc gửi bài học viên. Kết quả và ảnh nằm trong kho kiểm riêng.
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const output=process.env.SPEAKING_EVIDENCE_DIR||join(root,'output/playwright/speaking-fairness');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const results=[];
try {
  for(const lesson of lessons.filter(l=>!process.env.SPEAKING_LESSONS||process.env.SPEAKING_LESSONS.split(',').includes(String(l.number)))) for(const width of [390,1440]) {
    const fixture=await startFixture(root,{status:'accepted',seedAll:true});
    const record=fixture.record(lesson,learners[0]);
    const part=lesson.number===6?lesson.parts[1]:lesson.parts[0];
    const first=record.links.get(part);
    first.question_count=0;first.evidence={acceptanceBasis:'chatbot_completion',countVerified:false,recoveryId:'fixture'};
    if(lesson.number>=4) record.practice.get(1).evidence=first.evidence;
    const context=await browser.newContext({viewport:{width,height:1000}});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(`${fixture.origin}/speaking-homework/${lesson.file}`);
      await page.locator('#class-select').selectOption('IC2304');
      await page.locator('#student-select').selectOption(learners[0]);
      await page.locator('#open-homework').click();
      await page.locator('#homework-content').waitFor({state:'visible'});
      const result=page.locator(`#${part}-result`);
      assert.match(await result.innerText(),/Chatbot đã xác nhận|Chatbot đã xác nhận/i);
      assert.doesNotMatch(await result.innerText(),/0.*câu|0\/|chưa đủ/iu);
      assert.equal(fixture.requests.some(r=>r.path==='/finish'),false,'Không tự nộp hộ');
      if(lesson.number===8) await page.locator(`#${part}-card`).screenshot({path:join(output,`accepted-card-${width}.png`)});
      if(lesson.number>=4) assert.match(await page.locator('#practice-1-result').innerText(),/không cần làm thêm/);
      await page.locator(`#${part}-link`).fill('https://chatgpt.com/share/00000000-0000-4000-8000-000000000099');
      assert.equal(await result.isVisible(),false,'Đổi link không giữ kết quả nhận của link cũ');
      await page.locator(`#${part}-link`).fill(first.share_url);
      assert.equal(await page.locator('#ready-submit-card').isVisible(),true);
      await page.locator('#submit-homework').click();
      await page.locator('#completion-card').waitFor({state:'visible'});
      assert.equal(fixture.requests.filter(r=>r.path==='/finish').length,1,'Chỉ nộp khi học viên bấm nút');
      assert.equal(fixture.requests.find(r=>r.path==='/finish').body.manualSubmit,true,'Gửi ý định nộp rõ ràng cho API');
      assert.deepEqual(errors,[]);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if(lesson.number===7) await page.screenshot({path:join(output,`completion-${width}.png`),fullPage:true});
      results.push({lesson:lesson.number,width,outcome:'passed'});
    }catch(error){results.push({lesson:lesson.number,width,outcome:'failed',error:error.message,
      identityMessage:await page.locator('#identity-message').innerText().catch(()=>''),requests:fixture.requests.map(r=>({path:r.path,assignmentCode:r.body.assignmentCode}))});}
    finally{await context.close();await fixture.close();}
  }
}finally{await browser.close();await writeFile(join(output,'completion-feedback.json'),JSON.stringify(results,null,2),'utf8');}
console.log(JSON.stringify({tests:results.length,passed:results.filter(r=>r.outcome==='passed').length,failures:results.filter(r=>r.outcome==='failed')}));
if(results.some(r=>r.outcome==='failed'))process.exitCode=1;

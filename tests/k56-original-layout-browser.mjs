// Bổ sung từ phản hồi của Linh: skin không được đổi cách tổ chức đề K56 cũ.
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium, serve, readingPage, slugs} from './helpers/k56-design-fixture.mjs';
let browser, server;
before(async()=>{server=await serve();browser=await chromium.launch({channel:'msedge',headless:true});});
after(async()=>{await browser?.close();await server?.close();});
for(const slug of slugs)test(slug+': giữ bố cục đề K56 trước redesign',async()=>{
  const f=await readingPage(browser,server.base,slug);
  try{
    const section=f.page.locator('.cbt-reading-section:not([hidden])');
    const ratio=await section.evaluate(el=>el.firstElementChild.getBoundingClientRect().width/el.getBoundingClientRect().width);
    assert(Math.abs(ratio-.5)<.01,'Reading phải giữ hai cột bằng nhau như K56 cũ');
    const badge = section.locator('.cbt-section-intro > span').first();
    assert.equal(await badge.evaluate(el=>el.getBoundingClientRect().bottom<=el.parentElement.querySelector('p').getBoundingClientRect().top),true,'Nhãn nhóm nằm trước hướng dẫn, không che hoặc nhập vào nội dung');
    assert.equal(await f.page.locator('.k56-reading-switch').count(),0,'Không thêm bước đổi vùng vào luồng cũ');
    await f.page.setViewportSize({width:390,height:844});
    assert.equal(await section.locator('.cbt-reading-passage').isVisible(),true);
    assert.equal(await section.locator('.cbt-reading-questions').isVisible(),true);
    const bounds=await section.evaluate(el=>[...el.children].map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom};}));
    assert(bounds[1].top>=bounds[0].bottom-1,'Màn hẹp giữ bài đọc trước câu hỏi, cả hai cùng hiện');
  }finally{await f.close();}
  const paper=await readingPage(browser,server.base,slug,'lis_first','');
  try{
    const fields=paper.page.locator('#readingQuestions .question');
    const positions=await fields.evaluateAll(nodes=>nodes.slice(0,2).map(n=>{const r=n.getBoundingClientRect();return {left:r.left,top:r.top};}));
    assert(Math.abs(positions[0].left-positions[1].left)<2&&positions[1].top>positions[0].top,'Phiếu giữ thứ tự câu từ trên xuống theo cột như trước');
    for(const width of [801,800,799,701,700,699]){
      await paper.page.setViewportSize({width,height:844});
      const grid=paper.page.locator('#readingQuestions');
      const columns=await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').map(Number.parseFloat));
      assert.equal(columns.length,width>700?2:1,'Đúng breakpoint phiếu cũ ở '+width);
      if(width>700)assert(Math.abs(columns[0]-columns[1])<1,'Hai cột phiếu phải đều, không có cột implicit ở '+width);
    }
  }finally{await paper.close();}
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1366,height:768}});
  try{
    await context.route('**/*',r=>r.request().url().startsWith(server.base)?r.continue():r.abort());
    const page=await context.newPage();
    await page.goto(server.base+'term-tests/'+slug+'-computer-based/?demo=writing&class=CODEXDEMO56');
    await page.locator('#writingView').waitFor({state:'visible'});
    const value=await page.locator('.writing-separator').first().getAttribute('aria-valuenow');
    assert.equal(Number(value),slug==='term-test-1-k56'?44:50,'Writing giữ tỷ lệ của đề gốc khi chưa có preference');
  }finally{await context.close();}
});

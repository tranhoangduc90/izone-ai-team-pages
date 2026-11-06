import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

// Cache fresh của bản ngay trước thay đổi không được che app mới.
const base='13fb721783ca0d2e5d5a14fadd47fbf02324ad93';
const oldFile=p=>execFileSync('git',['show',`${base}:${p}`],{encoding:'utf8'});
const newFile=p=>fs.readFileSync(p,'utf8');
const normalize=s=>s.replaceAll('\r\n','\n');
const scripts=s=>[...s.matchAll(/src="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
const dynamic=s=>[...s.matchAll(/loadScript\('([^']+)'\)/g)].map(m=>m[1]);
const cases=[['term-test-1-k56','k56-shared'],['term-test-2-k56','k56-test2-shared'],
  ['mini-test-k56','k56-mini-shared'],['substitute-test-1-k56','substitute-k56-shared'],
  ['substitute-test-2-k56','substitute-test-2-k56-shared']];
for(const [slug,engine] of cases) for(const delivery of slug.startsWith('substitute')?['-computer-based']:['','-computer-based']) {
  test(`${slug}${delivery}: vượt cache cũ và nạp đúng app đã bỏ outline`,()=>{
    const route=new URL(`https://fixture.invalid/term-tests/${slug}${delivery}/`);
    function graph(read){
      const queue=scripts(read(route.pathname.slice(1)+'index.html')).map(s=>new URL(s,route));
      const entries=[];
      while(queue.length){const url=queue.shift(),body=read(url.pathname.slice(1));entries.push({url,body});
        if(url.pathname.endsWith('/bootstrap.js'))queue.push(...dynamic(body).map(s=>new URL(s,route)));
      }return entries;
    }
    const cache=new Map(graph(oldFile).map(row=>[row.url.href,row.body]));
    const queue=scripts(newFile(route.pathname.slice(1)+'index.html')).map(s=>new URL(s,route));
    const apps=[];
    while(queue.length){
      const url=queue.shift(),body=cache.get(url.href)??newFile(url.pathname.slice(1));
      if(url.pathname.endsWith('/bootstrap.js'))queue.push(...dynamic(body).map(s=>new URL(s,route)));
      if(url.pathname===`/term-tests/${engine}/app.js`)apps.push(body);
    }
    assert.ok(apps.length,'Phải đi đến app thật qua entry/bootstrap');
    for(const body of apps)assert.equal(normalize(body),normalize(newFile(`term-tests/${engine}/app.js`)));
    // Thời gian và đề không bị sửa cùng giao diện.
    const content=`term-tests/${slug}-computer-based/content.js`;
    assert.equal(normalize(newFile(content)),normalize(oldFile(content)));
  });
}

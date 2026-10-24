// Embed the observer in an already required asset: no new blocking script request.
// --write updates only the marked suffix; default/--check verifies generated copies.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=new URL('../term-tests/',import.meta.url),marker='\n// BEGIN GENERATED EXAM JOURNAL STARTUP v1\n';
const source=fs.readFileSync(new URL('shared/exam-journal/lobby-capture.js',base),'utf8').replace(/\r\n/g,'\n').trimEnd();
export const targets=['term-test-1','term-test-2','mini-test-lesson-5','term-test-1-k56','term-test-2-k56','mini-test-k56',
 'substitute-test-1-k67','substitute-test-2-k67','substitute-test-1-k56','substitute-test-2-k56'];
for(const target of targets){
 const file=new URL(target+'/test-config.js',base),current=fs.readFileSync(file,'utf8');
 const newline=current.includes('\r\n')?'\r\n':'\n';
 const prefix=current.split(/\r?\n\/\/ BEGIN GENERATED EXAM JOURNAL STARTUP v1\r?\n/)[0].trimEnd();
 const expected=prefix+(marker+source+'\n// END GENERATED EXAM JOURNAL STARTUP v1\n').replace(/\n/g,newline);
 if(process.argv.includes('--write'))fs.writeFileSync(file,expected);
 else assert.equal(current.replace(/\r\n/g,'\n'),expected.replace(/\r\n/g,'\n'),'Startup observer bundle drift: '+target);
}
console.log(JSON.stringify({startupBundles:targets.length,status:process.argv.includes('--write')?'written':'PASS'}));

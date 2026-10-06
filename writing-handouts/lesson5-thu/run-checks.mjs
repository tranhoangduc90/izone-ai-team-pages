import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Nhận tên lượt kiểm, chạy toàn bộ native test của giao diện bằng dữ liệu giả.
// Giữ ID, stdout/stderr và revision thật; lỗi hoặc thiếu inventory không được báo đạt.
const root=process.cwd(),runId=process.argv[2];
if(!/^[a-zA-Z0-9_-]+$/.test(runId||''))throw new Error('Cần tên lượt kiểm hợp lệ.');
const files=['writing-handouts/lesson5-demo/core.test.mjs','writing-handouts/lesson5-thu/client.test.mjs','writing-handouts/lesson5-thu/ui-races.test.mjs','writing-handouts/lesson5/teacher.test.mjs','writing-handouts/lesson5-thu/recovery-ui.test.mjs','writing-handouts/lesson5-thu/features.test.mjs'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const fingerprint=()=>{
 const p=spawnSync('C:/Python314/python.exe',['-X','utf8','C:/Users/ADMIN/.codex/hooks/enforce_product_process.py','fingerprint','--root',root,'--manifest',root+'/.codex/product-quality-gate.json'],{encoding:'utf8'});
 if(p.status!==0)throw new Error(p.stdout+p.stderr);return JSON.parse(p.stdout).tree_revision;
};
const before=fingerprint(),argv=[process.execPath,'--test','--test-reporter=tap',...files];
const native=spawnSync(argv[0],argv.slice(1),{cwd:root,encoding:'utf8',timeout:300000,maxBuffer:32*1024*1024});
const output=native.stdout||'',errors=native.stderr||'';
const tests=[...output.matchAll(/^(not ok|ok) \d+ - (.+)$/gm)].map(m=>({id:m[2].replace(/ # (SKIP|TODO).*$/,''),passed:m[1]==='ok',skipped:/ # (SKIP|TODO)/.test(m[2])}));
const counter=k=>Number(output.match(new RegExp('^# '+k+' (\\d+)$','m'))?.[1]??NaN);
const after=fingerprint(),passed=counter('pass'),failed=counter('fail'),skipped=counter('skipped');
const inventoryValid=tests.length===counter('tests')&&new Set(tests.map(t=>t.id)).size===tests.length;
const outcome=native.status===0&&failed===0&&skipped===0&&inventoryValid&&before===after?'passed':'failed';
const dir=path.join(root,'.codex/product-evidence',runId);fs.mkdirSync(dir,{recursive:true});
const save=(name,content)=>{const file=path.join(dir,name);fs.writeFileSync(file,content,'utf8');return {path:file,sha256:digest(fs.readFileSync(file))};};
save('receipt.json',JSON.stringify({run_id:runId,command:argv.map(a=>/\s/.test(a)?'"'+a+'"':a).join(' '),argv,cwd:root,tree_revision:before,revision_after:after,captured_at:new Date().toISOString(),exit_code:native.status??1,outcome,passed,failed,skipped,inventory_valid:inventoryValid,executed_test_ids:tests.map(t=>t.id),tests,stdout:save('stdout.tap',output),stderr:save('stderr.txt',errors),runner_fingerprint:digest(fs.readFileSync(new URL(import.meta.url))),environment_fingerprint:digest(JSON.stringify({node:process.version,platform:os.platform(),arch:os.arch()})),configuration_fingerprint:digest(fs.readFileSync('writing-handouts/package.json')),fixture_fingerprint:digest(files.map(n=>n+':'+digest(fs.readFileSync(n))).join('\n'))},null,2));
process.stdout.write(output);process.stderr.write(errors);
console.log(JSON.stringify({run_id:runId,outcome,passed,failed,skipped,inventory_valid:inventoryValid,tree_revision:before,receipt:dir+'/receipt.json'}));
process.exit(native.status===0?(outcome==='passed'?0:1):(native.status??1));

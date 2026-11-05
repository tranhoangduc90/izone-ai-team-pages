// Build an immutable, self-contained Progress Log package without changing other products.
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=[];
async function walk(dir){for(const entry of await readdir(path.join(repo,dir),{withFileTypes:true})){
 const name=dir+'/'+entry.name;if(entry.name==='releases'||entry.name.startsWith('.')||entry.name==='release.json')continue;
 if(entry.isDirectory())await walk(name);else if(/\.(?:js|mjs|css|html|json|svg|png|jpg|webp|woff2?|ico)$/i.test(name))files.push(name);
}}
await walk('progress-log');await walk('shared');files.sort();
const source=new Map(await Promise.all(files.map(async f=>{const bytes=await readFile(path.join(repo,f));return [f,/\.(?:js|mjs|html|css|json|svg)$/.test(f)?Buffer.from(bytes.toString().replaceAll('\r\n','\n')):bytes];})));
const entries=['index.html','thuy.html','teacher.html','teacher-thuy.html','student.html','journey.html'];
// The loader's fallback is generated output, excluded from the source identity.
for(const entry of entries){const f='progress-log/'+entry;if(source.has(f))source.set(f,Buffer.from(source.get(f).toString().replace(/data-fallback="[a-f0-9]*"/g,'data-fallback=""')));}
const version=hash(Buffer.concat([Buffer.from((await readFile(fileURLToPath(import.meta.url),'utf8')).replaceAll('\r\n','\n')),...files.flatMap(f=>[Buffer.from(f+'\0'),source.get(f)])])).slice(0,16);
const base='/izone-ai-team-pages/progress-log/releases/'+version+'/';
const output=path.join(repo,'progress-log/releases',version),assets=[];
function assetURL(file,spec){
 if(!/^\.?\.?\//.test(spec)||!/[.](?:js|mjs|css|json|svg|png|jpg|webp|woff2?|ico)(?:[?#]|$)/i.test(spec))return spec;
 const pathname=spec.split(/[?#]/)[0],resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),pathname));
 return source.has(resolved)?base+resolved:spec;
}
for(const file of files){
 let bytes=source.get(file);
 if(/\.(?:js|mjs)$/.test(file))bytes=Buffer.from(bytes.toString().replace(/(['"])(\.{1,2}\/[^'"\n]+)\1/g,(all,q,spec)=>q+assetURL(file,spec)+q));
 if(file.endsWith('.html')){
  let html=bytes.toString().replace(/<script[^>]*data-progress-entry[^>]*><\/script>/g,tag=>{
   const app=tag.match(/data-app="([^"]+)"/)[1];return '<script type="module" src="'+app+'"></script>';
  }).replace(/type="text\/progress-source"/g,'');
  html=html.replace(/\b(src|href)="([^"#]+)"/g,(all,attr,spec)=>{
   if(/^(?:https?:|data:|\/)/.test(spec))return all;
   const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec.split(/[?#]/)[0]));
   return source.has(resolved)?attr+'="'+base+resolved+'"':all;
  });
  if(entries.some(entry=>file==='progress-log/'+entry))html=html.replace('</head>',`<script src="${base}progress-log/release-runtime.js"></script><script type="module" src="${base}progress-log/release-updater.js"></script></head>`);
  bytes=Buffer.from(html);
 }
 const target=path.join(output,file);await mkdir(path.dirname(target),{recursive:true});
 try{if(!bytes.equals(await readFile(target)))throw Error('Immutable release changed: '+file);}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(target,bytes);}
 assets.push({path:base+file,sha256:hash(bytes),bytes:bytes.length});
}
for(const entry of entries){const f=path.join(repo,'progress-log',entry);let html=await readFile(f,'utf8');html=html.replace(/data-fallback="[a-f0-9]*"/g,'data-fallback="'+version+'"');await writeFile(f,html);}
await writeFile(path.join(repo,'progress-log/release.json'),JSON.stringify({version,assets},null,2)+'\n');
console.log(JSON.stringify({version,files:assets.length,bytes:assets.reduce((n,a)=>n+a.bytes,0)}));

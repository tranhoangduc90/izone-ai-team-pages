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
// Include the runtime dependency graph, never old review snapshots or test datasets.
const requiredRuntime=['progress-log/release-runtime.js','progress-log/release-updater.js'];
const included=new Set(),queue=[...entries.map(entry=>'progress-log/'+entry),'progress-log/demo/index.html','progress-log/demo/thuy.html',...requiredRuntime];
while(queue.length){
 const file=queue.pop();if(included.has(file)||!source.has(file))continue;included.add(file);
 if(!/\.(?:js|mjs|html|css|json|svg)$/.test(file))continue;
 const content=source.get(file).toString(),references=[...content.matchAll(/["']([^"'\r\n]+)["']/g)].map(m=>m[1]);
 if(file.endsWith('.css'))references.push(...[...content.matchAll(/url\(\s*([^'")\s]+)\s*\)/g)].map(m=>m[1]));
 for(const spec of references){
  if(/^(?:https?:|data:|\/|#)/.test(spec)||/\s/.test(spec)||!/\.(?:js|mjs|css|html|json|svg|png|jpg|webp|woff2?|ico)(?:[?#].*)?$/i.test(spec))continue;
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec.split(/[?#]/)[0]));
  if(source.has(resolved)&&!included.has(resolved))queue.push(resolved);
 }
}
files.splice(0,files.length,...files.filter(file=>included.has(file)));
if(!requiredRuntime.every(file=>included.has(file)))throw Error('Missing release runtime');
const version=hash(Buffer.concat([Buffer.from((await readFile(fileURLToPath(import.meta.url),'utf8')).replaceAll('\r\n','\n')),...files.flatMap(f=>[Buffer.from(f+'\0'),source.get(f)])])).slice(0,16);
const base='/izone-ai-team-pages/progress-log/releases/'+version+'/';
const output=path.join(repo,'progress-log/releases',version),assets=[];
const appModules=new Set();
function collectAppImports(file){
 if(appModules.has(file))return;
 appModules.add(file);
 for(const match of source.get(file).toString().matchAll(/^\s*import\s+[^;]+?from\s+['"]([^'"]+)['"]\s*;/gm)){
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1].split(/[?#]/)[0]));
  if(source.has(target))collectAppImports(target);
 }
}
collectAppImports('progress-log/app.js');
const preloads=[...appModules].map(file=>`<link rel="modulepreload" href="${base}${file}">`).join('');
const openingScript=['config.js','release-runtime.js'].map(file=>source.get('progress-log/'+file).toString()).join('\n');
if(/<\/script/i.test(openingScript))throw Error('Invalid inline worksheet bootstrap');
const openingHash=createHash('sha256').update(openingScript).digest('base64');
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
  if(entries.some(entry=>file==='progress-log/'+entry)){
   const runtime=`<script src="${base}progress-log/release-runtime.js"></script>`;
   if(/progress-log\/(?:index|thuy)\.html$/.test(file)){
    if(!html.includes("script-src 'self';"))throw Error('Worksheet CSP is missing its script policy');
    html=html.replace(/^[ \t]*<script\s+src="[^"]+\/progress-log\/config\.js"><\/script>\r?\n/m,'')
      .replace("script-src 'self';",`script-src 'self' 'sha256-${openingHash}';`)
      .replace('</title>',`</title><script data-release-source="${base}progress-log/release-runtime.js">${openingScript}</script>`);
    html=html.replace('</head>',preloads+'</head>');
   }else html=html.replace('</head>',runtime+'</head>');
   html=html.replace('</head>',`<script type="module" src="${base}progress-log/release-updater.js"></script></head>`);
  }
  bytes=Buffer.from(html);
 }
 const target=path.join(output,file);await mkdir(path.dirname(target),{recursive:true});
 try{if(!bytes.equals(await readFile(target)))throw Error('Immutable release changed: '+file);}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(target,bytes);}
 assets.push({path:base+file,sha256:hash(bytes),bytes:bytes.length});
}
for(const entry of entries){const f=path.join(repo,'progress-log',entry);let html=await readFile(f,'utf8');html=html.replace(/data-fallback="[a-f0-9]*"/g,'data-fallback="'+version+'"');await writeFile(f,html);}
await writeFile(path.join(repo,'progress-log/release.json'),JSON.stringify({version,assets},null,2)+'\n');
console.log(JSON.stringify({version,files:assets.length,bytes:assets.reduce((n,a)=>n+a.bytes,0)}));

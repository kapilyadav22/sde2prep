import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
// Signed provider URLs are consumed only in memory; they are never logged or persisted.
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');process.stdout.write('Ready for image import JSON on stdin (input is hidden).\n');
let input='';
for await(const chunk of process.stdin){input+=chunk;if(input.endsWith('\n'))break;}
const jobs=JSON.parse(input);let succeeded=0,failed=0;
await mkdir('public/diagrams',{recursive:true});
for(let i=0;i<jobs.length;i+=8){await Promise.all(jobs.slice(i,i+8).map(async job=>{
  try{const res=await fetch(job.url,{signal:AbortSignal.timeout(30000)});if(!res.ok||!res.headers.get('content-type')?.startsWith('image/'))throw Error();const bytes=Buffer.from(await res.arrayBuffer());await writeFile(path.join('public/diagrams',job.name),bytes);succeeded++;}catch{failed++;}
}));if(i%40===0)process.stdout.write(`Imported ${succeeded} diagrams; ${failed} unavailable.\n`);}
console.log(JSON.stringify({succeeded,failed}));process.exit(failed===jobs.length?1:0);

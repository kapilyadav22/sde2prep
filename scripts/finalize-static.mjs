import fs from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('out');
const aliases=JSON.parse(await fs.readFile('content/note-aliases.json','utf8'));
// Canonical notes remain full pre-rendered pages. Old chunk URLs need only redirects.
for(const [old,id] of Object.entries(aliases)){
  if(!/^[a-z0-9-]+$/.test(old)||!/^[a-z0-9-]+$/.test(id))throw Error('Invalid note alias');
  const directory=path.join(out,'notes',old);await fs.rm(directory,{recursive:true,force:true});await fs.mkdir(directory,{recursive:true});
  const target=`/notes/${id}/`;const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening your note · sde2prep</title><link rel="canonical" href="${target}"><meta http-equiv="refresh" content="0;url=${target}"></head><body><p>This note is now part of its original chapter. <a href="${target}">Continue reading</a></p><script>location.replace(${JSON.stringify(target)}+location.hash)</script></body></html>`;
  await fs.writeFile(path.join(directory,'index.html'),html);
}
// All internal navigation uses regular anchors. Next embeds the hydration payload
// in each HTML page, so duplicated external client-navigation payloads are unused.
let removed=0,bytes=0;
async function trim(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())await trim(file);else if(entry.name==='index.txt'||/^__next\..*\.txt$/.test(entry.name)){bytes+=(await fs.stat(file)).size;await fs.unlink(file);removed++;}}}
await trim(out);
console.log(`Static package: ${Object.keys(aliases).length} legacy redirects; removed ${removed} unused navigation payloads (${Math.round(bytes/1024/1024)} MiB).`);

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {notesFromNative} from './native-content.mjs';
import {replaceSource} from './content.mjs';
import {linkLibrary} from './link-leetcode.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sources=JSON.parse(await fs.readFile(path.join(root,'content/sources.json'),'utf8'));
let library=JSON.parse(await fs.readFile(path.join(root,'content/library.json'),'utf8'));
for(const configured of sources.filter(s=>s.nativeSnapshot)){
  const doc=JSON.parse(await fs.readFile(path.join(root,'content',configured.nativeSnapshot),'utf8'));
  const source={...configured,status:'Imported',updatedAt:configured.modifiedTime||library.sources.find(s=>s.id===configured.id)?.updatedAt||new Date().toISOString()};
  const notes=notesFromNative(doc,source);
  const used=notes.flatMap(n=>n.originalTabIds);if(new Set(used).size!==used.length)throw Error(`Repeated source section in ${source.title}`);
  library=replaceSource(library,source,notes);console.log(`${source.title}: ${notes.length} chapters from ${used.length} source sections.`);
}
library=await linkLibrary(library);
await fs.writeFile(path.join(root,'content/library.json'),JSON.stringify(library,null,2));

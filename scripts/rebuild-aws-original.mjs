import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=path.join(root,'content/library.json');
const library=JSON.parse(await fs.readFile(file,'utf8'));
const document=JSON.parse(await fs.readFile(path.join(root,'content/raw/aws-native.json'),'utf8'));
const source=library.sources.find(s=>s.id==='aws-notes');
function textOf(blocks){return (blocks||[]).map(b=>b.paragraph?(b.paragraph.elements||[]).map(e=>e.textRun?.content||'').join(''):b.table?b.table.tableRows.map(r=>r.tableCells.map(c=>textOf(c.content)).join('\t')).join('\n'):'').join('\n');}
const slug=s=>s.replace(/[^a-z0-9-]/gi,'-');
const tabs=document.tabs.filter(t=>textOf(t.body?.content).trim());
const notes=tabs.map(t=>{
  const content=textOf(t.body.content);
  const first=content.split('\n').map(s=>s.trim()).find(Boolean);
  const title=(t.title==='q/a'||t.title==='Topics')?t.title:(first||t.title);
  return {id:`aws-original-${slug(t.tabId)}`,title,category:'aws',sourceId:source.id,sourceUrl:source.url+'?tab='+t.tabId,description:content.replace(/\s+/g,' ').trim().slice(0,160),content,minutes:Math.max(1,Math.ceil(content.split(/\s+/).length/220)),updatedAt:source.updatedAt,tags:['AWS','Original document'],originalTabId:t.tabId};
});
const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const normalized=notes.map(n=>normalize(n.content));
let aliases={};try{aliases=JSON.parse(await fs.readFile(path.join(root,'content/note-aliases.json'),'utf8'));}catch{}
const mappings=[];
for(const old of library.notes.filter(n=>n.category==='aws'&&!n.originalTabId)){
  const words=normalize(old.content).split(' ');const samples=[];
  for(let i=0;i<Math.min(words.length-8,400);i+=10)samples.push(words.slice(i,i+8).join(' '));
  const scores=normalized.map(text=>samples.filter(s=>text.includes(s)).length/Math.max(1,samples.length));
  const index=scores.indexOf(Math.max(...scores));
  if(index<0||scores[index]<.1)throw Error(`Could not confidently map existing AWS note ${old.id}; preserve it and inspect the source.`);
  aliases[old.id]=notes[index].id;mappings.push({from:old.title,to:notes[index].title,confidence:Math.round(scores[index]*100)});
}
library.notes=[...library.notes.filter(n=>n.category!=='aws'),...notes];
source.status='Imported';
await fs.writeFile(file,JSON.stringify(library,null,2));
await fs.writeFile(path.join(root,'content/note-aliases.json'),JSON.stringify(aliases,null,2));
console.log(JSON.stringify({chapters:notes.length,preservedLinks:Object.keys(aliases).length,lowestConfidence:Math.min(...mappings.map(m=>m.confidence))}));

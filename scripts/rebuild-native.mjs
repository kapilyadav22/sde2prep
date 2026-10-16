import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile('content/raw/hld-native.json','utf8'));
const tableImages=JSON.parse(await fs.readFile('content/raw/hld-table-images.json','utf8'));
const library=JSON.parse(await fs.readFile('content/library.json','utf8'));
const groups=new Map();for(const p of data.paragraphs){if(!groups.has(p.tabId))groups.set(p.tabId,[]);groups.get(p.tabId).push(p);}
const clean=s=>s.replace(/\u000b/g,'\n').trim();
const tabs=[];
for(const [tabId,paragraphs] of groups){
  const tables=data.tables.find(t=>t.id===tabId)?.content||[];
  const images=[...(data.positions.find(t=>t.id===tabId)?.content||[]),...(tableImages.find(t=>t.id===tabId)?.content||[])];
  const events=[];
  for(const p of paragraphs){
    if(tables.some(t=>p.startIndex>=t.startIndex&&p.startIndex<t.endIndex))continue;
    const level=/^HEADING_/.test(p.namedStyleType)?Number(p.namedStyleType.split('_')[1])+1:0;
    events.push({index:p.startIndex,content:(level?'#'.repeat(Math.min(level,6))+' ':p.isListItem?'- ':'')+clean(p.text)});
  }
  for(const table of tables){
    let content;const {rows,code}=table;
    if(code && rows.length===1 && rows[0].length===1)content='```\n'+clean(rows[0][0])+'\n```';
    else if(rows.length===1 && rows[0].length===1)content=clean(rows[0][0]).split('\n').map(l=>'> '+l).join('\n');
    else {
      const escaped=rows.map(r=>r.map(c=>clean(c).replace(/\|/g,' / ').replace(/\n/g,' · ')));
      const width=Math.max(...escaped.map(r=>r.length));
      const line=row=>'| '+Array.from({length:width},(_,i)=>row[i]||'').join(' | ')+' |';
      content=[line(escaped[0]),line(Array(width).fill('---')),...escaped.slice(1).map(line)].join('\n');
    }
    events.push({index:table.startIndex,content});
  }
  for(const image of images){
    const name=(tabId+'-'+image.id).replace(/[^a-z0-9-]/gi,'-')+'.png';
    try{await fs.access('public/diagrams/'+name);}catch{continue;}
    const context=paragraphs.filter(p=>p.startIndex<image.startIndex&&p.namedStyleType?.startsWith('HEADING_')).at(-1)?.text||paragraphs[0].text;
    events.push({index:image.startIndex,content:`![${clean(context).replace(/[\[\]]/g,'')} — source diagram](/diagrams/${name})`});
  }
  events.sort((a,b)=>a.index-b.index);
  const title=clean(paragraphs[0].text).replace(/\n/g,' — ');
  const content=events.map(e=>e.content).filter(Boolean).join('\n\n');tabs.push({id:tabId,title,content});
  const note=library.notes.find(n=>n.id==='hld-notes-'+tabId.replace(/[^a-z0-9-]/gi,'-'));
  if(note){note.title=title;note.content=content;note.description=clean(paragraphs.find(p=>p.text.length>100)?.text||title).replace(/\s+/g,' ').slice(0,160);note.tags=['HLD','System design'];}
}
await fs.writeFile('content/raw/hld-tabs.json',JSON.stringify(tabs));
await fs.writeFile('content/library.json',JSON.stringify(library,null,2));
console.log(`Rebuilt ${tabs.length} HLD chapters with native tables and diagrams.`);

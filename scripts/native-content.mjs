export function nativeText(blocks){return (blocks||[]).map(b=>b.paragraph?(b.paragraph.elements||[]).map(e=>e.textRun?.content||e.dropdown?.dropdownProperties?.displayValue||'').join(''):b.table?b.table.tableRows.map(r=>r.tableCells.map(c=>nativeText(c.content)).join('\t')).join('\n'):'').join('\n');}
export function nativeImageIds(blocks){return (blocks||[]).flatMap(b=>b.paragraph?(b.paragraph.elements||[]).filter(e=>e.inlineObjectElement).map(e=>e.inlineObjectElement.inlineObjectId):b.table?b.table.tableRows.flatMap(r=>r.tableCells.flatMap(c=>nativeImageIds(c.content))):[]);}
const safe=s=>s.replace(/[^a-z0-9-]/gi,'-');
export function chapterGroups(document,source){
  const all=document.tabs||[];const tabs=all.filter(t=>nativeText(t.body?.content).trim()||nativeImageIds(t.body?.content).length);
  if(source.nativeGrouping==='tabs'||['aws','hld','multithreading'].includes(source.category))return tabs.map(t=>({title:t.title,tabs:[t]}));
  if(source.category==='kafka'){
    const ranges=[[0,6,'Messaging foundations'],[6,11,'Consumer groups & coordination'],[11,19,'Replication, failures & recovery'],[19,21,'Scenarios & interview questions'],[21,23,'Producer internals & retries'],[23,all.length,'Delivery, backpressure & retry topics']];
    return ranges.map(([from,to,title])=>({title,tabs:all.slice(from,to).filter(t=>tabs.includes(t))})).filter(g=>g.tabs.length);
  }
  const byId=new Map(all.map(t=>[t.tabId,t]));const rootOf=t=>{let root=t,seen=new Set();while(root.parentTabId&&byId.has(root.parentTabId)&&!seen.has(root.parentTabId)){seen.add(root.tabId);root=byId.get(root.parentTabId);}return root;};
  const groups=[];let current=null;
  for(const tab of tabs){const root=rootOf(tab);const chars=nativeText(tab.body?.content).length,images=nativeImageIds(tab.body?.content).length;
    if(!current||current.root!==root.tabId||current.tabs.length>=7||current.characters+chars>24000||current.images+images>35){current={root:root.tabId,title:root.title,tabs:[],characters:0,images:0};groups.push(current);}
    if(!current.tabs.length&&tab.tabId!==root.tabId)current.title=`${root.title} · ${tab.title}`;
    current.tabs.push(tab);current.characters+=chars;current.images+=images;
  }
  return groups;
}
export function notesFromNative(document,source){return chapterGroups(document,source).map(group=>{
  const tab=group.tabs[0];const content=group.tabs.map(t=>nativeText(t.body?.content)).join('\n\n');const first=content.split('\n').map(s=>s.trim()).find(Boolean);
  const title=['aws','hld'].includes(source.category)?((tab.title==='q/a'||tab.title==='Topics')?tab.title:(first||tab.title)):group.title;
  const prefix=source.category==='aws'?'aws-original':source.category==='hld'?'hld-notes':`${source.id}-original`;
  return {id:`${prefix}-${safe(tab.tabId)}`,title,category:source.category,sourceId:source.id,sourceUrl:source.url+(source.url.includes('?')?'&':'?')+'tab='+tab.tabId,description:content.replace(/\s+/g,' ').trim().slice(0,160),content,minutes:Math.max(1,Math.ceil(content.split(/\s+/).length/220)),updatedAt:source.updatedAt,tags:[source.label||source.category.toUpperCase(),'Original document'],originalTabId:tab.tabId,originalTabIds:group.tabs.map(t=>t.tabId)};
});}

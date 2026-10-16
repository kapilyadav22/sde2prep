export function nativeText(blocks){return (blocks||[]).map(b=>b.paragraph?(b.paragraph.elements||[]).map(e=>e.textRun?.content||'').join(''):b.table?b.table.tableRows.map(r=>r.tableCells.map(c=>nativeText(c.content)).join('\t')).join('\n'):'').join('\n');}
export function notesFromNative(document,source){return document.tabs.filter(t=>nativeText(t.body?.content).trim()).map(t=>{
  const content=nativeText(t.body.content);const first=content.split('\n').map(s=>s.trim()).find(Boolean);const title=(t.title==='q/a'||t.title==='Topics')?t.title:(first||t.title);
  return {id:`aws-original-${t.tabId.replace(/[^a-z0-9-]/gi,'-')}`,title,category:source.category,sourceId:source.id,sourceUrl:source.url+'?tab='+t.tabId,description:content.replace(/\s+/g,' ').trim().slice(0,160),content,minutes:Math.max(1,Math.ceil(content.split(/\s+/).length/220)),updatedAt:source.updatedAt,tags:['AWS','Original document'],originalTabId:t.tabId};
});}

export const FOLDER_ID='1FdapeRdLXkr4VXSdE_7mA4JOZ0xq9lCI';
export const LIBRARY_TTL=30_000;
export function decodeHtml(value){return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi,entity=>{const basic={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};if(basic[entity])return basic[entity];const n=entity.startsWith('&#x')?parseInt(entity.slice(3),16):parseInt(entity.slice(2),10);return Number.isFinite(n)&&n<=0x10ffff?String.fromCodePoint(n):'';});}
export function parseFolder(html,folder=''){
  if(!html.includes('flip-entries'))throw new Error('The shared folder is unavailable. Check that files inherit the folder’s link access.');
  const entries=[];
  for(const chunk of html.split(/<div class="flip-entry"/).slice(1)){
    const id=/\bid="entry-([\w-]+)"/.exec(chunk)?.[1];
    const title=/<div class="flip-entry-title">([\s\S]*?)<\/div>/.exec(chunk)?.[1];
    const href=/<a href="([^"]+)"/.exec(chunk)?.[1];
    if(!id||!title||!href)continue;
    const name=decodeHtml(title.replace(/<[^>]*>/g,''));
    const url=decodeHtml(href);
    const mime=decodeHtml(/type\/([^"?]+)"/.exec(chunk)?.[1]||'');
    const isFolder=/drive\/folders\//.test(url)||mime==='application/vnd.google-apps.folder';
    const kind=isFolder?'folder':/\.pdf$/i.test(name)||mime==='application/pdf'?'pdf':/\.docx$/i.test(name)?'docx':/\.doc$/i.test(name)?'doc':/\.(md|markdown)$/i.test(name)?'markdown':/\.txt$/i.test(name)?'text':/docs\.google\.com\/document\//.test(url)||mime==='application/vnd.google-apps.document'?'gdoc':null;
    if(kind)entries.push({id,title:name.replace(/\.(pdf|docx?|md|markdown|txt)$/i,'').replace(/_/g,' '),name,kind,topic:folder||'Handwritten notes'});
  }
  return entries;
}
export async function fetchFolder(fetcher=fetch,folderId=FOLDER_ID,label='',depth=0,seen=new Set()){
  if(depth>5)throw new Error('Subfolders are nested too deeply. Move notes within five folder levels.');
  if(seen.has(folderId))return [];
  seen.add(folderId);
  const response=await fetcher(`https://drive.google.com/embeddedfolderview?id=${folderId}`,{redirect:'follow',headers:{'Cache-Control':'no-cache'}});
  if(!response.ok)throw new Error('The shared folder could not be read. Please retry.');
  const html=await response.text();
  const entries=parseFolder(html,label);
  const files=entries.filter(file=>file.kind!=='folder');
  for(const child of entries.filter(file=>file.kind==='folder'))files.push(...await fetchFolder(fetcher,child.id,label?`${label} / ${child.title}`:child.title,depth+1,seen));
  if(files.length>2000)throw new Error('This folder is too large to display in one request.');
  return files;
}
export function fileEndpoint(file){return file.kind==='gdoc'?`https://docs.google.com/document/d/${file.id}/export?format=html`:`https://drive.usercontent.google.com/download?id=${file.id}&export=download`;}
export function validRange(range){return !range||/^bytes=(?:\d+-\d*|-\d+)$/.test(range);}

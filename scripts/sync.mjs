import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeNotes, replaceSource, slug } from './content.mjs';
import { notesFromNative } from './native-content.mjs';
import { linkLibrary } from './link-leetcode.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
const contentDir = path.join(root,'content');
// Automatically load environment files if present
try { process.loadEnvFile(path.join(root, '.env.local')); } catch {}
try { process.loadEnvFile(path.join(root, '.env')); } catch {}

// Auto-generate GOOGLE_ACCESS_TOKEN from a service account key if available.
// Store the full service account JSON as GOOGLE_SERVICE_ACCOUNT_KEY in Vercel env vars.
if (!process.env.GOOGLE_ACCESS_TOKEN && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  try {
    const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const now = Math.floor(Date.now() / 1000);
    const header  = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly',
      aud: key.token_uri,
      iat: now,
      exp: now + 3600,
    };
    const b64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsigned = `${b64url(header)}.${b64url(payload)}`;
    const { createSign } = await import('node:crypto');
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    const jwt = `${unsigned}.${signer.sign(key.private_key, 'base64url')}`;
    const tokenRes = await fetch(key.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) throw new Error(`Token endpoint returned HTTP ${tokenRes.status}: ${tokenText.slice(0, 200)}`);
    let tokenData;
    try { tokenData = JSON.parse(tokenText); }
    catch { throw new Error(`Token endpoint returned non-JSON: ${tokenText.slice(0, 200)}`); }
    const { access_token, error, error_description } = tokenData;
    if (error) throw new Error(`Token endpoint error: ${error} — ${error_description}`);
    if (!access_token) throw new Error('No access_token in response');
    process.env.GOOGLE_ACCESS_TOKEN = access_token;
    console.log('Google access token generated from service account key.');
  } catch (err) {
    console.warn(`Service account token generation failed: ${err.message}. Falling back to cached snapshots.`);
  }
}


const config = JSON.parse(await fs.readFile(path.join(contentDir,'sources.json'),'utf8'));
const local = process.argv.includes('--local');
const selected = process.argv.find(x=>x.startsWith('--source='))?.split('=')[1];
let library;
try { library=JSON.parse(await fs.readFile(path.join(contentDir,'library.json'),'utf8')); } catch { library={notes:[],sources:[],problems:[]}; }
async function fetchText(url) {
  const headers = {'User-Agent':'sde2prep-content-importer'};
  if (process.env.GITHUB_TOKEN && new URL(url).hostname === 'api.github.com') headers.Authorization=`Bearer ${process.env.GITHUB_TOKEN}`;
  if (process.env.GOOGLE_ACCESS_TOKEN && ['www.googleapis.com','docs.googleapis.com'].includes(new URL(url).hostname)) headers.Authorization=`Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`;
  const res=await fetch(url,{headers,signal:AbortSignal.timeout(120000)});
  if (!res.ok) throw new Error(`Source download returned HTTP ${res.status}. Check sharing/access.`);
  const text=await res.text();
  if (/^\s*<!doctype html|^\s*<html/i.test(text)) throw new Error('Received a sign-in page instead of document content. Export and upload the file, or configure GOOGLE_ACCESS_TOKEN locally.');
  return text;
}
// RFC 4180 fields, including multiline cells and escaped quotation marks.
export function parseCSV(text) {
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){cell+='"';i++;} else quoted=!quoted; }
    else if(c===',' && !quoted){row.push(cell);cell='';}
    else if(c==='\n' && !quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  return rows;
}
function sheetContent(text, source) {
  const rows=parseCSV(text); const header=rows[0];
  const nameIndex=header.indexOf('Problem Name'); const titleIndex=nameIndex>=0?nameIndex:1;
  const topicIndex=header.indexOf('s'); const statusIndex=header.indexOf('Status');
  const primaryTopics = new Set(['Arrays','Arrays (*)','Strings','Linked List','Trees','Graphs','Dynamic Programming']);
  const firstRows = rows.slice(1).filter(r=>r[titleIndex]?.trim() && primaryTopics.has(r[topicIndex]?.trim()));
  const problems=firstRows.map(r=>{
    const title=r[titleIndex].trim(); const url=r.find(c=>/^https:\/\/leetcode.com\/problems\//.test(c.trim()));
    return {id:slug(title),title,topic:r[topicIndex]?.trim() || 'Practice', ...(url?{url:url.trim()}:{} )};
  }).filter((p,i,all)=>all.findIndex(q=>q.id===p.id)===i);
  const table = '# Microsoft interview preparation\n\nImported from your Microsoft DSA sheet. Track your own completion in the practice list.\n\n| Topic | Problem | Source status | Notes |\n| --- | --- | --- | --- |\n'+firstRows.map(r=>[r[topicIndex],r[titleIndex],r[statusIndex],r[statusIndex+1]].map(v=>(v||'').replace(/\|/g,'/').replace(/\n/g,' ')).join(' | ')).map(x=>'| '+x+' |').join('\n');
  // Preserve all remaining rows, including your revision priorities and code notes.
  const appendix = '\n\n# Complete source notebook\n\n'+rows.slice(1).filter(r=>r.some((c,i)=>i>0 && c.trim())).map(r=>r.slice(1).filter(Boolean).join(' — ')).join('\n\n');
  return {notes:makeNotes(table+appendix,source),problems};
}
function documentNotes(text, source) {
  if(source.category!=='aws') return makeNotes(text,source);
  const markers=[...text.matchAll(/^AWS (?:EC2(?: Auto Scaling)?|Lambda|IAM|S3|VPC|Security|RDS|Application Load Balancer|ELB|DynamoDB|SNS|SQS|API Gateway|ECS|EKS|Storage|ElastiCache|CloudWatch|Route 53)[^\n]*$/gm)];
  const starts=[{index:0,title:'AWS overview & study roadmap'}];
  for(const m of markers){
    if(m.index-starts.at(-1).index<500) continue;
    starts.push({index:m.index,title:m[0].replace(/\s*[-–:]?\s*Interview Study Notes\s*$/,'').replace(/\s*:\s*$/,'').trim()});
  }
  const grouped = new Map();
  for (const [i,s] of starts.entries()) grouped.set(s.title,(grouped.get(s.title)||'')+text.slice(s.index,starts[i+1]?.index)+'\n\n');
  return [...grouped].flatMap(([title,body])=>makeNotes(body,{...source,id:source.id+'-'+slug(title)},title).map(n=>({...n,sourceId:source.id})));
}
async function githubNotes(source) {
  const cache=path.join(contentDir,'raw','github.json');
  let files;
  if(local) {
    files=JSON.parse(await fs.readFile(cache,'utf8'));
  } else {
    try {
      const tree=JSON.parse(await fetchText(`https://api.github.com/repos/${source.repository}/git/trees/${source.branch}?recursive=1`));
      if(!Array.isArray(tree.tree)) throw new Error('GitHub tree unavailable.');
      const paths=tree.tree.filter(f=>f.type==='blob' && /\.(java|cpp|md|docs)$/.test(f.path)); files=[];
      for(let i=0;i<paths.length;i+=6){
        const batch=await Promise.all(paths.slice(i,i+6).map(async f=>({path:f.path,text:await fetchText(`https://raw.githubusercontent.com/${source.repository}/${source.branch}/${f.path.split('/').map(encodeURIComponent).join('/')}`)})));
        files.push(...batch);
      }
      await fs.writeFile(cache,JSON.stringify(files));
      console.log(`${source.title}: Synced ${files.length} latest files from GitHub (${source.repository}).`);
    } catch(err) {
      console.warn(`${source.title}: Could not fetch live from GitHub (${err.message}); using cached ${cache}.`);
      files=JSON.parse(await fs.readFile(cache,'utf8'));
    }
  }
  const groups=new Map();
  for(const file of files){
    const parts=file.path.split('/'); const group=parts[1]==='cpp'?parts[2]:parts[1];
    if(!group)continue; if(!groups.has(group))groups.set(group,[]);groups.get(group).push(file);
  }
  return [...groups].map(([group,files])=>{
    const content=files.map(f=>`## ${f.path}\n\n${/\.(java|cpp)$/.test(f.path)?'```'+(f.path.endsWith('java')?'java':'cpp')+'\n'+f.text+'\n```':f.text}`).join('\n\n');
    const title=group.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    return {id:`${source.id}-${slug(group)}`,title,category:'lld',sourceId:source.id,sourceUrl:source.url+'/tree/'+source.branch+'/'+files[0].path.split('/').slice(0,-1).map(encodeURIComponent).join('/'),description:`${title}: ${files.length} source ${files.length===1?'file':'files'} from your MS_LLD repository. Explore the implementation, classes, and design decisions.`,content,minutes:Math.max(1,Math.ceil(content.split(/\s+/).length/220)),updatedAt:source.updatedAt,tags:['LLD','Implementation',files.some(f=>f.path.endsWith('.java'))?'Java':'C++']};
  });
}
let errors=0;
for(const configured of config.filter(s=>!selected || s.id===selected)){
  const source={...configured,updatedAt:new Date().toISOString(),status:'Imported'};
  try {
    let notes;
    if(source.nativeSnapshot){
      let snapshot;
      if(local) {
        snapshot=JSON.parse(await fs.readFile(path.join(contentDir,source.nativeSnapshot),'utf8'));
      } else {
        if(source.type==='DOCX') {
          snapshot=JSON.parse(await fs.readFile(path.join(contentDir,source.nativeSnapshot),'utf8'));
        } else if(!process.env.GOOGLE_ACCESS_TOKEN) {
          snapshot=JSON.parse(await fs.readFile(path.join(contentDir,source.nativeSnapshot),'utf8'));
        } else {
          try {
            const id=source.url.match(/\/d\/([^/]+)/)[1];
            const resource=JSON.parse(await fetchText(`https://docs.googleapis.com/v1/documents/${id}?includeTabsContent=true`));
            const tabs=[];const flatten=items=>{for(const t of items||[]){tabs.push({tabId:t.tabProperties.tabId,title:t.tabProperties.title,parentTabId:t.tabProperties.parentTabId||null,index:t.tabProperties.index,nestingLevel:t.tabProperties.nestingLevel,...t.documentTab});flatten(t.childTabs);}};flatten(resource.tabs);snapshot={documentId:resource.documentId,title:resource.title,tabs};
            const jobs=[];
            for(const tab of tabs)for(const [imageId,item] of Object.entries(tab.inlineObjects||{})){
              const image=item.inlineObjectProperties?.embeddedObject;const url=image?.imageProperties?.contentUri;
              if(url){const name=(source.category+'-'+tab.tabId+'-'+imageId).replace(/[^a-z0-9-]/gi,'-')+'.png';jobs.push({url,name});image.imageProperties={localPath:'/diagrams/'+name};}
            }
            await fs.mkdir(path.join(root,'public/diagrams'),{recursive:true});
            for(let i=0;i<jobs.length;i+=6)await Promise.all(jobs.slice(i,i+6).map(async j=>{const res=await fetch(j.url,{signal:AbortSignal.timeout(60000)});if(!res.ok||!res.headers.get('content-type')?.startsWith('image/'))throw Error('Could not retrieve a source diagram. The previous published content was preserved.');await fs.writeFile(path.join(root,'public/diagrams',j.name),Buffer.from(await res.arrayBuffer()));}));
            await fs.writeFile(path.join(contentDir,source.nativeSnapshot),JSON.stringify(snapshot));
            console.log(`${source.title}: Refreshed from Google Docs API.`);
          } catch(apiErr) {
            console.warn(`${source.title}: Live Google Docs API sync failed (${apiErr.message}); using snapshot ${source.nativeSnapshot}.`);
            snapshot=JSON.parse(await fs.readFile(path.join(contentDir,source.nativeSnapshot),'utf8'));
          }
        }
      }
      notes=notesFromNative(snapshot,source);
    }
    else if(source.type==='GitHub') {
      notes=await githubNotes(source);
    }
    else {
      let text;
      if(local) {
        text=await fs.readFile(path.join(contentDir,source.file),'utf8');
      } else {
        const id=source.url.match(/\/d\/([^/]+)/)?.[1];
        if (id) {
          const url=process.env.GOOGLE_ACCESS_TOKEN?`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${source.type==='Google Sheets'?'text%2Fcsv':'text%2Fplain'}`:source.type==='Google Sheets'?`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`:`https://docs.google.com/document/d/${id}/export?format=txt`;
          try {
            text=await fetchText(url);
            if (source.file) await fs.writeFile(path.join(contentDir,source.file),text);
            console.log(`${source.title}: Synced latest content from Google Sheets URL.`);
          } catch(fetchErr) {
            if (source.file) {
              console.warn(`${source.title}: Live sync failed (${fetchErr.message}); using local ${source.file}.`);
              text=await fs.readFile(path.join(contentDir,source.file),'utf8');
            } else {
              throw fetchErr;
            }
          }
        } else if (source.file) {
          text=await fs.readFile(path.join(contentDir,source.file),'utf8');
        }
      }
      if(source.type==='Google Sheets') {const parsed=sheetContent(text,source);notes=parsed.notes;library.problems=parsed.problems;}
      else notes=documentNotes(text,source);
    }
    library=replaceSource(library,source,notes);
    console.log(`${source.title}: ${notes.length} notes generated.`);
  }catch(error){
    errors++;console.error(`${source.title}: ${error.message}`);
    if(!library.sources.some(s=>s.id===source.id))library.sources.push({...source,status:'Needs import'});
  }
}
library=await linkLibrary(library);
await fs.writeFile(path.join(contentDir,'library.tmp.json'),JSON.stringify(library,null,2));
await fs.rename(path.join(contentDir,'library.tmp.json'),path.join(contentDir,'library.json'));
console.log(`Content library successfully updated: ${library.notes.length} total notes across ${library.sources.length} sources.`);
if(errors)process.exitCode=1;

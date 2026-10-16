import { Buffer } from 'node:buffer';
import WordExtractor from 'word-extractor';
import { fetchFolder,fileEndpoint,validRange,LIBRARY_TTL } from './drive-library.mjs';
let cached=null;
let pending=null;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(value,status=200)=>Response.json(value,{status,headers});
async function list(force=false){
  if(!force&&cached&&Date.now()-cached.time<LIBRARY_TTL)return cached.files;
  if(pending)return pending;
  pending=fetchFolder().then(files=>{cached={files,time:Date.now()};return files;}).finally(()=>{pending=null;});
  return pending;
}
async function boundedBody(response,max=25*1024*1024){
  if(Number(response.headers.get('content-length'))>max)throw new Error('This article exceeds the 25 MB document limit.');
  const chunks=[];let length=0;const reader=response.body.getReader();
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw new Error('This article exceeds the 25 MB document limit.');}chunks.push(value);}
  const body=new Uint8Array(length);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}return body;
}
export async function api(request){
  const url=new URL(request.url);
  if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'Method not allowed.'},405);
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Open this document from sde2prep.'},403);
  try{
    if(url.pathname==='/api/handwritten'){
      const files=await list(url.searchParams.get('refresh')==='1');
      return json({files,checkedAt:new Date().toISOString(),refreshAfter:30});
    }
    const match=/^\/api\/handwritten\/([\w-]+)\/(file|article|preview)$/.exec(url.pathname);
    if(!match)return json({error:'Not found.'},404);
    const [,id,action]=match;
    const file=(await list()).find(file=>file.id===id);
    if(!file)return json({error:'This file is no longer in the shared notes folder. Refresh the collection.'},404);
    if(action==='preview'){
      if(file.kind!=='pdf')return json({error:'Preview is available for PDFs.'},400);
      const preview=await fetch(`https://drive.google.com/thumbnail?id=${file.id}&sz=w1200`,{redirect:'follow'});
      if(!preview.ok||!preview.headers.get('content-type')?.startsWith('image/'))return json({error:'Preview not available.'},404);
      return new Response(preview.body,{headers:{...headers,'Content-Type':preview.headers.get('content-type')}});
    }
    const range=request.headers.get('range');
    if(!validRange(range))return json({error:'Invalid byte range.'},416);
    const upstream=await fetch(fileEndpoint(file),{method:request.method,redirect:'follow',headers:range&&action==='file'?{Range:range}:{}});
    if(!upstream.ok&&upstream.status!==206)return json({error:'This document is not currently available. Check its sharing in the notes folder.'},502);
    const mime=upstream.headers.get('content-type')||'';
    if(mime.includes('text/html')&&file.kind!=='gdoc')return json({error:'Google Drive has not made this file available for reading yet. Retry once the upload has finished.'},502);
    if(action==='article'){
      if(file.kind==='pdf')return json({error:'Use the PDF reader for this file.'},400);
      const body=await boundedBody(upstream);
      if(file.kind==='doc'){
        const document=await new WordExtractor().extract(Buffer.from(body));
        return json({format:'text',content:document.getBody(),file});
      }
      if(file.kind==='docx')return new Response(body,{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}});
      return json({format:file.kind==='gdoc'?'html':file.kind==='markdown'?'markdown':'text',content:new TextDecoder().decode(body),file});
    }
    const responseHeaders=new Headers(headers);
    responseHeaders.set('Content-Type',file.kind==='pdf'?'application/pdf':'application/octet-stream');
    responseHeaders.set('Content-Disposition','inline');
    for(const name of ['Content-Length','Content-Range','Accept-Ranges','Last-Modified','ETag']){const value=upstream.headers.get(name);if(value)responseHeaders.set(name,value);}
    return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  }catch(error){return json({error:error instanceof Error?error.message:'Unable to read the notes folder.'},502);}
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/handwritten'))return api(request);
    return env.ASSETS.fetch(request);
  }
};

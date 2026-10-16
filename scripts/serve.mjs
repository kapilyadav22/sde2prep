import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('out');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.txt':'text/plain','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.xml':'application/xml','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
  try{
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return;}
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);
  }catch{res.writeHead(404,{'Content-Type':'text/html'});res.end(await readFile(path.join(root,'404.html')).catch(()=>'<h1>Not found</h1>'));}
}).listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`Local: http://localhost:${process.env.PORT||3000}`));

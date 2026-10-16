'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, PanelRightClose, PanelRightOpen } from 'lucide-react';
import Link from './static-link';
import { PdfReader } from './pdf-reader';
import { FullscreenButton } from './fullscreen-button';
import { Markdown } from './markdown';
import { ImageModal } from './image-modal';
import { readFolder,type LiveFile } from '@/lib/live-folder';

type Article={format:'html'|'markdown'|'text';content:string;toc:{id:string;title:string;level:number}[]};
export function LiveDocumentReader(){
  const [file,setFile]=useState<LiveFile|null>(null);
  const [article,setArticle]=useState<Article|null>(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [tocHidden,setTocHidden]=useState(false);
  const [modalImage,setModalImage]=useState<{src:string;alt?:string}|null>(null);
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('id');
    const controller=new AbortController();let active=true;
    setError('');setFile(null);setArticle(null);
    (async()=>{
      if(!id)throw new Error('Choose a file from Handwritten notes.');
      const data=await readFolder(retry>0,controller.signal);
      const selected=data.files.find(item=>item.id===id);
      if(!selected)throw new Error('This file is no longer in the notes folder.');
      if(!active)return;setFile(selected);document.title=`${selected.title} | sde2prep`;
      if(selected.kind==='pdf')return;
      const response=await fetch(`/api/handwritten/${selected.id}/article`,{cache:'no-store',signal:controller.signal});
      if(!response.ok){const data=await response.json();throw new Error(data.error||'This article could not be opened.');}
      let format:Article['format']='html';let content='';
      if(selected.kind==='docx'){
        const mammoth=await import('mammoth/mammoth.browser');
        content=(await mammoth.convertToHtml({arrayBuffer:await response.arrayBuffer()})).value;
      }else{const body=await response.json();format=body.format;content=body.content;}
      const toc:Article['toc']=[];
      if(format==='html'){
        const purifier=(await import('dompurify')).default;
        const clean=purifier.sanitize(content,{USE_PROFILES:{html:true},FORBID_TAGS:['style','form','input','button','iframe','object','embed','video','audio'],FORBID_ATTR:['style','class','srcset'],ALLOW_DATA_ATTR:false});
        const doc=new DOMParser().parseFromString(clean,'text/html');
        const first=doc.body.querySelector('h1,h2');
        if(first?.textContent?.trim().toLowerCase()===selected.title.trim().toLowerCase())first.remove();
        doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading,index)=>{heading.id=`article-section-${index+1}`;toc.push({id:heading.id,title:heading.textContent||'',level:Number(heading.tagName.slice(1))});});
        doc.body.querySelectorAll('a').forEach(anchor=>{anchor.target='_blank';anchor.rel='noreferrer noopener';});
        doc.body.querySelectorAll('img').forEach(img=>{img.loading='lazy';img.decoding='async';if(!img.alt)img.alt='Document illustration';});
        content=doc.body.innerHTML;
      }else if(format==='markdown'){
        let index=0;for(const match of content.matchAll(/^#{1,4}\s+(.+)$/gm))toc.push({id:`section-${++index}`,title:match[1].replace(/[*`]/g,''),level:match[0].indexOf(' ')});
      }
      if(active)setArticle({format,content,toc});
    })().catch(error=>{if(active&&error.name!=='AbortError')setError(error.message||'Unable to open this file.');});
    return()=>{active=false;controller.abort();};
  },[retry]);
  useEffect(()=>{try{setTocHidden(localStorage.getItem('sde2prep-toc-hidden')==='true'||window.innerWidth<950);}catch{}},[]);
  function toggleContents(){setTocHidden(value=>{try{localStorage.setItem('sde2prep-toc-hidden',String(!value));}catch{}return !value;});}
  if(file?.kind==='pdf')return <PdfReader key={file.id} note={{id:file.id,title:file.title,topic:file.topic,file:`/api/handwritten/${file.id}/file`,preview:`/api/handwritten/${file.id}/preview`}}/>;

  const handleProseClick=(e:React.MouseEvent)=>{
    const target=e.target as HTMLElement;
    const img=target.tagName==='IMG'?(target as HTMLImageElement):target.closest('a')?.querySelector('img');
    if(img&&img.src){
      e.preventDefault();
      e.stopPropagation();
      setModalImage({src:img.src,alt:img.alt||''});
    }
  };

  return <><div className="reader-topline"><div className="reader-toolbar-actions">{article&&article.toc.length>0&&<button className="button" aria-expanded={!tocHidden} onClick={toggleContents}>{tocHidden?<PanelRightOpen size={16}/>:<PanelRightClose size={16}/>}<span>{tocHidden?'Show contents':'Hide contents'}</span></button>}<FullscreenButton/></div></div>
    {error?<div className="folder-error" role="alert"><p>{error}</p><button className="button" onClick={()=>setRetry(value=>value+1)}><RefreshCw size={16}/>Retry</button></div>:!article?<div className="empty-state" role="status"><p>Opening {file?.title||'your document'}…</p></div>:<div className={`reader-layout ${tocHidden||!article.toc.length?'toc-collapsed':''}`}><article className="reader-article"><h1>{file?.title}</h1><div className="prose live-article" onClick={handleProseClick}>{article.format==='html'?<div dangerouslySetInnerHTML={{__html:article.content}}/>:article.format==='markdown'?<Markdown content={article.content}/>:article.content.split(/\n\s*\n/).map((paragraph,index)=><p style={{whiteSpace:'pre-wrap'}} key={index}>{paragraph}</p>)}</div></article>{!tocHidden&&article.toc.length>0&&<aside className="reader-toc"><div className="toc-heading"><span className="eyebrow">ON THIS PAGE</span><button className="icon-button" aria-label="Collapse table of contents" onClick={toggleContents}><PanelRightClose size={17}/></button></div><nav aria-label="Table of contents">{article.toc.map(item=><a href={`#${item.id}`} data-level={item.level} key={item.id}>{item.title}</a>)}</nav></aside>}</div>}
    <ImageModal src={modalImage?.src||null} alt={modalImage?.alt} onClose={()=>setModalImage(null)}/>
  </>;
}

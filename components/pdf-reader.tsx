'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCw, ZoomIn, ZoomOut, Scan } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { HandwrittenNote } from '@/lib/handwritten';
import Link from './static-link';
import { FullscreenButton } from './fullscreen-button';

export function PdfReader({note}:{note:HandwrittenNote}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const container=useRef<HTMLDivElement>(null);
  const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null);
  const [page,setPage]=useState(1);
  const [pageInput,setPageInput]=useState('1');
  const [zoom,setZoom]=useState(1);
  const [width,setWidth]=useState(800);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let cancelled=false; let destroy:(()=>void)|undefined;
    setLoading(true);setError('');setPdf(null);setPage(1);setPageInput('1');
    import('pdfjs-dist').then(async engine=>{
      if(cancelled)return;
      engine.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
      const task=engine.getDocument({url:note.file,disableAutoFetch:true,disableStream:true,rangeChunkSize:262144});
      destroy=()=>{void task.destroy();};
      try{const document=await task.promise;if(!cancelled)setPdf(document);}catch{if(!cancelled){setLoading(false);setError('This PDF could not be opened. Please try again.');}}
    }).catch(()=>{if(!cancelled){setLoading(false);setError('The PDF reader could not load. Please try again.');}});
    return()=>{cancelled=true;destroy?.();};
  },[note.file,retry]);
  useEffect(()=>{
    const element=container.current;if(!element)return;
    const observer=new ResizeObserver(entries=>setWidth(Math.max(200,entries[0].contentRect.width-32)));
    observer.observe(element);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!pdf)return;
    let cancelled=false;let task:RenderTask|undefined;
    setLoading(true);setError('');
    pdf.getPage(page).then(async documentPage=>{
      if(cancelled||!canvas.current)return;
      const natural=documentPage.getViewport({scale:1});
      const viewport=documentPage.getViewport({scale:width/natural.width*zoom});
      const ratio=Math.min(window.devicePixelRatio||1,2);
      const element=canvas.current;
      element.width=Math.ceil(viewport.width*ratio);element.height=Math.ceil(viewport.height*ratio);
      element.style.width=`${Math.round(viewport.width)}px`;element.style.height=`${Math.round(viewport.height)}px`;
      task=documentPage.render({canvas:element,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});
      await task.promise;
      if(!cancelled)setLoading(false);
    }).catch(error=>{if(!cancelled&&error?.name!=='RenderingCancelledException'){setLoading(false);setError('This page could not be displayed. Try another page or retry.');}});
    return()=>{cancelled=true;task?.cancel();};
  },[pdf,page,width,zoom]);
  function go(next:number){if(!pdf)return;const value=Math.max(1,Math.min(pdf.numPages,next));setPage(value);setPageInput(String(value));container.current?.scrollTo({top:0,left:0});}
  return <><div className="reader-topline"><Link href="/handwritten/"><ArrowLeft size={16}/>Handwritten notes</Link><FullscreenButton/></div><div className="pdf-title"><h1>{note.title}</h1><p>{note.topic}</p></div>
    <section className="pdf-reader" aria-label={`${note.title} PDF reader`}>
      <div className="pdf-toolbar"><div className="pdf-pages"><button className="icon-button" aria-label="Previous page" disabled={!pdf||page<=1} onClick={()=>go(page-1)}><ChevronLeft size={19}/></button><form onSubmit={e=>{e.preventDefault();go(Number(pageInput)||page);}}><label>Page <input aria-label="PDF page number" inputMode="numeric" type="number" min={1} max={pdf?.numPages||1} value={pageInput} disabled={!pdf} onChange={e=>setPageInput(e.target.value)} onBlur={()=>go(Number(pageInput)||page)}/></label><span> of {pdf?.numPages||'…'}</span></form><button className="icon-button" aria-label="Next page" disabled={!pdf||page>=pdf.numPages} onClick={()=>go(page+1)}><ChevronRight size={19}/></button></div><div className="pdf-zoom"><button className="icon-button" aria-label="Zoom out PDF" disabled={zoom<=.5} onClick={()=>setZoom(z=>Math.max(.5,z-.25))}><ZoomOut size={18}/></button><span>{Math.round(zoom*100)}%</span><button className="icon-button" aria-label="Zoom in PDF" disabled={zoom>=2} onClick={()=>setZoom(z=>Math.min(2,z+.25))}><ZoomIn size={18}/></button><button className="button" onClick={()=>setZoom(1)}><Scan size={16}/>Fit width</button></div></div>
      {error?<div className="pdf-error" role="alert"><p>{error}</p><button className="button" onClick={()=>setRetry(r=>r+1)}><RotateCw size={16}/>Retry</button></div>:<div className="pdf-loading" role="status">{loading?'Opening page…':`Page ${page} of ${pdf?.numPages}`}</div>}
      <div className="pdf-canvas-container" ref={container} aria-busy={loading}>{page===1&&loading&&note.preview&&<img className="pdf-first-preview" src={note.preview} alt={`${note.title}, first page preview`} fetchPriority="high" decoding="async" style={{width:width*zoom,aspectRatio:note.aspectRatio}}/>}<canvas ref={canvas} role="img" aria-label={`${note.title}, page ${page}`} style={{visibility:loading||error?'hidden':'visible',position:loading?'absolute':'static'}}/></div>
    </section>
  </>;
}

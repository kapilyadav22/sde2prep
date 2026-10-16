'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, FileText, Search, RefreshCw, BookOpen } from 'lucide-react';
import Link from './static-link';
import { readFolder,liveFileHref,type LiveFile } from '@/lib/live-folder';

export function HandwrittenLibrary() {
  const [notes,setNotes]=useState<LiveFile[]>([]);
  const [query,setQuery]=useState('');
  const [topic,setTopic]=useState('All topics');
  const [kind,setKind]=useState('all');
  const [loading,setLoading]=useState(true);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [checkedAt,setCheckedAt]=useState('');
  const inFlight=useRef(false);
  const controller=useRef<AbortController|null>(null);
  const refresh=useCallback(async(force=false)=>{
    if(inFlight.current)return;
    inFlight.current=true;setLoading(true);
    controller.current=new AbortController();
    try{const data=await readFolder(force,controller.current.signal);setNotes(data.files);setCheckedAt(data.checkedAt);setLoaded(true);setError('');}
    catch(error){if(!(error instanceof Error&&error.name==='AbortError'))setError(error instanceof Error?error.message:'Unable to read the notes folder.');}
    finally{inFlight.current=false;setLoading(false);}
  },[]);
  useEffect(()=>{
    void refresh();
    const interval=setInterval(()=>{if(document.visibilityState==='visible')void refresh(true);},30_000);
    const onFocus=()=>{if(document.visibilityState==='visible')void refresh(true);};
    document.addEventListener('visibilitychange',onFocus);window.addEventListener('focus',onFocus);
    return()=>{clearInterval(interval);controller.current?.abort();document.removeEventListener('visibilitychange',onFocus);window.removeEventListener('focus',onFocus);};
  },[refresh]);
  const topics=useMemo(()=>[...new Set(notes.map(note=>note.topic))],[notes]);
  const visible=notes.filter(note=>(topic==='All topics'||note.topic===topic)&&(kind==='all'||(kind==='pdf'?note.kind==='pdf':note.kind!=='pdf'))&&`${note.title} ${note.topic}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="page-heading"><div><h1>Handwritten notes</h1><p>PDFs, documents, and Markdown from your notes folder.</p></div><button className="button" onClick={()=>void refresh(true)} disabled={loading}><RefreshCw size={16} className={loading?'is-spinning':''}/>{loading?'Checking…':'Refresh'}</button></div>
    <div className="live-folder-status"><span className="status-dot"/><span>{loaded?`${notes.length} ${notes.length===1?'file':'files'} · Checks for changes every 30 seconds`:'Loading your notes folder…'}</span>{checkedAt&&<small>Updated {new Date(checkedAt).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</small>}</div>
    {error&&<div className="folder-error" role="alert">{error}{loaded&&' Showing the last loaded list until a refresh succeeds.'}</div>}
    {(notes.length>0||loaded)&&<div className="library-toolbar"><div className="filter-tabs">{[{id:'all',label:'All files'},{id:'pdf',label:'PDFs'},{id:'article',label:'Articles'}].map(option=><button key={option.id} className={kind===option.id?'selected':''} aria-pressed={kind===option.id} onClick={()=>setKind(option.id)}>{option.label}</button>)}</div><div className="library-tools"><label className="inline-search"><Search size={17}/><input aria-label="Search handwritten notes" placeholder="Search files…" value={query} onChange={e=>setQuery(e.target.value)}/></label>{topics.length>1&&<select aria-label="Filter handwritten topic" value={topic} onChange={e=>setTopic(e.target.value)}><option>All topics</option>{topics.map(item=><option key={item}>{item}</option>)}</select>}</div></div>}
    <div className="pdf-grid">{visible.map(note=><Link href={liveFileHref(note)} className="pdf-card" key={note.id}><span className="pdf-card-icon">{note.kind==='pdf'?<FileText size={28}/>:<BookOpen size={28}/>}</span><div><small>{note.topic}</small><h2>{note.title}</h2><p>{note.kind==='pdf'?'PDF notebook':note.kind==='markdown'?'Markdown article':note.kind==='gdoc'?'Google Docs article':note.kind==='text'?'Text article':'Word article'}</p></div><ArrowUpRight size={18}/></Link>)}</div>
    {loaded&&!visible.length&&<div className="empty-state"><FileText size={32}/><h2>{notes.length?'No matching files':'No supported files yet'}</h2><p>{notes.length?'Try a different topic or search.':'PDF, Word, Google Docs, and Markdown files added to your folder will appear here automatically.'}</p></div>}
  </>;
}

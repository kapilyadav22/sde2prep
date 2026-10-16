'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from '@/components/static-link';
import { ArrowLeft, ArrowRight, Bookmark, Check, CheckCircle2, Clock3, PanelRightClose, PanelRightOpen, Minus, Plus, BookOpen } from 'lucide-react';
import { FullscreenButton } from './fullscreen-button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Note } from '@/lib/types';
import { useWorkspace, noteHref } from './workspace';
export function Reader({note,children,toc=[]}:{note:Note;children?:ReactNode;toc?:{id:string;title:string;level?:number}[]}){
  const {user,toggle,visit,notes}=useWorkspace();const [size,setSize]=useState(16);const [tocHidden,setTocHidden]=useState(note.category==='lld');const [progress,setProgress]=useState(0);
  useEffect(()=>{visit(note.id);},[note.id,visit]);
  useEffect(()=>{try{const stored=localStorage.getItem('sde2prep-toc-hidden');if(stored!==null)setTocHidden(stored==='true');else if(window.innerWidth<=950)setTocHidden(true);}catch{}},[]);
  function toggleToc(){const next=!tocHidden;setTocHidden(next);try{localStorage.setItem('sde2prep-toc-hidden',String(next));}catch{}}
  useEffect(()=>{const handler=()=>{const body=document.documentElement;const available=body.scrollHeight-window.innerHeight;setProgress(available>0?Math.min(100,Math.max(0,window.scrollY/available*100)):100);};handler();window.addEventListener('scroll',handler,{passive:true});return()=>window.removeEventListener('scroll',handler);},[]);
  const saved=user.saved.includes(note.id);const done=user.completed.includes(note.id);const categoryNotes=notes.filter(n=>n.category===note.category);const index=categoryNotes.findIndex(n=>n.id===note.id);const next=index>=0?categoryNotes[index+1]:null;
  const replaced=!note.local&&user.sources.some(s=>s.id===note.sourceId)&&!notes.some(n=>n.id===note.id);
  return <><div className="reading-progress" style={{width:`${progress}%`}}/><div className="reader-topline"><Link href={`/${note.category}/`}><ArrowLeft size={15}/>{note.category.toUpperCase()} collection</Link><div><button className="icon-button" onClick={()=>setSize(s=>Math.max(14,s-1))} aria-label="Decrease font size"><Minus size={16}/></button><span className="font-label">Aa</span><button className="icon-button" onClick={()=>setSize(s=>Math.min(23,s+1))} aria-label="Increase font size"><Plus size={16}/></button><span className="reader-divider"/><button className="button toc-toggle" aria-controls="reader-contents" aria-expanded={!tocHidden} onClick={toggleToc}>{tocHidden?<PanelRightOpen size={16}/>:<PanelRightClose size={16}/>}<span>{tocHidden?'Show contents':'Hide contents'}</span></button><FullscreenButton/></div></div><div className={`reader-layout ${tocHidden?'toc-collapsed':''} ${note.category==='lld'?'lld-reader':''}`}><article className="reader-article"><div className="eyebrow">{note.category.toUpperCase()}<span className="eyebrow-divider">/</span>{note.tags.at(-1)||'Study notes'}</div><h1>{note.title}</h1><div className="reader-meta"><span className="avatar tiny">KY</span><span>Kapil Yadav</span><span>·</span><span><Clock3 size={14}/>{note.minutes} min read</span></div><div className="reader-actions"><button aria-pressed={done} className={`button ${done?'completed-button':'primary'}`} onClick={()=>toggle('completed',note.id)}>{done?<CheckCircle2 size={16}/>:<Check size={16}/>} {done?'Completed':'Mark as complete'}</button><button aria-pressed={saved} className="button" onClick={()=>toggle('saved',note.id)}><Bookmark size={15} fill={saved?'currentColor':'none'}/>{saved?'Saved':'Save note'}</button></div>{replaced?<div className="source-notice"><BookOpen size={22}/><div><strong>You imported a newer version of this source.</strong><p>Read the updated chapters in the collection.</p><Link href={`/${note.category}/`}>Open updated notes<ArrowRight size={14}/></Link></div></div>:<div className="prose" style={{fontSize:size}}>{children||<ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>}</div>}{next&&<Link className="next-note" href={noteHref(next)}><div><span className="eyebrow">NEXT NOTE</span><strong>{next.title}</strong></div><ArrowRight size={21}/></Link>}</article>{!tocHidden&&<aside id="reader-contents" className="reader-toc"><div className="toc-heading"><span className="eyebrow">ON THIS PAGE</span><button type="button" className="icon-button" aria-label="Collapse table of contents" onClick={toggleToc}><PanelRightClose size={17}/></button></div>{toc.length?<nav aria-label="Table of contents">{toc.map(t=><a key={t.id} href={`#${t.id}`} data-level={t.level||2}>{t.title}</a>)}</nav>:<p>No sections in this note.</p>}</aside>}</div></>;
}
export function LocalReader(){
  const {notes,ready}=useWorkspace();const [id,setId]=useState('');
  useEffect(()=>setId(new URLSearchParams(window.location.search).get('id')||''),[]);
  if(!ready)return <div className="empty-state"><p>Opening your notes…</p></div>;
  const note=notes.find(n=>n.id===id&&n.local);
  if(!note)return <div className="empty-state"><BookOpen size={32}/><h1>This note isn’t in this browser.</h1><p>Browse the published library to keep reading.</p><Link className="button" href="/library/">Explore notes<ArrowRight size={16}/></Link></div>;
  return <Reader key={note.id} note={note}/>;
}

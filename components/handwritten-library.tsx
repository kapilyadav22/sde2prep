'use client';
import { useMemo, useState } from 'react';
import { ArrowUpRight, FileText, Search } from 'lucide-react';
import Link from './static-link';
import type { HandwrittenNote } from '@/lib/handwritten';
export function HandwrittenLibrary({notes}:{notes:HandwrittenNote[]}) {
  const [query,setQuery]=useState('');
  const [topic,setTopic]=useState('All topics');
  const topics=useMemo(()=>[...new Set(notes.map(note=>note.topic))],[notes]);
  const visible=notes.filter(note=>(topic==='All topics'||note.topic===topic)&&`${note.title} ${note.topic}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="page-heading"><div><h1>Handwritten notes</h1><p>Read your PDF notebooks here.</p></div><span className="pdf-count">{notes.length} PDFs</span></div>
    {notes.length>0&&<div className="library-toolbar"><label className="inline-search"><Search size={17}/><input aria-label="Search handwritten notes" placeholder="Search notebooks…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter handwritten topic" value={topic} onChange={e=>setTopic(e.target.value)}><option>All topics</option>{topics.map(item=><option key={item}>{item}</option>)}</select></div>}
    <div className="pdf-grid">{visible.map(note=><Link href={`/handwritten/${note.id}/`} className="pdf-card" key={note.id}><span className="pdf-card-icon"><FileText size={28}/></span><div><small>{note.topic}</small><h2>{note.title}</h2><p>PDF{note.pages?` · ${note.pages} pages`:''}{note.bytes?` · ${(note.bytes/1024/1024).toFixed(1)} MB`:''}</p></div><ArrowUpRight size={18}/></Link>)}</div>
    {!visible.length&&<div className="empty-state"><FileText size={32}/><h2>{notes.length?'No matching notebooks':'No PDFs available yet'}</h2><p>{notes.length?'Try a different topic or search.':'This collection will contain the PDFs from your handwritten notes folder.'}</p></div>}
  </>;
}

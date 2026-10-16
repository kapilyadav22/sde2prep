'use client';
import Link from '@/components/static-link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { LayoutDashboard, Braces, Blocks, Network, Cloud, Folder, Bookmark, Search, ArrowUpRight, ArrowRight, ChevronRight, X, FileText, Check, CheckCircle2, Clock3, BookOpen, Menu, Github, ExternalLink, Layers, Sun, Database, GitFork, Leaf, Workflow, FlaskConical } from 'lucide-react';
import type { Category, Note, Source, Problem } from '@/lib/types';
import { categories } from '@/lib/config';
import { ThemeToggle } from './theme-toggle';
import noteAliases from '@/content/note-aliases.json';

const icons = { dsa: Braces, lld: Blocks, hld: Network, aws: Cloud, redis: Database, multithreading: GitFork, springboot: Leaf, kafka: Workflow, testing: FlaskConical, other: Folder };
const collectionKickers:Record<Category,string>={dsa:"PROBLEM SOLVING",lld:"CODE & CRAFT",hld:"SYSTEM THINKING",aws:"CLOUD ENGINEERING",redis:"DATA & CACHE",multithreading:"JAVA CONCURRENCY",springboot:"JAVA FRAMEWORK",kafka:"EVENT STREAMING",testing:"JAVA TESTING",other:"KEEP EXPLORING"};
type UserData = { saved: string[]; completed: string[]; recent: string[]; solved: string[]; notes: Note[]; sources: Source[] };
const empty: UserData = { saved: [], completed: [], recent: [], solved: [], notes: [], sources: [] };
type ContextType = { notes: Note[]; sources: Source[]; problems: Problem[]; user: UserData; ready: boolean; toggle: (key: 'saved' | 'completed' | 'solved', id: string) => void; visit: (id: string) => void; query: string; setQuery: (value: string) => void };
const WorkspaceContext = createContext<ContextType | null>(null);
export const useWorkspace = () => { const c=useContext(WorkspaceContext); if(!c) throw new Error('Workspace unavailable'); return c; };
export function noteHref(note: Note) { return note.local ? `/reading/?id=${encodeURIComponent(note.id)}` : `/notes/${note.id}/`; }

export function Workspace({ children, initialNotes, initialSources, problems }: { children: ReactNode; initialNotes: Note[]; initialSources: Source[]; problems: Problem[] }) {
  const [user,setUser]=useState<UserData>(empty); const [ready,setReady]=useState(false);
  const [query,setQuery]=useState(''); const [mobile,setMobile]=useState(false); const [toast,setToast]=useState('');
  const pathname=usePathname(); const searchRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{try {const value=JSON.parse(localStorage.getItem('sde2prep-v1')||'null');if(value && Array.isArray(value.notes) && Array.isArray(value.sources) && Array.isArray(value.saved) && Array.isArray(value.completed) && Array.isArray(value.recent) && Array.isArray(value.solved)){const aliases=noteAliases as Record<string,string>;for(const key of ['saved','completed','recent'])value[key]=[...new Set((value[key] as string[]).map(id=>aliases[id]||id))];setUser(value);}}catch{}setReady(true);},[]);
  useEffect(()=>{if(!ready)return;try{localStorage.setItem('sde2prep-v1',JSON.stringify(user));}catch{setToast('Browser storage is full or unavailable. Changes may not be saved on this device.');}},[user,ready]);
  useEffect(()=>{setMobile(false);setQuery('');},[pathname]);
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key==='k'){event.preventDefault();searchRef.current?.focus();}if(event.key==='Escape'){setQuery('');setMobile(false);}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[]);
  useEffect(()=>{if(toast){const timer=setTimeout(()=>setToast(''),6000);return()=>clearTimeout(timer);}},[toast]);
  const overridden=new Set(user.sources.map(s=>s.id));
  const notes=[...initialNotes.filter(n=>!overridden.has(n.sourceId)),...user.notes].filter(n=>n.category!=='dsa');
  const sources=[...initialSources.filter(s=>!overridden.has(s.id)),...user.sources];
  const toggle=useCallback((key:'saved'|'completed'|'solved',id:string)=>setUser(u=>({...u,[key]:u[key].includes(id)?u[key].filter(x=>x!==id):[...u[key],id]})),[]);
  const visit=useCallback((id:string)=>setUser(u=>u.recent[0]===id?u:{...u,recent:[id,...u.recent.filter(x=>x!==id)].slice(0,20)}),[]);
  const results=query.trim()?notes.filter(n=>(n.title+' '+n.description+' '+n.tags.join(' ')).toLowerCase().includes(query.toLowerCase())).slice(0,8):[];
  const category=categories.find(c=>pathname===`/${c.id}/` || pathname===`/${c.id}`);
  const crumbs:{label:string;href?:string}[]=[{label:'Workspace',href:'/'}];
  if(pathname==='/'){
    crumbs[0]={label:'Workspace'};
  }else if(category){
    crumbs.push({label:category.label});
  }else if(pathname.startsWith('/notes/')){
    const slug=pathname.replace(/^\/notes\//,'').replace(/\/$/,'');
    const aliases=noteAliases as Record<string,string>;
    const current=notes.find(n=>n.id===slug||aliases[slug]===n.id);
    if(current){
      const noteCat=categories.find(c=>c.id===current.category);
      if(noteCat)crumbs.push({label:noteCat.label,href:`/${noteCat.id}/`});
      crumbs.push({label:current.title});
    }else{crumbs.push({label:'Reading room'});}
  }else if(pathname.startsWith('/reading')){
    crumbs.push({label:'Reading room'});
  }else if(pathname.startsWith('/handwritten/read')){
    crumbs.push({label:'Handwritten notes',href:'/handwritten/'},{label:'Reader'});
  }else if(pathname.startsWith('/handwritten')){
    crumbs.push({label:'Handwritten notes'});
  }else if(pathname.startsWith('/bookmarks')){
    crumbs.push({label:'Saved notes'});
  }else if(pathname.startsWith('/library')){
    crumbs.push({label:'All notes'});
  }else if(pathname.startsWith('/sources')){
    crumbs.push({label:'Sources'});
  }else{
    crumbs.push({label:'Overview'});
  }
  return <WorkspaceContext.Provider value={{notes,sources,problems,user,ready,toggle,visit,query,setQuery}}>
    <a className="skip-link" href="#main">Skip to content</a>
    {mobile&&<button className="sidebar-overlay" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
    <aside className={`sidebar ${mobile?'is-open':''}`}>
      <Link className="brand" href="/" aria-label="sde2prep home"><span className="brand-icon"><Braces size={21}/></span>sde2<span>prep</span><span className="brand-dot"/></Link>
      <div className="workspace-label">PERSONAL WORKSPACE <span>K</span></div>
      <nav aria-label="Main navigation">
        <Link className={`nav-item ${pathname==='/'?'active':''}`} href="/"><LayoutDashboard size={18}/>Overview</Link>
        <Link className={`nav-item ${pathname.startsWith('/library')?'active':''}`} href="/library/"><BookOpen size={18}/>All notes<span className="nav-count">{notes.length}</span></Link>
        <Link className={`nav-item ${pathname.startsWith('/bookmarks')?'active':''}`} href="/bookmarks/"><Bookmark size={18}/>Saved notes{notes.some(n=>user.saved.includes(n.id))&&<span className="nav-count">{notes.filter(n=>user.saved.includes(n.id)).length}</span>}</Link>
        <Link className={`nav-item ${pathname.startsWith('/handwritten')?'active':''}`} href="/handwritten/"><FileText size={18}/>Handwritten notes</Link>
        <div className="nav-section">YOUR COLLECTIONS</div>
        {categories.map(c=>{const Icon=icons[c.id];return <Link key={c.id} className={`nav-item ${category?.id===c.id?'active':''}`} href={`/${c.id}/`}><Icon className={`icon-${c.id}`} size={18}/>{c.label}<ChevronRight className="nav-chevron" size={14}/></Link>;})}
      </nav>
      <div className="sidebar-bottom"><div className="profile"><span className="avatar">KY</span><div><strong>Kapil Yadav</strong></div></div></div>
    </aside>
    <div className="workspace-main">
      <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={()=>setMobile(true)}><Menu size={21}/></button>{crumbs.map((crumb,index)=>{const isLast=index===crumbs.length-1;return <span key={index} className={`breadcrumb-crumb ${index===0?'breadcrumb-root':''}`}>{index>0&&<ChevronRight size={14} className="breadcrumb-separator" aria-hidden="true"/>}{isLast?<strong aria-current="page" title={crumb.label}>{crumb.label}</strong>:crumb.href?<Link href={crumb.href} title={crumb.label}>{crumb.label}</Link>:<span>{crumb.label}</span>}</span>;})}</nav><div className="topbar-right"><div className="searchbox"><Search size={16}/><input ref={searchRef} aria-label="Search notes" placeholder="Search your notes…" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><ThemeToggle/><span className="topbar-divider"/><span className="avatar small">KY</span></div>
        {query.trim()&&<div className="search-results" role="region" aria-label="Search results"><div className="search-result-heading">SEARCH RESULTS <button className="icon-button" aria-label="Close search" onClick={()=>setQuery('')}><X size={16}/></button></div>{results.length?results.map(n=><Link key={n.id} href={noteHref(n)} onClick={()=>setQuery('')}><FileText size={18}/><div><strong>{n.title}</strong><small>{n.category.toUpperCase()} · {n.minutes} min read</small></div><ArrowUpRight size={16}/></Link>):<p>No notes match “{query}”. Try a topic or service name.</p>}</div>}
      </header>
      <main id="main" className="main-content">{children}</main>

    </div>
    {toast&&<div className="toast" role="status"><CheckCircle2 size={19}/>{toast}<button className="icon-button" aria-label="Dismiss" onClick={()=>setToast('')}><X size={16}/></button></div>}
  </WorkspaceContext.Provider>;
}

export function CategoryIcon({id,size=24}:{id:Category;size?:number}){const Icon=icons[id];return <Icon size={size} strokeWidth={1.7}/>;}
export function NoteCard({note}:{note:Note}){const {user,toggle}=useWorkspace();const saved=user.saved.includes(note.id);return <article className="note-card"><div className="note-card-top"><span className={`mini-category ${note.category}`}><CategoryIcon id={note.category} size={15}/>{note.category.toUpperCase()}</span><button className={`icon-button bookmark-button ${saved?'is-saved':''}`} aria-label={saved?`Unsave ${note.title}`:`Save ${note.title}`} aria-pressed={saved} onClick={()=>toggle('saved',note.id)}><Bookmark size={17} fill={saved?'currentColor':'none'}/></button></div><Link className="note-card-link" href={noteHref(note)}><h3>{note.title}</h3><p>{note.description}</p></Link><div className="note-card-footer"><span><Clock3 size={13}/>{note.minutes} min read</span>{user.completed.includes(note.id)?<span className="completed-label"><Check size={14}/>Completed</span>:<span>{note.local?'Browser import':'Study notes'}<ArrowUpRight size={13}/></span>}</div></article>;}

function ArchitectureArt(){return <div className="architecture-art" aria-hidden="true"><div className="art-grid"/><span className="art-orbit orbit-one"/><span className="art-orbit orbit-two"/><div className="art-node art-user"><Braces size={26}/></div><span className="art-line line-one"/><div className="art-node art-network"><Network size={26}/><small>DESIGN</small></div><span className="art-line line-two"/><div className="art-node art-cloud"><Cloud size={25}/></div><span className="art-line line-three"/><div className="art-node art-db"><Layers size={22}/></div><div className="art-spark spark-one">✳</div><div className="art-spark spark-two">+</div><div className="art-code"><span/>const next = <b>you.levelUp()</b>;</div></div>;}

const collectionMeta: Record<Category, { badge: string; tags: string[] }> = {
  hld: { badge: '36 CHAPTERS', tags: ['System Design', 'Scaling', 'Caching', 'DB Sharding'] },
  lld: { badge: '161 FILES', tags: ['Design Patterns', 'SOLID', 'Java & C++', 'Clean Architecture'] },
  dsa: { badge: '25 PROBLEMS', tags: ['Microsoft Focus', 'Dynamic Programming', 'Graphs', 'Trees'] },
  aws: { badge: '29 SERVICES', tags: ['VPC & Security', 'EC2 & S3', 'DynamoDB', 'Microservices'] },
  redis: { badge: '7 CHAPTERS', tags: ['Distributed Locks', 'TTL & Eviction', 'Pub/Sub', 'Clustering'] },
  multithreading: { badge: '10 CHAPTERS', tags: ['Java Concurrency', 'ThreadPoolExecutor', 'Locks & Sync'] },
  springboot: { badge: '27 CHAPTERS', tags: ['Framework Internals', 'Bean Lifecycle', 'Auto-Configuration'] },
  kafka: { badge: '6 CHAPTERS', tags: ['Event Streaming', 'Partitions', 'Consumer Groups', 'Brokers'] },
  testing: { badge: '4 CHAPTERS', tags: ['JUnit 5 & Mockito', 'Unit Testing', 'Mock Injections'] },
  other: { badge: 'EXPLORE', tags: ['Curated Insights', 'Study Notes'] },
};

export function Dashboard(){
  const {notes,user,problems}=useWorkspace();
  const recent=user.recent.map(id=>notes.find(n=>n.id===id)).filter(Boolean) as Note[];

  // Curated high-yield architecture chapters for SDE 2 interviews
  const highYieldSlugs = [
    'hld-notes-t-2x0ms32xl9nw',
    'hld-notes-t-attd6lhp8ubr',
    'hld-notes-t-zc2e3vmnwi65',
    'aws-original-t-0',
    'redis-notes-t-0',
    'java-multithreading-1',
  ];
  const highYieldNotes: Note[] = [];
  for (const s of highYieldSlugs) {
    const found = notes.find(n => n.id === s || n.id.includes(s));
    if (found && !highYieldNotes.some(h => h.id === found.id)) highYieldNotes.push(found);
  }
  if (highYieldNotes.length < 5) {
    for (const cat of ['hld', 'aws', 'redis', 'multithreading', 'springboot'] as Category[]) {
      const fallback = notes.find(n => n.category === cat && !highYieldNotes.some(h => h.id === n.id));
      if (fallback) highYieldNotes.push(fallback);
    }
  }

  const solvedCount = problems.filter(p => user.solved.includes(p.id)).length;
  const completedCount = notes.filter(n => user.completed.includes(n.id)).length;
  const savedCount = notes.filter(n => user.saved.includes(n.id)).length;
  const solvedPercent = problems.length ? Math.round((solvedCount / problems.length) * 100) : 0;

  const roadmapMilestones = [
    {
      phase: '01',
      title: 'Data Structures & Algorithms',
      desc: 'Microsoft interview focus list (DP, Graphs, Trees, Arrays)',
      href: '/dsa/',
      count: `${solvedCount}/${problems.length} solved`,
      done: solvedCount > 0 && solvedCount === problems.length,
    },
    {
      phase: '02',
      title: 'Low-Level Design & Code Craft',
      desc: '161 complete implementation files, SOLID principles & GoF patterns',
      href: '/lld/',
      count: '161 files',
      done: false,
    },
    {
      phase: '03',
      title: 'High-Level System Design',
      desc: 'Scalability, Caching, DB Sharding, URL Shortener, and Rate Limiter',
      href: '/hld/',
      count: '36 chapters',
      done: false,
    },
    {
      phase: '04',
      title: 'Enterprise Backend & Cloud',
      desc: 'AWS Cloud architecture, Spring Boot internals, Redis cache & Kafka',
      href: '/aws/',
      count: '69 chapters',
      done: false,
    },
    {
      phase: '05',
      title: 'Production Testing & Reliability',
      desc: 'JUnit 5 & Mockito best practices, fault tolerance and assertions',
      href: '/testing/',
      count: '4 chapters',
      done: false,
    },
  ];

  return (
    <>
      {/* 1. Showstopper Hero Banner */}
      <section className="hero-banner" aria-label="Welcome banner">
        <div className="hero-ambient-glow" aria-hidden="true" />
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span className="pulse-dot" />
            <span>SDE 2 INTERVIEW WORKSPACE · KAPIL YADAV</span>
          </div>
          <h2>A little learning. <em>A big leap.</em></h2>
          <p>
            Your comprehensive engineering interview vault. Master High-Level System Design, Low-Level Architecture, Cloud Engineering, Redis Caching, and Java Concurrency with 159+ chapters and 25 targeted Microsoft DSA practice problems.
          </p>
          <div className="hero-actions">
            <Link className="button hero-button-primary" href={recent[0] ? noteHref(recent[0]) : '/hld/'}>
              {recent[0] ? 'Continue reading' : 'Explore System Design'}
              <ArrowRight size={16} />
            </Link>
            <Link className="button hero-button-secondary" href="/dsa/">
              <Braces size={16} />
              <span>Microsoft DSA Track</span>
            </Link>
            <Link className="button hero-button-ghost" href="/library/">
              <BookOpen size={16} />
              <span>All 159+ Notes</span>
            </Link>
          </div>
          <div className="hero-badges">
            <span className="hero-pill"><Check size={13} /> 159 In-depth chapters</span>
            <span className="hero-pill"><Check size={13} /> 161 LLD implementations</span>
            <span className="hero-pill"><Check size={13} /> 25 Microsoft DSA problems</span>
          </div>
        </div>
        <ArchitectureArt />
      </section>

      {/* 2. Executive Stat Cards */}
      <div className="stat-grid">
        <Link href="/library/" className="stat-card">
          <div className="stat-card-header">
            <span className="stat-icon-wrap icon-green"><BookOpen size={20} /></span>
            <span className="stat-badge">9 DOMAINS</span>
          </div>
          <div className="stat-card-body">
            <strong>{notes.length}</strong>
            <span>Study notes &amp; chapters</span>
          </div>
          <div className="stat-card-footer">
            <span>Verified engineering notes</span>
            <ArrowUpRight size={14} />
          </div>
        </Link>

        <Link href="/dsa/" className="stat-card">
          <div className="stat-card-header">
            <span className="stat-icon-wrap icon-blue"><Braces size={20} /></span>
            <span className="stat-badge">{solvedPercent}% DONE</span>
          </div>
          <div className="stat-card-body">
            <strong>{solvedCount} <span className="stat-total">/ {problems.length}</span></strong>
            <span>Microsoft DSA solved</span>
          </div>
          <div className="stat-progress-bar">
            <span style={{ width: `${solvedPercent}%` }} />
          </div>
        </Link>

        <Link href="/library/" className="stat-card">
          <div className="stat-card-header">
            <span className="stat-icon-wrap icon-emerald"><CheckCircle2 size={20} /></span>
            <span className="stat-badge">REVISION</span>
          </div>
          <div className="stat-card-body">
            <strong>{completedCount}</strong>
            <span>Notes completed</span>
          </div>
          <div className="stat-card-footer">
            <span>Mark chapters as you read</span>
            <ArrowUpRight size={14} />
          </div>
        </Link>

        <Link href="/bookmarks/" className="stat-card">
          <div className="stat-card-header">
            <span className="stat-icon-wrap icon-purple"><Bookmark size={20} /></span>
            <span className="stat-badge">FAST RECALL</span>
          </div>
          <div className="stat-card-body">
            <strong>{savedCount}</strong>
            <span>Bookmarked notes</span>
          </div>
          <div className="stat-card-footer">
            <span>Quick revision before interviews</span>
            <ArrowUpRight size={14} />
          </div>
        </Link>
      </div>

      {/* 3. Microsoft DSA Spotlight Banner */}
      <div className="microsoft-banner">
        <div className="ms-logo" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
        <div className="ms-content">
          <span className="eyebrow"><span className="little-dot" />TARGET COMPANY FOCUS</span>
          <h2>Microsoft Interview Focus · DSA Practice Track</h2>
          <p>25 curated interview problems spanning Dynamic Programming, Graphs, Trees, Arrays, and Strings with direct LeetCode integration.</p>
        </div>
        <div className="ms-meta">
          <div className="practice-progress">
            <strong>{solvedCount}<span> / {problems.length}</span></strong>
            <small>solved ({solvedPercent}%)</small>
            <div className="progress-track">
              <span style={{ width: `${solvedPercent}%` }} />
            </div>
          </div>
          <Link href="/dsa/" className="button primary">
            Practice problems <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* 4. Rich Curated Collections Grid */}
      <section className="collections-section">
        <div className="section-heading">
          <div>
            <h2>Engineering Collections</h2>
            <p>10 specialized curriculum tracks curated for senior engineering roles</p>
          </div>
          <Link href="/library/" className="text-link">
            All notes <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="collection-grid">
          {categories.map(c => {
            const count = notes.filter(n => n.category === c.id).length;
            const meta = collectionMeta[c.id] || { badge: `${count} NOTES`, tags: ['Study Notes'] };
            return (
              <Link key={c.id} className={`collection-card ${c.id}`} href={`/${c.id}/`}>
                <div className="collection-card-top">
                  <span className="collection-icon">
                    <CategoryIcon id={c.id} size={22} />
                  </span>
                  <span className="collection-badge">{c.id === 'dsa' ? `${problems.length} PROBLEMS` : meta.badge}</span>
                  <ArrowUpRight className="collection-arrow" size={18} />
                </div>
                <h3>{c.label}</h3>
                <p>{c.description || c.name}</p>
                <div className="collection-tags">
                  {meta.tags.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="collection-tag">{tag}</span>
                  ))}
                </div>
              </Link>
            );
          })}
          <Link className="collection-card handwritten" href="/handwritten/">
            <div className="collection-card-top">
              <span className="collection-icon">
                <FileText size={22} />
              </span>
              <span className="collection-badge">LIVE FOLDER</span>
              <ArrowUpRight className="collection-arrow" size={18} />
            </div>
            <h3>Handwritten</h3>
            <p>Original sketches, PDFs, architectural drawings, and reading room.</p>
            <div className="collection-tags">
              <span className="collection-tag">PDF Viewer</span>
              <span className="collection-tag">Original Diagrams</span>
              <span className="collection-tag">Study Sketches</span>
            </div>
          </Link>
        </div>
      </section>

      {/* 5. Two-Column Interactive Hub (Recent / High-Yield & Preparation Journey) */}
      <div className="dashboard-columns">
        <div className="dashboard-column-left">
          <div className="section-heading">
            <div>
              <h2>{recent.length > 0 ? 'Recently opened notes' : 'High-yield architecture reads'}</h2>
              <p>{recent.length > 0 ? 'Pick up right where you left off' : 'Core foundation chapters for system design and architecture'}</p>
            </div>
            <Link href="/library/" className="text-link">
              All {notes.length} notes <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="recent-list">
            {(recent.length > 0 ? recent.slice(0, 5) : highYieldNotes.slice(0, 5)).map(n => (
              <Link href={noteHref(n)} key={n.id} className="recent-note">
                <span className={`recent-note-icon ${n.category}`}>
                  <CategoryIcon id={n.category} size={20} />
                </span>
                <div className="recent-note-info">
                  <h3>{n.title}</h3>
                  <p>
                    <span className={`cat-pill ${n.category}`}>{n.category.toUpperCase()}</span>
                    <span>·</span>
                    <span><Clock3 size={12} /> {n.minutes} min read</span>
                    {user.completed.includes(n.id) && (
                      <>
                        <span>·</span>
                        <span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Check size={12} /> Completed
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <ArrowUpRight size={16} className="recent-note-arrow" />
              </Link>
            ))}
          </div>
        </div>

        <div className="dashboard-column-right">
          <div className="section-heading">
            <div>
              <h2>Preparation milestones</h2>
              <p>5 structured phases for SDE 2 readiness</p>
            </div>
            <Link href="/dsa/" className="text-link">
              Practice track <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="journey-card">
            <div className="journey-title">
              <span aria-hidden="true">🎯</span>
              <div>
                <h2>SDE 2 Interview Track</h2>
                <p>Structured from fundamental intuition to production scale.</p>
              </div>
            </div>

            <div className="journey-steps">
              {roadmapMilestones.map((s, idx) => (
                <Link href={s.href} key={idx} className={`journey-step ${s.done ? 'done' : ''}`}>
                  <span className="step-number">{s.phase}</span>
                  <div className="step-info">
                    <strong>{s.title}</strong>
                    <small>{s.desc}</small>
                  </div>
                  <span className="step-count">{s.count}</span>
                  <ChevronRight size={15} className="step-chevron" />
                </Link>
              ))}
            </div>

            <div className="journey-footer">
              <span>Personal progress saved automatically</span>
              <Link href="/library/" className="text-link">Explore all <ArrowRight size={12} /></Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function LibraryView({category,saved=false}:{category?:Category;saved?:boolean}){
  const {notes,user,sources,problems}=useWorkspace();const [filter,setFilter]=useState('all');const [search,setSearch]=useState('');const [sort,setSort]=useState('default');const [limit,setLimit]=useState(18);const config=categories.find(c=>c.id===category);
  let filtered=notes.filter(n=>(!category||n.category===category)&&(!saved||user.saved.includes(n.id))&&(filter==='all'||filter==='complete'?filter!=='complete'||user.completed.includes(n.id):n.category===filter)&&(n.title+' '+n.description).toLowerCase().includes(search.toLowerCase()));
  if(sort==='title')filtered=[...filtered].sort((a,b)=>a.title.localeCompare(b.title));if(sort==='short')filtered=[...filtered].sort((a,b)=>a.minutes-b.minutes);if(sort==='updated')filtered=[...filtered].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const missing=sources.find(s=>s.category===category&&s.status==='Needs import');
  return <><div className="page-heading"><div><div className="eyebrow">{saved?'KEEP THE GOOD ONES CLOSE':'YOUR KNOWLEDGE LIBRARY'}</div><h1>{saved?'Saved for a second look.':config?.name||'Every note. One workspace.'}</h1><p>{saved?'The ideas you want to come back to.':config?.description||'Small discoveries, big ideas, and everything in between.'}</p></div></div>

  <div className="library-toolbar"><div className="filter-tabs"><button onClick={()=>{setFilter('all');setLimit(18);}} className={filter==='all'?'selected':''}>{category?'All notes':'All collections'}<span>{notes.filter(n=>(!category||n.category===category)&&(!saved||user.saved.includes(n.id))).length}</span></button>{!category&&categories.filter(c=>c.id!=='dsa').map(c=><button key={c.id} className={filter===c.id?'selected':''} onClick={()=>{setFilter(c.id);setLimit(18);}}>{c.label}</button>)}<button className={filter==='complete'?'selected':''} onClick={()=>setFilter('complete')}>Completed</button></div><div className="library-tools"><div className="inline-search"><Search size={15}/><input aria-label="Filter notes" placeholder="Find a note…" value={search} onChange={e=>{setSearch(e.target.value);setLimit(18);}}/></div><select aria-label="Sort notes" value={sort} onChange={e=>setSort(e.target.value)}><option value="default">Source order</option><option value="updated">Recently updated</option><option value="title">Title A–Z</option><option value="short">Shortest read</option></select></div></div>
  {filtered.length?<><div className="note-grid">{filtered.slice(0,limit).map(n=><NoteCard key={n.id} note={n}/>)}</div>{filtered.length>limit&&<div className="load-more"><button className="button" onClick={()=>setLimit(l=>l+18)}>Show more notes<span>{filtered.length-limit} remaining</span></button></div>}</>:<div className="empty-state"><span><BookOpen size={33}/></span><h2>{search?'No notes found.':saved?'Your next great find belongs here.':'Room for something new.'}</h2><p>{search?'Try a different search or collection.':saved?'Tap the bookmark on any note to save it for later.':'New notes will appear here when this collection is updated.'}</p>{saved?<Link className="button primary" href="/library/">Explore notes<ArrowRight size={15}/></Link>:<Link className="button primary" href="/library/">Explore notes<ArrowRight size={15}/></Link>}</div>}
  </>;
}

export function DSAView(){
  const {problems}=useWorkspace();
  return <><div className="page-heading"><div><div className="eyebrow">PROBLEM SOLVING</div><h1>Data structures &amp; algorithms</h1><p>Microsoft interview problems with direct LeetCode links.</p></div></div><MicrosoftPractice problems={problems}/></>;
}

function MicrosoftPractice({problems}:{problems:Problem[]}){
  const {user,toggle}=useWorkspace();const [topic,setTopic]=useState('All topics');const [search,setSearch]=useState('');const [unsolved,setUnsolved]=useState(false);
  const topics=[...new Set(problems.map(p=>p.topic))];const solved=problems.filter(p=>user.solved.includes(p.id)).length;
  const filtered=problems.filter(p=>(topic==='All topics'||p.topic===topic)&&p.title.toLowerCase().includes(search.toLowerCase())&&(!unsolved||!user.solved.includes(p.id)));
  return <section className="practice-panel" id="microsoft"><div className="practice-header"><div className="ms-logo"><i/><i/><i/><i/></div><div><span className="eyebrow">COMPANY FOCUS</span><h2>Microsoft DSA collection</h2><p>Track your progress across the Microsoft problem list.</p></div><div className="practice-progress"><strong>{solved}<span> / {problems.length}</span></strong><small>problems solved</small><div className="progress-track"><span style={{width:`${problems.length?solved/problems.length*100:0}%`}}/></div></div></div><div className="practice-tools"><div className="inline-search"><Search size={16}/><input aria-label="Search Microsoft problems" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search problems…"/></div><select value={topic} onChange={e=>setTopic(e.target.value)} aria-label="Filter problem topic"><option>All topics</option>{topics.map(t=><option key={t}>{t}</option>)}</select><label className="checkbox-label"><input type="checkbox" checked={unsolved} onChange={e=>setUnsolved(e.target.checked)}/>Unsolved only</label></div><div className="problem-table-wrap"><table className="problem-table"><thead><tr><th scope="col">DONE</th><th scope="col">PROBLEM</th><th scope="col">TOPIC</th><th scope="col">PRACTICE</th></tr></thead><tbody>{filtered.map((p,i)=><tr key={p.id} className={user.solved.includes(p.id)?'solved':''}><td><input type="checkbox" aria-label={`Mark ${p.title} as solved`} checked={user.solved.includes(p.id)} onChange={()=>toggle('solved',p.id)}/></td><td><span className="problem-index">{String(i+1).padStart(2,'0')}</span><a className="problem-title-link" href={p.url} target="_blank" rel="noreferrer">{p.title}</a>{p.premium&&<span className="premium-label">Premium</span>}</td><td><span className="topic-pill">{p.topic}</span></td><td><a href={p.url} target="_blank" rel="noreferrer" title={p.leetcodeTitle||p.title} aria-label={`Practice ${p.title} on LeetCode`}>LeetCode<ArrowUpRight size={14}/></a></td></tr>)}</tbody></table>{!filtered.length&&<p className="no-problems">No problems match these filters.</p>}</div><div className="practice-source"><span>Completion is saved in this browser</span></div></section>;
}

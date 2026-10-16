'use client';

import { useMemo, useState } from 'react';
import Link from '@/components/static-link';
import { ArrowRight, Check, ChevronRight, Code2, FileCode2, FileText, Folder, FolderOpen, Github, Layers, Search } from 'lucide-react';
import { useWorkspace, noteHref } from './workspace';
import { buildLldTree, commonFolder, fileLanguage, isCodeFile, lldFileId, type LldChapterManifest, type LldTree } from '@/lib/lld-source';
import styles from './lld-browser.module.css';

function FolderContents({ tree, href }: { tree: LldTree; href: string }) {
  return <ul className={styles.tree}>
    {tree.folders.map(folder => <li key={folder.path}><details open><summary><ChevronRight size={11} /><Folder size={13} /><span>{folder.name}</span></summary><FolderContents tree={folder} href={href} /></details></li>)}
    {tree.files.map(file => <li key={file.path}><Link href={`${href}#${lldFileId(file.path)}`} title={`Read ${file.path}`}>{isCodeFile(file.path) ? <FileCode2 size={13} /> : <FileText size={13} />}<span>{file.path.split('/').at(-1)}</span><small>{fileLanguage(file.path)}</small></Link></li>)}
  </ul>;
}

export function LLDBrowser({ chapters = [] }: { chapters?: LldChapterManifest[] }) {
  const { notes, user } = useWorkspace();
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('all');
  const collection = notes.filter(note => note.category === 'lld');
  const manifest = useMemo(() => new Map(chapters.map(chapter => [chapter.id, chapter])), [chapters]);
  const allFiles = [...new Set(chapters.flatMap(chapter => chapter.paths))];
  const filtered = collection.filter(note => {
    const paths = manifest.get(note.id)?.paths || [];
    const cpp = paths.length > 0 && paths.every(path => path.startsWith('src/cpp/'));
    return (language === 'all' || (language === 'cpp' ? cpp : !cpp)) && `${note.title} ${note.description} ${paths.join(' ')}`.toLowerCase().includes(query.toLowerCase());
  });
  const groups = [
    { id: 'java', title: 'Java & shared implementations', caption: 'System designs, practical variations, and design notes.', items: filtered.filter(note => { const paths = manifest.get(note.id)?.paths; return !paths?.length || !paths.every(path => path.startsWith('src/cpp/')); }) },
    { id: 'cpp', title: 'C++ implementations', caption: 'C++ designs, patterns, concurrency, and language references.', items: filtered.filter(note => { const paths = manifest.get(note.id)?.paths; return paths?.length && paths.every(path => path.startsWith('src/cpp/')); }) },
  ];

  return <>
    <div className="page-heading"><div><div className="eyebrow">DESIGN THROUGH CODE</div><h1>Low-level design</h1><p>Follow each design from its requirements to the original implementation.</p></div></div>
    <section className={styles.hero} aria-label="Repository overview"><span className={styles.heroIcon}><Code2 size={28} /></span><div><span className={styles.eyebrow}>MS_LLD · KAPILYADAV22</span><h2>Every design. In its place.</h2><p>Explore topics, expand folders, and read each source file with its original code and comments.</p><div className={styles.stats}><span><Layers size={13} />{collection.length} designs & topics</span><span><FileCode2 size={13} />{allFiles.length} source files</span><span>Java & C++</span></div></div><a href="https://github.com/kapilyadav22/MS_LLD" target="_blank" rel="noreferrer"><Github size={15} />View repository<ArrowRight size={12} /></a></section>
    <div className={styles.toolbar}><div className={styles.filters} aria-label="Implementation language">{[{ id: 'all', name: 'All implementations' }, { id: 'java', name: 'Java & shared' }, { id: 'cpp', name: 'C++' }].map(option => <button key={option.id} className={language === option.id ? styles.activeFilter : ''} onClick={() => setLanguage(option.id)} aria-pressed={language === option.id}>{option.name}</button>)}</div><label className={styles.search}><Search size={15} /><input aria-label="Search low-level designs and source files" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a design or file…" /></label></div>
    {groups.map(group => group.items.length > 0 && <section className={styles.group} key={group.id}><div className={styles.groupHeading}><span>{group.id === 'cpp' ? 'C++' : 'J'}</span><div><h2>{group.title}</h2><p>{group.caption}</p></div><small>{group.items.length} topics</small></div><div className={styles.cards}>
      {group.items.map(note => {
        const chapter = manifest.get(note.id);
        const files = (chapter?.paths || []).map(path => ({ path, text: '' }));
        const base = commonFolder(files);
        const tree = buildLldTree(files, base);
        const languages = [...new Set(files.filter(file => isCodeFile(file.path)).map(file => fileLanguage(file.path)))];
        const completed = user.completed.includes(note.id);
        return <article className={styles.card} key={note.id}>
          <div className={styles.cardTop}><span className={styles.folderIcon}><FolderOpen size={20} /></span><div><Link href={noteHref(note)}><h3>{note.title}</h3></Link><p>{files.length ? `${files.length} ${files.length === 1 ? 'file' : 'files'} · ${languages.join(' & ') || 'Design notes'}` : `${note.minutes} min read`}</p></div>{completed && <span className={styles.completed} title="Completed"><Check size={14} /></span>}</div>
          {files.length > 0 ? <details className={styles.structure}><summary><ChevronRight size={12} /><span>Explore folder structure</span><small>{files.length}</small></summary><div className={styles.folderTree}><div className={styles.root}><Folder size={12} /><span>{base}</span></div><FolderContents tree={tree} href={noteHref(note)} /></div></details> : <p className={styles.description}>{note.description}</p>}
          <Link className={styles.open} href={noteHref(note)}><span>Read design & code</span><ArrowRight size={13} /></Link>
        </article>;
      })}
    </div></section>)}
    {!filtered.length && <div className="empty-state"><Search size={28} /><h2>No matching implementations.</h2><p>Try a design name, folder, or source filename.</p></div>}
  </>;
}

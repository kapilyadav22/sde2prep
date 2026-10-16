'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Code2, ExternalLink, FileCode2, FileText, Folder, FolderOpen, ListTree, Minus, Plus, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildLldTree, commonFolder, fileLanguage, fileLineCount, githubFileUrl, isCodeFile, lldFileId as fileId, type LldSourceFile, type LldTree } from '@/lib/lld-source';
import { CodeBlock } from './code-block';
import styles from './lld-document.module.css';

function SourceTree({ tree, selected, onSelect }: { tree: LldTree; selected: string; onSelect: (file: LldSourceFile) => void }) {
  return <ul className={styles.tree}>
    {tree.folders.map(folder => <li key={folder.path}>
      <details open className={styles.folder}>
        <summary><ChevronRight className={styles.folderChevron} size={12} /><Folder size={14} /><span>{folder.name}</span></summary>
        <SourceTree tree={folder} selected={selected} onSelect={onSelect} />
      </details>
    </li>)}
    {tree.files.map(file => <li key={file.path}><a className={selected === file.path ? styles.activeFile : ''} href={`#${fileId(file.path)}`} onClick={() => onSelect(file)}>{isCodeFile(file.path) ? <FileCode2 size={14} /> : <FileText size={14} />}<span>{file.path.split('/').at(-1)}</span></a></li>)}
  </ul>;
}

function Documentation({ file }: { file: LldSourceFile }) {
  if (/\.md$/i.test(file.path)) return <div className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
    img: ({ src, alt }) => <img src={src} alt={alt || 'Original repository diagram'} loading="lazy" />,
    pre: ({ children }) => <div className={styles.markdownPre}>{children}</div>,
  }}>{file.text}</ReactMarkdown></div>;
  return <div className={styles.plainText}>{file.text || 'This file is empty in the original repository.'}</div>;
}

export function LLDDocument({ files }: { files: LldSourceFile[] }) {
  const initialFiles = useMemo(() => {
    const documentation = files.filter(file => !isCodeFile(file.path));
    const firstCode = files.find(file => isCodeFile(file.path));
    return [...documentation.map(file => file.path), ...(firstCode ? [firstCode.path] : [])];
  }, [files]);
  const [expanded, setExpanded] = useState<string[]>(initialFiles);
  const [selected, setSelected] = useState(initialFiles[0] || files[0]?.path || '');
  const [query, setQuery] = useState('');
  const base = commonFolder(files);
  const filteredFiles = useMemo(() => files.filter(file => file.path.toLowerCase().includes(query.toLowerCase())), [files, query]);
  const tree = useMemo(() => buildLldTree(filteredFiles, base), [filteredFiles, base]);
  const languages = [...new Set(files.filter(file => isCodeFile(file.path)).map(file => fileLanguage(file.path)))];
  useEffect(() => {
    const followHash = () => {
      const file = files.find(file => `#${fileId(file.path)}` === window.location.hash);
      if (file) {
        setSelected(file.path);
        setExpanded(current => current.includes(file.path) ? current : [...current, file.path]);
      }
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, [files]);
  const toggle = (path: string) => setExpanded(current => current.includes(path) ? current.filter(value => value !== path) : [...current, path]);
  function select(file: LldSourceFile) {
    setSelected(file.path);
    setExpanded(current => current.includes(file.path) ? current : [...current, file.path]);
  }

  if (!files.length) return null;
  return <section className={styles.document} aria-label="Original implementation files">
    <div className={styles.introduction}><span className={styles.introIcon}><Code2 size={21} /></span><div><strong>Implementation</strong><p>{files.length} original {files.length === 1 ? 'file' : 'files'}{languages.length ? ` · ${languages.join(' & ')}` : ''}</p></div></div>
    <div className={styles.workspace}>
      <aside className={styles.explorer}>
        <div className={styles.explorerHeading}><ListTree size={15} /><strong>Files</strong><span>{files.length}</span></div>
        <label className={styles.search}><Search size={13} /><input aria-label="Find an implementation file" placeholder="Find a file…" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <nav aria-label="Implementation file hierarchy"><div className={styles.root}><FolderOpen size={14} /><span>{base || 'Repository'}</span></div>{filteredFiles.length ? <SourceTree tree={tree} selected={selected} onSelect={select} /> : <p className={styles.noFiles}>No matching files.</p>}</nav>
      </aside>
      <div className={styles.files}>
        <div className={styles.fileTools}><div><button type="button" onClick={() => setExpanded(files.map(file => file.path))}><Plus size={12} />Expand all</button><button type="button" onClick={() => setExpanded([])}><Minus size={12} />Collapse all</button></div></div>
        {files.map(file => {
          const open = expanded.includes(file.path);
          const relative = base && file.path.startsWith(`${base}/`) ? file.path.slice(base.length + 1) : file.path;
          return <details key={file.path} id={fileId(file.path)} className={`${styles.file} ${selected === file.path ? styles.selectedFile : ''}`} open={open}>
            <summary onClick={event => { event.preventDefault(); setSelected(file.path); toggle(file.path); }}>
              <span className={styles.fileChevron}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
              {isCodeFile(file.path) ? <FileCode2 size={17} /> : <FileText size={17} />}
              <span className={styles.fileName}>{relative}</span><span className={styles.fileLanguage}>{fileLanguage(file.path)}</span>
            </summary>
            <div className={styles.fileBody}>
              <div className={styles.sourcePath}><span title={file.path}>{file.path}</span></div>
              {isCodeFile(file.path) ? <CodeBlock code={file.text} path={file.path} collapsible={false} /> : <Documentation file={file} />}
              <div className={styles.fileFooter}><span>{fileLineCount(file.text).toLocaleString()} lines</span><a href={`#${fileId(file.path)}`} onClick={() => setSelected(file.path)}>Back to file header</a></div>
            </div>
          </details>;
        })}
      </div>
    </div>
  </section>;
}

'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, Download, WrapText } from 'lucide-react';
import { fileLanguage, fileLineCount } from '@/lib/lld-source';
import styles from './code-block.module.css';

type Token = { text: string; kind: string };
const keywords = new Set('abstract assert boolean break byte case catch char class const continue default delete do double else enum explicit extends extern false final finally float for friend goto if implements import instanceof int interface long namespace native new null nullptr operator override package private protected public record return short signed sizeof static strictfp struct super switch synchronized template this throw throws transient true try typedef typename union unsigned using var virtual void volatile while'.split(' '));
const builtins = new Set('String System Object Integer Long Double Boolean Character List ArrayList LinkedList Map HashMap Set HashSet TreeSet Queue PriorityQueue Deque ArrayDeque Optional Collections Comparator Thread Runnable ExecutorService ReentrantLock AtomicInteger ConcurrentHashMap Vector vector string std cout cin endl unordered_map unordered_set mutex unique_lock lock_guard shared_ptr unique_ptr make_shared make_unique condition_variable'.split(' '));

/** Small lexical highlighter: every character of the original source is retained as text. */
function highlight(source: string): Token[][] {
  const pattern = /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|@[\w.]+|#[ \t]*\w+|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFdDlL]?\b|\b[A-Za-z_$][\w$]*\b/g;
  const tokens: Token[] = [];
  let position = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > position) tokens.push({ text: source.slice(position, match.index), kind: '' });
    const text = match[0];
    const kind = text.startsWith('//') || text.startsWith('/*') ? 'comment'
      : text.startsWith('"') || text.startsWith("'") ? 'string'
      : text.startsWith('@') || text.startsWith('#') ? 'annotation'
      : /^\d/.test(text) ? 'number'
      : keywords.has(text) ? 'keyword'
      : builtins.has(text) || /^[A-Z][A-Za-z0-9]*$/.test(text) ? 'type' : '';
    tokens.push({ text, kind });
    position = match.index + text.length;
  }
  if (position < source.length) tokens.push({ text: source.slice(position), kind: '' });
  const lines: Token[][] = [[]];
  for (const token of tokens) {
    const parts = token.text.split('\n');
    parts.forEach((text, index) => {
      if (index) lines.push([]);
      if (text) lines[lines.length - 1].push({ text, kind: token.kind });
    });
  }
  return lines;
}

export function CodeBlock({ code, path = '', language, collapsible = true }: { code: string; path?: string; language?: string; collapsible?: boolean }) {
  const [wrapped, setWrapped] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const lines = useMemo(() => highlight(code), [code]);
  const label = language || fileLanguage(path);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch { setCopyState('failed'); }
    window.setTimeout(() => setCopyState('idle'), 2500);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = path.split('/').at(-1) || 'code.txt';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className={styles.block}>
    <div className={styles.toolbar} data-source-chrome="true">
      {collapsible && <button type="button" className={styles.collapse} aria-label={collapsed ? 'Expand source code' : 'Collapse source code'} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>}
      <span className={styles.language}>{label}</span>
      <span className={styles.lines}>{fileLineCount(code).toLocaleString()} lines</span>
      <div className={styles.actions}>
        <button type="button" className={wrapped ? styles.selected : ''} aria-label="Wrap long code lines" aria-pressed={wrapped} title="Wrap long lines" onClick={() => setWrapped(!wrapped)}><WrapText size={15} /><span>Wrap</span></button>
        <button type="button" aria-label={`Download ${path.split('/').at(-1) || 'source code'}`} title="Download original file" onClick={download}><Download size={15} /></button>
        <button type="button" onClick={copy} aria-label="Copy original source code">{copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}<span>{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Try again' : 'Copy'}</span></button>
      </div>
      <span className={styles.srOnly} role="status">{copyState === 'copied' ? 'Source code copied to clipboard.' : copyState === 'failed' ? 'Clipboard is unavailable. Select the code to copy it.' : ''}</span>
    </div>
    {!collapsed && (code ? <pre className={`${styles.pre} ${wrapped ? styles.wrap : ''}`} tabIndex={0} aria-label={`${label} source code${path ? `: ${path}` : ''}`}><code>{lines.map((line, index) => <span className={styles.line} data-line={index + 1} key={index}>{line.map((token, tokenIndex) => <span key={tokenIndex} className={token.kind ? styles[token.kind] : undefined}>{token.text}</span>)}{index < lines.length - 1 && <span className={styles.lineBreak}>{'\n'}</span>}</span>)}</code></pre> : <p className={styles.empty}>This file is empty in the original repository.</p>)}
    {collapsed && <button type="button" className={styles.expand} onClick={() => setCollapsed(false)}><ChevronDown size={14} />Show {fileLineCount(code).toLocaleString()} lines of source code</button>}
  </div>;
}

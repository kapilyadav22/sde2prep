import fs from 'node:fs';
import path from 'node:path';
import sources from '@/content/sources.json';
import type { Note } from './types';
import type { NativeTab } from './native-document';
const cache=new Map<string,{tabs:NativeTab[]}>();
export function originalTabs(note:Note):NativeTab[]{
  const ids=note.originalTabIds||[note.originalTabId].filter(Boolean) as string[];
  if(!ids.length)return [];
  const source=sources.find(s=>s.id===note.sourceId) as {nativeSnapshot?:string}|undefined;
  if(!source?.nativeSnapshot)return [];
  let document=cache.get(note.sourceId);
  if(!document){document=JSON.parse(fs.readFileSync(path.join(process.cwd(),'content',source.nativeSnapshot),'utf8'));cache.set(note.sourceId,document!);}
  return ids.map(id=>document!.tabs.find(t=>t.tabId===id)).filter(Boolean) as NativeTab[];
}
export const tabAnchor=(id:string)=>`tab-${id.replace(/[^a-z0-9-]/gi,'-')}`;

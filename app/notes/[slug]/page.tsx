import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { library, origin } from '@/lib/content';
import { Reader } from '@/components/reader';
import { Markdown } from '@/components/markdown';
import aliases from '@/content/note-aliases.json';
import { originalTabs, tabAnchor } from '@/lib/original-documents';
import { LLDDocument } from '@/components/lld-document';
import { filesForLldNote, lldFileId } from '@/lib/lld-source';
import githubFiles from '@/content/raw/github.json';
import { OriginalDocument } from '@/components/original-document';
import { nativeToc, type NativeTab } from '@/lib/native-document';
const aliasMap=aliases as Record<string,string>;
const resolveNote=(slug:string)=>library.notes.find(n=>n.id===(aliasMap[slug]||slug));
export function generateStaticParams(){return library.notes.map(n=>({slug:n.id}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const n=resolveNote(slug);if(!n)return{};return {title:n.title,description:n.description,alternates:{canonical:`/notes/${n.id}/`},openGraph:{type:'article',title:n.title,description:n.description,modifiedTime:n.updatedAt,authors:['Kapil Yadav']}};}
export default async function NotePage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const note=resolveNote(slug);if(!note)notFound();const tabs=originalTabs(note);const lldFiles=note.category==='lld'?filesForLldNote(note.content,githubFiles):[];const toc=lldFiles.length?lldFiles.map(f=>({id:lldFileId(f.path),title:f.path.replace(/^src\//,'')})):tabs.length?(tabs.length===1?nativeToc(tabs[0]):tabs.map(t=>({id:tabAnchor(t.tabId),title:t.title}))):[...note.content.matchAll(/^#{1,4}\s+(.+)$/gm)].map((m,i)=>({id:`section-${i+1}`,title:m[1].replace(/[*`]/g,'')}));const schema={'@context':'https://schema.org','@type':'LearningResource',name:note.title,description:note.description,learningResourceType:'Study notes',educationalLevel:'Software engineer interview preparation',inLanguage:'en',author:{'@type':'Person',name:'Kapil Yadav'},dateModified:note.updatedAt,url:`${origin}/notes/${note.id}/`};return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\u003c')}}/><Reader note={{...note,content:''}} toc={toc}>{lldFiles.length?<LLDDocument files={lldFiles}/>:tabs.length?tabs.map(tab=><section key={tab.tabId} className="original-chapter-section" id={tabAnchor(tab.tabId)}>{tabs.length>1&&<h2 className="original-chapter-title">{tab.title}</h2>}<OriginalDocument tab={tab}/></section>):<Markdown content={note.content}/>}</Reader></>;}

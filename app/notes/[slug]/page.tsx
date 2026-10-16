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
import { nativePresentation } from '@/lib/native-presentation.mjs';
import { HLD_ROADMAP_TAB_ID } from '@/lib/hld-roadmap.mjs';
const aliasMap=aliases as Record<string,string>;
const resolveNote=(slug:string)=>library.notes.find(n=>n.id===(aliasMap[slug]||slug));
export function generateStaticParams(){return library.notes.map(n=>({slug:n.id}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const n=resolveNote(slug);if(!n)return{};return {title:n.title,description:n.description,alternates:{canonical:`/notes/${n.id}/`},openGraph:{type:'article',title:n.title,description:n.description,modifiedTime:n.updatedAt,authors:['Kapil Yadav']}};}
export default async function NotePage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const note=resolveNote(slug);if(!note)notFound();const tabs=originalTabs(note);const presentations=tabs.map(tab=>nativePresentation(tab,{articleTitle:note.title,sectionTitle:tabs.length>1?tab.title:undefined}));const lldFiles=note.category==='lld'?filesForLldNote(note.content,githubFiles):[];const toc=lldFiles.length?lldFiles.map(f=>({id:lldFileId(f.path),title:f.path.replace(/^src\//,'')})):tabs.length?(tabs.length===1?presentations[0].toc:tabs.map(t=>({id:tabAnchor(t.tabId),title:t.title}))):[...note.content.matchAll(/^#{1,4}\s+(.+)$/gm)].map((m,i)=>({id:`section-${i+1}`,title:m[1].replace(/[*`]/g,'')}));const schema={'@context':'https://schema.org','@type':'LearningResource',name:note.title,description:note.description,learningResourceType:'Study notes',educationalLevel:'Software engineer interview preparation',inLanguage:'en',author:{'@type':'Person',name:'Kapil Yadav'},dateModified:note.updatedAt,url:`${origin}/notes/${note.id}/`};return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\u003c')}}/><Reader note={{...note,content:''}} toc={toc}>{lldFiles.length?<LLDDocument files={lldFiles}/>:tabs.length?tabs.map((tab,index)=><section key={tab.tabId} className="original-chapter-section" id={tabAnchor(tab.tabId)}>{presentations[index].showSectionTitle&&<h2 className="original-chapter-title">{tab.title}</h2>}<>{tab.tabId===HLD_ROADMAP_TAB_ID&&<p className="roadmap-help" id="hld-roadmap-help">Change any problem’s status below. Your progress is saved in this browser.</p>}<OriginalDocument tab={tab} presentation={presentations[index]} codeSections={note.category==='multithreading'}/></></section>):<Markdown content={note.content}/>}</Reader></>;}

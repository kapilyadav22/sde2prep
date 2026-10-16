import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { library, origin } from '@/lib/content';
import { Reader } from '@/components/reader';
import { Markdown } from '@/components/markdown';
import aliases from '@/content/note-aliases.json';
import document from '@/content/raw/aws-native.json';
import { OriginalDocument } from '@/components/original-document';
import { nativeToc, type NativeTab } from '@/lib/native-document';
const aliasMap=aliases as Record<string,string>;
const resolveNote=(slug:string)=>library.notes.find(n=>n.id===(aliasMap[slug]||slug));
export function generateStaticParams(){return [...library.notes.map(n=>({slug:n.id})),...Object.keys(aliasMap).filter(id=>!library.notes.some(n=>n.id===id)).map(slug=>({slug}))];}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const n=resolveNote(slug);if(!n)return{};return {title:n.title,description:n.description,alternates:{canonical:`/notes/${n.id}/`},openGraph:{type:'article',title:n.title,description:n.description,modifiedTime:n.updatedAt,authors:['Kapil Yadav']}};}
export default async function NotePage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const note=resolveNote(slug);if(!note)notFound();const tab=note.originalTabId?(document.tabs as unknown as NativeTab[]).find(t=>t.tabId===note.originalTabId):undefined;const toc=tab?nativeToc(tab):[...note.content.matchAll(/^#{1,4}\s+(.+)$/gm)].map((m,i)=>({id:`section-${i+1}`,title:m[1].replace(/[*`]/g,'')}));const schema={'@context':'https://schema.org','@type':'LearningResource',name:note.title,description:note.description,learningResourceType:'Study notes',educationalLevel:'Software engineer interview preparation',inLanguage:'en',author:{'@type':'Person',name:'Kapil Yadav'},dateModified:note.updatedAt,url:`${origin}/notes/${note.id}/`};return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\u003c')}}/><Reader note={{...note,content:''}} toc={toc}>{tab?<OriginalDocument tab={tab}/>:<Markdown content={note.content}/>}</Reader></>;}

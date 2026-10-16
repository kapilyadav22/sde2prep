import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { categories } from '@/lib/config';
import { LibraryView, DSAView } from '@/components/workspace';
import { LLDBrowser } from '@/components/lld-browser';
import { lldManifest } from '@/lib/lld-source';
import { library } from '@/lib/content';
import githubFiles from '@/content/raw/github.json';
export function generateStaticParams(){return categories.map(c=>({category:c.id}));}
export async function generateMetadata({params}:{params:Promise<{category:string}>}):Promise<Metadata>{const {category}=await params;const c=categories.find(c=>c.id===category);return {title:c?.name||'Collection',description:c?`${c.name} interview preparation notes. ${c.description}`:undefined,alternates:{canonical:`/${category}/`}};}
export default async function CategoryPage({params}:{params:Promise<{category:string}>}){const {category}=await params;const c=categories.find(c=>c.id===category);if(!c)notFound();return c.id==='dsa'?<DSAView/>:c.id==='lld'?<LLDBrowser chapters={lldManifest(library.notes,githubFiles)}/>:<LibraryView key={c.id} category={c.id}/>;}

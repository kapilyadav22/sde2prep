import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { categories } from '@/lib/config';
import { LibraryView } from '@/components/workspace';
export function generateStaticParams(){return categories.map(c=>({category:c.id}));}
export async function generateMetadata({params}:{params:Promise<{category:string}>}):Promise<Metadata>{const {category}=await params;const c=categories.find(c=>c.id===category);return {title:c?.name||'Collection',description:c?`${c.name} interview preparation notes. ${c.description}`:undefined,alternates:{canonical:`/${category}/`}};}
export default async function CategoryPage({params}:{params:Promise<{category:string}>}){const {category}=await params;const c=categories.find(c=>c.id===category);if(!c)notFound();return <LibraryView key={c.id} category={c.id}/>;}

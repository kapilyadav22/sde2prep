import { notFound } from 'next/navigation';
import { handwrittenNotes } from '@/lib/handwritten';
import { PdfReader } from '@/components/pdf-reader';
export function generateStaticParams(){return handwrittenNotes.map(note=>({id:note.id}));}
export const dynamicParams=false;
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const note=handwrittenNotes.find(note=>note.id===id);return {title:note?.title||'PDF not found',description:note?`${note.title} — ${note.topic} handwritten PDF notes.`:undefined,alternates:{canonical:`/handwritten/${id}/`}};}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const note=handwrittenNotes.find(note=>note.id===id);if(!note)notFound();return <PdfReader note={note}/>;}

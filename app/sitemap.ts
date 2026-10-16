import type { MetadataRoute } from 'next';
import { library,origin } from '@/lib/content';
import { handwrittenNotes } from '@/lib/handwritten';
import { categories } from '@/lib/config';
export const dynamic='force-static';
export default function sitemap():MetadataRoute.Sitemap{return [{url:origin,changeFrequency:'weekly',priority:1},{url:`${origin}/library/`,changeFrequency:'weekly',priority:.9},{url:origin+'/handwritten/',changeFrequency:'weekly',priority:.8},...handwrittenNotes.map(n=>({url:origin+'/handwritten/'+n.id+'/',changeFrequency:'monthly' as const,priority:.7})),...categories.map(c=>({url:`${origin}/${c.id}/`,changeFrequency:'weekly' as const,priority:.8})),...library.notes.map(n=>({url:`${origin}/notes/${n.id}/`,lastModified:n.updatedAt,changeFrequency:'monthly' as const,priority:.6}))];}

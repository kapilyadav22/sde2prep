import type { MetadataRoute } from 'next';
import {origin} from '@/lib/content';
export const dynamic='force-static';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/reading/','/sources/','/bookmarks/']},sitemap:`${origin}/sitemap.xml`};}

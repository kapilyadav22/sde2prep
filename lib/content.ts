import data from '@/content/library.json';
import type { Library } from './types';
export const library = data as Library;
export { categories } from './config';
export const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://sde2prep-kapil.safe-bison-7629.chatgpt.site';

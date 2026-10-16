import data from '@/content/library.json';
import type { Library } from './types';
// DSA is a practice list; its source notebooks are retained only for maintenance.
export const library: Library = {
  ...data as Library,
  notes: (data as Library).notes.filter(note => note.category !== 'dsa'),
  problems: (data as Library).problems.filter(problem => /^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/$/.test(problem.url || '')),
};
export { categories } from './config';
export const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://sde2prep-kapil.safe-bison-7629.chatgpt.site';

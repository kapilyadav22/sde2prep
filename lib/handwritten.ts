import data from '@/content/handwritten.json';
export type HandwrittenNote = { id: string; title: string; topic: string; file: string; bytes?: number; pages?: number; preview?: string; aspectRatio?: number };
export const handwrittenNotes = data as HandwrittenNote[];

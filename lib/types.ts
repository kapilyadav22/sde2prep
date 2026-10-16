export type Category = 'dsa' | 'lld' | 'hld' | 'aws' | 'redis' | 'multithreading' | 'springboot' | 'kafka' | 'testing' | 'other';
export type Note = { id: string; title: string; category: Category; sourceId: string; sourceUrl?: string; description: string; content: string; minutes: number; updatedAt: string; tags: string[]; local?: boolean; originalTabId?: string; originalTabIds?: string[] };
export type Source = { id: string; title: string; category: Category; type: string; url?: string; file?: string; updatedAt: string; status: string };
export type Problem = { id: string; title: string; url?: string; topic: string; sourceUrl?: string; leetcodeId?: number; leetcodeTitle?: string; premium?: boolean; linkNote?: string };
export type Library = { notes: Note[]; sources: Source[]; problems: Problem[] };

export type Category = 'dsa' | 'lld' | 'hld' | 'aws' | 'other';
export type Note = { id: string; title: string; category: Category; sourceId: string; sourceUrl?: string; description: string; content: string; minutes: number; updatedAt: string; tags: string[]; local?: boolean };
export type Source = { id: string; title: string; category: Category; type: string; url?: string; file?: string; updatedAt: string; status: string };
export type Problem = { id: string; title: string; url?: string; topic: string };
export type Library = { notes: Note[]; sources: Source[]; problems: Problem[] };

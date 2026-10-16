export type LldSourceFile = { path: string; text: string };
export type LldChapterManifest = { id: string; title: string; paths: string[] };
export type LldTree = { name: string; path: string; folders: LldTree[]; files: LldSourceFile[] };

/** Match the existing chapter boundaries to the original files, without parsing or rewriting code. */
export function filesForLldNote(content: string, files: LldSourceFile[]): LldSourceFile[] {
  const paths = new Set([...content.matchAll(/^## (src\/[^\r\n]+)\r?$/gm)].map(match => match[1]));
  return files.filter(file => paths.has(file.path));
}

export function lldManifest(notes: { id: string; title: string; category: string; content: string }[], files: LldSourceFile[]): LldChapterManifest[] {
  return notes.filter(note => note.category === 'lld').map(note => ({
    id: note.id,
    title: note.title,
    paths: filesForLldNote(note.content, files).map(file => file.path),
  }));
}

export function fileLanguage(path: string): string {
  const extension = path.split('.').at(-1)?.toLowerCase();
  return ({ java: 'Java', cpp: 'C++', cc: 'C++', h: 'C++', hpp: 'C++', md: 'Markdown', docs: 'Notes', txt: 'Text', xml: 'XML', json: 'JSON' } as Record<string, string>)[extension || ''] || 'Text';
}

export function isCodeFile(path: string): boolean {
  return /\.(java|cpp|cc|h|hpp|xml|json)$/i.test(path);
}

export function commonFolder(files: LldSourceFile[]): string {
  if (!files.length) return 'src';
  const first = files[0].path.split('/').slice(0, -1);
  let length = first.length;
  for (const file of files.slice(1)) {
    const parts = file.path.split('/').slice(0, -1);
    let index = 0;
    while (index < length && first[index] === parts[index]) index++;
    length = index;
  }
  return first.slice(0, length).join('/');
}

export function buildLldTree(files: LldSourceFile[], base = commonFolder(files)): LldTree {
  const root: LldTree = { name: base.split('/').at(-1) || 'src', path: base, folders: [], files: [] };
  for (const file of files) {
    const relative = base && file.path.startsWith(`${base}/`) ? file.path.slice(base.length + 1) : file.path;
    const parts = relative.split('/');
    let parent = root;
    for (const part of parts.slice(0, -1)) {
      const path = parent.path ? `${parent.path}/${part}` : part;
      let folder = parent.folders.find(folder => folder.path === path);
      if (!folder) { folder = { name: part, path, folders: [], files: [] }; parent.folders.push(folder); }
      parent = folder;
    }
    parent.files.push(file);
  }
  return root;
}

/** Code elements use this same source string for rendering, copying, and downloading. */
export function fileLineCount(text: string): number {
  return text ? text.split('\n').length : 0;
}

export function githubFileUrl(path: string, branch = 'master'): string {
  return `https://github.com/kapilyadav22/MS_LLD/blob/${encodeURIComponent(branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function lldFileId(path: string): string {
  let hash = 0;
  for (const character of path) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return `source-${path.split('/').at(-1)?.replace(/[^a-z\d]+/gi, '-').toLowerCase()}-${(hash >>> 0).toString(36)}`;
}

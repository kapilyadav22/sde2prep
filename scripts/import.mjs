import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import { makeNotes, replaceSource, slug } from './content.mjs';
const [file, category, sourceId, ...titleParts] = process.argv.slice(2);
if (!file || !['dsa','lld','hld','aws','redis','multithreading','springboot','kafka','testing','other'].includes(category) || !sourceId) {
  console.error('Usage: npm run import -- /path/notes.docx aws aws-notes "AWS notes"\nSupports .docx, .pdf, .md, .txt and an exported sde2prep .json library. Reuse the source ID to replace an earlier version.'); process.exit(1);
}
const libraryPath = new URL('../content/library.json', import.meta.url);
let library = JSON.parse(await fs.readFile(libraryPath, 'utf8'));
const ext = path.extname(file).toLowerCase();
if (ext === '.json') {
  const uploaded = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!Array.isArray(uploaded.notes) || !Array.isArray(uploaded.sources)) throw new Error('Expected an exported sde2prep library.');
  for (const source of uploaded.sources) {
    if (!['dsa','lld','hld','aws','redis','multithreading','springboot','kafka','testing','other'].includes(source.category) || typeof source.id !== 'string') throw new Error('Invalid source.');
    const notes = uploaded.notes.filter(n => n.sourceId === source.id);
    if (notes.some(n => typeof n.content !== 'string' || typeof n.id !== 'string' || typeof n.title !== 'string' || n.category !== source.category)) throw new Error('Invalid notes.');
    library = replaceSource(library, source, notes.map(({local, ...note}) => note));
  }
} else {
  let text;
  if (ext === '.docx') text = (await mammoth.extractRawText({ path: file })).value;
  else if (ext === '.pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(await fs.readFile(file)), useSystemFonts: true });
    const pdf = await task.promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p); const content = await page.getTextContent();
      pages.push(content.items.map(i => ('str' in i ? i.str + (i.hasEOL ? '\n' : ' ') : '')).join(''));
    }
    text = pages.join('\n\n');
    await task.destroy();
  } else if (['.txt', '.md'].includes(ext)) text = await fs.readFile(file, 'utf8');
  else throw new Error('Unsupported format. Convert legacy .doc files to .docx first.');
  const source = { id: slug(sourceId), title: titleParts.join(' ') || path.basename(file, ext), category, type: ext.slice(1).toUpperCase(), updatedAt: new Date().toISOString(), status: 'Imported' };
  library = replaceSource(library, source, makeNotes(text, source));
}
const tmp = new URL('../content/library.tmp.json', import.meta.url);
await fs.writeFile(tmp, JSON.stringify(library, null, 2));
await fs.rename(tmp, libraryPath);
console.log(`Imported successfully. ${library.notes.length} notes in the library. Run npm run build to update published pages.`);

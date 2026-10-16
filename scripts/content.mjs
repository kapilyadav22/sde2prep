export const slug = (value) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'notes';
export function clean(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\uec03|\uec02|\ue403|\ue402||/g, '\n```\n').replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n').trim();
}
export function makeNotes(text, source, title = source.title) {
  const body = clean(text);
  if (!body.trim()) throw new Error('No readable text found. Scanned PDFs need OCR before importing.');
  // Keep original text intact. Split only at paragraph boundaries, so no source content is discarded.
  const sections = [];
  const paragraphs = body.split(/\n\s*\n/);
  let current = ''; let inFence = false;
  for (const p of paragraphs) {
    if (current.length > 6500 && !inFence) { sections.push(current.trim()); current = ''; }
    for (const line of p.split('\n')) if (/^\s*```/.test(line)) inFence = !inFence;
    current += p + '\n\n';
  }
  if (current.trim()) sections.push(current.trim());
  return sections.map((content, i) => {
    const first = content.split('\n').find(x => x.trim() && x.trim().length > 5 && x.trim().length < 100 && !/^[*•|`]/.test(x.trim()));
    const heading = first?.replace(/^#+\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
    const name = sections.length === 1 ? title : i === 0 ? title : `${title} · ${heading || `Part ${i + 1}`}`;
    return { id: `${source.id}-${i + 1}`, title: name, category: source.category, sourceId: source.id, sourceUrl: source.url, description: content.replace(/[#*`>]/g, '').replace(/\s+/g, ' ').slice(0, 160), content, minutes: Math.max(1, Math.ceil(content.split(/\s+/).length / 220)), updatedAt: source.updatedAt, tags: [source.category.toUpperCase(), source.type === 'GitHub' ? 'Implementation' : 'Study notes'] };
  });
}
export function replaceSource(library, source, notes) {
  return { ...library, sources: [...library.sources.filter(s => s.id !== source.id), source], notes: [...library.notes.filter(n => n.sourceId !== source.id), ...notes] };
}

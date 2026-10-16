import { isNativeCode, nativeCodeText } from './native-code.mjs';

/** Only whitespace, case, and terminal title punctuation are presentation differences. */
export const titleKey = text => text.normalize('NFKC').replace(/\s+/g, ' ').trim().replace(/[:.]+$/, '').trim().toLowerCase();

/** @param {import('./native-document').NativeBlock} block */
export function isEmptyNativeParagraph(block) {
  return !!block.paragraph && (block.paragraph.elements || []).every(element => element.textRun && !element.textRun.content.trim());
}

/** Build a display plan without modifying the stored source or code.
 * @param {import('./native-document').NativeTab} tab
 * @param {{articleTitle?:string,sectionTitle?:string}} options
 */
export function nativePresentation(tab, { articleTitle = '', sectionTitle = '' } = {}) {
  const blocks = tab.body?.content || [];
  const hidden = new Set();
  const headings = new Map();
  const first = blocks.find(block => !isEmptyNativeParagraph(block) && (block.paragraph || block.table));
  const firstText = first?.paragraph ? nativeCodeText(first).trim() : '';
  const isTitle = block => !!block.paragraph && !block.paragraph.bullet
    && (block.paragraph.elements || []).every(element => element.textRun)
    && !isNativeCode(block) && nativeCodeText(block).trim().length <= 180;
  // Docs often stores headings as normal paragraphs with bold words. Number/emoji
  // prefixes can be separate unstyled runs, so only alphabetic runs establish emphasis.
  const styledTitle = block => {
    if (!isTitle(block)) return false;
    const runs=(block.paragraph.elements || []).filter(element=>element.textRun && /\p{L}/u.test(element.textRun.content));
    const text=nativeCodeText(block).trim();
    const size=Math.max(0,...runs.map(element=>element.textRun.textStyle?.fontSize?.magnitude || 0));
    return runs.length>0 && runs.every(element=>element.textRun.textStyle?.bold)
      && !/[.,;]$/.test(text) && (size>=14 || /[:?]$/.test(text));
  };
  const articleMatch = !!first && isTitle(first) && !!titleKey(articleTitle) && titleKey(firstText) === titleKey(articleTitle);
  const sectionMatch = !!first && isTitle(first) && !!titleKey(sectionTitle) && titleKey(firstText) === titleKey(sectionTitle);
  const showSectionTitle = !!sectionTitle && titleKey(sectionTitle) !== titleKey(articleTitle) && !sectionMatch;
  if (articleMatch) hidden.add(first);

  // A source title can supply the chapter heading rather than repeating a generated one.
  const firstRuns = first?.paragraph?.elements?.filter(element => element.textRun?.content.trim()) || [];
  const firstIsBoldTitle = !!first && isTitle(first) && firstRuns.length > 0
    && firstRuns.every(element => element.textRun?.textStyle?.bold) && !/[.!?]$/.test(firstText);
  const promoted = !articleMatch && (sectionMatch || firstIsBoldTitle) ? first : undefined;
  if (promoted) headings.set(promoted, 2);

  // Suppress only consecutive heading-led title copies, never repeated code or table values.
  let previous;
  for (const block of blocks) {
    if (isEmptyNativeParagraph(block)) continue;
    if (!isTitle(block)) { previous = undefined; continue; }
    const rawHeading = /^HEADING_/.test(block.paragraph.paragraphStyle?.namedStyleType || '') || styledTitle(block);
    const previousHeading = previous && (/^HEADING_/.test(previous.paragraph.paragraphStyle?.namedStyleType || '') || styledTitle(previous) || headings.has(previous) || hidden.has(previous));
    if (previous && (rawHeading || previousHeading) && titleKey(nativeCodeText(previous)) === titleKey(nativeCodeText(block))) {
      hidden.add(block);
    } else previous = block;
  }

  const sourceLevels = [...new Set(blocks.filter(block => !hidden.has(block)).map(block => Number(/^HEADING_(\d)/.exec(block.paragraph?.paragraphStyle?.namedStyleType || '')?.[1] || 0)).filter(Boolean))].sort((a,b) => a-b);
  const promotedIsRawHeading = promoted && /^HEADING_/.test(promoted.paragraph.paragraphStyle?.namedStyleType || '');
  const base = showSectionTitle || (promoted && !promotedIsRawHeading) ? 3 : 2;
  for (const block of blocks) {
    const raw = Number(/^HEADING_(\d)/.exec(block.paragraph?.paragraphStyle?.namedStyleType || '')?.[1] || 0);
    if (raw && !hidden.has(block) && block !== promoted) headings.set(block, Math.min(6, base + sourceLevels.indexOf(raw)));
  }
  let parentLevel=showSectionTitle?2:1;
  for (const block of blocks) {
    if (hidden.has(block)) continue;
    if (headings.has(block)) { parentLevel=headings.get(block); continue; }
    if (!styledTitle(block)) continue;
    const text=nativeCodeText(block).trim();
    const section=/^[🔹🔸🔷🔶]/u.test(text);
    const level=section?(showSectionTitle?3:2):Math.min(6,parentLevel+1);
    headings.set(block,level);
    if (section) parentLevel=level;
  }
  // Source documents sometimes jump from Heading 1 directly to Heading 4.
  let previousLevel=showSectionTitle?2:1;
  for (const block of blocks) {
    if (!headings.has(block) || hidden.has(block)) continue;
    const level=Math.min(headings.get(block),previousLevel+1);
    headings.set(block,level);
    previousLevel=level;
  }
  const toc = blocks.filter(block => headings.has(block) && !hidden.has(block)).map(block => ({
    id: `original-${tab.tabId.replace(/[^a-z0-9-]/gi, '-')}-${block.startIndex || 0}`,
    title: nativeCodeText(block).trim(), level: headings.get(block),
  }));
  return { hidden, headings, showSectionTitle, toc };
}

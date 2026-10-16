/** @param {import('./native-document').NativeBlock} block */
export function nativeCodeText(block) {
  return (block.paragraph?.elements || []).map(element => element.textRun?.content || '').join('');
}

/** @param {import('./native-document').NativeBlock} block */
function eligible(block) {
  const paragraph = block?.paragraph;
  return !!paragraph && !paragraph.bullet
    && !/^HEADING_/.test(paragraph.paragraphStyle?.namedStyleType || '')
    && !(paragraph.elements || []).some(element => !element.textRun);
}

/** Word code fonts are useful evidence, but bold monospace also occurs in prose.
 * @param {import('./native-document').NativeBlock} block
 */
export function isNativeCode(block) {
  if (!eligible(block)) return false;
  const text = nativeCodeText(block).trim();
  if (!text) return false;
  const runs = block.paragraph.elements.filter(element => element.textRun?.content.trim()).map(element => element.textRun);
  if (runs.every(run => /mono|courier|consolas/i.test(run.textStyle?.weightedFontFamily?.fontFamily || ''))
      && !runs.every(run => run.textStyle?.bold)) return true;

  // The original also contains complete examples in its normal paragraph font.
  return /^(?:\/\/|\/\*|\*\/|\*(?:\s|$))/.test(text)
    || /^[{}()[\];,]+(?:\s*\/\/.*)?$/.test(text)
    || /^}\s*,[^]*\);$/.test(text)
    || /^@[\w.]+(?:\([^]*\))?$/.test(text)
    || /^(?:(?:public|protected|private|static|final|abstract|sealed)\s+)*(?:class|interface|enum|record|import|package)\s+[\w$.]/.test(text)
    || /^(?:}\s*)?(?:(?:else\s+)?(?:if|for|while|switch|catch|synchronized)\s*\(|(?:else|try|finally|do)\s*(?:\{|$))/.test(text)
    || /^(?:return|throw)\s+[^]*;/.test(text)
    || /^(?:break|continue);?$/.test(text)
    || /^(?:new\s+)?[\w$.]+(?:<[^>]+>)?\([^]*(?:[);{]|\/\/[^]*)$/.test(text)
    || /^(?:new\s+)?[\w$.]+(?:<[^>]+>)?\($/.test(text)
    || /^\.[A-Za-z_$][\w$]*\(/.test(text)
    || /^(?:(?:public|protected|private|static|final|volatile|synchronized|native|abstract)\s+)*[\w$]+(?:<[^>]+>)?(?:\[\])*\s+[\w$]+\s*(?:=|;|\([^]*(?:\{|;)$)/.test(text)
    || /^[\w$.\[\]]+\s*(?:\+\+|--|[+*/%-]?=)[^]*;/.test(text)
    || /^(?:acquire|work)$/.test(text);
}

/** Group only consecutive code, retaining blank lines between source paragraphs.
 * @param {import('./native-document').NativeBlock[]} content
 * @param {number} start
 */
export function nativeCodeGroup(content, start) {
  if (!isNativeCode(content[start])) return null;
  let end = start + 1;
  let cursor = end;
  let parameters = nativeCodeText(content[start]).trim().endsWith('(');
  while (cursor < content.length) {
    const text = nativeCodeText(content[cursor]).trim();
    const parameter = parameters && eligible(content[cursor])
      && /^(?:final\s+)?[A-Za-z_$][\w$]*(?:<[^>]+>)?(?:\[\])*\s+[a-z_$][\w$]*,?$/.test(text);
    if (isNativeCode(content[cursor]) || parameter) {
      parameters = text.endsWith('(') || (parameter && text.endsWith(','));
      end = ++cursor;
    } else if (eligible(content[cursor]) && !text) {
      cursor++;
    } else break;
  }
  return { end, code: content.slice(start, end).map(nativeCodeText).join('') };
}

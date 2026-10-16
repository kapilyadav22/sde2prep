import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Google Docs' masked reads keep their original array positions, so merge the
// complementary responses without flattening tables or transforming source text.
const root = new URL('../', import.meta.url);
const read = async name => JSON.parse(await fs.readFile(new URL(`content/raw/${name}`, root), 'utf8'));
const [paragraphs, styles, tables, images, children, previous] = await Promise.all([
  read('hld-paragraph-parts.json'), read('hld-styles-parts.json'),
  read('hld-tables-parts.json'), read('hld-image-parts.json'),
  read('hld-child-parts.json'), read('hld-native.json'),
]);

function merge(a, b, path = '') {
  if (b === null || b === undefined) return structuredClone(a);
  if (a === null || a === undefined) return structuredClone(b);
  if (Array.isArray(a) && Array.isArray(b)) {
    assert.equal(a.length, b.length, `Source array size changed: ${path}`);
    return a.map((item, i) => merge(item, b[i], `${path}[${i}]`));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const out = structuredClone(a);
    for (const [key, value] of Object.entries(b)) out[key] = merge(out[key], value, `${path}.${key}`);
    return out;
  }
  assert.equal(a, b, `Source value changed between complementary reads: ${path}`);
  return a;
}

const byTab = doc => new Map(doc.tabs.map(tab => [tab.tabId, tab]));
const maps = [styles, tables, images, children].map(byTab);
const tabs = [];
for (const tab of paragraphs.tabs) {
  let body;
  let properties;
  if (tab.parentTabId) {
    const child = maps[3].get(tab.tabId);
    assert.ok(child?.body?.content, `Missing full child tab: ${tab.tabId}`);
    body = merge(tab.body, child.body, tab.tabId);
    properties = child;
  } else {
    const [style, table, image] = maps.map(m => m.get(tab.tabId));
    assert.ok(style?.body?.content && table?.body?.content && image, `Missing root parts: ${tab.tabId}`);
    body = merge(merge(tab.body, style.body, `${tab.tabId}.styles`), table.body, `${tab.tabId}.tables`);
    properties = image;
  }
  tabs.push({tabId:tab.tabId,title:tab.title,parentTabId:tab.parentTabId,index:tab.index,
    nestingLevel:tab.nestingLevel,body,inlineObjects:properties.inlineObjects||{},lists:properties.lists||{}});
}

const counts = {tabs:tabs.length,rootTabs:tabs.filter(t=>!t.parentTabId).length,childTabs:tabs.filter(t=>t.parentTabId).length,
  paragraphs:0,tables:0,tableRows:0,tableCells:0,images:0,imageDefinitions:0,listItems:0,
  textRuns:0,styledRuns:0,monospaceRuns:0,characters:0,headings:0};
const textByTab = new Map();
const imageByTab = new Map();
const localImages = new Set();
function visit(blocks, onParagraph, onTable=()=>{}) {
  for(const block of blocks||[]) {
    if(block.paragraph) onParagraph(block);
    if(block.table) {
      onTable(block.table);
      for(const row of block.table.tableRows||[]) for(const cell of row.tableCells||[]) visit(cell.content,onParagraph,onTable);
    }
  }
}
function paragraphText(paragraph) {return (paragraph.elements||[]).map(e=>e.textRun?.content||'').join('');}
for(const tab of tabs) {
  const text=[], imageIds=[];
  visit(tab.body.content, block=>{
    const paragraph=block.paragraph;
    counts.paragraphs++;
    if(paragraph.bullet) counts.listItems++;
    if(paragraph.paragraphStyle?.namedStyleType?.startsWith('HEADING_')) counts.headings++;
    text.push({startIndex:block.startIndex,text:paragraphText(paragraph)});
    for(const element of paragraph.elements||[]) {
      if(element.textRun) {
        counts.textRuns++;
        counts.characters+=element.textRun.content?.length||0;
        if(element.textRun.textStyle) counts.styledRuns++;
        if(/mono|courier|consolas/i.test(element.textRun.textStyle?.weightedFontFamily?.fontFamily||''))counts.monospaceRuns++;
      }
      if(element.inlineObjectElement) {
        counts.images++;
        const id=element.inlineObjectElement.inlineObjectId;
        imageIds.push(id);
        const image=tab.inlineObjects[id]?.inlineObjectProperties?.embeddedObject;
        assert.ok(image?.imageProperties?.localPath,`Missing original diagram definition: ${tab.tabId}/${id}`);
      }
    }
  }, table=>{
    counts.tables++;
    counts.tableRows+=table.tableRows.length;
    counts.tableCells+=table.tableRows.reduce((sum,row)=>sum+row.tableCells.length,0);
  });
  textByTab.set(tab.tabId,text);
  imageByTab.set(tab.tabId,imageIds);
  for(const image of Object.values(tab.inlineObjects)) {
    counts.imageDefinitions++;
    const path=image.inlineObjectProperties?.embeddedObject?.imageProperties?.localPath;
    if(path) {
      assert.ok(/^\/diagrams\/[a-z0-9.-]+$/i.test(path),'Only local image paths may be persisted');
      await fs.access(new URL(`public${path}`,root));
      localImages.add(path);
    }
  }
}

// Every text run and inline image outside a root table must match the paragraph
// read exactly. Root tables and child tables are copied directly from full reads.
for(const tab of paragraphs.tabs) {
  const output=new Map(textByTab.get(tab.tabId).map(p=>[p.startIndex,p.text]));
  const sourceImages=[];
  visit(tab.body.content,block=>{
    assert.equal(output.get(block.startIndex),paragraphText(block.paragraph),`Original text changed: ${tab.tabId}:${block.startIndex}`);
    for(const el of block.paragraph.elements||[])if(el.inlineObjectElement)sourceImages.push(el.inlineObjectElement.inlineObjectId);
  });
  const outputImages=imageByTab.get(tab.tabId);
  // Masked paragraph reads omit table contents; compare their image subsequence.
  let cursor=0;
  for(const id of sourceImages) {cursor=outputImages.indexOf(id,cursor);assert.ok(cursor>=0,`Original image order changed: ${tab.tabId}/${id}`);cursor++;}
}

// Independent comparison with the previous indexed provider read proves that no
// source paragraph, including those inside tables and the four child tabs, was lost.
const oldByTab = new Map();
for(const p of previous.paragraphs) {
  if(!oldByTab.has(p.tabId))oldByTab.set(p.tabId,[]);
  oldByTab.get(p.tabId).push(p);
}
const oldMismatches=[];
let recoveredParagraphs=0;
for(const tab of tabs) {
  const old=oldByTab.get(tab.tabId)||[];
  const current=textByTab.get(tab.tabId);
  const currentByIndex=new Map(current.map(p=>[p.startIndex,p]));
  assert.equal(currentByIndex.size,current.length,`Duplicate paragraph source indices: ${tab.tabId}`);
  const oldIndices=new Set(old.map(p=>p.startIndex));
  for(const p of current)if(!oldIndices.has(p.startIndex))assert.equal(p.text.trim(),'',`Unexpected new source paragraph: ${tab.tabId}:${p.startIndex}`);
  recoveredParagraphs+=current.length-old.length;
  for(const a of old) {
    const b=currentByIndex.get(a.startIndex);
    if(!b||a.text.trim()!==b.text.trim())oldMismatches.push({tabId:tab.tabId,index:a.startIndex,old:a.text.slice(0,80),current:b?.text.slice(0,80)});
  }
}
assert.equal(oldMismatches.length,0,`Original text differs from previous source read: ${JSON.stringify(oldMismatches.slice(0,5))}`);
assert.equal(counts.images,394,'Expected all 394 original HLD diagrams');
assert.equal(localImages.size,394);
const orderedText=tabs.map(tab=>textByTab.get(tab.tabId).map(p=>p.text).join('')).join('\n');
const fidelity={paragraphTextExact:true,paragraphOrderExact:true,tableStructurePreserved:true,imageOrderPreserved:true,
  sourceTabHierarchyPreserved:true,sourceStylesPreserved:true,previousSourceTextMatches:true,
  recoveredEmptyOrImageParagraphs:recoveredParagraphs,
  textSha256:crypto.createHash('sha256').update(orderedText).digest('hex'),counts};
const result={documentId:paragraphs.documentId,title:paragraphs.title,
  sourceUrl:'https://docs.google.com/document/d/1vSlU2wx8SfCXvmP0Os_gcIBG1DkyelRt4q3KmbgzpzQ/edit',
  sourceFormat:'google-docs-native',tabs,fidelity};
const json=JSON.stringify(result);
assert.ok(!json.includes('googleusercontent.com')&&!json.includes('contentUri'),'No signed source image URLs may be stored');
await fs.writeFile(new URL('content/raw/hld-original.json',root),json);
await fs.writeFile(new URL('content/raw/hld-fidelity.json',root),JSON.stringify(fidelity,null,2)+'\n');
console.log(JSON.stringify({snapshotBytes:Buffer.byteLength(json),...fidelity},null,2));

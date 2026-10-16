import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nativePresentation, titleKey } from '../lib/native-presentation.mjs';
import { nativeCodeText, isNativeCode } from '../lib/native-code.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const java = read('../content/raw/java-native.json');
const firstJava = java.tabs[0];
const text = block => nativeCodeText(block).trim();

test('adjacent repeated Java titles appear once and keep their original heading anchor', () => {
  const plan = nativePresentation(firstJava, {articleTitle:'Thread coordination and coding exercises'});
  const blocks = firstJava.body.content;
  const heading = blocks.find(block => block.startIndex === 774);
  const repeated = blocks.find(block => block.startIndex === 801);
  assert.equal(plan.headings.get(heading), 3, 'Coding exercises sit below the source overview heading');
  assert.ok(plan.hidden.has(repeated));
  assert.equal(plan.toc.filter(item => titleKey(item.title) === titleKey(text(heading))).length, 1);
  assert.ok(plan.toc.some(item => item.id === 'original-java-thread-coordination-774'));
  assert.ok(!plan.hidden.has(blocks[2]), 'A topic repeated in an introductory list remains visible');
});

test('article and tab titles share the existing source title instead of adding another', () => {
  const aws = read('../content/raw/aws-native.json').tabs[0];
  const title = aws.body.content.find(block => text(block) === 'AWS');
  const single = nativePresentation(aws, {articleTitle:'AWS'});
  assert.ok(single.hidden.has(title));
  assert.equal(single.showSectionTitle, false);
  const grouped = nativePresentation(aws, {articleTitle:'Cloud foundations', sectionTitle:'AWS'});
  assert.equal(grouped.showSectionTitle, false);
  assert.equal(grouped.headings.get(title), 2);
  assert.ok(!grouped.hidden.has(title));
});

test('presentation never mutates source, hides code, or deduplicates repeated table values', () => {
  for (const chapter of java.tabs) {
    const before = JSON.stringify(chapter);
    const plan = nativePresentation(chapter, {articleTitle:chapter.title});
    for (const hidden of plan.hidden) {
      assert.ok(hidden.paragraph && !hidden.paragraph.bullet && !isNativeCode(hidden));
      assert.ok(!hidden.table);
    }
    assert.equal(JSON.stringify(chapter), before);
  }
  let index=0;
  const paragraph = (content, heading) => ({startIndex:++index,paragraph:{paragraphStyle:{namedStyleType:heading?'HEADING_1':'NORMAL_TEXT'},elements:[{textRun:{content}}]}});
  const a=paragraph('Repeated explanation.\n'), b=paragraph('Repeated explanation.\n');
  const table={table:{tableRows:[{tableCells:[{content:[paragraph('Yes\n'),paragraph('Yes\n')]}]}]}};
  const chapter={tabId:'test',title:'Test',body:{content:[a,b,table]}};
  assert.equal(nativePresentation(chapter).hidden.size,0);
});

test('source heading levels become a readable hierarchy without duplicate TOC entries', () => {
  for (const chapter of java.tabs) {
    const plan=nativePresentation(chapter,{articleTitle:chapter.title});
    assert.ok(plan.toc.every(item=>item.level>=2&&item.level<=6));
    assert.equal(new Set(plan.toc.map(item=>item.id)).size,plan.toc.length);
    assert.ok(plan.toc.every(item=>!plan.hidden.has(chapter.body.content.find(block=>`original-${chapter.tabId}-${block.startIndex}`===item.id))));
  }
});

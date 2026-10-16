import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isNativeCode, nativeCodeGroup, nativeCodeText } from '../lib/native-code.mjs';

const source = JSON.parse(readFileSync(new URL('../content/raw/java-native.json', import.meta.url)));
const tab = id => source.tabs.find(tab => tab.tabId === id).body.content;

test('Java examples keep their exact source indentation and paragraph newlines', () => {
  const blocks = tab('java-thread-coordination');
  const group = nativeCodeGroup(blocks, 46);
  assert.equal(group.end, 99, 'The complete multi-class example ends before the next explanation');
  assert.equal(group.code, blocks.slice(46, group.end).map(nativeCodeText).join(''));
  assert.match(group.code, /\n    private int number = 1;\n/);
  assert.match(group.code, /\n\n/);
  assert.ok(group.code.endsWith('\n'));
});

test('code in normal and bold fonts is recognized without swallowing explanations', () => {
  for (const [id, indices] of [
    ['java-thread-coordination', [24,25,26,27,28,29,34,35,36,39,40,41,42,43]],
    ['java-locks-parallel-sums', [513,514,515]],
    ['java-parallel-processing', [303,304,305,306,308,309,311,312,313,314,315,317,318,320,322]],
    ['java-scheduled-executors', [342,345,413,414,415,416,417,418,419,420]],
    ['java-deadlocks-exceptions', [205,207,208,209,210,211,212,213,214,215,247,248,249,250,251,252,253,254,255,256]],
    ['java-reference-topics', [28,29,31,32,33,34,36,37,38,40,41,42,43,45,46,47,48,50,51,52,53,54,55,57,58,60,62,64,65,67,68,70,71,73,74,75,76,77]],
  ]) for (const index of indices) assert.ok(isNativeCode(tab(id)[index]), `${id}: paragraph ${index}`);
  for (const [id, indices] of [
    ['java-thread-coordination', [0,1,32,44,45]],
    ['java-blocking-queues', [107]],
    ['java-locks-parallel-sums', [503]],
    ['java-scheduled-executors', [204,262]],
    ['java-deadlocks-exceptions', [184,185,186,193,194,195]],
    ['java-reentrant-locks-futures', [5,6,10,23,26,28,34,39,40,44,45,50,56,66,69,75,82,88]],
  ]) for (const index of indices) assert.ok(!isNativeCode(tab(id)[index]), `${id}: prose paragraph ${index}`);
});

test('code grouping preserves every source character and leaves tables and images in order', () => {
  for (const chapter of source.tabs) {
    const blocks = chapter.body.content;
    let projected = '';
    for (let i = 0; i < blocks.length; i++) {
      const group = nativeCodeGroup(blocks, i);
      if (group) {
        assert.ok(blocks.slice(i, group.end).every(block => block.paragraph && !block.paragraph.bullet && block.paragraph.elements.every(element => element.textRun)));
        projected += group.code;
        i = group.end - 1;
      } else projected += nativeCodeText(blocks[i]);
    }
    assert.equal(projected, blocks.map(nativeCodeText).join(''), chapter.tabId);
  }
});

test('multiline constructor signatures retain every normally formatted parameter', () => {
  const blocks = tab('java-scheduled-executors');
  for (const [start, end] of [[336,343], [362,371]]) {
    const group = nativeCodeGroup(blocks, start);
    assert.ok(group && group.end >= end, `Constructor at paragraph ${start} must remain complete`);
    assert.ok(group.code.includes(blocks.slice(start,end).map(nativeCodeText).join('')));
  }
});

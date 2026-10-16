import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeNotes, replaceSource } from './content.mjs';
const source = {id:'aws-notes',title:'AWS',category:'aws',type:'DOCX',updatedAt:'2026-10-16'};
test('reimport replaces the old source without leaving stale chapters or touching other sources', () => {
  const before = {sources:[source,{id:'hld'}], notes:[{id:'old1',sourceId:'aws-notes'},{id:'old2',sourceId:'aws-notes'},{id:'keep',sourceId:'hld'}]};
  const result = replaceSource(before,source,makeNotes('Updated AWS note',source));
  assert.deepEqual(result.notes.map(n=>n.id),['keep','aws-notes-1']);
  assert.equal(result.sources.length,2);
});
test('paragraph segmentation preserves all source text and produces deterministic IDs', () => {
  const input = ('Meaningful paragraph. '.repeat(450) + '\n\n').repeat(3).trim();
  const notes = makeNotes(input,source);
  assert.equal(notes.map(n=>n.content).join('\n\n').replace(/\s+/g,' '),input.replace(/\s+/g,' '));
  assert.deepEqual(notes.map(n=>n.id),makeNotes(input,source).map(n=>n.id));
});
test('empty extractions fail without silently replacing existing content',()=>assert.throws(()=>makeNotes('  ',source),/No readable text/));
test('a long fenced code block stays in a single chapter',()=>{
  const text='Introduction.\n\n```java\n'+('int value = 1;\n\n'.repeat(1000))+'```\n\nAfter the code.';
  const notes=makeNotes(text,source);
  assert.ok(notes.every(n=>(n.content.match(/^```/gm)||[]).length%2===0));
  assert.equal(notes.map(n=>n.content).join('\n\n').replace(/\s+/g,' '),text.replace(/\s+/g,' '));
});

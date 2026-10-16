import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HLD_ROADMAP_TAB_ID, roadmapStatusCell, roadmapStorageKey, isRoadmapStatus } from '../lib/hld-roadmap.mjs';

const document=JSON.parse(readFileSync(new URL('../content/raw/hld-original.json',import.meta.url)));
const tab=document.tabs.find(tab=>tab.tabId===HLD_ROADMAP_TAB_ID);
const tables=tab.body.content.filter(block=>block.table).map(block=>block.table);
const statuses=tables.flatMap(table=>table.tableRows.flatMap((row,r)=>row.tableCells.map((_,c)=>roadmapStatusCell(table,r,c)).filter(Boolean)));

test('all 25 roadmap problems have distinct editable statuses with their source defaults',()=>{
  assert.equal(statuses.length,25);
  assert.equal(new Set(statuses.map(status=>status.key)).size,25);
  assert.equal(statuses.filter(status=>status.status==='Done').length,3);
  assert.equal(statuses.filter(status=>status.status==='Not Done').length,22);
  assert.ok(statuses.every(status=>status.title&&isRoadmapStatus(status.status)));
});

test('source reordering and column changes retain progress for the same system design',()=>{
  const original=tables[0];
  const before=roadmapStatusCell(original,1,2);
  const reordered=structuredClone(original);
  reordered.tableRows=[reordered.tableRows[0],...reordered.tableRows.slice(1).reverse()];
  for(const row of reordered.tableRows)row.tableCells=[row.tableCells[2],row.tableCells[3],row.tableCells[0],row.tableCells[1]];
  const after=roadmapStatusCell(reordered,5,0);
  assert.deepEqual(after,before);
  assert.equal(roadmapStorageKey(after.key),roadmapStorageKey(before.key));
});

test('headers and unrelated cells are never editable, invalid saved states are rejected',()=>{
  for(const table of tables){
    assert.ok(table.tableRows[0].tableCells.every((_,c)=>roadmapStatusCell(table,0,c)===null));
    for(let r=1;r<table.tableRows.length;r++)for(const c of [0,1,3])assert.equal(roadmapStatusCell(table,r,c),null);
  }
  for(const value of [null,undefined,'',{},'__proto__','Finished'])assert.equal(isRoadmapStatus(value),false);
  assert.equal(isRoadmapStatus('In Progress'),true);
});

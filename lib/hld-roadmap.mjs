export const HLD_ROADMAP_TAB_ID = 't.iu1fivdlxj3x';
export const roadmapStatuses = ['Not Done', 'In Progress', 'Done'];
export const isRoadmapStatus = value => roadmapStatuses.includes(value);
export const roadmapStorageKey = problemKey => `sde2prep-hld-roadmap-v1:${problemKey}`;

function cellText(cell) {
  return (cell?.content || []).map(block => (block.paragraph?.elements || []).map(element => element.textRun?.content || element.dropdown?.dropdownProperties?.displayValue || '').join('')).join('').trim();
}

/** Recognize only the roadmap's problem/status columns, never arbitrary document tables.
 * @param {import('./native-document').NativeBlock['table']} table
 * @param {number} rowIndex
 * @param {number} cellIndex
 */
export function roadmapStatusCell(table, rowIndex, cellIndex) {
  if (!table || rowIndex === 0) return null;
  const headers = table.tableRows[0]?.tableCells.map(cell => cellText(cell).toLowerCase()) || [];
  const statusColumn = headers.indexOf('status');
  const problemColumn = headers.indexOf('system design problem');
  if (statusColumn < 0 || problemColumn < 0 || cellIndex !== statusColumn) return null;
  const row = table.tableRows[rowIndex];
  const title = cellText(row?.tableCells[problemColumn]);
  const status = cellText(row?.tableCells[statusColumn]);
  if (!title || !isRoadmapStatus(status)) return null;
  // Names, rather than row positions, retain progress when the source is reordered.
  const key = `${HLD_ROADMAP_TAB_ID}:${title.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  return { key, title, status };
}

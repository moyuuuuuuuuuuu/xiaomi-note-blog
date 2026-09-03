import assert from 'node:assert/strict';
import {
  collectFolders,
  filterNotes,
  formatIndexDate,
  getNoteRowLayout,
  groupNotesByRowPattern,
  toIndexNumber,
} from './noteIndex.js';

const notes = [
  { id: '1', title: '傍晚六点的风', content: '江边散步', folder: '生活', modifyTime: Date.UTC(2026, 6, 17) },
  { id: '2', title: '阅读摘录', content: '重要的句子', folder: '阅读', modifyTime: Date.UTC(2026, 6, 16) },
  { id: '3', title: '无分类', content: '零散内容', modifyTime: Date.UTC(2026, 6, 15) },
];

assert.deepEqual(filterNotes(notes, '江边', 'all').map((note) => note.id), []);
assert.deepEqual(filterNotes(notes, '傍晚', 'all').map((note) => note.id), ['1']);
assert.deepEqual(filterNotes(notes, '生活', 'all').map((note) => note.id), ['1']);
assert.deepEqual(filterNotes(notes, '', '阅读').map((note) => note.id), ['2']);
assert.deepEqual(collectFolders(notes), [
  { name: '生活', count: 1 },
  { name: '阅读', count: 1 },
]);
assert.equal(formatIndexDate(Date.UTC(2026, 6, 17)), '2026.07.17');
assert.equal(toIndexNumber(0), '01');
assert.equal(toIndexNumber(11), '12');

assert.deepEqual(
  Array.from({ length: 6 }, (_, rowIndex) => {
    const { count, spans, direction } = getNoteRowLayout(rowIndex);
    return { count, spans, direction };
  }),
  [
    { count: 3, spans: [5, 3, 4], direction: 'forward' },
    { count: 4, spans: [2, 4, 3, 3], direction: 'forward' },
    { count: 2, spans: [7, 5], direction: 'forward' },
    { count: 3, spans: [4, 3, 5], direction: 'reverse' },
    { count: 4, spans: [3, 3, 4, 2], direction: 'reverse' },
    { count: 2, spans: [5, 7], direction: 'reverse' },
  ],
);

assert.deepEqual(getNoteRowLayout(-1), {
  rowIndex: 0,
  patternIndex: 0,
  cycle: 0,
  count: 3,
  spans: [5, 3, 4],
  offsets: [0, 8, 2],
  direction: 'forward',
});

const layoutNotes = Array.from({ length: 13 }, (_, index) => ({ id: String(index + 1) }));
const groupedRows = groupNotesByRowPattern(layoutNotes);
assert.deepEqual(groupedRows.map((row) => row.entries.length), [3, 4, 2, 4]);
assert.deepEqual(
  groupedRows.flatMap((row) => row.entries.map((entry) => entry.index)),
  Array.from({ length: 13 }, (_, index) => index),
);
assert.deepEqual(
  groupedRows[0].entries.map(({ columnStart, columnSpan, offset }) => ({ columnStart, columnSpan, offset })),
  [
    { columnStart: 1, columnSpan: 5, offset: 0 },
    { columnStart: 6, columnSpan: 3, offset: 8 },
    { columnStart: 9, columnSpan: 4, offset: 2 },
  ],
);
assert.deepEqual(
  groupedRows[3].entries.map(({ index, columnStart, columnSpan, offset }) => ({ index, columnStart, columnSpan, offset })),
  [
    { index: 9, columnStart: 1, columnSpan: 3, offset: 3 },
    { index: 10, columnStart: 4, columnSpan: 3, offset: 10 },
    { index: 11, columnStart: 7, columnSpan: 4, offset: 0 },
    { index: 12, columnStart: 11, columnSpan: 2, offset: 5 },
  ],
);

assert.deepEqual(
  groupNotesByRowPattern(Array.from({ length: 19 }, (_, index) => ({ id: String(index + 1) })))
    .map((row) => row.entries.length),
  [3, 4, 2, 3, 4, 3],
);
assert.deepEqual(
  groupNotesByRowPattern([{ id: 'only' }])[0].entries
    .map(({ columnStart, columnSpan, offset }) => ({ columnStart, columnSpan, offset })),
  [{ columnStart: 4, columnSpan: 6, offset: 0 }],
);
assert.deepEqual(groupNotesByRowPattern([]), []);

import assert from 'node:assert/strict';
import { collectFolders, filterNotes, formatIndexDate, toIndexNumber } from './noteIndex.js';

const notes = [
  { id: '1', title: '傍晚六点的风', content: '江边散步', folder: '生活', modifyTime: Date.UTC(2026, 6, 17) },
  { id: '2', title: '阅读摘录', content: '重要的句子', folder: '阅读', modifyTime: Date.UTC(2026, 6, 16) },
  { id: '3', title: '无分类', content: '零散内容', modifyTime: Date.UTC(2026, 6, 15) },
];

assert.deepEqual(filterNotes(notes, '江边', 'all').map((note) => note.id), ['1']);
assert.deepEqual(filterNotes(notes, '', '阅读').map((note) => note.id), ['2']);
assert.deepEqual(collectFolders(notes), [
  { name: '生活', count: 1 },
  { name: '阅读', count: 1 },
]);
assert.equal(formatIndexDate(Date.UTC(2026, 6, 17)), '2026.07.17');
assert.equal(toIndexNumber(0), '01');
assert.equal(toIndexNumber(11), '12');

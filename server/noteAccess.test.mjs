import assert from 'node:assert/strict';
import {
  getMissingGrants,
  getRequiredGrants,
  sanitizeNoteDetail,
  toNoteSummary,
} from './noteAccess.js';

const stored = {
  id: 'n1',
  title: 'Private',
  content: 'secret body',
  password: 'note-secret',
  createTime: 1,
  modifyTime: 2,
  folder: 'Work',
  extra: 'drop',
};
const settings = { folderPasswords: { Work: 'folder-secret' } };

const summary = toNoteSummary(stored, settings);

assert.deepEqual(summary, {
  id: 'n1',
  title: 'Private',
  createTime: 1,
  modifyTime: 2,
  folder: 'Work',
  noteProtected: true,
  folderProtected: true,
});
assert.equal('content' in summary, false);
assert.equal('password' in summary, false);
assert.deepEqual(sanitizeNoteDetail(stored, settings), {
  ...summary,
  content: 'secret body',
});
assert.deepEqual(getRequiredGrants(summary), ['folder:Work', 'note:n1']);
assert.deepEqual(
  getMissingGrants(summary, (grant) => grant === 'folder:Work'),
  ['note:n1'],
);

const publicSummary = toNoteSummary(
  { id: 2, title: null, content: null, createTime: null, folder: null },
  settings,
);
assert.deepEqual(publicSummary, {
  id: '2',
  title: '',
  createTime: 0,
  modifyTime: 0,
  folder: '',
  noteProtected: false,
  folderProtected: false,
});

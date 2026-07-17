import assert from 'node:assert/strict';
import { getNoteAccessSteps } from './noteAccessFlow.js';

const protectedNote = {
  id: 'n1',
  title: 'Protected',
  folder: 'Work',
  noteProtected: true,
  folderProtected: true,
};

assert.deepEqual(
  getNoteAccessSteps(protectedNote, {
    isAdmin: false,
    unlockedFolders: new Set(),
    unlockedNotes: new Set(),
  }),
  [
    { scope: 'folder', id: 'Work' },
    { scope: 'note', id: 'n1' },
  ],
);
assert.deepEqual(
  getNoteAccessSteps(protectedNote, {
    isAdmin: false,
    unlockedFolders: new Set(['Work']),
    unlockedNotes: new Set(),
  }),
  [{ scope: 'note', id: 'n1' }],
);
assert.deepEqual(
  getNoteAccessSteps(protectedNote, {
    isAdmin: true,
    unlockedFolders: new Set(),
    unlockedNotes: new Set(),
  }),
  [],
);
assert.deepEqual(
  getNoteAccessSteps({ ...protectedNote, noteProtected: false, folderProtected: false }, {
    isAdmin: false,
    unlockedFolders: new Set(),
    unlockedNotes: new Set(),
  }),
  [],
);

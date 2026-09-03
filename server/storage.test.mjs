import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createDataStore,
  defaultSettings,
  getAdminSettings,
  getPublicSettings,
  mergeSyncedNotes,
} from './storage.js';

const dataDir = await mkdtemp(join(tmpdir(), 'xiaominote-store-'));

try {
  const store = createDataStore(dataDir);

  assert.deepEqual(await store.readSettings(), defaultSettings);
  assert.deepEqual(await store.readNotes(), []);

  await store.updateSettings({
    siteName: '碎碎念',
    siteDescription: '从小米笔记同步来的日常记录',
    logoUrl: 'https://example.com/logo.png',
    password: '',
    selectedFolders: ['生活'],
    folderPasswords: { 生活: 'folder-secret', 公开: '' },
    miCookie: 'serviceToken=secret-cookie',
  });

  const settings = await store.readSettings();
  assert.equal(settings.miCookie, 'serviceToken=secret-cookie');
  assert.deepEqual(getPublicSettings(settings), {
    siteName: '碎碎念',
    siteDescription: '从小米笔记同步来的日常记录',
    logoUrl: 'https://example.com/logo.png',
    password: '',
    selectedFolders: ['生活'],
    folderPasswords: {},
    protectedFolders: ['生活'],
    hasMiCookie: true,
    miCookieUpdatedAt: settings.miCookieUpdatedAt,
  });
  assert.deepEqual(getAdminSettings(settings), {
    siteName: '碎碎念',
    siteDescription: '从小米笔记同步来的日常记录',
    logoUrl: 'https://example.com/logo.png',
    password: '',
    selectedFolders: ['生活'],
    folderPasswords: { 生活: 'folder-secret', 公开: '' },
    protectedFolders: ['生活'],
    hasMiCookie: true,
    miCookieUpdatedAt: settings.miCookieUpdatedAt,
    miCookieStatus: 'unchecked',
    miCookieLastCheckedAt: null,
    miCookieLastRefreshedAt: null,
    miCookieLastError: '',
  });
  assert.equal('miCookie' in getPublicSettings(settings), false);
  assert.equal('miCookie' in getAdminSettings(settings), false);

  await store.writeNotes([{ id: '1', title: 'A', content: 'B', createTime: 1, modifyTime: 2 }]);
  assert.deepEqual((await store.readNotes()).map((note) => note.id), ['1']);

  assert.deepEqual(
    mergeSyncedNotes(
      [{ id: '1', title: 'Old', content: 'Old body', createTime: 1, modifyTime: 2, password: 'note-secret' }],
      [{ id: '1', title: 'New', content: 'New body', createTime: 3, modifyTime: 4 }],
    ),
    [{ id: '1', title: 'New', content: 'New body', createTime: 3, modifyTime: 4, password: 'note-secret' }],
  );
} finally {
  await rm(dataDir, { recursive: true, force: true });
}

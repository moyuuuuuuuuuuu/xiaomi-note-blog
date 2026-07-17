import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

async function getFreePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  probe.close();
  await once(probe, 'close');
  return port;
}

async function waitForServer(baseUrl, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/settings`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('server did not start');
}

const dataDir = await mkdtemp(join(tmpdir(), 'xiaominote-api-contract-'));
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;

await writeFile(join(dataDir, 'settings.json'), JSON.stringify({
  siteName: 'Contract test',
  folderPasswords: { Work: 'folder-secret' },
}), 'utf8');
await writeFile(join(dataDir, 'notes.json'), JSON.stringify([{
  id: 'n1',
  title: 'Protected note',
  content: 'secret body',
  password: 'note-secret',
  createTime: 1,
  modifyTime: 2,
  folder: 'Work',
}]), 'utf8');

const child = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    DATA_DIR: dataDir,
    DIST_DIR: dataDir,
    ADMIN_PASSWORD: 'admin-secret',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

try {
  await waitForServer(baseUrl, child);

  const listResponse = await fetch(`${baseUrl}/api/notes`);
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), {
    notes: [{
      id: 'n1',
      title: 'Protected note',
      createTime: 1,
      modifyTime: 2,
      folder: 'Work',
      noteProtected: true,
      folderProtected: true,
    }],
  });

  const settingsResponse = await fetch(`${baseUrl}/api/settings`);
  const publicSettings = await settingsResponse.json();
  assert.deepEqual(publicSettings.folderPasswords, {});
  assert.deepEqual(publicSettings.protectedFolders, ['Work']);
  assert.equal(JSON.stringify(publicSettings).includes('folder-secret'), false);

  const summaryResponse = await fetch(`${baseUrl}/api/notes/n1/summary`);
  assert.equal(summaryResponse.status, 200);
  assert.deepEqual((await summaryResponse.json()).note, {
    id: 'n1',
    title: 'Protected note',
    createTime: 1,
    modifyTime: 2,
    folder: 'Work',
    noteProtected: true,
    folderProtected: true,
  });

  const lockedResponse = await fetch(`${baseUrl}/api/notes/n1`);
  assert.equal(lockedResponse.status, 423);
  const lockedBody = await lockedResponse.json();
  assert.equal('content' in lockedBody.note, false);
  assert.equal('password' in lockedBody.note, false);
  assert.deepEqual(lockedBody.requiredScopes, ['folder:Work', 'note:n1']);

  const folderVerifyResponse = await fetch(`${baseUrl}/api/password/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope: 'folder', id: 'Work', password: 'folder-secret' }),
  });
  assert.equal(folderVerifyResponse.status, 200);
  const unlockCookie = folderVerifyResponse.headers.get('set-cookie')?.split(';')[0];
  assert.match(unlockCookie || '', /^xiao_note_unlock=/);

  const folderUnlockedResponse = await fetch(`${baseUrl}/api/notes/n1`, {
    headers: { cookie: unlockCookie },
  });
  assert.equal(folderUnlockedResponse.status, 423);
  assert.deepEqual((await folderUnlockedResponse.json()).requiredScopes, ['note:n1']);

  const noteVerifyResponse = await fetch(`${baseUrl}/api/password/verify`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: unlockCookie,
    },
    body: JSON.stringify({ scope: 'note', id: 'n1', password: 'note-secret' }),
  });
  assert.equal(noteVerifyResponse.status, 200);
  const refreshedUnlockCookie = noteVerifyResponse.headers.get('set-cookie')?.split(';')[0];
  assert.equal(refreshedUnlockCookie, unlockCookie);

  const detailResponse = await fetch(`${baseUrl}/api/notes/n1`, {
    headers: { cookie: refreshedUnlockCookie },
  });
  assert.equal(detailResponse.status, 200);
  const detailBody = await detailResponse.json();
  assert.equal(detailBody.note.content, 'secret body');
  assert.equal('password' in detailBody.note, false);

  const adminSettingsDenied = await fetch(`${baseUrl}/api/admin/settings`);
  assert.equal(adminSettingsDenied.status, 401);
  const exportDenied = await fetch(`${baseUrl}/api/admin/notes/export`);
  assert.equal(exportDenied.status, 401);
  const settingsWriteDenied = await fetch(`${baseUrl}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ siteName: 'Unauthorized change' }),
  });
  assert.equal(settingsWriteDenied.status, 401);

  const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'admin-secret' }),
  });
  assert.equal(loginResponse.status, 200);
  const adminCookie = loginResponse.headers.get('set-cookie')?.split(';')[0];
  assert.match(adminCookie || '', /^xiao_admin_session=/);

  const adminSettingsResponse = await fetch(`${baseUrl}/api/admin/settings`, {
    headers: { cookie: adminCookie },
  });
  assert.equal(adminSettingsResponse.status, 200);
  const adminSettings = await adminSettingsResponse.json();
  assert.equal(adminSettings.folderPasswords.Work, 'folder-secret');
  assert.equal('miCookie' in adminSettings, false);

  const exportResponse = await fetch(`${baseUrl}/api/admin/notes/export`, {
    headers: { cookie: adminCookie },
  });
  assert.equal(exportResponse.status, 200);
  const exportBody = await exportResponse.json();
  assert.equal(exportBody.notes[0].content, 'secret body');
  assert.equal('password' in exportBody.notes[0], false);

  const adminDetailResponse = await fetch(`${baseUrl}/api/notes/n1`, {
    headers: { cookie: adminCookie },
  });
  assert.equal(adminDetailResponse.status, 200);

  const updateResponse = await fetch(`${baseUrl}/api/notes/n1`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      cookie: adminCookie,
    },
    body: JSON.stringify({ title: 'Updated title' }),
  });
  assert.equal(updateResponse.status, 200);
  assert.deepEqual(await updateResponse.json(), {
    note: {
      id: 'n1',
      title: 'Updated title',
      createTime: 1,
      modifyTime: 2,
      folder: 'Work',
      noteProtected: true,
      folderProtected: true,
    },
  });
} finally {
  child.kill();
  await once(child, 'exit').catch(() => {});
  await rm(dataDir, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import {
  ApiError,
  fetchAdminSettings,
  fetchExportNotes,
  fetchNote,
  fetchNoteSummary,
} from './api.js';

const requests = [];
globalThis.fetch = async (path, options) => {
  requests.push({ path, options });
  if (path === '/api/notes/locked') {
    return {
      ok: false,
      status: 423,
      json: async () => ({ error: '笔记尚未解锁', requiredScopes: ['note:locked'] }),
    };
  }
  return { ok: true, status: 200, json: async () => ({ ok: true }) };
};

await fetchNoteSummary('a/b');
await fetchAdminSettings();
await fetchExportNotes();

assert.deepEqual(requests.slice(0, 3).map(({ path }) => path), [
  '/api/notes/a%2Fb/summary',
  '/api/admin/settings',
  '/api/admin/notes/export',
]);
assert.equal(requests[0].options.credentials, 'same-origin');

await assert.rejects(
  fetchNote('locked'),
  (error) => {
    assert.equal(error instanceof ApiError, true);
    assert.equal(error.status, 423);
    assert.deepEqual(error.data.requiredScopes, ['note:locked']);
    return true;
  },
);

# Secure Note Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home page consume summary-only note data, require server-authorized password unlocks before protected navigation, and prevent list, sync, settings, and detail endpoints from leaking note bodies or passwords.

**Architecture:** Keep complete notes in the existing JSON store, but introduce a strict projection layer at every public response boundary. Add a short-lived, IP-bound server unlock session in parallel with the existing admin session, then let the detail endpoint enforce all required grants before returning sanitized content. The React home page stores only summaries; the detail page fetches a summary first, completes folder/note challenges in order, and requests the body only after authorization.

**Tech Stack:** Node.js HTTP server and `node:assert` tests; React 18, React Router 7, TypeScript, Vite 6; existing JSON storage and cookie utilities.

## Global Constraints

- Do not change the local `notes.json` storage format.
- Do not change Xiaomi Cloud synchronization sources or image caching behavior.
- Do not refactor the site-wide access-password flow.
- Do not add a database or persist unlock sessions across server restarts.
- Preserve the approved page layout and minimal-modern visual style; only remove the article preview and adapt interaction states.
- Public list and sync responses must never contain `content`, note passwords, folder passwords, or site settings.
- The server-side HttpOnly unlock session is the sole authorization source; browser storage is not an authorization source.

---

### Task 1: Strict Note Projection Boundary

**Files:**
- Create: `server/noteAccess.js`
- Create: `server/noteAccess.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: stored note objects and a settings object with `folderPasswords`.
- Produces: `toNoteSummary(note, settings)`, `sanitizeNoteDetail(note, settings)`, `getRequiredGrants(summary)`, and `getMissingGrants(summary, hasGrant)`.

- [ ] **Step 1: Write the failing projection tests**

```js
import assert from 'node:assert/strict';
import { getMissingGrants, getRequiredGrants, sanitizeNoteDetail, toNoteSummary } from './noteAccess.js';

const stored = { id: 'n1', title: 'Private', content: 'secret body', password: 'note-secret', createTime: 1, modifyTime: 2, folder: 'Work', extra: 'drop' };
const settings = { folderPasswords: { Work: 'folder-secret' } };
const summary = toNoteSummary(stored, settings);

assert.deepEqual(summary, { id: 'n1', title: 'Private', createTime: 1, modifyTime: 2, folder: 'Work', noteProtected: true, folderProtected: true });
assert.equal('content' in summary, false);
assert.equal('password' in summary, false);
assert.deepEqual(sanitizeNoteDetail(stored, settings), { ...summary, content: 'secret body' });
assert.deepEqual(getRequiredGrants(summary), ['folder:Work', 'note:n1']);
assert.deepEqual(getMissingGrants(summary, (grant) => grant === 'folder:Work'), ['note:n1']);
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `node server/noteAccess.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `server/noteAccess.js`.

- [ ] **Step 3: Implement the projection helpers**

```js
export function toNoteSummary(note = {}, settings = {}) {
  const folder = typeof note.folder === 'string' ? note.folder : '';
  return {
    id: String(note.id || ''),
    title: String(note.title || ''),
    createTime: Number(note.createTime || 0),
    modifyTime: Number(note.modifyTime || 0),
    folder,
    noteProtected: Boolean(note.password),
    folderProtected: Boolean(folder && settings.folderPasswords?.[folder]),
  };
}

export function sanitizeNoteDetail(note, settings) {
  return { ...toNoteSummary(note, settings), content: String(note?.content || '') };
}

export function getRequiredGrants(summary) {
  return [
    summary.folderProtected ? `folder:${summary.folder}` : null,
    summary.noteProtected ? `note:${summary.id}` : null,
  ].filter(Boolean);
}

export function getMissingGrants(summary, hasGrant) {
  return getRequiredGrants(summary).filter((grant) => !hasGrant(grant));
}
```

- [ ] **Step 4: Add the test to the project test script and run it**

Change the `test` script so `node server/noteAccess.test.mjs` runs before storage tests.

Run: `node server/noteAccess.test.mjs && pnpm test`

Expected: projection tests and all existing tests PASS.

- [ ] **Step 5: Commit the projection boundary**

```bash
git add server/noteAccess.js server/noteAccess.test.mjs package.json
git commit -m "feat: add safe note response projections"
```

### Task 2: IP-Bound Unlock Sessions

**Files:**
- Create: `server/unlockSession.js`
- Create: `server/unlockSession.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: request cookie header, client IP, and a grant string such as `folder:Work` or `note:n1`.
- Produces: `createUnlockSessionStore({ ttlMs, now, tokenFactory })`, whose result exposes `grant({ cookieHeader, ip, scope })` and `has({ cookieHeader, ip, scope })`; `getUnlockSessionCookie(token)`.

- [ ] **Step 1: Write failing grant, expiry, and IP-binding tests**

```js
import assert from 'node:assert/strict';
import { createUnlockSessionStore, getUnlockSessionCookie } from './unlockSession.js';

let time = 1000;
const sessions = createUnlockSessionStore({ ttlMs: 100, now: () => time, tokenFactory: () => 'token-1' });
const granted = sessions.grant({ cookieHeader: '', ip: '127.0.0.1', scope: 'folder:Work' });
assert.equal(granted.token, 'token-1');
assert.match(getUnlockSessionCookie(granted.token), /HttpOnly/);
assert.match(getUnlockSessionCookie(granted.token), /SameSite=Lax/);
const cookieHeader = 'xiao_note_unlock=token-1';
assert.equal(sessions.has({ cookieHeader, ip: '127.0.0.1', scope: 'folder:Work' }), true);
assert.equal(sessions.has({ cookieHeader, ip: '127.0.0.2', scope: 'folder:Work' }), false);
time = 1101;
assert.equal(sessions.has({ cookieHeader, ip: '127.0.0.1', scope: 'folder:Work' }), false);
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `node server/unlockSession.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the in-memory unlock store**

```js
import crypto from 'node:crypto';

const COOKIE_NAME = 'xiao_note_unlock';
const readToken = (header = '') => header.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) || '';

export function createUnlockSessionStore({ ttlMs, now = () => Date.now(), tokenFactory = () => crypto.randomBytes(24).toString('hex') }) {
  const records = new Map();
  const get = (cookieHeader, ip) => {
    const token = readToken(cookieHeader);
    const record = records.get(token);
    if (!record || record.ip !== ip || record.expiresAt <= now()) {
      if (record) records.delete(token);
      return null;
    }
    return { token, record };
  };
  return {
    grant({ cookieHeader, ip, scope }) {
      const current = get(cookieHeader, ip);
      const token = current?.token || tokenFactory();
      const record = current?.record || { ip, scopes: new Set() };
      record.scopes.add(scope);
      record.expiresAt = now() + ttlMs;
      records.set(token, record);
      return { token };
    },
    has({ cookieHeader, ip, scope }) {
      return Boolean(get(cookieHeader, ip)?.record.scopes.has(scope));
    },
  };
}

export function getUnlockSessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`;
}
```

- [ ] **Step 4: Add the test to `pnpm test` and run it**

Run: `node server/unlockSession.test.mjs && pnpm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit unlock sessions**

```bash
git add server/unlockSession.js server/unlockSession.test.mjs package.json
git commit -m "feat: add protected note unlock sessions"
```

### Task 3: Safe Settings and API Response Contracts

**Files:**
- Modify: `server/storage.js`
- Modify: `server/storage.test.mjs`
- Modify: `server/index.js`

**Interfaces:**
- Consumes: helpers from Tasks 1 and 2 plus existing admin/password-limiter functions.
- Produces: summary-only `GET /api/notes`, `GET /api/notes/:id/summary`, protected `GET /api/notes/:id`, authenticated `GET /api/admin/settings`, authenticated `GET /api/admin/notes/export`, and unlock-cookie responses from `POST /api/password/verify`.

- [ ] **Step 1: Tighten storage tests for public/admin settings**

Add assertions that `getPublicSettings({ folderPasswords: { Work: 'secret' }, miCookie: 'cookie' })` returns `protectedFolders: ['Work']`, an empty `folderPasswords` map, `hasMiCookie: true`, and neither secret. Add `getAdminSettings` assertions for the real `folderPasswords` map while still omitting `miCookie`.

- [ ] **Step 2: Run the storage test and confirm it fails**

Run: `node server/storage.test.mjs`

Expected: FAIL because `protectedFolders` and `getAdminSettings` do not exist.

- [ ] **Step 3: Implement safe settings projections**

```js
export function getPublicSettings(settings) {
  return {
    siteName: settings.siteName,
    siteDescription: settings.siteDescription,
    logoUrl: settings.logoUrl,
    hasPassword: Boolean(settings.password),
    hasMiCookie: Boolean(settings.miCookie),
    protectedFolders: Object.entries(settings.folderPasswords || {}).filter(([, password]) => Boolean(password)).map(([folder]) => folder),
    folderPasswords: {},
  };
}

export function getAdminSettings(settings) {
  return { ...getPublicSettings(settings), folderPasswords: { ...(settings.folderPasswords || {}) } };
}
```

- [ ] **Step 4: Replace route response boundaries and enforce detail grants**

Import `getAdminSettings`, `toNoteSummary`, `sanitizeNoteDetail`, `getMissingGrants`, `createUnlockSessionStore`, and `getUnlockSessionCookie`. Create a 30-minute unlock store. Project notes through `toNoteSummary` for list, sync, and update responses. Add summary, protected detail, admin settings, and admin export routes; export maps stored notes to `{ ...sanitizeNoteDetail(note, settings) }`. On successful folder/note verification, call `unlockSessions.grant(...)` and send `Set-Cookie`. For a protected detail without all grants, return status `423` with:

```js
{
  error: 'Note is locked',
  note: summary,
  requiredScopes: missingGrants,
}
```

An existing valid admin session bypasses missing-grant checks.

- [ ] **Step 5: Run all server tests and syntax checks**

Run: `pnpm test && node --check server/index.js && node --check server/storage.js`

Expected: all tests PASS and both syntax checks exit 0.

- [ ] **Step 6: Commit safe server contracts**

```bash
git add server/storage.js server/storage.test.mjs server/index.js
git commit -m "feat: secure note and settings endpoints"
```

### Task 4: Frontend Summary Types and API Client

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/lib/api.js`
- Modify: `src/app/lib/noteIndex.js`
- Modify: `src/app/lib/noteIndex.test.mjs`

**Interfaces:**
- Consumes: Task 3 response contracts.
- Produces: `NoteSummary`, `NoteDetail`, structured `ApiError`, `fetchNoteSummary`, `fetchAdminSettings`, and `fetchExportNotes`; title/folder-only `filterNotes`.

- [ ] **Step 1: Change the note-index fixture to prove bodies are not searchable**

Use a fixture whose body contains `江边` but whose title/folder do not, and assert `filterNotes(notes, '江边', 'all')` is empty. Add a title match assertion and retain the folder assertion.

- [ ] **Step 2: Run the focused test and confirm the body-search assertion fails**

Run: `node src/app/lib/noteIndex.test.mjs`

Expected: FAIL because `filterNotes` still inspects `note.content`.

- [ ] **Step 3: Restrict filtering to summary fields**

```js
export function filterNotes(notes, searchTerm, selectedFolder) {
  const keyword = searchTerm.trim().toLowerCase();
  return notes.filter((note) => {
    const matchesFolder = selectedFolder === 'all' || note.folder === selectedFolder;
    const matchesKeyword = !keyword || note.title.toLowerCase().includes(keyword) || (note.folder || '').toLowerCase().includes(keyword);
    return matchesFolder && matchesKeyword;
  });
}
```

- [ ] **Step 4: Split frontend types and make HTTP errors inspectable**

Define `NoteSummary` with only the seven summary fields. Define `NoteDetail extends NoteSummary` with `content`, and temporarily retain `type Note = NoteDetail & { password?: string }` until Tasks 5 and 6 migrate the components. Keep update inputs partial and never require a list item to contain a body. Make `request()` throw `new ApiError(response.status, payload)` and export `fetchNoteSummary(id)`, `fetchAdminSettings()`, and `fetchExportNotes()` for the new endpoints.

- [ ] **Step 5: Run focused tests and TypeScript build to expose downstream migrations**

Run: `node src/app/lib/noteIndex.test.mjs && pnpm build`

Expected: note-index test PASS and the compatibility alias keeps the build passing.

- [ ] **Step 6: Commit types and API client**

```bash
git add src/app/App.tsx src/app/lib/api.js src/app/lib/noteIndex.js src/app/lib/noteIndex.test.mjs
git commit -m "refactor: split note summary and detail clients"
```

### Task 5: Summary-Only Home Page and Protected Navigation

**Files:**
- Modify: `src/app/pages/HomePage.tsx`
- Modify: `src/app/components/NotesList.tsx`
- Modify: `src/app/components/NoteIndex.tsx`
- Modify: `src/app/components/SetNotePasswordDialog.tsx`
- Modify: `src/app/components/SettingsDialog.tsx`

**Interfaces:**
- Consumes: `NoteSummary[]`, protection flags, `verifyProtectedPassword`, `fetchExportNotes`, and admin settings from Task 4.
- Produces: one list-only home view whose click sequence is folder challenge, note challenge, then `navigate('/note/:id')`.

- [ ] **Step 1: Convert home state to summaries**

Change `HomePage` to store `NoteSummary[]`; replace list/sync/update items directly with response summaries. Fetch public settings normally and fetch admin settings only after `fetchAdminSession()` reports an authenticated administrator.

- [ ] **Step 2: Remove preview and body dependencies from `NotesList`**

Delete `NoteContent`, body truncation, selected desktop preview, and all legacy preview markup. Render only the existing `NoteIndex` inside the approved list container at every breakpoint. Type list, selection, password, update, and delete callbacks with `NoteSummary`.

- [ ] **Step 3: Implement the ordered navigation gate**

Use `folderProtected` and `noteProtected` flags. For administrators call `navigate` immediately. For visitors, open the folder password dialog first when needed; its success callback opens the note dialog when needed; the final success callback navigates. Keep successful IDs only in component memory as a prompt convenience, never in `localStorage`, and let the server detail endpoint remain authoritative.

- [ ] **Step 4: Move export behind admin authentication**

Show export only when `canManageNotes` is true. Fetch complete export data from `fetchExportNotes()` immediately before building the existing archive; do not export the summary array.

- [ ] **Step 5: Adapt settings/password dialogs to summary inputs**

Let password edits send a partial update `{ id, password }`. Ensure the settings dialog receives real folder passwords only after admin settings were loaded; public folder locks are represented by `protectedFolders` and note summary flags.

- [ ] **Step 6: Build and manually inspect the home route**

Run: `pnpm build`

Expected: build exits 0; home output contains one index region and no `NoteContent` import in `NotesList.tsx`.

- [ ] **Step 7: Commit the list-only home flow**

```bash
git add src/app/pages/HomePage.tsx src/app/components/NotesList.tsx src/app/components/NoteIndex.tsx src/app/components/SetNotePasswordDialog.tsx src/app/components/SettingsDialog.tsx
git commit -m "feat: gate navigation from summary-only note list"
```

### Task 6: Secure Direct Detail Flow

**Files:**
- Modify: `src/app/pages/NoteDetailPage.tsx`

**Interfaces:**
- Consumes: `fetchNoteSummary`, `fetchNote`, `verifyProtectedPassword`, `NoteSummary`, `NoteDetail`, and admin session state.
- Produces: direct-route behavior that never requests content before required password challenges succeed.

- [ ] **Step 1: Load summary, settings, and admin status before content**

Replace the initial `Promise.all([fetchNote(...)])` with summary/settings/admin requests. If the visitor is an admin or the summary has no protection flags, request the detail immediately; otherwise retain only the summary and start the challenge sequence.

- [ ] **Step 2: Reuse the ordered folder/note challenge**

Verify `folder:<folder>` first and `note:<id>` second. After the last successful verification, call `fetchNote(noteId)`; render `NoteContent` only after it returns a `NoteDetail`. Do not read or write unlock state from `localStorage`.

- [ ] **Step 3: Handle an authoritative 423 response**

If `fetchNote()` throws `ApiError` with status `423`, discard any stale detail, use the returned safe summary, and restart only the required scopes. Keep wrong-password errors inside the existing dialog without navigation.

- [ ] **Step 4: Preserve administrator edit/delete behavior**

Use partial update payloads and replace the loaded detail after a successful edit without inserting it into home list state. Keep delete navigation back to `/`.

- [ ] **Step 5: Build the complete frontend**

Run: `pnpm build`

Expected: TypeScript/Vite build exits 0 and produces `dist/`.

- [ ] **Step 6: Commit secure detail loading**

```bash
git add src/app/pages/NoteDetailPage.tsx
git commit -m "feat: unlock protected notes before loading detail"
```

### Task 7: End-to-End Contract Verification

**Files:**
- Modify only files required to fix failures found by the commands below.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: evidence that public responses omit secrets and authorized detail/export flows still work.

- [ ] **Step 1: Run the complete automated suite**

Run: `pnpm test && pnpm build && git diff --check`

Expected: all tests PASS, Vite build exits 0, and `git diff --check` produces no output.

- [ ] **Step 2: Start the server and verify public response shapes**

Run the server on a disposable port, call `GET /api/notes`, `POST /api/sync` only when a test Xiaomi cookie is available, `GET /api/notes/:id/summary`, and a protected `GET /api/notes/:id`. Confirm list/summary responses have no `content` or `password`, and locked detail returns `423` with only summary and missing scopes.

- [ ] **Step 3: Verify unlock and admin flows with a cookie jar**

Post the folder and note passwords to `/api/password/verify`, retaining cookies, then request detail and confirm it includes `content` but no `password`. Confirm unauthenticated `/api/admin/settings` and `/api/admin/notes/export` return `401`; after admin login, both succeed and export contains bodies but no note passwords.

- [ ] **Step 4: Review the final diff against the specification**

Run: `git diff --stat main...HEAD && git log --oneline main..HEAD`

Expected: only the planned server, client, test, package, and documentation changes are present; commits correspond to Tasks 1-6.

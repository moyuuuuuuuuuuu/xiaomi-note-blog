# Modern Minimal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Xiaomi Notes blog UI as a modern minimal, whitespace-led experience with black/white/gray styling, restrained cobalt accents, an editorial note index, and subtle interactive dust particles while preserving every existing behavior.

**Architecture:** Keep API, routing, authentication, storage, and note-management behavior unchanged. Introduce a small presentation layer consisting of semantic theme tokens, focused homepage and note-index components, reusable reveal primitives, and a canvas particle engine whose math is isolated in a testable module. Refactor the current oversized `NotesList` presentation around those units without moving its password, export, filtering, or management responsibilities into the new visual components.

**Tech Stack:** React 18, TypeScript, React Router 7, Tailwind CSS 4, Motion 12, Canvas 2D, Lucide React, existing Radix/shadcn primitives, Node test runner scripts, Vite 6.

## Global Constraints

- Do not modify API contracts, data structures, routes, sync behavior, password verification, administrator sessions, local unlock state, Markdown parsing, or server storage.
- Use system fonts only; add no remote fonts, images, or heavyweight visual dependencies.
- Define visual colors as semantic CSS variables; use near-white `#fafafa`, near-black `#111111`, neutral grays, and cobalt `#275df5` as the only brand accent.
- Keep dangerous actions red; never substitute cobalt for destructive semantics.
- Preserve a single-column mobile flow and prevent all horizontal overflow.
- Keep motion within 300–500ms for entrances and 150–220ms for hover feedback.
- Honor `prefers-reduced-motion: reduce`; stop particle drift and pointer response in reduced-motion mode.
- Pause the particle loop while the page is hidden, lower particle count on mobile, and keep the canvas non-interactive with `pointer-events: none`.

---

## File Map

- Create `src/app/lib/noteIndex.js`: pure filtering, folder counting, numbering, and display-date helpers for the redesigned index.
- Create `src/app/lib/noteIndex.test.mjs`: focused tests for the note-index view model.
- Create `src/app/lib/dustParticles.js`: pure particle creation and pointer-repulsion math.
- Create `src/app/lib/dustParticles.test.mjs`: deterministic particle-engine tests.
- Create `src/app/components/motion/Reveal.tsx`: reduced-motion-aware local equivalent of the selected React Bits/Aceternity reveal behavior.
- Create `src/app/components/DustParticles.tsx`: lifecycle-safe Canvas 2D renderer.
- Create `src/app/components/HomeHero.tsx`: homepage editorial hero and note count.
- Create `src/app/components/NoteIndex.tsx`: presentational indexed note rows and management menu slot.
- Modify `src/app/components/Header.tsx`: minimal global navigation.
- Modify `src/app/components/Footer.tsx`: minimal metadata footer.
- Modify `src/app/components/NotesList.tsx`: retain behavior while composing search, folders, index, desktop preview, export, and password dialogs.
- Modify `src/app/pages/HomePage.tsx`: compose hero, particles, redesigned list, and semantic loading state.
- Modify `src/app/pages/NoteDetailPage.tsx`: narrow editorial reading layout.
- Modify `src/app/components/NoteContent.tsx`: keep parsing unchanged and expose the new typography class.
- Modify `src/app/components/AdminPasswordDialog.tsx`, `PasswordDialog.tsx`, `NotePasswordDialog.tsx`, `SetNotePasswordDialog.tsx`, and `SettingsDialog.tsx`: apply the shared minimal dialog treatment without changing form logic.
- Modify `src/app/components/ui/button.tsx`, `input.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `badge.tsx`, and `sonner.tsx`: align shared primitives with theme tokens.
- Modify `src/styles/theme.css`: semantic color, radius, focus, and typography tokens.
- Modify `src/styles/index.css`: page layout, prose, reveal, particle, and reduced-motion styles.
- Modify `package.json`: include the two new pure-module test files in `pnpm test`.

---

### Task 1: Semantic Theme and Note-Index View Model

**Files:**
- Create: `src/app/lib/noteIndex.js`
- Create: `src/app/lib/noteIndex.test.mjs`
- Modify: `src/styles/theme.css`
- Modify: `src/styles/index.css`
- Modify: `package.json`

**Interfaces:**
- Consumes: note objects with `id`, `title`, `content`, `modifyTime`, and optional `folder`.
- Produces: `filterNotes(notes, searchTerm, selectedFolder)`, `collectFolders(notes)`, `formatIndexDate(timestamp)`, and `toIndexNumber(index)`.

- [ ] **Step 1: Write failing note-index tests**

```js
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node src/app/lib/noteIndex.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `noteIndex.js`.

- [ ] **Step 3: Implement the pure note-index helpers**

```js
export function filterNotes(notes, searchTerm, selectedFolder) {
  const query = searchTerm.trim().toLocaleLowerCase('zh-CN');
  return notes.filter((note) => {
    const matchesFolder = selectedFolder === 'all' || note.folder === selectedFolder;
    const haystack = `${note.title}\n${note.content}`.toLocaleLowerCase('zh-CN');
    return matchesFolder && (!query || haystack.includes(query));
  });
}

export function collectFolders(notes) {
  const counts = new Map();
  for (const note of notes) {
    if (note.folder) counts.set(note.folder, (counts.get(note.folder) || 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count }));
}

export function formatIndexDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

export function toIndexNumber(index) {
  return String(index + 1).padStart(2, '0');
}
```

- [ ] **Step 4: Add semantic tokens and global foundations**

Update `:root` in `src/styles/theme.css` so the primary tokens resolve to:

```css
:root {
  --background: #fafafa;
  --foreground: #111111;
  --card: #ffffff;
  --card-foreground: #111111;
  --popover: #ffffff;
  --popover-foreground: #111111;
  --primary: #111111;
  --primary-foreground: #ffffff;
  --secondary: #f1f1f1;
  --secondary-foreground: #272727;
  --muted: #f3f3f3;
  --muted-foreground: #737373;
  --accent: #eef2ff;
  --accent-foreground: #214ecb;
  --brand: #275df5;
  --brand-soft: #edf1ff;
  --destructive: #c62828;
  --destructive-foreground: #ffffff;
  --border: #dedede;
  --input: #cfcfcf;
  --ring: #275df5;
  --radius: 0.375rem;
}
```

Add `--color-brand` and `--color-brand-soft` mappings to `@theme inline`. In `src/styles/index.css`, add the system font stack, `overflow-x: clip`, visible `:focus-visible` rings, `.editorial-container`, `.editorial-rule`, and reduced-motion rules.

- [ ] **Step 5: Register and run the focused test**

Add `node src/app/lib/noteIndex.test.mjs` to the beginning of the existing `test` script, then run:

```bash
pnpm test
```

Expected: all existing tests and `noteIndex.test.mjs` exit 0.

- [ ] **Step 6: Commit the theme foundation**

```bash
git add package.json src/app/lib/noteIndex.js src/app/lib/noteIndex.test.mjs src/styles/theme.css src/styles/index.css
git commit -m "feat: add minimal theme foundation"
```

---

### Task 2: Reduced-Motion Reveal and Dust Particle Engine

**Files:**
- Create: `src/app/lib/dustParticles.js`
- Create: `src/app/lib/dustParticles.test.mjs`
- Create: `src/app/components/motion/Reveal.tsx`
- Create: `src/app/components/DustParticles.tsx`
- Modify: `src/styles/index.css`
- Modify: `package.json`

**Interfaces:**
- Produces: `createDustParticle(random, width, height)`, `advanceDustParticle(particle, bounds, pointer)`, `Reveal({ children, delay, className })`, and `DustParticles({ className })`.
- `pointer` is `null` or `{ x: number, y: number, radius: number }`; particles are `{ x, y, vx, vy, size, alpha }`.

- [ ] **Step 1: Write deterministic particle-math tests**

```js
import assert from 'node:assert/strict';
import { advanceDustParticle, createDustParticle } from './dustParticles.js';

const randomValues = [0.5, 0.25, 0.75, 0.4, 0.6, 0.3];
let index = 0;
const particle = createDustParticle(() => randomValues[index++], 200, 100);
assert.deepEqual(particle, { x: 100, y: 25, vx: 0.05, vy: -0.02, size: 1.2, alpha: 0.18 });

const moved = advanceDustParticle(
  { x: 50, y: 50, vx: 0, vy: 0, size: 1, alpha: 0.15 },
  { width: 100, height: 100 },
  { x: 55, y: 50, radius: 40 },
);
assert.ok(moved.x < 50, 'nearby pointer repels the particle');

const wrapped = advanceDustParticle(
  { x: 101, y: 20, vx: 0.2, vy: 0, size: 1, alpha: 0.15 },
  { width: 100, height: 100 },
  null,
);
assert.ok(wrapped.x <= 1, 'particle wraps at the horizontal edge');
```

- [ ] **Step 2: Run the particle test and verify it fails**

Run `node src/app/lib/dustParticles.test.mjs`.

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `dustParticles.js`.

- [ ] **Step 3: Implement particle creation and movement**

Implement deterministic creation using the ranges exercised above, cap repulsion to a subtle `0.35px` impulse, damp velocity after repulsion, and wrap particles across all four bounds. Do not read DOM globals in this module.

- [ ] **Step 4: Implement the reveal primitive**

```tsx
import { motion, useReducedMotion } from 'motion/react';
import type { PropsWithChildren } from 'react';

export function Reveal({ children, delay = 0, className = '' }: PropsWithChildren<{ delay?: number; className?: string }>) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 5: Implement the canvas lifecycle**

`DustParticles.tsx` must:

```tsx
return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
```

Inside its effect, use `ResizeObserver`, cap DPR at `1.5`, create `36` desktop or `18` mobile particles, track pointer coordinates relative to the canvas, set `pointer-events: none`, pause on `document.hidden`, and cancel the animation frame plus every listener on cleanup. When `matchMedia('(prefers-reduced-motion: reduce)')` matches, draw one static frame and do not register pointer listeners.

- [ ] **Step 6: Run tests and build**

Add the particle test to `pnpm test`, then run:

```bash
pnpm test
pnpm run build
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit the motion foundation**

```bash
git add package.json src/app/lib/dustParticles.js src/app/lib/dustParticles.test.mjs src/app/components/motion/Reveal.tsx src/app/components/DustParticles.tsx src/styles/index.css
git commit -m "feat: add subtle reveal and dust effects"
```

---

### Task 3: Minimal Header, Hero, Footer, and Homepage Composition

**Files:**
- Create: `src/app/components/HomeHero.tsx`
- Modify: `src/app/components/Header.tsx`
- Modify: `src/app/components/Footer.tsx`
- Modify: `src/app/pages/HomePage.tsx`

**Interfaces:**
- `HomeHero` consumes `{ siteName: string; siteDescription: string; noteCount: number }`.
- `Header` preserves all current props and callbacks.
- `HomePage` preserves all current loading, authentication, sync, settings, update, and delete behavior.

- [ ] **Step 1: Create the homepage hero**

```tsx
import { Reveal } from './motion/Reveal';

export function HomeHero({ siteName, siteDescription, noteCount }: { siteName: string; siteDescription: string; noteCount: number }) {
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div>
        <Reveal><p className="home-kicker">Personal notes · {new Date().getFullYear()}</p></Reveal>
        <Reveal delay={0.06}><h1 id="home-title">记录思考，<br />保留瞬间。</h1></Reveal>
      </div>
      <Reveal className="home-intro" delay={0.12}>
        <p>{siteDescription || `${siteName}中的日常记录。`}</p>
        <p className="home-count"><strong>{noteCount}</strong><span>NOTES IN ARCHIVE</span></p>
      </Reveal>
    </section>
  );
}
```

- [ ] **Step 2: Restyle the existing header without changing behavior**

Keep the current props. Replace the gradient logo surface with a cobalt dot or configured image, remove the description from the navigation, use a ghost settings button, and retain the near-black sync button, spinner, disabled state, and mobile labels.

- [ ] **Step 3: Compose the homepage**

In `HomePage.tsx`, replace the gradient page shell with:

```tsx
<div className="minimal-page min-h-screen flex flex-col">
  <div className="home-atmosphere" aria-hidden="true">
    <DustParticles className="home-particles" />
  </div>
  <Header {...headerProps} />
  <main className="editorial-container flex-1">
    <HomeHero siteName={settings.siteName} siteDescription={settings.siteDescription} noteCount={notes.length} />
    <NotesList {...notesListProps} />
  </main>
  <Footer siteName={settings.siteName} />
  {existingDialogs}
</div>
```

Use a typographic loading state with an animated one-pixel rule; preserve the current password-gate return path.

- [ ] **Step 4: Simplify the footer**

Render the copyright/site name on the left and `PERSONAL NOTES ARCHIVE` on the right, separated from content by a one-pixel rule. Remove the heart and social-decoration treatment.

- [ ] **Step 5: Verify the homepage shell**

Run:

```bash
pnpm test
pnpm run build
```

Expected: both commands exit 0 and Vite reports transformed modules without TypeScript errors.

- [ ] **Step 6: Commit the homepage shell**

```bash
git add src/app/components/HomeHero.tsx src/app/components/Header.tsx src/app/components/Footer.tsx src/app/pages/HomePage.tsx
git commit -m "feat: redesign the homepage shell"
```

---

### Task 4: Editorial Search, Filters, and Note Index

**Files:**
- Create: `src/app/components/NoteIndex.tsx`
- Modify: `src/app/components/NotesList.tsx`
- Modify: `src/styles/index.css`

**Interfaces:**
- `NoteIndex` consumes `notes`, `selectedNoteId`, `isMobile`, `isNoteLocked`, `onSelect`, and `renderActions`.
- `NotesList` preserves its public props and all existing export, password, unlock, preview, update, and delete behavior.

- [ ] **Step 1: Build the presentational index component**

```tsx
export function NoteIndex({ notes, selectedNoteId, isNoteLocked, onSelect, renderActions }: NoteIndexProps) {
  return (
    <div className="note-index">
      {notes.map((note, index) => (
        <Reveal key={note.id} delay={Math.min(index, 6) * 0.035}>
          <article className={`note-index-row ${selectedNoteId === note.id ? 'is-active' : ''}`}>
            <button type="button" className="note-index-main" onClick={() => onSelect(note)}>
              <span className="note-index-number">{toIndexNumber(index)}</span>
              <span className="note-index-title">{isNoteLocked(note) && <Lock aria-hidden="true" />} {note.title}</span>
              <span className="note-index-meta">{note.folder || '未分类'} · {formatIndexDate(note.modifyTime)}</span>
              <ArrowUpRight className="note-index-arrow" aria-hidden="true" />
            </button>
            {renderActions(note)}
          </article>
        </Reveal>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Replace the search card with an editorial toolbar**

Keep the same `searchTerm`, `selectedFolder`, and export handlers. Render a semantic search label, underline input, folder buttons with `aria-pressed`, and the existing export dropdown. Use `collectFolders(notes)` rather than duplicating count filters in JSX.

- [ ] **Step 3: Replace the left card list with `NoteIndex`**

Move the existing management dropdown JSX into `renderActions(note)`. Preserve every password, remove-protection, and delete callback exactly. Keep the current desktop preview alongside the index but remove its card chrome; on mobile, continue routing to `/note/:id` after the same unlock checks.

- [ ] **Step 4: Restyle empty, locked, and selected states**

Use typography, a short rule, and restrained icons. Never display gradients, circular icon backplates, blue-filled rows, or permanent shadows. The active row uses a three-pixel cobalt rule and `aria-current="true"` on its selection button.

- [ ] **Step 5: Run regression verification**

```bash
pnpm test
pnpm run build
```

Expected: both commands exit 0. Manually verify search, each folder, export menu, desktop preview, mobile navigation, lock prompts, management menu, and empty results.

- [ ] **Step 6: Commit the note index**

```bash
git add src/app/components/NoteIndex.tsx src/app/components/NotesList.tsx src/styles/index.css
git commit -m "feat: replace note cards with editorial index"
```

---

### Task 5: Editorial Note Detail and Prose

**Files:**
- Modify: `src/app/pages/NoteDetailPage.tsx`
- Modify: `src/app/components/NoteContent.tsx`
- Modify: `src/styles/index.css`

**Interfaces:**
- Preserve route `/note/:noteId`, all fetching, unlock checks, password dialogs, update/delete handlers, and administrator menu actions.
- `NoteContent` continues to consume `{ content: string }` and use the current Markdown transformation.

- [ ] **Step 1: Replace the detail shell**

Build a near-white page with a minimal sticky navigation, text back button, narrow `max-width: 46rem` reading column, metadata overline, large title, and one-pixel divider. Keep the current admin dropdown and all callbacks.

- [ ] **Step 2: Apply editorial prose styles**

Update `.note-content` in `src/styles/index.css` to use a maximum readable measure, `1.85` body line height, neutral headings, cobalt links, one-pixel blockquote rule, restrained inline-code fill, square-to-small-radius code blocks, and images without decorative shadows.

- [ ] **Step 3: Restyle loading, missing, and locked states**

Use the same typographic loading rule as the homepage. Keep the current return and password behavior. Ensure the missing-note state provides a visible, keyboard-accessible return action.

- [ ] **Step 4: Run verification**

```bash
pnpm test
pnpm run build
```

Expected: both commands exit 0. Manually inspect headings, lists, task items, links, blockquotes, code, images, locked notes, folder locks, admin actions, delete navigation, and mobile width.

- [ ] **Step 5: Commit the detail redesign**

```bash
git add src/app/pages/NoteDetailPage.tsx src/app/components/NoteContent.tsx src/styles/index.css
git commit -m "feat: redesign the note reading experience"
```

---

### Task 6: Shared Controls, Dialogs, and Feedback

**Files:**
- Modify: `src/app/components/ui/button.tsx`
- Modify: `src/app/components/ui/input.tsx`
- Modify: `src/app/components/ui/dialog.tsx`
- Modify: `src/app/components/ui/dropdown-menu.tsx`
- Modify: `src/app/components/ui/badge.tsx`
- Modify: `src/app/components/ui/sonner.tsx`
- Modify: `src/app/components/AdminPasswordDialog.tsx`
- Modify: `src/app/components/PasswordDialog.tsx`
- Modify: `src/app/components/NotePasswordDialog.tsx`
- Modify: `src/app/components/SetNotePasswordDialog.tsx`
- Modify: `src/app/components/SettingsDialog.tsx`

**Interfaces:**
- Preserve every component prop, validation message, submission callback, authentication call, settings field, cookie update, and close behavior.

- [ ] **Step 1: Align primitive variants with semantic tokens**

Use near-black primary buttons, white outline buttons, small radii, cobalt focus rings, one-pixel popover borders, and restrained shadows. Keep destructive variants mapped to `--destructive` and do not remove disabled, hover, focus, or keyboard states.

- [ ] **Step 2: Apply the shared dialog structure**

For every named dialog, keep its form logic unchanged while standardizing:

```tsx
<DialogHeader className="minimal-dialog-header">
  <DialogTitle>{existingTitle}</DialogTitle>
  <DialogDescription>{existingDescription}</DialogDescription>
</DialogHeader>
```

Use underline/light-border fields, cobalt focus, near-black confirmation, outline cancel, and visible inline errors. Settings sections use one-pixel separators rather than tinted cards.

- [ ] **Step 3: Restyle toast feedback**

Keep Sonner behavior and positions unchanged. Use white surfaces, near-black text, one-pixel borders, restrained shadows, cobalt success detail, and red error detail.

- [ ] **Step 4: Run behavior verification**

```bash
pnpm test
pnpm run build
```

Expected: both commands exit 0. Manually verify site password, admin login, settings save, Xiaomi cookie save, note password set/remove, folder password, validation errors, cancel/escape, and destructive confirmation.

- [ ] **Step 5: Commit the shared UI pass**

```bash
git add src/app/components/ui/button.tsx src/app/components/ui/input.tsx src/app/components/ui/dialog.tsx src/app/components/ui/dropdown-menu.tsx src/app/components/ui/badge.tsx src/app/components/ui/sonner.tsx src/app/components/AdminPasswordDialog.tsx src/app/components/PasswordDialog.tsx src/app/components/NotePasswordDialog.tsx src/app/components/SetNotePasswordDialog.tsx src/app/components/SettingsDialog.tsx
git commit -m "feat: unify minimal dialogs and controls"
```

---

### Task 7: Final Accessibility, Performance, and Visual Verification

**Files:**
- Verify only: all files changed in Tasks 1–6.

**Interfaces:**
- Produces a verified production build with unchanged business behavior and the approved visual system.

- [ ] **Step 1: Run the complete automated suite**

```bash
pnpm test
pnpm run build
git diff --check
```

Expected: all commands exit 0; Vite may report the existing large-chunk warning but no errors.

- [ ] **Step 2: Verify responsive layouts**

Inspect at widths `360`, `390`, `768`, `1024`, and `1440`. Confirm no horizontal scroll, clipped controls, overlapping metadata, or particle overflow. Confirm index offsets disappear on mobile.

- [ ] **Step 3: Verify interaction and accessibility**

Keyboard through navigation, search, folders, index rows, export, settings, dialogs, management menus, and detail back navigation. Confirm visible focus, meaningful labels, `aria-pressed` folder state, `aria-current` selected row, sufficient contrast, and no pointer interception by the canvas.

- [ ] **Step 4: Verify reduced motion and lifecycle**

Enable `prefers-reduced-motion: reduce`; confirm reveals become immediate and particles stop. Hide/show the browser tab; confirm the canvas loop pauses and resumes without duplicate animation frames. Resize repeatedly and confirm particle count remains bounded.

- [ ] **Step 5: Verify all business workflows**

Exercise homepage loading, search, folder filters, export formats, desktop preview, mobile detail navigation, sync, settings, admin authentication, site password, folder password, note password, edit, password removal, delete, Markdown rendering, network errors, and empty state.

- [ ] **Step 6: Record the verification result**

Confirm the working tree contains no uncommitted redesign files. If any verification step fails, return to the task that owns that file, add a concrete regression check there, correct the implementation, rerun that task's commands, and commit through that task before repeating Task 7.

# Magnetic Field Note Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rigid note rows with the approved responsive magnetic-field card layout while preserving summary-only data, protected-note navigation, and administrator actions.

**Architecture:** Extend the existing pure note-index helper with a deterministic six-slot layout mapper, then make `NoteIndex` render notes in six-item grid clusters using that mapper. Keep all data loading and click behavior unchanged; CSS owns the twelve-column desktop placement, compact single-column mobile flow, focus states, and reduced-motion behavior.

**Tech Stack:** React 18, TypeScript, CSS Grid, Motion `Reveal`, Lucide React, Node built-in test runner assertions, Vite 6.

## Global Constraints

- Only change the note-list presentation; do not change the homepage hero, navigation, search, category filter, detail page, routes, API, sync, export, authentication, or password behavior.
- List rendering must continue to consume `NoteSummary` and must never fetch, prefetch, or render note content or passwords.
- Preserve `NoteIndex` props: `notes`, `isNoteLocked`, `onSelect`, and `renderActions`.
- Keep DOM and keyboard reading order identical to the filtered note array.
- Use existing semantic color tokens and existing dependencies only.
- Below `900px`, use a safe single-column flow with no horizontal overflow.
- Honor `prefers-reduced-motion: reduce` by disabling card movement and rotation.

---

## File Map

- Modify `src/app/lib/noteIndex.js`: export the deterministic card-layout mapper used by the component.
- Modify `src/app/lib/noteIndex.test.mjs`: cover all six slots, mirrored groups, and index normalization.
- Modify `src/app/components/NoteIndex.tsx`: group notes into six-item clusters and render magnetic-card semantics without changing callbacks.
- Modify `src/styles/index.css`: replace rigid row styles with magnetic grid, interaction, responsive, and reduced-motion rules.

### Task 1: Deterministic Magnetic Layout Model

**Files:**
- Modify: `src/app/lib/noteIndex.test.mjs`
- Modify: `src/app/lib/noteIndex.js`

**Interfaces:**
- Consumes: a zero-based note index.
- Produces: `getNoteCardLayout(index)`, returning `{ variant, direction, slot, group }` where `variant` is one of `hero`, `wide`, `medium`, `compact`, `tall`, or `closing`, and `direction` is `forward` or `reverse`.

- [ ] **Step 1: Write the failing layout test**

Update the import and append these assertions to `src/app/lib/noteIndex.test.mjs`:

```js
import {
  collectFolders,
  filterNotes,
  formatIndexDate,
  getNoteCardLayout,
  toIndexNumber,
} from './noteIndex.js';

assert.deepEqual(
  Array.from({ length: 6 }, (_, index) => getNoteCardLayout(index).variant),
  ['hero', 'wide', 'medium', 'compact', 'tall', 'closing'],
);
assert.deepEqual(getNoteCardLayout(0), { variant: 'hero', direction: 'forward', slot: 0, group: 0 });
assert.deepEqual(getNoteCardLayout(6), { variant: 'hero', direction: 'reverse', slot: 0, group: 1 });
assert.deepEqual(getNoteCardLayout(12), { variant: 'hero', direction: 'forward', slot: 0, group: 2 });
assert.deepEqual(getNoteCardLayout(-1), { variant: 'hero', direction: 'forward', slot: 0, group: 0 });
```

- [ ] **Step 2: Run the test and verify the missing-export failure**

Run:

```bash
node src/app/lib/noteIndex.test.mjs
```

Expected: FAIL with a `SyntaxError` stating that `noteIndex.js` does not provide an export named `getNoteCardLayout`.

- [ ] **Step 3: Implement the minimal layout mapper**

Append to `src/app/lib/noteIndex.js`:

```js
const NOTE_CARD_VARIANTS = ['hero', 'wide', 'medium', 'compact', 'tall', 'closing'];

export function getNoteCardLayout(index) {
  const safeIndex = Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
  const slot = safeIndex % NOTE_CARD_VARIANTS.length;
  const group = Math.floor(safeIndex / NOTE_CARD_VARIANTS.length);

  return {
    variant: NOTE_CARD_VARIANTS[slot],
    direction: group % 2 === 0 ? 'forward' : 'reverse',
    slot,
    group,
  };
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
node src/app/lib/noteIndex.test.mjs
```

Expected: exit code `0` with no assertion output.

- [ ] **Step 5: Commit the tested layout model**

```bash
git add src/app/lib/noteIndex.js src/app/lib/noteIndex.test.mjs
git commit -m "test: define magnetic note card rhythm"
```

### Task 2: Magnetic Card Component and Responsive Styling

**Files:**
- Modify: `src/app/components/NoteIndex.tsx`
- Modify: `src/styles/index.css`

**Interfaces:**
- Consumes: the existing `NoteIndexProps` and `getNoteCardLayout(index)` from Task 1.
- Produces: six-item `.note-index-cluster` sections containing focusable magnetic cards; existing selection and management callbacks remain unchanged.

- [ ] **Step 1: Group the note array without changing order**

In `src/app/components/NoteIndex.tsx`, import `getNoteCardLayout` and create groups immediately inside the component:

```tsx
const groups = Array.from(
  { length: Math.ceil(notes.length / 6) },
  (_, groupIndex) => notes.slice(groupIndex * 6, groupIndex * 6 + 6),
);
```

- [ ] **Step 2: Replace row markup with magnetic-card semantics**

Render each group as a labelled cluster, and use the absolute note index for numbering and layout:

```tsx
<div className="note-index">
  {groups.map((group, groupIndex) => {
    const direction = getNoteCardLayout(groupIndex * 6).direction;
    return (
      <section
        className={`note-index-cluster note-index-cluster--${direction}`}
        aria-label={`文章组 ${groupIndex + 1}`}
        key={group[0].id}
      >
        {group.map((note, slot) => {
          const index = groupIndex * 6 + slot;
          const { variant } = getNoteCardLayout(index);
          const folder = note.folder || '未分类';
          return (
            <Reveal
              className={`note-index-card note-index-card--${variant}`}
              delay={Math.min(index, 6) * 0.035}
              key={note.id}
            >
              <article className="note-index-card-surface">
                <button type="button" className="note-index-main" onClick={() => onSelect(note)}>
                  <span className="note-index-card-head">
                    <span className="note-index-number">{toIndexNumber(index)}</span>
                    <span className="note-index-meta" title={folder}>{folder} · {formatIndexDate(note.modifyTime)}</span>
                  </span>
                  <span className="note-index-title">
                    {isNoteLocked(note) && <Lock aria-label="已加密" />}
                    {note.title}
                  </span>
                  <ArrowUpRight className="note-index-arrow" aria-hidden="true" />
                </button>
                {renderActions(note)}
              </article>
            </Reveal>
          );
        })}
      </section>
    );
  })}
</div>
```

- [ ] **Step 3: Replace rigid row CSS with the twelve-column field**

Replace the existing `.note-index` through mobile `.note-index-actions` rules in `src/styles/index.css` with rules that:

```css
.note-index { display: grid; gap: clamp(2.5rem, 6vw, 5.5rem); }
.note-index-cluster {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 2.25rem;
  gap: 0.75rem;
}
.note-index-card { min-width: 0; }
.note-index-cluster--forward .note-index-card--hero { grid-column: 1 / span 6; grid-row: 1 / span 5; }
.note-index-cluster--forward .note-index-card--wide { grid-column: 7 / span 6; grid-row: 2 / span 4; }
.note-index-cluster--forward .note-index-card--medium { grid-column: 2 / span 4; grid-row: 6 / span 4; }
.note-index-cluster--forward .note-index-card--compact { grid-column: 6 / span 3; grid-row: 7 / span 3; }
.note-index-cluster--forward .note-index-card--tall { grid-column: 9 / span 4; grid-row: 6 / span 5; }
.note-index-cluster--forward .note-index-card--closing { grid-column: 1 / span 7; grid-row: 11 / span 3; }
.note-index-cluster--reverse .note-index-card--hero { grid-column: 7 / span 6; grid-row: 1 / span 5; }
.note-index-cluster--reverse .note-index-card--wide { grid-column: 1 / span 6; grid-row: 2 / span 4; }
.note-index-cluster--reverse .note-index-card--medium { grid-column: 7 / span 4; grid-row: 6 / span 4; }
.note-index-cluster--reverse .note-index-card--compact { grid-column: 4 / span 3; grid-row: 7 / span 3; }
.note-index-cluster--reverse .note-index-card--tall { grid-column: 1 / span 4; grid-row: 6 / span 5; }
.note-index-cluster--reverse .note-index-card--closing { grid-column: 6 / span 7; grid-row: 11 / span 3; }
```

Use the complete presentation rules below for the replacement:

```css
.note-index {
  display: grid;
  gap: clamp(2.5rem, 6vw, 5.5rem);
}

.note-index-cluster {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 2.25rem;
  gap: 0.75rem;
}

.note-index-card { min-width: 0; }
.note-index-cluster--forward .note-index-card--hero { grid-column: 1 / span 6; grid-row: 1 / span 5; }
.note-index-cluster--forward .note-index-card--wide { grid-column: 7 / span 6; grid-row: 2 / span 4; }
.note-index-cluster--forward .note-index-card--medium { grid-column: 2 / span 4; grid-row: 6 / span 4; }
.note-index-cluster--forward .note-index-card--compact { grid-column: 6 / span 3; grid-row: 7 / span 3; }
.note-index-cluster--forward .note-index-card--tall { grid-column: 9 / span 4; grid-row: 6 / span 5; }
.note-index-cluster--forward .note-index-card--closing { grid-column: 1 / span 7; grid-row: 11 / span 3; }
.note-index-cluster--reverse .note-index-card--hero { grid-column: 7 / span 6; grid-row: 1 / span 5; }
.note-index-cluster--reverse .note-index-card--wide { grid-column: 1 / span 6; grid-row: 2 / span 4; }
.note-index-cluster--reverse .note-index-card--medium { grid-column: 7 / span 4; grid-row: 6 / span 4; }
.note-index-cluster--reverse .note-index-card--compact { grid-column: 4 / span 3; grid-row: 7 / span 3; }
.note-index-cluster--reverse .note-index-card--tall { grid-column: 1 / span 4; grid-row: 6 / span 5; }
.note-index-cluster--reverse .note-index-card--closing { grid-column: 6 / span 7; grid-row: 11 / span 3; }

.note-index-card-surface {
  position: relative;
  isolation: isolate;
  height: 100%;
  border: 1px solid color-mix(in srgb, var(--border) 92%, transparent);
  border-radius: 1.125rem;
  background: color-mix(in srgb, var(--card) 88%, transparent);
  box-shadow: 0 0 0 transparent;
  transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 220ms ease, box-shadow 240ms ease;
}

.note-index-card-surface::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at 92% 4%, color-mix(in srgb, var(--brand) 15%, transparent), transparent 34%);
  content: '';
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
}

.note-index-card:hover .note-index-card-surface,
.note-index-card:focus-within .note-index-card-surface {
  z-index: 2;
  border-color: color-mix(in srgb, var(--brand) 42%, var(--border));
  box-shadow: 0 1.1rem 2.6rem rgb(15 23 42 / 10%), 0 0 0 0.3rem color-mix(in srgb, var(--brand) 4%, transparent);
  transform: translateY(-0.35rem) rotate(-0.3deg);
}

.note-index-card:nth-child(even):hover .note-index-card-surface,
.note-index-card:nth-child(even):focus-within .note-index-card-surface {
  transform: translateY(-0.35rem) rotate(0.3deg);
}

.note-index-card:hover .note-index-card-surface::before,
.note-index-card:focus-within .note-index-card-surface::before { opacity: 1; }

.note-index-main {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 7rem;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.2rem;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: var(--foreground);
  text-align: left;
  cursor: pointer;
}

.note-index-main:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 3px;
}

.note-index-card-head {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-right: 2.25rem;
}

.note-index-number,
.note-index-meta {
  color: var(--muted-foreground);
  font-size: 0.64rem;
  letter-spacing: 0.09em;
}

.note-index-number { color: var(--brand); font-weight: 650; }
.note-index-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.note-index-title {
  display: flex;
  max-width: calc(100% - 1.5rem);
  align-items: flex-start;
  gap: 0.5rem;
  overflow-wrap: anywhere;
  font-size: clamp(1rem, 1.75vw, 1.4rem);
  font-weight: 540;
  line-height: 1.15;
  letter-spacing: -0.04em;
}

.note-index-card--hero .note-index-title { font-size: clamp(1.45rem, 3vw, 2.45rem); }
.note-index-card--closing .note-index-title { font-size: clamp(1.15rem, 2.1vw, 1.75rem); }
.note-index-card--compact .note-index-title { font-size: clamp(0.92rem, 1.45vw, 1.15rem); }

.note-index-title svg {
  width: 0.9rem;
  flex: 0 0 auto;
  color: var(--muted-foreground);
}

.note-index-arrow {
  position: absolute;
  right: 1.1rem;
  bottom: 0.95rem;
  width: 1rem;
  color: var(--muted-foreground);
  transition: color 200ms ease, transform 220ms ease;
}

.note-index-main:hover .note-index-arrow,
.note-index-main:focus-visible .note-index-arrow {
  color: var(--brand);
  transform: translate(0.2rem, -0.2rem);
}

.note-index-actions {
  position: absolute;
  z-index: 4;
  right: 0.7rem;
  top: 0.65rem;
  opacity: 0;
  transition: opacity 180ms ease;
}

.note-index-card:hover .note-index-actions,
.note-index-card:focus-within .note-index-actions { opacity: 1; }

@media (max-width: 899px) {
  .note-index { gap: 0.8rem; }
  .note-index-cluster { display: flex; flex-direction: column; gap: 0.8rem; }
  .note-index-card { width: 100%; min-height: 7rem; }
  .note-index-card--hero { min-height: 10.5rem; }
  .note-index-card--medium { width: 94%; margin-left: 6%; }
  .note-index-card--compact { width: 88%; margin-left: 12%; }
  .note-index-card--tall { width: 92%; margin-right: 8%; }
  .note-index-card--closing { width: 96%; margin-left: 4%; }
  .note-index-card:hover .note-index-card-surface,
  .note-index-card:focus-within .note-index-card-surface,
  .note-index-card:nth-child(even):hover .note-index-card-surface,
  .note-index-card:nth-child(even):focus-within .note-index-card-surface { transform: translateY(-0.15rem); }
  .note-index-actions { opacity: 1; }
  .note-index-title { padding-right: 1rem; }
}

@media (prefers-reduced-motion: reduce) {
  .note-index-card-surface,
  .note-index-card-surface::before,
  .note-index-arrow,
  .note-index-actions { transition: none; }
  .note-index-card:hover .note-index-card-surface,
  .note-index-card:focus-within .note-index-card-surface,
  .note-index-card:nth-child(even):hover .note-index-card-surface,
  .note-index-card:nth-child(even):focus-within .note-index-card-surface { transform: none; }
}
```

- [ ] **Step 4: Run focused behavior tests**

Run:

```bash
node src/app/lib/noteIndex.test.mjs && node src/app/lib/noteAccessFlow.test.mjs
```

Expected: exit code `0`; layout mapping and protected-note navigation assertions all pass.

- [ ] **Step 5: Run full regression tests and production build**

Run:

```bash
pnpm test && pnpm build
```

Expected: all Node assertions exit `0`; Vite finishes with `built in` and exit code `0`.

- [ ] **Step 6: Inspect the final diff for scope and whitespace**

Run:

```bash
git diff --check
git diff --stat
git diff -- src/app/components/NoteIndex.tsx src/styles/index.css src/app/lib/noteIndex.js src/app/lib/noteIndex.test.mjs
```

Expected: no whitespace errors; only the four planned implementation files differ from the task baseline.

- [ ] **Step 7: Commit the magnetic note index**

```bash
git add src/app/components/NoteIndex.tsx src/styles/index.css
git commit -m "feat: reshape note index as magnetic cards"
```

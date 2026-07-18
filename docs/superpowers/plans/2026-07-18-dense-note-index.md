# Dense Note Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized six-card magnetic clusters with the approved compact `3 → 4 → 2` irregular row rhythm whose card heights follow title content.

**Architecture:** Replace the old six-slot card mapper with a pure row-layout model that owns grouping, mirrored twelve-column spans, deterministic top offsets, and absolute indices. `NoteIndex` consumes this view model and passes CSS custom properties through the existing `Reveal` wrapper; CSS handles the dense desktop grid, tablet two-column reflow, mobile single column, compact surfaces, and reduced-motion behavior.

**Tech Stack:** React 18, TypeScript, CSS Grid, Motion `Reveal`, Lucide React, Node assertions, Vite 6.

## Global Constraints

- Only change the article list presentation and its pure layout helper.
- Keep `NoteSummary` summary-only; never request, prefetch, or render article content or passwords.
- Preserve `NoteIndex` props: `notes`, `isNoteLocked`, `onSelect`, and `renderActions`.
- Desktop row counts repeat `3 → 4 → 2`; spans mirror every nine articles.
- Card height follows title content with a `66px` minimum and deterministic `0–10px` top offsets.
- At `720px–1099px`, use alternating `5 / 7` and `7 / 5` two-column pairs.
- At `719px` and below, use a `92%–100%` single-column flow.
- Preserve DOM order and keyboard reading order at every breakpoint.
- Keep existing theme tokens and dependencies; add no random placement, masonry, remote resources, or runtime packages.
- Honor `prefers-reduced-motion: reduce` by disabling lift and rotation.

---

## File Map

- Modify `src/app/lib/noteIndex.js`: replace the legacy six-card mapper with row layout and grouping helpers.
- Modify `src/app/lib/noteIndex.test.mjs`: prove row counts, mirrored spans, offsets, grouping, indices, and partial-row alignment.
- Modify `src/app/components/motion/Reveal.tsx`: accept a React style object so a grid item can receive CSS custom properties without an extra wrapper.
- Modify `src/app/components/NoteIndex.tsx`: render the pure row view model and preserve all existing callbacks.
- Modify `src/styles/index.css`: implement the approved dense grid and responsive presentation.

### Task 1: Deterministic `3 → 4 → 2` Row View Model

**Files:**
- Modify: `src/app/lib/noteIndex.test.mjs`
- Modify: `src/app/lib/noteIndex.js`

**Interfaces:**
- Consumes: `getNoteRowLayout(rowIndex)` receives a zero-based row index; `groupNotesByRowPattern(notes)` receives an ordered note array.
- Produces: row layouts with `{ rowIndex, patternIndex, cycle, count, spans, offsets, direction }`, and grouped rows with entries containing `{ note, index, columnStart, columnSpan, offset }`.

- [ ] **Step 1: Replace the legacy layout assertions with failing row-model assertions**

Change the imports in `src/app/lib/noteIndex.test.mjs` to:

```js
import {
  collectFolders,
  filterNotes,
  formatIndexDate,
  getNoteRowLayout,
  groupNotesByRowPattern,
  toIndexNumber,
} from './noteIndex.js';
```

Replace the `getNoteCardLayout` assertions with:

```js
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
assert.deepEqual(groupedRows.map((row) => row.entries.length), [3, 4, 2, 3, 1]);
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
  groupedRows[4].entries.map(({ index, columnStart, columnSpan, offset }) => ({ index, columnStart, columnSpan, offset })),
  [{ index: 12, columnStart: 10, columnSpan: 3, offset: 3 }],
);
assert.deepEqual(groupNotesByRowPattern([]), []);
```

- [ ] **Step 2: Run the focused test and verify the missing-export failure**

Run:

```bash
node src/app/lib/noteIndex.test.mjs
```

Expected: FAIL because `noteIndex.js` does not export `getNoteRowLayout` or `groupNotesByRowPattern`.

- [ ] **Step 3: Replace the legacy mapper with the row model**

Remove `NOTE_CARD_VARIANTS` and `getNoteCardLayout` from `src/app/lib/noteIndex.js`, then append:

```js
const NOTE_ROW_PATTERNS = [
  { count: 3, spans: [5, 3, 4], offsets: [0, 8, 2] },
  { count: 4, spans: [2, 4, 3, 3], offsets: [5, 0, 10, 3] },
  { count: 2, spans: [7, 5], offsets: [0, 9] },
];

export function getNoteRowLayout(rowIndex) {
  const safeRowIndex = Number.isFinite(rowIndex) && rowIndex >= 0 ? Math.floor(rowIndex) : 0;
  const patternIndex = safeRowIndex % NOTE_ROW_PATTERNS.length;
  const cycle = Math.floor(safeRowIndex / NOTE_ROW_PATTERNS.length);
  const pattern = NOTE_ROW_PATTERNS[patternIndex];
  const direction = cycle % 2 === 0 ? 'forward' : 'reverse';
  const mirror = (values) => direction === 'reverse' ? [...values].reverse() : [...values];

  return {
    rowIndex: safeRowIndex,
    patternIndex,
    cycle,
    count: pattern.count,
    spans: mirror(pattern.spans),
    offsets: mirror(pattern.offsets),
    direction,
  };
}

export function groupNotesByRowPattern(notes) {
  const rows = [];
  let noteIndex = 0;
  let rowIndex = 0;

  while (noteIndex < notes.length) {
    const layout = getNoteRowLayout(rowIndex);
    const rowNotes = notes.slice(noteIndex, noteIndex + layout.count);
    const usedSpans = layout.spans.slice(0, rowNotes.length);
    const usedColumns = usedSpans.reduce((total, span) => total + span, 0);
    let columnStart = layout.direction === 'reverse' && rowNotes.length < layout.count
      ? 13 - usedColumns
      : 1;

    const entries = rowNotes.map((note, slot) => {
      const entry = {
        note,
        index: noteIndex + slot,
        columnStart,
        columnSpan: layout.spans[slot],
        offset: layout.offsets[slot],
      };
      columnStart += layout.spans[slot];
      return entry;
    });

    rows.push({ ...layout, entries });
    noteIndex += rowNotes.length;
    rowIndex += 1;
  }

  return rows;
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
node src/app/lib/noteIndex.test.mjs
```

Expected: exit code `0` with no assertion output.

- [ ] **Step 5: Commit the row view model**

```bash
git add src/app/lib/noteIndex.js src/app/lib/noteIndex.test.mjs
git commit -m "test: define dense note row rhythm"
```

### Task 2: Compact Content-Height Cards and Responsive Reflow

**Files:**
- Modify: `src/app/components/motion/Reveal.tsx`
- Modify: `src/app/components/NoteIndex.tsx`
- Modify: `src/styles/index.css`

**Interfaces:**
- Consumes: `groupNotesByRowPattern(notes)` from Task 1 and the unchanged `NoteIndexProps` callbacks.
- Produces: semantic row sections whose `Reveal` grid items receive `--note-column-start`, `--note-column-span`, `--note-card-offset`, `--note-tablet-span`, `--note-mobile-width`, and `--note-mobile-offset`.

- [ ] **Step 1: Allow `Reveal` to forward CSS custom properties**

Update `src/app/components/motion/Reveal.tsx` to:

```tsx
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties, PropsWithChildren } from 'react';

interface RevealProps extends PropsWithChildren {
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

export function Reveal({ children, delay = 0, className = '', style }: RevealProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
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

- [ ] **Step 2: Render row groups and responsive custom properties**

Replace `src/app/components/NoteIndex.tsx` with:

```tsx
import type { CSSProperties, ReactNode } from 'react';
import { ArrowUpRight, Lock } from 'lucide-react';
import type { NoteSummary } from '../App';
import { formatIndexDate, groupNotesByRowPattern, toIndexNumber } from '../lib/noteIndex.js';
import { Reveal } from './motion/Reveal';

interface NoteIndexProps {
  notes: NoteSummary[];
  isNoteLocked: (note: NoteSummary) => boolean;
  onSelect: (note: NoteSummary) => void;
  renderActions: (note: NoteSummary) => ReactNode;
}

type NoteCardStyle = CSSProperties & {
  '--note-column-start': number;
  '--note-column-span': number;
  '--note-card-offset': string;
  '--note-tablet-span': number;
  '--note-mobile-width': string;
  '--note-mobile-offset': string;
};

const TABLET_SPANS = [5, 7, 7, 5];
const MOBILE_WIDTHS = [100, 92, 96];
const MOBILE_OFFSETS = [0, 8, 0];

export function NoteIndex({ notes, isNoteLocked, onSelect, renderActions }: NoteIndexProps) {
  const rows = groupNotesByRowPattern(notes);

  return (
    <div className="note-index">
      {rows.map((row) => (
        <section
          className={`note-index-row-group note-index-row-group--${row.direction}`}
          aria-label={`文章行 ${row.rowIndex + 1}`}
          key={`note-row-${row.rowIndex}`}
        >
          {row.entries.map(({ note, index, columnStart, columnSpan, offset }) => {
            const folder = note.folder || '未分类';
            const style: NoteCardStyle = {
              '--note-column-start': columnStart,
              '--note-column-span': columnSpan,
              '--note-card-offset': `${offset}px`,
              '--note-tablet-span': TABLET_SPANS[index % TABLET_SPANS.length],
              '--note-mobile-width': `${MOBILE_WIDTHS[index % MOBILE_WIDTHS.length]}%`,
              '--note-mobile-offset': `${MOBILE_OFFSETS[index % MOBILE_OFFSETS.length]}%`,
            };

            return (
              <Reveal
                className={`note-index-card${columnSpan <= 3 ? ' note-index-card--narrow' : ''}`}
                delay={Math.min(index, 6) * 0.035}
                key={note.id}
                style={style}
              >
                <article className="note-index-card-surface">
                  <button type="button" className="note-index-main" onClick={() => onSelect(note)}>
                    <span className="note-index-card-head">
                      <span className="note-index-number">{toIndexNumber(index)}</span>
                      <span className="note-index-meta" title={folder}>
                        {folder} · {formatIndexDate(note.modifyTime)}
                      </span>
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
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Replace the magnetic cluster rules with the approved dense grid**

Keep unrelated `.notes-layout`, empty-state, preview, and content styles unchanged. Replace the note-index cluster/card block in `src/styles/index.css` with:

```css
.note-index {
  display: grid;
  gap: 0.7rem;
}

.note-index-row-group {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.7rem;
  align-items: start;
}

.note-index-card {
  position: relative;
  grid-column: var(--note-column-start) / span var(--note-column-span);
  min-width: 0;
  margin-top: var(--note-card-offset);
  align-self: start;
}

.note-index-card:hover,
.note-index-card:focus-within { z-index: 3; }

.note-index-card-surface {
  position: relative;
  isolation: isolate;
  min-height: 66px;
  border: 1px solid color-mix(in srgb, var(--border) 92%, transparent);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--card) 88%, transparent);
  box-shadow: 0 0 0 transparent;
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 200ms ease, box-shadow 220ms ease;
}

.note-index-card-surface::before {
  position: absolute;
  z-index: 0;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at 92% 4%, color-mix(in srgb, var(--brand) 13%, transparent), transparent 34%);
  content: '';
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease;
}

.note-index-card:hover .note-index-card-surface,
.note-index-card:focus-within .note-index-card-surface {
  border-color: color-mix(in srgb, var(--brand) 40%, var(--border));
  box-shadow: 0 0.75rem 1.8rem rgb(15 23 42 / 9%), 0 0 0 0.22rem color-mix(in srgb, var(--brand) 4%, transparent);
  transform: translateY(-3px) rotate(-0.2deg);
}

.note-index-card:nth-child(even):hover .note-index-card-surface,
.note-index-card:nth-child(even):focus-within .note-index-card-surface { transform: translateY(-3px) rotate(0.2deg); }
.note-index-card:hover .note-index-card-surface::before,
.note-index-card:focus-within .note-index-card-surface::before { opacity: 1; }

.note-index-main {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  min-height: 66px;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.7rem;
  padding: 0.75rem 0.82rem;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: var(--foreground);
  text-align: left;
  cursor: pointer;
}

.note-index-main:focus-visible { outline: 2px solid var(--brand); outline-offset: 3px; }
.note-index-card-head { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 0.55rem; padding-right: 1.7rem; }
.note-index-number,
.note-index-meta { color: var(--muted-foreground); font-size: 0.58rem; letter-spacing: 0.08em; }
.note-index-number { color: var(--brand); font-weight: 650; }
.note-index-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note-index-title { display: flex; max-width: calc(100% - 1rem); align-items: flex-start; gap: 0.42rem; overflow-wrap: anywhere; font-size: clamp(0.82rem, 1.1vw, 1.05rem); font-weight: 550; line-height: 1.18; letter-spacing: -0.035em; }
.note-index-card--narrow .note-index-title { font-size: clamp(0.76rem, 0.92vw, 0.94rem); }
.note-index-title svg { width: 0.78rem; flex: 0 0 auto; color: var(--muted-foreground); }
.note-index-arrow { position: absolute; right: 0.7rem; bottom: 0.62rem; width: 0.82rem; color: var(--muted-foreground); transition: color 180ms ease, transform 200ms ease; }
.note-index-main:hover .note-index-arrow,
.note-index-main:focus-visible .note-index-arrow { color: var(--brand); transform: translate(0.16rem, -0.16rem); }
.note-index-actions { position: absolute; z-index: 4; right: 0.38rem; top: 0.34rem; opacity: 0; transition: opacity 180ms ease; }
.note-index-card:hover .note-index-actions,
.note-index-card:focus-within .note-index-actions { opacity: 1; }

@media (min-width: 720px) and (max-width: 1099px) {
  .note-index { grid-template-columns: repeat(12, minmax(0, 1fr)); }
  .note-index-row-group { display: contents; }
  .note-index-card { grid-column: auto / span var(--note-tablet-span); }
}

@media (max-width: 719px) {
  .note-index { display: flex; flex-direction: column; gap: 0.7rem; }
  .note-index-row-group { display: contents; }
  .note-index-card { width: var(--note-mobile-width); margin-top: 0; margin-left: var(--note-mobile-offset); }
  .note-index-card:hover .note-index-card-surface,
  .note-index-card:focus-within .note-index-card-surface,
  .note-index-card:nth-child(even):hover .note-index-card-surface,
  .note-index-card:nth-child(even):focus-within .note-index-card-surface { transform: translateY(-2px); }
  .note-index-actions { opacity: 1; }
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

Expected: exit code `0`; dense grouping and protected-note navigation assertions pass.

- [ ] **Step 5: Run the full regression suite and production build**

Run:

```bash
pnpm test && pnpm build
```

Expected: all Node assertion files exit `0`; Vite reports `built in` and exits `0`.

- [ ] **Step 6: Verify the approved density in a real browser**

Use `apply_patch` to create the untracked preview fixtures below at `/tmp/xiaomi-note-dense-preview/settings.json` and `/tmp/xiaomi-note-dense-preview/notes.json`:

```json
{
  "siteName": "Dense note preview",
  "siteDescription": "3 / 4 / 2 compact index",
  "selectedFolders": [],
  "folderPasswords": {}
}
```

```json
[
  { "id": "n01", "title": "在风里写下一封很短的信", "content": "detail-only-01", "folder": "随记", "createTime": 1784304000000, "modifyTime": 1784304000000 },
  { "id": "n02", "title": "React 组件边界与状态设计备忘", "content": "detail-only-02", "folder": "开发", "createTime": 1784217600000, "modifyTime": 1784217600000 },
  { "id": "n03", "title": "周末路线", "content": "detail-only-03", "folder": "旅行", "createTime": 1784131200000, "modifyTime": 1784131200000 },
  { "id": "n04", "title": "留白也是一种信息层级", "content": "detail-only-04", "folder": "设计", "createTime": 1784044800000, "modifyTime": 1784044800000 },
  { "id": "n05", "title": "买咖啡豆", "content": "detail-only-05", "folder": "生活", "createTime": 1783958400000, "modifyTime": 1783958400000 },
  { "id": "n06", "title": "当标题变得很长时，它只应该自然撑高自己所在的卡片，而不是让整排文章都变得笨重", "content": "detail-only-06", "folder": "产品", "createTime": 1783872000000, "modifyTime": 1783872000000 },
  { "id": "n07", "title": "命令速查", "content": "detail-only-07", "folder": "开发", "createTime": 1783785600000, "modifyTime": 1783785600000 },
  { "id": "n08", "title": "七月书单与读后片段", "content": "detail-only-08", "folder": "阅读", "createTime": 1783699200000, "modifyTime": 1783699200000 },
  { "id": "n09", "title": "深夜灵感", "content": "detail-only-09", "folder": "随记", "createTime": 1783612800000, "modifyTime": 1783612800000 },
  { "id": "n10", "title": "如何让索引页保持克制但不失节奏", "content": "detail-only-10", "folder": "设计", "createTime": 1783526400000, "modifyTime": 1783526400000 },
  { "id": "n11", "title": "一段更长的旅行准备清单：车票、相机、电池和雨衣", "content": "detail-only-11", "folder": "旅行", "createTime": 1783440000000, "modifyTime": 1783440000000 },
  { "id": "n12", "title": "今日完成", "content": "detail-only-12", "folder": "工作", "createTime": 1783353600000, "modifyTime": 1783353600000 },
  { "id": "n13", "title": "最后一张卡片向右收束", "content": "detail-only-13", "folder": "随记", "createTime": 1783267200000, "modifyTime": 1783267200000 }
]
```

Start the built application from the worktree, using Windows Node in this WSL environment:

```bash
WSLENV="${WSLENV:+$WSLENV:}PORT/w:DATA_DIR/pw:DIST_DIR/pw" \
PORT=8791 \
DATA_DIR=/tmp/xiaomi-note-dense-preview \
DIST_DIR="$PWD/dist" \
/mnt/d/nvm/nvm4w/nodejs/node.exe server/index.js
```

Open `http://127.0.0.1:8791/`, then inspect `.note-index-card` bounding boxes at `1440px`, `1024px`, `768px`, and `390px`:

```text
1440px: row counts 3 / 4 / 2 / 3 / 1; no overlap; no page overflow
1024px: alternating 5 / 7 and 7 / 5 pairs; no gaps large enough for another card
768px: same two-column order; complete titles remain visible
390px: single column at 92% / 96% / 100%; no page overflow
```

Expected: long titles increase only their own card height; short-title cards remain compact; keyboard focus and protected-note clicks retain current behavior.

After verification, stop the preview server and remove `/tmp/xiaomi-note-dense-preview`.

- [ ] **Step 7: Inspect and commit the presentation change**

Run:

```bash
git diff --check
git diff --stat
git diff -- src/app/components/motion/Reveal.tsx src/app/components/NoteIndex.tsx src/styles/index.css src/app/lib/noteIndex.js src/app/lib/noteIndex.test.mjs
git add src/app/components/motion/Reveal.tsx src/app/components/NoteIndex.tsx src/styles/index.css
git commit -m "feat: compact note index into irregular rows"
```

Expected: only the five planned implementation files differ from the plan baseline, split across the Task 1 and Task 2 commits.

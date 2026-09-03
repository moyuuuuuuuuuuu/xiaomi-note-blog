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
  '--note-card-height': string;
  '--note-card-rotation': string;
  '--note-card-shift-x': string;
  '--note-tablet-span': number;
  '--note-mobile-width': string;
  '--note-mobile-offset': string;
  '--note-mobile-height': string;
  '--note-mobile-rotation': string;
};

const TABLET_SPANS = [5, 7, 7, 5];
const MOBILE_WIDTHS = [100, 92, 96];
const MOBILE_OFFSETS = [0, 8, 0];
const CARD_HEIGHTS = [7.5, 8.35, 7.8, 8.8, 7.25, 8.1];
const CARD_ROTATIONS = [-1.25, 0.75, -0.45, 1.1, -0.8, 0.4];
const CARD_SHIFTS = [-4, 3, 0, 5, -2, 2];
const MOBILE_HEIGHTS = [7.2, 7.65, 7.35];
const MOBILE_ROTATIONS = [-0.45, 0.35, -0.2];

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
              '--note-card-height': `${CARD_HEIGHTS[index % CARD_HEIGHTS.length]}rem`,
              '--note-card-rotation': `${CARD_ROTATIONS[index % CARD_ROTATIONS.length]}deg`,
              '--note-card-shift-x': `${CARD_SHIFTS[index % CARD_SHIFTS.length]}px`,
              '--note-tablet-span': TABLET_SPANS[index % TABLET_SPANS.length],
              '--note-mobile-width': `${MOBILE_WIDTHS[index % MOBILE_WIDTHS.length]}%`,
              '--note-mobile-offset': `${MOBILE_OFFSETS[index % MOBILE_OFFSETS.length]}%`,
              '--note-mobile-height': `${MOBILE_HEIGHTS[index % MOBILE_HEIGHTS.length]}rem`,
              '--note-mobile-rotation': `${MOBILE_ROTATIONS[index % MOBILE_ROTATIONS.length]}deg`,
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
                      <span className="note-index-meta">
                        <span className="note-index-folder" title={folder}>{folder}</span>
                        <span aria-hidden="true">/</span>
                        <time dateTime={new Date(note.modifyTime).toISOString()}>
                          {formatIndexDate(note.modifyTime)}
                        </time>
                      </span>
                    </span>
                    <span className="note-index-title">
                      {isNoteLocked(note) && <Lock aria-label="已加密" />}
                      {note.title}
                    </span>
                    <span className="note-index-read" aria-hidden="true">阅读</span>
                    <span className="note-index-arrow-wrap" aria-hidden="true">
                      <ArrowUpRight className="note-index-arrow" />
                    </span>
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

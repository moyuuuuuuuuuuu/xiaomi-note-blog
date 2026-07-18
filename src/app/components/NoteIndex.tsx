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

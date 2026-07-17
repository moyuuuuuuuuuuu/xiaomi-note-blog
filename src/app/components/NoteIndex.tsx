import type { ReactNode } from 'react';
import { ArrowUpRight, Lock } from 'lucide-react';
import type { NoteSummary } from '../App';
import { formatIndexDate, getNoteCardLayout, toIndexNumber } from '../lib/noteIndex.js';
import { Reveal } from './motion/Reveal';

interface NoteIndexProps {
  notes: NoteSummary[];
  isNoteLocked: (note: NoteSummary) => boolean;
  onSelect: (note: NoteSummary) => void;
  renderActions: (note: NoteSummary) => ReactNode;
}

export function NoteIndex({ notes, isNoteLocked, onSelect, renderActions }: NoteIndexProps) {
  const groups = Array.from(
    { length: Math.ceil(notes.length / 6) },
    (_, groupIndex) => notes.slice(groupIndex * 6, groupIndex * 6 + 6),
  );

  return (
    <div className="note-index">
      {groups.map((group, groupIndex) => {
        const direction = getNoteCardLayout(groupIndex * 6).direction;

        return (
          <section
            className={`note-index-cluster note-index-cluster--${direction}`}
            aria-label={`文章组 ${groupIndex + 1}`}
            key={`note-group-${groupIndex}`}
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
                    <button
                      type="button"
                      className="note-index-main"
                      onClick={() => onSelect(note)}
                    >
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
        );
      })}
    </div>
  );
}

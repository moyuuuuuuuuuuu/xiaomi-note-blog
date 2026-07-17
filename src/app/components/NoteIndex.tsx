import type { ReactNode } from 'react';
import { ArrowUpRight, Lock } from 'lucide-react';
import type { Note } from '../App';
import { formatIndexDate, toIndexNumber } from '../lib/noteIndex.js';
import { Reveal } from './motion/Reveal';

interface NoteIndexProps {
  notes: Note[];
  selectedNoteId: string | null;
  isNoteLocked: (note: Note) => boolean;
  onSelect: (note: Note) => void;
  renderActions: (note: Note) => ReactNode;
}

export function NoteIndex({ notes, selectedNoteId, isNoteLocked, onSelect, renderActions }: NoteIndexProps) {
  return (
    <div className="note-index">
      {notes.map((note, index) => {
        const active = selectedNoteId === note.id;
        return (
          <Reveal key={note.id} delay={Math.min(index, 6) * 0.035}>
            <article className={`note-index-row ${active ? 'is-active' : ''}`}>
              <button
                type="button"
                className="note-index-main"
                onClick={() => onSelect(note)}
                aria-current={active ? 'true' : undefined}
              >
                <span className="note-index-number">{toIndexNumber(index)}</span>
                <span className="note-index-title">
                  {isNoteLocked(note) && <Lock aria-label="已加密" />}
                  {note.title}
                </span>
                <span className="note-index-meta">{note.folder || '未分类'} · {formatIndexDate(note.modifyTime)}</span>
                <ArrowUpRight className="note-index-arrow" aria-hidden="true" />
              </button>
              {renderActions(note)}
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}

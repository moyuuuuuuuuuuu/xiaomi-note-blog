import { renderNoteMarkdown } from '../lib/noteMarkdown.js';

interface NoteContentProps {
  content: string;
}

export function NoteContent({ content }: NoteContentProps) {
  return (
    <div
      className="note-content"
      dangerouslySetInnerHTML={{ __html: renderNoteMarkdown(content) }}
    />
  );
}

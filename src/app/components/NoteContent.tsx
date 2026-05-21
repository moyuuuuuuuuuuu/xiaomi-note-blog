import { renderNoteMarkdown } from '../lib/noteMarkdown.js';

interface NoteContentProps {
  content: string;
}

export function NoteContent({ content }: NoteContentProps) {
  return (
    <div
      className="note-content text-gray-700 font-sans leading-relaxed"
      dangerouslySetInnerHTML={{ __html: renderNoteMarkdown(content) }}
    />
  );
}

interface NoteContentProps {
  content: string;
}

const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;

function isSafeImageUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:', 'data:', 'blob:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function renderTextWithImages(text: string, keyPrefix: string) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  imagePattern.lastIndex = 0;
  while ((match = imagePattern.exec(text))) {
    const [raw, alt, src] = match;
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      isSafeImageUrl(src) ? (
        <img
          key={`${keyPrefix}-image-${match.index}`}
          src={src}
          alt={alt || '图片'}
          loading="lazy"
          className="my-3 max-h-[70vh] max-w-full rounded-md border object-contain"
        />
      ) : (
        raw
      ),
    );
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export function NoteContent({ content }: NoteContentProps) {
  return (
    <div className="whitespace-pre-wrap break-words text-gray-700 font-sans leading-relaxed">
      {content.split('\n').map((line, index) => (
        <div key={index} className={line ? undefined : 'min-h-[1.5em]'}>
          {renderTextWithImages(line, `line-${index}`)}
        </div>
      ))}
    </div>
  );
}

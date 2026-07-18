export function filterNotes(notes, searchTerm, selectedFolder) {
  const query = searchTerm.trim().toLocaleLowerCase('zh-CN');

  return notes.filter((note) => {
    const matchesFolder = selectedFolder === 'all' || note.folder === selectedFolder;
    const haystack = `${note.title}\n${note.folder || ''}`.toLocaleLowerCase('zh-CN');
    return matchesFolder && (!query || haystack.includes(query));
  });
}

export function collectFolders(notes) {
  const counts = new Map();

  for (const note of notes) {
    if (note.folder) {
      counts.set(note.folder, (counts.get(note.folder) || 0) + 1);
    }
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

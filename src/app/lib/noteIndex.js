export function filterNotes(notes, searchTerm, selectedFolder) {
  const query = searchTerm.trim().toLocaleLowerCase('zh-CN');

  return notes.filter((note) => {
    const matchesFolder = selectedFolder === 'all' || note.folder === selectedFolder;
    const haystack = `${note.title}\n${note.content}`.toLocaleLowerCase('zh-CN');
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

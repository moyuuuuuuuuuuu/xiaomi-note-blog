export function getNoteAccessSteps(note, {
  isAdmin,
  unlockedFolders,
  unlockedNotes,
}) {
  if (isAdmin) return [];

  const steps = [];
  if (note.folderProtected && !unlockedFolders.has(note.folder)) {
    steps.push({ scope: 'folder', id: note.folder });
  }
  if (note.noteProtected && !unlockedNotes.has(note.id)) {
    steps.push({ scope: 'note', id: note.id });
  }
  return steps;
}

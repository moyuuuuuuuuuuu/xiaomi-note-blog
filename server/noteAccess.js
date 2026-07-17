export function toNoteSummary(note = {}, settings = {}) {
  const folder = typeof note.folder === 'string' ? note.folder : '';

  return {
    id: String(note.id || ''),
    title: typeof note.title === 'string' ? note.title : '',
    createTime: Number(note.createTime || 0),
    modifyTime: Number(note.modifyTime || 0),
    folder,
    noteProtected: Boolean(note.password),
    folderProtected: Boolean(folder && settings.folderPasswords?.[folder]),
  };
}

export function sanitizeNoteDetail(note, settings) {
  return {
    ...toNoteSummary(note, settings),
    content: typeof note?.content === 'string' ? note.content : '',
  };
}

export function getRequiredGrants(summary) {
  return [
    summary.folderProtected ? `folder:${summary.folder}` : null,
    summary.noteProtected ? `note:${summary.id}` : null,
  ].filter(Boolean);
}

export function getMissingGrants(summary, hasGrant) {
  return getRequiredGrants(summary).filter((grant) => !hasGrant(grant));
}

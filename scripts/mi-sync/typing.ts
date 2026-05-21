export interface NoteRawFile {
  digest: string;
  mimeType: string;
  fileId: string;
}

export interface NoteFile {
  rawId: string;
  name: string;
  id: string;
  type: string;
  suffix: string;
}

export interface NoteFolder {
  id: string;
  type: "folder";
  createDate: number;
  modifyDate: number;
  subject: string;
}

export interface NoteExtraInfo {
  title: string;
  note_content_type?: "note" | "mind";
  mind_content?: string;
}

export interface NoteEntry {
  id: string;
  type: "note";
  createDate: number;
  modifyDate: number;
  subject: string;
  snippet: string;
  colorId: number;
  folderId: string;
  setting?: { data?: NoteRawFile[] };
  extraInfo: NoteExtraInfo;
}

export interface NoteDetail extends NoteEntry {
  content: string;
  files: NoteFile[];
}

export interface NoteListResponse {
  result: "ok";
  data: {
    entries: NoteEntry[];
    folders: NoteFolder[];
    lastPage: boolean;
    syncTag: string;
  };
}

export interface NoteDetailResponse {
  result: "ok";
  data: {
    entry: NoteDetail;
  };
}

export interface SyncState {
  lastSyncTime: number;
  notes: Record<string, NoteDetail>;
  folders: Record<string, string>;
}

export interface ProjectNote {
  id: string;
  title: string;
  content: string;
  createTime: number;
  modifyTime: number;
  folder?: string;
}

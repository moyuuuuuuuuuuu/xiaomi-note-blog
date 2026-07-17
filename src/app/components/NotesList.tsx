import { useState } from 'react';
import {
  Download,
  FileText,
  Lock,
  LockOpen,
  MoreVertical,
  Search,
  Shield,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { NotePasswordDialog } from './NotePasswordDialog';
import { SetNotePasswordDialog } from './SetNotePasswordDialog';
import { NoteIndex } from './NoteIndex';
import type { NoteDetail, NoteSummary, NoteUpdate, Settings as AppSettings } from '../App';
import { fetchExportNotes, verifyProtectedPassword } from '../lib/api';
import { getNoteAccessSteps } from '../lib/noteAccessFlow.js';
import { collectFolders, filterNotes } from '../lib/noteIndex.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface NotesListProps {
  notes: NoteSummary[];
  settings: AppSettings;
  canManageNotes: boolean;
  onUpdateNote: (note: NoteUpdate) => void | Promise<void>;
  onDeleteNote?: (noteId: string) => void;
}

interface PasswordDialogState {
  open: boolean;
  scope: 'note' | 'folder';
  id: string;
  title: string;
  description: string;
  onSuccess: () => void;
}

const closedPasswordDialog: PasswordDialogState = {
  open: false,
  scope: 'note',
  id: '',
  title: '',
  description: '',
  onSuccess: () => {},
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function noteAsMarkdown(note: NoteDetail) {
  return `# ${note.title}\n\n${note.content}\n\n---\n创建时间: ${formatDate(note.createTime)}\n修改时间: ${formatDate(note.modifyTime)}${note.folder ? `\n分类: ${note.folder}` : ''}`;
}

function noteAsText(note: NoteDetail) {
  return `${note.title}\n\n${note.content}\n\n---\n创建时间: ${formatDate(note.createTime)}\n修改时间: ${formatDate(note.modifyTime)}${note.folder ? `\n分类: ${note.folder}` : ''}`;
}

export function NotesList({
  notes,
  settings,
  canManageNotes,
  onUpdateNote,
  onDeleteNote,
}: NotesListProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [unlockedNotes, setUnlockedNotes] = useState<Set<string>>(new Set());
  const [unlockedFolders, setUnlockedFolders] = useState<Set<string>>(new Set());
  const [passwordDialog, setPasswordDialog] = useState<PasswordDialogState>(closedPasswordDialog);
  const [notePasswordDialog, setNotePasswordDialog] = useState<{
    open: boolean;
    note: NoteSummary | null;
  }>({ open: false, note: null });

  const filteredNotes = filterNotes(notes, searchTerm, selectedFolder) as NoteSummary[];
  const folders = collectFolders(notes) as Array<{ name: string; count: number }>;

  const navigateToNote = (note: NoteSummary) => navigate(`/note/${encodeURIComponent(note.id)}`);

  const openAccessStep = (
    note: NoteSummary,
    steps: Array<{ scope: 'note' | 'folder'; id: string }>,
    index = 0,
  ) => {
    const step = steps[index];
    if (!step) {
      navigateToNote(note);
      return;
    }

    const isFolder = step.scope === 'folder';
    setPasswordDialog({
      open: true,
      scope: step.scope,
      id: step.id,
      title: isFolder ? `解锁分类：${step.id}` : `解锁笔记：${note.title}`,
      description: isFolder ? '此分类已加密，请输入密码访问' : '此笔记已加密，请输入密码查看',
      onSuccess: () => {
        if (isFolder) {
          setUnlockedFolders((previous) => new Set(previous).add(step.id));
        } else {
          setUnlockedNotes((previous) => new Set(previous).add(step.id));
        }
        openAccessStep(note, steps, index + 1);
      },
    });
  };

  const handleNoteClick = (note: NoteSummary) => {
    const steps = getNoteAccessSteps(note, {
      isAdmin: canManageNotes,
      unlockedFolders,
      unlockedNotes,
    }) as Array<{ scope: 'note' | 'folder'; id: string }>;
    openAccessStep(note, steps);
  };

  const isNoteLocked = (note: NoteSummary) => {
    if (canManageNotes) return false;
    return (
      (note.folderProtected && !unlockedFolders.has(note.folder))
      || (note.noteProtected && !unlockedNotes.has(note.id))
    );
  };

  const isFolderLocked = (folder: string) => (
    settings.protectedFolders.includes(folder)
    || notes.some((note) => note.folder === folder && note.folderProtected)
  );

  const handleExport = async (format: 'markdown' | 'txt' | 'json' | 'all') => {
    if (!canManageNotes) return;

    try {
      const response = await fetchExportNotes();
      const visibleIds = new Set(filteredNotes.map((note) => note.id));
      const exportNotes = ((response.notes || []) as NoteDetail[])
        .filter((note) => visibleIds.has(note.id));

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(exportNotes, null, 2)], { type: 'application/json' });
        saveAs(blob, `xiaomi-notes-${Date.now()}.json`);
        toast.success('笔记已导出为 JSON 格式');
        return;
      }

      const zip = new JSZip();
      if (format === 'markdown' || format === 'all') {
        const folder = format === 'all' ? zip.folder('markdown') : zip;
        exportNotes.forEach((note) => folder?.file(`${note.title}.md`, noteAsMarkdown(note)));
      }
      if (format === 'txt' || format === 'all') {
        const folder = format === 'all' ? zip.folder('txt') : zip;
        exportNotes.forEach((note) => folder?.file(`${note.title}.txt`, noteAsText(note)));
      }
      if (format === 'all') {
        zip.file('notes.json', JSON.stringify(exportNotes, null, 2));
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `xiaomi-notes-${format}-${Date.now()}.zip`);
      toast.success('笔记已导出');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败');
    }
  };

  const removeNotePassword = async (note: NoteSummary) => {
    await onUpdateNote({ id: note.id, password: '' });
    setUnlockedNotes((previous) => {
      const next = new Set(previous);
      next.delete(note.id);
      return next;
    });
    toast.success('密码保护已移除');
  };

  const renderNoteActions = (note: NoteSummary) => {
    if (!canManageNotes) return null;

    return (
      <div className="note-index-actions">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`管理${note.title}`}>
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setNotePasswordDialog({ open: true, note })}>
              <Shield className="size-4 mr-2" />
              {note.noteProtected ? '修改笔记密码' : '设置笔记密码'}
            </DropdownMenuItem>
            {note.noteProtected && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void removeNotePassword(note)}>
                  <LockOpen className="size-4 mr-2" />
                  移除密码保护
                </DropdownMenuItem>
              </>
            )}
            {onDeleteNote && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => {
                    if (confirm(`确定要删除笔记“${note.title}”吗？`)) onDeleteNote(note.id);
                  }}
                >
                  <Trash2 className="size-4 mr-2" />
                  删除笔记
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <section className="notes-workspace" aria-label="笔记归档">
      <div className="editorial-toolbar">
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="editorial-search flex-1">
            <span className="sr-only">搜索笔记</span>
            <Search aria-hidden="true" />
            <Input
              type="text"
              placeholder="搜索笔记标题或分类..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </label>
          {canManageNotes && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 whitespace-nowrap">
                  <Download className="size-4" />
                  导出笔记
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void handleExport('markdown')}>导出为 Markdown</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleExport('txt')}>导出为 TXT</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleExport('json')}>导出为 JSON</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleExport('all')}>导出全部格式（ZIP）</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {folders.length > 0 && (
        <div className="folder-index" aria-label="按分类筛选">
          <button type="button" aria-pressed={selectedFolder === 'all'} onClick={() => setSelectedFolder('all')}>
            全部 ({notes.length})
          </button>
          {folders.map((folder) => (
            <button
              type="button"
              key={folder.name}
              aria-pressed={selectedFolder === folder.name}
              onClick={() => setSelectedFolder(folder.name)}
            >
              {isFolderLocked(folder.name) && <Lock className="size-3" />}
              {folder.name} ({folder.count})
            </button>
          ))}
        </div>
      )}

      {filteredNotes.length === 0 ? (
        <div className="minimal-empty py-24 text-center">
          <FileText className="size-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无笔记</h3>
          <p className="text-gray-500">尝试调整搜索条件，或使用顶部同步按钮获取笔记</p>
        </div>
      ) : (
        <div className="note-index-panel">
          <NoteIndex
            notes={filteredNotes}
            isNoteLocked={isNoteLocked}
            onSelect={handleNoteClick}
            renderActions={renderNoteActions}
          />
        </div>
      )}

      <NotePasswordDialog
        open={passwordDialog.open}
        onClose={() => setPasswordDialog((previous) => ({ ...previous, open: false }))}
        onVerified={async (password) => {
          await verifyProtectedPassword({
            scope: passwordDialog.scope,
            id: passwordDialog.id,
            password,
          });
          setPasswordDialog((previous) => ({ ...previous, open: false }));
          passwordDialog.onSuccess();
        }}
        title={passwordDialog.title}
        description={passwordDialog.description}
      />

      <SetNotePasswordDialog
        open={notePasswordDialog.open}
        onClose={() => setNotePasswordDialog((previous) => ({ ...previous, open: false }))}
        onSetPassword={async (password) => {
          if (notePasswordDialog.note) {
            await onUpdateNote({ id: notePasswordDialog.note.id, password });
            toast.success(notePasswordDialog.note.noteProtected ? '笔记密码已修改' : '笔记密码已设置');
          }
          setNotePasswordDialog((previous) => ({ ...previous, open: false }));
        }}
        note={notePasswordDialog.note}
      />
    </section>
  );
}

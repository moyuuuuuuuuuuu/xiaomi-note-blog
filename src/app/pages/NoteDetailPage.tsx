import { useNavigate, useParams } from 'react-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, FolderOpen, Lock, Shield, LockOpen, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { NotePasswordDialog } from '../components/NotePasswordDialog';
import { SetNotePasswordDialog } from '../components/SetNotePasswordDialog';
import { NoteContent } from '../components/NoteContent';
import type { Note, Settings as AppSettings } from '../App';
import { toast } from 'sonner';
import { deleteNote, fetchAdminSession, fetchNote, fetchSettings, updateNote, verifyProtectedPassword } from '../lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';

const defaultSettings: AppSettings = {
  siteName: '小米笔记博客',
  siteDescription: '从小米笔记同步来的日常记录',
  logoUrl: '',
  password: '',
  selectedFolders: [],
  folderPasswords: {},
  hasMiCookie: false,
  miCookieUpdatedAt: null,
};

export function NoteDetailPage() {
  const navigate = useNavigate();
  const { noteId } = useParams<{ noteId: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isFolderUnlocked, setIsFolderUnlocked] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<{
    open: boolean;
    scope: 'note' | 'folder';
    id: string;
    title: string;
    description: string;
    onSuccess: () => void;
  }>({
    open: false,
    scope: 'note',
    id: '',
    title: '',
    description: '',
    onSuccess: () => {}
  });
  const [notePasswordDialog, setNotePasswordDialog] = useState<{
    open: boolean;
    note: Note | null;
  }>({
    open: false,
    note: null
  });

  useEffect(() => {
    if (!noteId) return;
    const unlockedNotesData = localStorage.getItem('xiaomi-unlocked-notes');
    const unlockedFoldersData = localStorage.getItem('xiaomi-unlocked-folders');

    Promise.all([fetchNote(noteId), fetchSettings(), fetchAdminSession()])
      .then(([noteResponse, settingsResponse, adminSession]) => {
        const foundNote = noteResponse.note;
        setNote(foundNote);
        setIsAdminAuthenticated(Boolean(adminSession.authenticated));
        const nextSettings = { ...defaultSettings, ...settingsResponse };
        setSettings(nextSettings);
        
        if (foundNote?.title) {
          document.title = `${foundNote.title} - ${nextSettings.siteName}`;
        }

        // 检查是否已解锁
        if (unlockedNotesData) {
          const unlockedNotes = JSON.parse(unlockedNotesData);
          if (unlockedNotes.includes(noteId)) {
            setIsUnlocked(true);
          }
        }

        // 检查分类是否已解锁
        if (foundNote.folder && unlockedFoldersData) {
          const unlockedFolders = JSON.parse(unlockedFoldersData);
          if (unlockedFolders.includes(foundNote.folder)) {
            setIsFolderUnlocked(true);
          }
        }
      })
      .catch((error) => {
        console.error('加载笔记详情失败:', error);
        toast.error(error instanceof Error ? error.message : '加载笔记详情失败');
      })
      .finally(() => setIsLoading(false));
  }, [noteId]);

  // 检查是否需要验证密码
  useEffect(() => {
    if (!note) return;

    // 先检查分类密码
    if (note.folder && settings.folderPasswords?.[note.folder] && !isFolderUnlocked) {
      setPasswordDialog({
        open: true,
        scope: 'folder',
        id: note.folder,
        title: `解锁分类：${note.folder}`,
        description: '此分类已加密，请输入密码访问',
        onSuccess: () => {
          setIsFolderUnlocked(true);
          // 保存解锁状态
          const unlockedFoldersData = localStorage.getItem('xiaomi-unlocked-folders');
          const unlockedFolders = unlockedFoldersData ? JSON.parse(unlockedFoldersData) : [];
          if (!unlockedFolders.includes(note.folder)) {
            unlockedFolders.push(note.folder);
            localStorage.setItem('xiaomi-unlocked-folders', JSON.stringify(unlockedFolders));
          }
        }
      });
      return;
    }

    // 再检查笔记密码
    if (note.password && !isUnlocked) {
      setPasswordDialog({
        open: true,
        scope: 'note',
        id: note.id,
        title: `解锁笔记：${note.title}`,
        description: '此笔记已加密，请输入密码查看',
        onSuccess: () => {
          setIsUnlocked(true);
          // 保存解锁状态
          const unlockedNotesData = localStorage.getItem('xiaomi-unlocked-notes');
          const unlockedNotes = unlockedNotesData ? JSON.parse(unlockedNotesData) : [];
          if (!unlockedNotes.includes(noteId)) {
            unlockedNotes.push(noteId);
            localStorage.setItem('xiaomi-unlocked-notes', JSON.stringify(unlockedNotes));
          }
        }
      });
    }
  }, [note, settings, isUnlocked, isFolderUnlocked, noteId]);

  const isNoteLocked = (): boolean => {
    if (!note) return false;
    
    // 如果笔记本身有密码且未解锁
    if (note.password && !isUnlocked) {
      return true;
    }
    // 如果笔记所在分类有密码且未解锁
    if (note.folder && settings.folderPasswords?.[note.folder] && !isFolderUnlocked) {
      return true;
    }
    return false;
  };

  const handleUpdateNote = async (updatedNote: Note) => {
    try {
      const response = await updateNote(updatedNote);
      setNote(response.note || updatedNote);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存笔记失败');
      throw error;
    }
  };

  const handleDeleteNote = async () => {
    if (!note) return;
    
    if (confirm(`确定要删除笔记"${note.title}"吗？`)) {
      try {
        await deleteNote(note.id);
        toast.success('笔记已删除');
        navigate('/');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '删除笔记失败');
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading || !note) {
    return (
      <div className="minimal-loading min-h-screen">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{isLoading ? '加载中...' : '笔记不存在'}</h3>
          <Button onClick={() => navigate('/')}>返回列表</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-page min-h-screen flex flex-col">
      {/* 顶部导航栏 */}
      <div className="detail-nav">
        <div className="editorial-container flex items-center justify-between py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            返回
          </Button>
          
          {isAdminAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setNotePasswordDialog({ open: true, note })}>
                  <Shield className="size-4 mr-2" />
                  {note.password ? '修改笔记密码' : '设置笔记密码'}
                </DropdownMenuItem>
                {note.password && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => {
                        setPasswordDialog({
                          open: true,
                          scope: 'note',
                          id: note.id,
                          title: '验证密码',
                          description: `请输入笔记"${note.title}"的密码以移除密码保护`,
                          onSuccess: async () => {
                            await handleUpdateNote({
                              ...note,
                              password: undefined
                            });
                            toast.success('密码保护已移除');
                            setIsUnlocked(false);
                            // 从localStorage移除解锁状态
                            const unlockedNotesData = localStorage.getItem('xiaomi-unlocked-notes');
                            if (unlockedNotesData) {
                              const unlockedNotes = JSON.parse(unlockedNotesData);
                              const updatedUnlockedNotes = unlockedNotes.filter((id: string) => id !== note.id);
                              localStorage.setItem('xiaomi-unlocked-notes', JSON.stringify(updatedUnlockedNotes));
                            }
                          }
                        });
                      }}
                    >
                      <LockOpen className="size-4 mr-2" />
                      移除密码保护
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={handleDeleteNote}
                >
                  <Trash2 className="size-4 mr-2" />
                  删除笔记
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* 笔记内容 */}
      <main className="detail-reading flex-1">
          {isNoteLocked() ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center space-y-4">
                <Lock className="size-10 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">笔记已加密</h3>
                  <p className="text-gray-500">请输入密码查看内容</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <header className="detail-heading">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h1 className="flex-1">
                    {note.title}
                  </h1>
                  {note.password && (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="size-3" />
                      已加密
                    </Badge>
                  )}
                </div>
                <div className="detail-meta">
                  {note.folder && (
                    <Badge variant="secondary" className="gap-1">
                      <FolderOpen className="size-3" />
                      {note.folder}
                      {settings.folderPasswords?.[note.folder] && <Lock className="size-3 ml-1" />}
                    </Badge>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="size-4" />
                    创建: {formatDate(note.createTime)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="size-4" />
                    修改: {formatDate(note.modifyTime)}
                  </span>
                </div>
              </header>
              
              <article className="detail-body">
                <NoteContent content={note.content} />
              </article>
            </>
          )}
      </main>

      {/* 密码验证对话框 */}
      <NotePasswordDialog
        open={passwordDialog.open}
        onClose={() => setPasswordDialog(prev => ({ ...prev, open: false }))}
        onVerified={async (password) => {
          await verifyProtectedPassword({
            scope: passwordDialog.scope,
            id: passwordDialog.id,
            password,
          });
          setPasswordDialog(prev => ({ ...prev, open: false }));
          passwordDialog.onSuccess();
        }}
        title={passwordDialog.title}
        description={passwordDialog.description}
      />
      <SetNotePasswordDialog
        open={notePasswordDialog.open}
        onClose={() => setNotePasswordDialog(prev => ({ ...prev, open: false }))}
        onSetPassword={async (password) => {
          if (notePasswordDialog.note) {
            await handleUpdateNote({
              ...notePasswordDialog.note,
              password: password || undefined
            });
            if (password) {
              toast.success('笔记密码已设置');
            } else {
              toast.success('笔记密码已移除');
              setIsUnlocked(false);
              // 从localStorage移除解锁状态
              const unlockedNotesData = localStorage.getItem('xiaomi-unlocked-notes');
              if (unlockedNotesData) {
                const unlockedNotes = JSON.parse(unlockedNotesData);
                const updatedUnlockedNotes = unlockedNotes.filter((id: string) => id !== noteId);
                localStorage.setItem('xiaomi-unlocked-notes', JSON.stringify(updatedUnlockedNotes));
              }
            }
          }
          setNotePasswordDialog(prev => ({ ...prev, open: false }));
        }}
        note={notePasswordDialog.note}
      />
    </div>
  );
}

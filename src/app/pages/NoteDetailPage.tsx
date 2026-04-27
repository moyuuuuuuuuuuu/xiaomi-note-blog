import { useNavigate, useParams } from 'react-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, FolderOpen, Lock, Shield, LockOpen, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { NotePasswordDialog } from '../components/NotePasswordDialog';
import { SetNotePasswordDialog } from '../components/SetNotePasswordDialog';
import type { Note, Settings as AppSettings } from '../App';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';

export function NoteDetailPage() {
  const navigate = useNavigate();
  const { noteId } = useParams<{ noteId: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [settings, setSettings] = useState<AppSettings>({});
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isFolderUnlocked, setIsFolderUnlocked] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<{
    open: boolean;
    password: string;
    title: string;
    description: string;
    onSuccess: () => void;
  }>({
    open: false,
    password: '',
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
    // 从localStorage加载数据
    const notesData = localStorage.getItem('xiaomi-notes');
    const settingsData = localStorage.getItem('xiaomi-settings');
    const unlockedNotesData = localStorage.getItem('xiaomi-unlocked-notes');
    const unlockedFoldersData = localStorage.getItem('xiaomi-unlocked-folders');

    if (notesData) {
      const notes: Note[] = JSON.parse(notesData);
      const foundNote = notes.find(n => n.id === noteId);
      if (foundNote) {
        setNote(foundNote);
        
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
      }
    }

    if (settingsData) {
      setSettings(JSON.parse(settingsData));
    }
  }, [noteId]);

  // 检查是否需要验证密码
  useEffect(() => {
    if (!note) return;

    // 先检查分类密码
    if (note.folder && settings.folderPasswords?.[note.folder] && !isFolderUnlocked) {
      setPasswordDialog({
        open: true,
        password: settings.folderPasswords[note.folder],
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
        password: note.password,
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

  const handleUpdateNote = (updatedNote: Note) => {
    const notesData = localStorage.getItem('xiaomi-notes');
    if (notesData) {
      const notes: Note[] = JSON.parse(notesData);
      const updatedNotes = notes.map(n => n.id === updatedNote.id ? updatedNote : n);
      localStorage.setItem('xiaomi-notes', JSON.stringify(updatedNotes));
      setNote(updatedNote);
    }
  };

  const handleDeleteNote = () => {
    if (!note) return;
    
    if (confirm(`确定要删除笔记"${note.title}"吗？`)) {
      const notesData = localStorage.getItem('xiaomi-notes');
      if (notesData) {
        const notes: Note[] = JSON.parse(notesData);
        const updatedNotes = notes.filter(n => n.id !== note.id);
        localStorage.setItem('xiaomi-notes', JSON.stringify(updatedNotes));
        toast.success('笔记已删除');
        navigate('/');
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

  if (!note) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">笔记不存在</h3>
          <Button onClick={() => navigate('/')}>返回列表</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            返回
          </Button>
          
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
                        password: note.password!,
                        title: '验证密码',
                        description: `请输入笔记"${note.title}"的密码以移除密码保护`,
                        onSuccess: () => {
                          handleUpdateNote({
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
        </div>
      </div>

      {/* 笔记内容 */}
      <div className="flex-1 container max-w-4xl mx-auto p-4">
        <Card className="overflow-hidden">
          {isNoteLocked() ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center space-y-4">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-full w-fit mx-auto">
                  <Lock className="size-12 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">笔记已加密</h3>
                  <p className="text-gray-500">请输入密码查看内容</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="p-6 border-b bg-white">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h1 className="text-2xl font-semibold text-gray-900 flex-1">
                    {note.title}
                  </h1>
                  {note.password && (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="size-3" />
                      已加密
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
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
              </div>
              
              <div className="p-6">
                <pre className="whitespace-pre-wrap text-gray-700 font-sans leading-relaxed">
                  {note.content}
                </pre>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* 密码验证对话框 */}
      <NotePasswordDialog
        open={passwordDialog.open}
        onClose={() => setPasswordDialog(prev => ({ ...prev, open: false }))}
        onVerified={passwordDialog.onSuccess}
        expectedPassword={passwordDialog.password}
        title={passwordDialog.title}
        description={passwordDialog.description}
      />
      <SetNotePasswordDialog
        open={notePasswordDialog.open}
        onClose={() => setNotePasswordDialog(prev => ({ ...prev, open: false }))}
        onSetPassword={(password) => {
          if (notePasswordDialog.note) {
            handleUpdateNote({
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
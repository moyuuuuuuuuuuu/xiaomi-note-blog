import { useState, useEffect } from 'react';
import { Download, Search, FolderOpen, Calendar, FileText, Lock, Shield, MoreVertical, Trash2, LockOpen } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { NotePasswordDialog } from './NotePasswordDialog';
import { SetNotePasswordDialog } from './SetNotePasswordDialog';
import { NoteContent } from './NoteContent';
import { NoteIndex } from './NoteIndex';
import type { Note, Settings as AppSettings } from '../App';
import { verifyProtectedPassword } from '../lib/api';
import { stripNoteMarkdown } from '../lib/noteMarkdown.js';
import { collectFolders, filterNotes } from '../lib/noteIndex.js';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';

interface NotesListProps {
  notes: Note[];
  settings: AppSettings;
  canManageNotes: boolean;
  onUpdateNote: (note: Note) => void | Promise<void>;
  onDeleteNote?: (noteId: string) => void;
}

export function NotesList({ notes, settings, canManageNotes, onUpdateNote, onDeleteNote }: NotesListProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [unlockedNotes, setUnlockedNotes] = useState<Set<string>>(new Set());
  const [unlockedFolders, setUnlockedFolders] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
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

  // 检测是否为移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 加载解锁状态
  useEffect(() => {
    const unlockedNotesData = localStorage.getItem('xiaomi-unlocked-notes');
    const unlockedFoldersData = localStorage.getItem('xiaomi-unlocked-folders');
    
    if (unlockedNotesData) {
      setUnlockedNotes(new Set(JSON.parse(unlockedNotesData)));
    }
    if (unlockedFoldersData) {
      setUnlockedFolders(new Set(JSON.parse(unlockedFoldersData)));
    }
  }, []);

  const handleNoteClick = (note: Note) => {
    // 移动端：保存解锁状态到localStorage后跳转
    if (isMobile) {
      // 先检查分类密码
      if (note.folder && settings.folderPasswords?.[note.folder] && !unlockedFolders.has(note.folder)) {
        setPasswordDialog({
          open: true,
          scope: 'folder',
          id: note.folder,
          title: `解锁分类：${note.folder}`,
          description: '此分类已加密，请输入密码访问',
          onSuccess: () => {
            const newUnlockedFolders = new Set(unlockedFolders).add(note.folder!);
            setUnlockedFolders(newUnlockedFolders);
            localStorage.setItem('xiaomi-unlocked-folders', JSON.stringify(Array.from(newUnlockedFolders)));
            // 继续检查笔记密码
            if (note.password && !unlockedNotes.has(note.id)) {
              setPasswordDialog({
                open: true,
                scope: 'note',
                id: note.id,
                title: `解锁笔记：${note.title}`,
                description: '此笔记已加密，请输入密码查看',
                onSuccess: () => {
                  const newUnlockedNotes = new Set(unlockedNotes).add(note.id);
                  setUnlockedNotes(newUnlockedNotes);
                  localStorage.setItem('xiaomi-unlocked-notes', JSON.stringify(Array.from(newUnlockedNotes)));
                  navigate(`/note/${note.id}`);
                }
              });
            } else {
              navigate(`/note/${note.id}`);
            }
          }
        });
        return;
      }

      // 再检查笔记密码
      if (note.password && !unlockedNotes.has(note.id)) {
        setPasswordDialog({
          open: true,
          scope: 'note',
          id: note.id,
          title: `解锁笔记：${note.title}`,
          description: '此笔记已加密，请输入密码查看',
          onSuccess: () => {
            const newUnlockedNotes = new Set(unlockedNotes).add(note.id);
            setUnlockedNotes(newUnlockedNotes);
            localStorage.setItem('xiaomi-unlocked-notes', JSON.stringify(Array.from(newUnlockedNotes)));
            navigate(`/note/${note.id}`);
          }
        });
        return;
      }

      // 都没有密码，直接跳转
      navigate(`/note/${note.id}`);
      return;
    }

    // 桌面端：原有逻辑
    // 先检查分类密码
    if (note.folder && settings.folderPasswords?.[note.folder] && !unlockedFolders.has(note.folder)) {
      setPasswordDialog({
        open: true,
        scope: 'folder',
        id: note.folder,
        title: `解锁分类：${note.folder}`,
        description: '此分类已加密，请输入密码访问',
        onSuccess: () => {
          setUnlockedFolders(prev => new Set(prev).add(note.folder!));
          setSelectedNoteId(note.id);
        }
      });
      return;
    }

    // 再检查笔记密码
    if (note.password && !unlockedNotes.has(note.id)) {
      setPasswordDialog({
        open: true,
        scope: 'note',
        id: note.id,
        title: `解锁笔记：${note.title}`,
        description: '此笔记已加密，请输入密码查看',
        onSuccess: () => {
          setUnlockedNotes(prev => new Set(prev).add(note.id));
          setSelectedNoteId(note.id);
        }
      });
      return;
    }

    setSelectedNoteId(note.id);
  };

  const isNoteLocked = (note: Note): boolean => {
    // 如果笔记本身有密码且未解锁
    if (note.password && !unlockedNotes.has(note.id)) {
      return true;
    }
    // 如果笔记所在分类有密码且未解锁
    if (note.folder && settings.folderPasswords?.[note.folder] && !unlockedFolders.has(note.folder)) {
      return true;
    }
    return false;
  };

  const isFolderLocked = (folder: string): boolean => {
    return !!settings.folderPasswords?.[folder];
  };

  const filteredNotes = filterNotes(notes, searchTerm, selectedFolder) as Note[];

  const selectedNote = selectedNoteId ? notes.find(n => n.id === selectedNoteId) : null;
  const folders = collectFolders(notes) as Array<{ name: string; count: number }>;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const handleExport = async (format: 'markdown' | 'txt' | 'json' | 'all') => {
    if (format === 'all') {
      const zip = new JSZip();
      
      // 添加Markdown文件
      const mdFolder = zip.folder('markdown');
      filteredNotes.forEach(note => {
        if (!isNoteLocked(note)) {
          const content = `# ${note.title}\n\n${note.content}\n\n---\n创建时间: ${formatDate(note.createTime)}\n修改时间: ${formatDate(note.modifyTime)}${note.folder ? `\n分类: ${note.folder}` : ''}`;
          mdFolder?.file(`${note.title}.md`, content);
        }
      });
      
      // 添加TXT文件
      const txtFolder = zip.folder('txt');
      filteredNotes.forEach(note => {
        if (!isNoteLocked(note)) {
          const content = `${note.title}\n\n${note.content}\n\n---\n创建时间: ${formatDate(note.createTime)}\n修改时间: ${formatDate(note.modifyTime)}${note.folder ? `\n分类: ${note.folder}` : ''}`;
          txtFolder?.file(`${note.title}.txt`, content);
        }
      });
      
      // 添加JSON文件
      const jsonData = filteredNotes.filter(note => !isNoteLocked(note));
      zip.file('notes.json', JSON.stringify(jsonData, null, 2));
      
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `xiaomi-notes-export-${Date.now()}.zip`);
      toast.success('笔记已导出为ZIP文件');
    } else if (format === 'markdown') {
      const zip = new JSZip();
      filteredNotes.forEach(note => {
        if (!isNoteLocked(note)) {
          const content = `# ${note.title}\n\n${note.content}\n\n---\n创建时间: ${formatDate(note.createTime)}\n修改时间: ${formatDate(note.modifyTime)}${note.folder ? `\n分类: ${note.folder}` : ''}`;
          zip.file(`${note.title}.md`, content);
        }
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `xiaomi-notes-markdown-${Date.now()}.zip`);
      toast.success('笔记已导出为Markdown格式');
    } else if (format === 'txt') {
      const zip = new JSZip();
      filteredNotes.forEach(note => {
        if (!isNoteLocked(note)) {
          const content = `${note.title}\n\n${note.content}\n\n---\n创建时间: ${formatDate(note.createTime)}\n修改时间: ${formatDate(note.modifyTime)}${note.folder ? `\n分类: ${note.folder}` : ''}`;
          zip.file(`${note.title}.txt`, content);
        }
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `xiaomi-notes-txt-${Date.now()}.zip`);
      toast.success('笔记已导出为TXT格式');
    } else if (format === 'json') {
      const jsonData = filteredNotes.filter(note => !isNoteLocked(note));
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      saveAs(blob, `xiaomi-notes-${Date.now()}.json`);
      toast.success('笔记已导出为JSON格式');
    }
  };

  const renderNoteActions = (note: Note) => {
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
              {note.password ? '修改笔记密码' : '设置笔记密码'}
            </DropdownMenuItem>
            {note.password && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setPasswordDialog({
                  open: true,
                  scope: 'note',
                  id: note.id,
                  title: '验证密码',
                  description: `请输入笔记"${note.title}"的密码以移除密码保护`,
                  onSuccess: () => {
                    onUpdateNote({ ...note, password: undefined });
                    toast.success('密码保护已移除');
                    setUnlockedNotes((previous) => {
                      const next = new Set(previous);
                      next.delete(note.id);
                      return next;
                    });
                  },
                })}>
                  <LockOpen className="size-4 mr-2" />
                  移除密码保护
                </DropdownMenuItem>
              </>
            )}
            {onDeleteNote && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => {
                  if (confirm(`确定要删除笔记"${note.title}"吗？`)) {
                    onDeleteNote(note.id);
                    if (selectedNoteId === note.id) setSelectedNoteId(null);
                  }
                }}>
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
      {/* 搜索和导出栏 */}
      <div className="editorial-toolbar">
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="editorial-search flex-1">
            <span className="sr-only">搜索笔记</span>
            <Search aria-hidden="true" />
            <Input
              type="text"
              placeholder="搜索笔记标题或内容..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 whitespace-nowrap">
                <Download className="size-4" />
                导出笔记
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('markdown')}>
                导出为 Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('txt')}>
                导出为 TXT
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                导出为 JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('all')}>
                导出全部格式（ZIP）
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 分类标签 */}
      {folders.length > 0 && (
        <div className="folder-index" aria-label="按分类筛选">
              <button
                type="button"
                aria-pressed={selectedFolder === 'all'}
                onClick={() => setSelectedFolder('all')}
              >
                全部 ({notes.length})
              </button>
              {folders.map(folder => (
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

      {/* 笔记列表和内容 */}
      {filteredNotes.length === 0 ? (
        <div className="minimal-empty py-24 text-center">
          <FileText className="size-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无笔记</h3>
          <p className="text-gray-500">点击顶部同步按钮获取笔记</p>
        </div>
      ) : (
        <div className="notes-layout">
          {/* 左侧列表 */}
          <div className="note-index-panel">
            <div className="md:flex-1 md:overflow-y-auto">
              {filteredNotes.length === 0 ? (
                <div className="p-8 text-center">
                  <Search className="size-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">未找到笔记</h3>
                  <p className="text-sm text-gray-500">尝试调整搜索条件</p>
                </div>
              ) : (
                <>
                <NoteIndex
                  notes={filteredNotes}
                  selectedNoteId={selectedNoteId}
                  isNoteLocked={isNoteLocked}
                  onSelect={handleNoteClick}
                  renderActions={renderNoteActions}
                />
                <div className="legacy-note-list" aria-hidden="true">
                  {filteredNotes.map(note => (
                    <div
                      key={note.id}
                      className={`p-4 transition-colors group relative ${
                        !isMobile && selectedNoteId === note.id 
                          ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                          : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div 
                        onClick={() => handleNoteClick(note)}
                        className="cursor-pointer pr-8"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className={`font-semibold text-sm line-clamp-2 flex items-center gap-2 ${
                              !isMobile && selectedNoteId === note.id ? 'text-blue-900' : 'text-gray-900'
                            }`}>
                              {isNoteLocked(note) && <Lock className="size-3 text-amber-600 flex-shrink-0" />}
                              {note.title}
                            </h3>
                          </div>
                          
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {isNoteLocked(note) ? '••••••••••••••••••••' : truncateContent(stripNoteMarkdown(note.content))}
                          </p>
                          
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            {note.folder && (
                              <>
                                <span className="flex items-center gap-1">
                                  <FolderOpen className="size-3" />
                                  {note.folder}
                                </span>
                                <span>•</span>
                              </>
                            )}
                            <span>{formatDate(note.modifyTime)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 三个点菜单按钮 */}
                      {canManageNotes && (
                      <div className={`absolute right-2 top-3 transition-opacity ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setNotePasswordDialog({ open: true, note });
                            }}>
                              <Shield className="size-4 mr-2" />
                              {note.password ? '修改笔记密码' : '设置笔记密码'}
                            </DropdownMenuItem>
                            {note.password && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // 先验证密码，验证成功后再移除
                                    setPasswordDialog({
                                      open: true,
                                      scope: 'note',
                                      id: note.id,
                                      title: '验证密码',
                                      description: `请输入笔记"${note.title}"的密码以移除密码保护`,
                                      onSuccess: () => {
                                        onUpdateNote({
                                          ...note,
                                          password: undefined
                                        });
                                        toast.success('密码保护已移除');
                                        setUnlockedNotes(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(note.id);
                                          return newSet;
                                        });
                                      }
                                    });
                                  }}
                                >
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`确定要删除笔记"${note.title}"吗？`)) {
                                      onDeleteNote(note.id);
                                      if (selectedNoteId === note.id) {
                                        setSelectedNoteId(null);
                                      }
                                    }
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
                      )}
                    </div>
                  ))}
                </div>
                </>
              )}
            </div>
          </div>

          {/* 右侧内容 - 仅桌面端显示 */}
          {!isMobile && (
            <aside className="note-preview-panel">
              {selectedNote ? (
                isNoteLocked(selectedNote) ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-full w-fit mx-auto">
                        <Lock className="size-12 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">笔记已加密</h3>
                        <p className="text-gray-500">点击左侧笔记输入密码查看内容</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-6 border-b bg-white sticky top-0 z-10">
                      <div className="flex items-start justify-between gap-4">
                        <h1 className="text-2xl font-semibold text-gray-900 mb-3 flex-1">
                          {selectedNote.title}
                        </h1>
                        {selectedNote.password && (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="size-3" />
                            已加密
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                        {selectedNote.folder && (
                          <Badge variant="secondary" className="gap-1">
                            <FolderOpen className="size-3" />
                            {selectedNote.folder}
                            {settings.folderPasswords?.[selectedNote.folder] && <Lock className="size-3 ml-1" />}
                          </Badge>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="size-4" />
                          创建: {formatDate(selectedNote.createTime)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-4" />
                          修改: {formatDate(selectedNote.modifyTime)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <NoteContent content={selectedNote.content} />
                    </div>
                  </div>
                )
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <FileText className="size-16 mx-auto mb-3 opacity-50" />
                    <p>选择一条笔记查看详情</p>
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      )}

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

      {/* 设置密码对话框 */}
      <SetNotePasswordDialog
        open={notePasswordDialog.open}
        onClose={() => setNotePasswordDialog(prev => ({ ...prev, open: false }))}
        onSetPassword={async (password) => {
          if (notePasswordDialog.note) {
            await onUpdateNote({
              ...notePasswordDialog.note,
              password: password || undefined
            });
            if (password) {
              toast.success('笔记密码已设置');
            } else {
              toast.success('笔记密码已移除');
              setUnlockedNotes(prev => {
                const newSet = new Set(prev);
                newSet.delete(notePasswordDialog.note!.id);
                return newSet;
              });
            }
          }
          setNotePasswordDialog(prev => ({ ...prev, open: false }));
        }}
        note={notePasswordDialog.note}
      />
    </section>
  );
}

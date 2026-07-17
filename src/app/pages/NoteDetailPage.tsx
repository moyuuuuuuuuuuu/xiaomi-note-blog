import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Calendar,
  FolderOpen,
  Lock,
  LockOpen,
  MoreVertical,
  Shield,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { NotePasswordDialog } from '../components/NotePasswordDialog';
import { SetNotePasswordDialog } from '../components/SetNotePasswordDialog';
import { NoteContent } from '../components/NoteContent';
import type { NoteDetail, NoteSummary, NoteUpdate, Settings as AppSettings } from '../App';
import {
  ApiError,
  deleteNote,
  fetchAdminSession,
  fetchNote,
  fetchNoteSummary,
  fetchSettings,
  updateNote,
  verifyProtectedPassword,
} from '../lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const defaultSettings: AppSettings = {
  siteName: '小米笔记博客',
  siteDescription: '从小米笔记同步来的日常记录',
  logoUrl: '',
  password: '',
  selectedFolders: [],
  folderPasswords: {},
  protectedFolders: [],
  hasMiCookie: false,
  miCookieUpdatedAt: null,
};

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

export function NoteDetailPage() {
  const navigate = useNavigate();
  const { noteId } = useParams<{ noteId: string }>();
  const [summary, setSummary] = useState<NoteSummary | null>(null);
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<PasswordDialogState>(closedPasswordDialog);
  const [notePasswordDialogOpen, setNotePasswordDialogOpen] = useState(false);

  const loadDetail = async (id: string) => {
    try {
      const response = await fetchNote(id);
      setNote(response.note);
      setSummary(response.note);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 423) {
        const safeSummary = error.data.note as NoteSummary;
        const requiredScopes = (error.data.requiredScopes || []) as string[];
        setSummary(safeSummary);
        setNote(null);
        openAccessStep(safeSummary, requiredScopes);
        return false;
      }
      throw error;
    }
  };

  const openAccessStep = (safeSummary: NoteSummary, scopes: string[], index = 0) => {
    const requiredScope = scopes[index];
    if (!requiredScope) {
      void loadDetail(safeSummary.id).catch((error) => {
        toast.error(error instanceof Error ? error.message : '加载笔记详情失败');
      });
      return;
    }

    const isFolder = requiredScope.startsWith('folder:');
    const scope: 'folder' | 'note' = isFolder ? 'folder' : 'note';
    const id = requiredScope.slice(requiredScope.indexOf(':') + 1);
    setPasswordDialog({
      open: true,
      scope,
      id,
      title: isFolder ? `解锁分类：${safeSummary.folder}` : `解锁笔记：${safeSummary.title}`,
      description: isFolder ? '此分类已加密，请输入密码访问' : '此笔记已加密，请输入密码查看',
      onSuccess: () => openAccessStep(safeSummary, scopes, index + 1),
    });
  };

  const refreshAccess = async (id: string) => {
    const response = await fetchNoteSummary(id);
    const safeSummary = response.note as NoteSummary;
    const requiredScopes = (response.requiredScopes || []) as string[];
    setSummary(safeSummary);
    document.title = `${safeSummary.title} - ${settings.siteName}`;

    if (requiredScopes.length > 0) {
      setNote(null);
      openAccessStep(safeSummary, requiredScopes);
      return;
    }
    await loadDetail(id);
  };

  useEffect(() => {
    if (!noteId) {
      setLoadError('笔记地址无效');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError('');
    setSummary(null);
    setNote(null);

    Promise.all([fetchNoteSummary(noteId), fetchSettings(), fetchAdminSession()])
      .then(async ([summaryResponse, settingsResponse, adminSession]) => {
        const safeSummary = summaryResponse.note as NoteSummary;
        const requiredScopes = (summaryResponse.requiredScopes || []) as string[];
        const nextSettings = { ...defaultSettings, ...settingsResponse };
        setSummary(safeSummary);
        setSettings(nextSettings);
        setIsAdminAuthenticated(Boolean(adminSession.authenticated));
        document.title = `${safeSummary.title} - ${nextSettings.siteName}`;

        if (requiredScopes.length > 0) {
          openAccessStep(safeSummary, requiredScopes);
        } else {
          await loadDetail(noteId);
        }
      })
      .catch((error) => {
        console.error('加载笔记详情失败:', error);
        const message = error instanceof Error ? error.message : '加载笔记详情失败';
        setSummary(null);
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => setIsLoading(false));
  }, [noteId]);

  const handleUpdateNote = async (update: NoteUpdate) => {
    const response = await updateNote(update);
    const updatedSummary = response.note as NoteSummary;
    setSummary(updatedSummary);
    setNote((current) => (current ? { ...current, ...updatedSummary } : current));
  };

  const handleDeleteNote = async () => {
    if (!summary || !confirm(`确定要删除笔记“${summary.title}”吗？`)) return;
    try {
      await deleteNote(summary.id);
      toast.success('笔记已删除');
      navigate('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除笔记失败');
    }
  };

  if (isLoading || !summary) {
    return (
      <div className="minimal-loading min-h-screen">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isLoading ? '加载中...' : loadError || '笔记不存在'}
          </h3>
          <Button onClick={() => navigate('/')}>返回列表</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-page min-h-screen flex flex-col">
      <div className="detail-nav">
        <div className="editorial-container flex items-center justify-between py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="size-4" />
            返回
          </Button>

          {isAdminAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="管理笔记">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setNotePasswordDialogOpen(true)}>
                  <Shield className="size-4 mr-2" />
                  {summary.noteProtected ? '修改笔记密码' : '设置笔记密码'}
                </DropdownMenuItem>
                {summary.noteProtected && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        void handleUpdateNote({ id: summary.id, password: '' })
                          .then(() => toast.success('密码保护已移除'))
                          .catch((error) => toast.error(error instanceof Error ? error.message : '移除密码失败'));
                      }}
                    >
                      <LockOpen className="size-4 mr-2" />
                      移除密码保护
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => void handleDeleteNote()}>
                  <Trash2 className="size-4 mr-2" />
                  删除笔记
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <main className="detail-reading flex-1">
        <header className="detail-heading">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="flex-1">{summary.title}</h1>
            {summary.noteProtected && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="size-3" />
                已加密
              </Badge>
            )}
          </div>
          <div className="detail-meta">
            {summary.folder && (
              <Badge variant="secondary" className="gap-1">
                <FolderOpen className="size-3" />
                {summary.folder}
                {summary.folderProtected && <Lock className="size-3 ml-1" />}
              </Badge>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="size-4" />
              创建: {formatDate(summary.createTime)}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="size-4" />
              修改: {formatDate(summary.modifyTime)}
            </span>
          </div>
        </header>

        {note ? (
          <article className="detail-body">
            <NoteContent content={note.content} />
          </article>
        ) : (
          <div className="flex items-center justify-center min-h-[360px]">
            <div className="text-center space-y-4">
              <Lock className="size-10 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">笔记已加密</h3>
                <p className="text-gray-500">验证通过后才会加载正文</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  void refreshAccess(summary.id).catch((error) => {
                    toast.error(error instanceof Error ? error.message : '检查解锁状态失败');
                  });
                }}
              >
                输入密码
              </Button>
            </div>
          </div>
        )}
      </main>

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
        open={notePasswordDialogOpen}
        onClose={() => setNotePasswordDialogOpen(false)}
        onSetPassword={async (password) => {
          await handleUpdateNote({ id: summary.id, password });
          toast.success(summary.noteProtected ? '笔记密码已修改' : '笔记密码已设置');
          setNotePasswordDialogOpen(false);
        }}
        note={summary}
      />
    </div>
  );
}

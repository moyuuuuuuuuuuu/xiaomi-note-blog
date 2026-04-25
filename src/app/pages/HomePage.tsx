import { useState, useEffect } from 'react';
import { NotesList } from '../components/NotesList';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { PasswordDialog } from '../components/PasswordDialog';
import { SettingsDialog } from '../components/SettingsDialog';
import { AdminPasswordDialog } from '../components/AdminPasswordDialog';
import { toast } from 'sonner';
import type { Note, Settings as AppSettings } from '../App';
import { deleteNote, fetchAdminSession, fetchNotes, fetchSettings, loginAdmin, saveSettings, syncNotes, updateNote } from '../lib/api';
import { isAccessPasswordAuthenticated, markAccessPasswordAuthenticated } from '../lib/accessSession';

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

export function HomePage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // 加载设置
  useEffect(() => {
    Promise.all([fetchSettings(), fetchAdminSession()])
      .then(([serverSettings, adminSession]) => {
        const nextSettings = { ...defaultSettings, ...serverSettings };
        setSettings(nextSettings);
        document.title = nextSettings.siteName || defaultSettings.siteName;
        setIsAuthenticated(isAccessPasswordAuthenticated(nextSettings.password));
        setIsAdminAuthenticated(Boolean(adminSession.authenticated));
      })
      .catch((error) => {
        console.error('加载设置失败:', error);
        toast.error('加载服务器设置失败');
      })
      .finally(() => setIsSettingsLoaded(true));
  }, []);

  // 加载笔记数据
  useEffect(() => {
    // 只有在设置加载完成后才加载笔记
    if (!isSettingsLoaded) return;
    
    // 如果设置了密码且未认证，不加载笔记
    if (settings.password && !isAuthenticated) return;
    
    fetchNotes()
      .then((response) => setNotes(response.notes || []))
      .catch((error) => {
        console.error('加载笔记失败:', error);
        toast.error('加载服务器笔记失败');
      });
  }, [isAuthenticated, isSettingsLoaded, settings.password]);

  const handleSync = async () => {
    if (!isAdminAuthenticated) {
      toast.error('需要管理员认证后才能同步笔记');
      return;
    }
    setIsSyncing(true);
    try {
      const response = await syncNotes();
      const syncedNotes = response.notes || [];
      setNotes(prevNotes => {
        const currentById = new Map(prevNotes.map(note => [note.id, note]));
        return syncedNotes.map((note: Note) => {
          const current = currentById.get(note.id);
          return current?.password && !note.password ? { ...note, password: current.password } : note;
        });
      });
      toast.success(`同步成功！共同步 ${syncedNotes.length} 条笔记`);
    } catch (error) {
      console.error('同步失败:', error);
      toast.error(error instanceof Error ? error.message : '同步失败，请稍后重试');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    try {
      const savedSettings = await saveSettings(newSettings);
      setSettings({ ...defaultSettings, ...savedSettings });
      document.title = savedSettings.siteName || defaultSettings.siteName;
      toast.success('设置已保存');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存设置失败');
    }
  };

  const handlePasswordVerified = () => {
    markAccessPasswordAuthenticated(settings.password);
    setIsAuthenticated(true);
    toast.success('登录成功');
  };

  const handleOpenSettings = () => {
    if (isAdminAuthenticated) {
      setShowSettings(true);
      return;
    }
    setShowAdminLogin(true);
  };

  const handleAdminVerified = async (password: string) => {
    await loginAdmin(password);
    setIsAdminAuthenticated(true);
    setShowAdminLogin(false);
    setShowSettings(true);
    toast.success('管理员认证成功');
  };

  // 等待设置加载完成
  if (!isSettingsLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full size-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  // 如果设置了访问密码且未认证，显示密码对话框
  if (settings.password && !isAuthenticated) {
    return (
      <PasswordDialog 
        expectedPassword={settings.password} 
        onVerified={handlePasswordVerified}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
      <Header 
        onSync={handleSync}
        isSyncing={isSyncing}
        canSync={isAdminAuthenticated}
        onOpenSettings={handleOpenSettings}
        siteName={settings.siteName}
        siteDescription={settings.siteDescription}
        logoUrl={settings.logoUrl}
      />
      
      <main className="flex-1 container mx-auto px-4 py-6 md:py-8 max-w-6xl">
        <NotesList 
          notes={notes} 
          settings={settings}
          canManageNotes={isAdminAuthenticated}
          onUpdateNote={async (updatedNote) => {
            try {
              const response = await updateNote(updatedNote);
              const savedNote = response.note || updatedNote;
              setNotes(prevNotes => prevNotes.map(n => n.id === savedNote.id ? savedNote : n));
            } catch (error) {
              toast.error(error instanceof Error ? error.message : '保存笔记失败');
              throw error;
            }
          }}
          onDeleteNote={async (noteId) => {
            try {
              await deleteNote(noteId);
              setNotes(notes.filter(n => n.id !== noteId));
              toast.success('笔记已删除');
            } catch (error) {
              toast.error(error instanceof Error ? error.message : '删除笔记失败');
            }
          }}
        />
      </main>

      <Footer siteName={settings.siteName} />
      
      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={handleSaveSettings}
        onAdminAuthenticated={() => setIsAdminAuthenticated(true)}
        allFolders={Array.from(new Set(notes.map(n => n.folder).filter(Boolean))) as string[]}
      />
      <AdminPasswordDialog
        open={showAdminLogin}
        onClose={() => setShowAdminLogin(false)}
        onVerified={handleAdminVerified}
      />
    </div>
  );
}

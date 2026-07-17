import { useState, useEffect } from 'react';
import { NotesList } from '../components/NotesList';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { PasswordDialog } from '../components/PasswordDialog';
import { SettingsDialog } from '../components/SettingsDialog';
import { AdminPasswordDialog } from '../components/AdminPasswordDialog';
import { DustParticles } from '../components/DustParticles';
import { HomeHero } from '../components/HomeHero';
import { toast } from 'sonner';
import type { NoteSummary, Settings as AppSettings } from '../App';
import { deleteNote, fetchAdminSession, fetchAdminSettings, fetchNotes, fetchSettings, loginAdmin, saveSettings, syncNotes, updateNote } from '../lib/api';
import { isAccessPasswordAuthenticated, markAccessPasswordAuthenticated } from '../lib/accessSession';

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

export function HomePage() {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
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
      .then(async ([serverSettings, adminSession]) => {
        const authenticated = Boolean(adminSession.authenticated);
        const editableSettings = authenticated ? await fetchAdminSettings() : serverSettings;
        const nextSettings = { ...defaultSettings, ...editableSettings };
        setSettings(nextSettings);
        document.title = nextSettings.siteName || defaultSettings.siteName;
        setIsAuthenticated(isAccessPasswordAuthenticated(nextSettings.password));
        setIsAdminAuthenticated(authenticated);
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
      setNotes(syncedNotes);
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

  const handleOpenSettings = async () => {
    if (isAdminAuthenticated) {
      try {
        const editableSettings = await fetchAdminSettings();
        setSettings({ ...defaultSettings, ...editableSettings });
        setShowSettings(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '加载管理员设置失败');
      }
      return;
    }
    setShowAdminLogin(true);
  };

  const handleAdminVerified = async (password: string) => {
    await loginAdmin(password);
    const editableSettings = await fetchAdminSettings();
    setSettings({ ...defaultSettings, ...editableSettings });
    setIsAdminAuthenticated(true);
    setShowAdminLogin(false);
    setShowSettings(true);
    toast.success('管理员认证成功');
  };

  // 等待设置加载完成
  if (!isSettingsLoaded) {
    return (
      <div className="minimal-loading min-h-screen">
        <div>
          <p>LOADING NOTES</p>
          <span aria-hidden="true" />
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
    <div className="minimal-page min-h-screen flex flex-col">
      <div className="home-atmosphere" aria-hidden="true">
        <DustParticles className="home-particles" />
      </div>
      <Header 
        onSync={handleSync}
        isSyncing={isSyncing}
        canSync={isAdminAuthenticated}
        onOpenSettings={() => void handleOpenSettings()}
        siteName={settings.siteName}
        siteDescription={settings.siteDescription}
        logoUrl={settings.logoUrl}
      />
      
      <main className="editorial-container flex-1">
        <HomeHero siteName={settings.siteName} siteDescription={settings.siteDescription} noteCount={notes.length} />
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
              setNotes((previous) => previous.filter((note) => note.id !== noteId));
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
        allFolders={Array.from(new Set(notes.map((note) => note.folder).filter(Boolean)))}
      />
      <AdminPasswordDialog
        open={showAdminLogin}
        onClose={() => setShowAdminLogin(false)}
        onVerified={handleAdminVerified}
      />
    </div>
  );
}

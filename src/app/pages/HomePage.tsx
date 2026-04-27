import { useState, useEffect } from 'react';
import { NotesList } from '../components/NotesList';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { PasswordDialog } from '../components/PasswordDialog';
import { SettingsDialog } from '../components/SettingsDialog';
import { toast } from 'sonner';
import type { Note, Settings as AppSettings } from '../App';

export function HomePage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ password: '', selectedFolders: [], folderPasswords: {} });
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  // Cookie辅助函数
  const setCookie = (name: string, value: string, days: number) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
  };

  const getCookie = (name: string): string | null => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  };

  const deleteCookie = (name: string) => {
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/';
  };

  // 加载设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('xiaomi-settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    } else {
      // 初始化默认设置
      setSettings({ password: '', selectedFolders: [], folderPasswords: {} });
    }
    setIsSettingsLoaded(true);
  }, []);

  // 检查Cookie登录状态
  useEffect(() => {
    if (!isSettingsLoaded) return;
    if (!settings.password) return;
    if (settings.authCookie) {
      // 检查浏览器cookie是否匹配设置的authCookie
      const browserCookie = getCookie('xiaomi-notes-auth');
      if (browserCookie === settings.authCookie) {
        setIsAuthenticated(true);
      }
    }
  }, [isSettingsLoaded, settings.password, settings.authCookie]);

  // 加载笔记数据
  useEffect(() => {
    // 只有在设置加载完成后才加载笔记
    if (!isSettingsLoaded) return;
    
    // 如果设置了密码且未认证，不加载笔记
    if (settings.password && !isAuthenticated) return;
    
    // 加载笔记数据
    const savedNotes = localStorage.getItem('xiaomi-notes');
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
    } else {
      // 如果没有保存的笔记，加载模拟数据
      loadMockNotes();
    }
  }, [isAuthenticated, isSettingsLoaded, settings.password]);

  const loadMockNotes = () => {
    const mockNotes: Note[] = [
      {
        id: '1',
        title: '会议记录 - 2026年4月项目讨论',
        content: '今天的会议主要讨论了以下几点：\n1. 项目进度更新\n2. 下一阶段的工作安排\n3. 资源分配问题\n\n需要跟进的事项：\n- 与设计团队确认UI方案\n- 完成技术文档编写',
        createTime: Date.now() - 86400000 * 7,
        modifyTime: Date.now() - 86400000 * 2,
        folder: '工作'
      },
      {
        id: '2',
        title: '购物清单',
        content: '需要购买的物品：\n- 牛奶\n- 面包\n- 鸡蛋\n- 水果（苹果、香蕉）\n- 蔬菜',
        createTime: Date.now() - 86400000 * 5,
        modifyTime: Date.now() - 86400000,
        folder: '生活'
      },
      {
        id: '3',
        title: '学习笔记 - React高级特性',
        content: 'React高级特性学习要点：\n\n1. Hooks的使用\n- useState\n- useEffect\n- useContext\n- useReducer\n- useMemo和useCallback\n\n2. 性能优化\n- 代码分割\n- 懒加载\n- 虚拟列表\n\n3. 状态管理\n- Context API\n- Redux\n- Zustand',
        createTime: Date.now() - 86400000 * 3,
        modifyTime: Date.now() - 3600000,
        folder: '学习'
      },
      {
        id: '4',
        title: '旅行计划 - 周末短途游',
        content: '周末旅行安排：\n\n目的地：杭州西湖\n日期：4月19-20日\n\n行程安排：\n第一天：\n- 上午：游览西湖十景\n- 中午：品尝当地美食\n- 下午：参观博物馆\n- 晚上：逛河坊街\n\n第二天：\n- 上午：灵隐寺\n- 中午：返程',
        createTime: Date.now() - 86400000,
        modifyTime: Date.now() - 7200000,
        folder: '生活'
      },
      {
        id: '5',
        title: '读书笔记 - 《人类简史》',
        content: '《人类简史》读书笔记\n\n主要观点：\n1. 认知革命 - 约7万年前\n2. 农业革命 - 约1.2万年前\n3. 科学革命 - 约500年前\n\n感悟：\n人类的发展历程充满了偶然性和必然性。每一次革命都深刻改变了人类社会的组织方式和思维模式。',
        createTime: Date.now() - 86400000 * 10,
        modifyTime: Date.now() - 86400000 * 4,
        folder: '学习'
      },
      {
        id: '6',
        title: '项目需求文档',
        content: '项目名称：智能办公系统\n\n核心功能：\n1. 文档管理\n2. 任务分配\n3. 团队协作\n4. 数据统计\n\n技术栈：\n- 前端：React + TypeScript\n- 后端：Node.js + Express\n- 数据库：PostgreSQL',
        createTime: Date.now() - 86400000 * 12,
        modifyTime: Date.now() - 86400000 * 5,
        folder: '工作'
      },
      {
        id: '7',
        title: '健身计划',
        content: '每周健身安排：\n\n周一/三/五：\n- 热身 10分钟\n- 力量训练 30分钟\n- 有氧运动 20分钟\n\n周二/四/六：\n- 瑜伽/拉伸 30分钟\n- 慢跑 30分钟\n\n周日：休息',
        createTime: Date.now() - 86400000 * 6,
        modifyTime: Date.now() - 86400000 * 3,
        folder: '生活'
      },
      {
        id: '8',
        title: 'JavaScript进阶知识点',
        content: 'JavaScript高级概念：\n\n1. 闭包（Closure）\n2. 原型链（Prototype Chain）\n3. 异步编程（Promise, async/await）\n4. 事件循环（Event Loop）\n5. 模块化（ES6 Modules）\n\n重点理解：\n- 执行上下文\n- 作用域链\n- this绑定',
        createTime: Date.now() - 86400000 * 8,
        modifyTime: Date.now() - 86400000 * 6,
        folder: '学习'
      }
    ];
    setNotes(mockNotes);
    localStorage.setItem('xiaomi-notes', JSON.stringify(mockNotes));
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // 模拟调用Node服务同步笔记
      // 实际应用中应该调用: await fetch('/api/sync', { method: 'POST' })
      const response = await mockSyncAPI();
      
      // 过滤选中的分类
      let syncedNotes = response.notes;
      if (settings.selectedFolders.length > 0) {
        syncedNotes = syncedNotes.filter(note => 
          settings.selectedFolders.includes(note.folder || '')
        );
      }
      
      setNotes(syncedNotes);
      localStorage.setItem('xiaomi-notes', JSON.stringify(syncedNotes));
      toast.success(`同步成功！共同步 ${syncedNotes.length} 条笔记`);
    } catch (error) {
      console.error('同步失败:', error);
      toast.error('同步失败，请稍后重试');
    } finally {
      setIsSyncing(false);
    }
  };

  // 模拟API调用
  const mockSyncAPI = async (): Promise<{ notes: Note[] }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const allNotes: Note[] = [
          {
            id: '1',
            title: '会议记录 - 2026年4月项目讨论',
            content: '今天的会议主要讨论了以下几点：\n1. 项目进度更新\n2. 下一阶段的工作安排\n3. 资源分配问题\n\n需要跟进的事项：\n- 与设计团队确认UI方案\n- 完成技术文档编写',
            createTime: Date.now() - 86400000 * 7,
            modifyTime: Date.now() - 86400000 * 2,
            folder: '工作'
          },
          {
            id: '2',
            title: '购物清单',
            content: '需要购买的物品：\n- 牛奶\n- 面包\n- 鸡蛋\n- 水果（苹果、香蕉）\n- 蔬菜',
            createTime: Date.now() - 86400000 * 5,
            modifyTime: Date.now() - 86400000,
            folder: '生活'
          },
          {
            id: '3',
            title: '学习笔记 - React高级特性',
            content: 'React高级特性学习要点：\n\n1. Hooks的使用\n- useState\n- useEffect\n- useContext\n- useReducer\n- useMemo和useCallback\n\n2. 性能优化\n- 代码分割\n- 懒加载\n- 虚拟列表\n\n3. 状态管理\n- Context API\n- Redux\n- Zustand',
            createTime: Date.now() - 86400000 * 3,
            modifyTime: Date.now() - 3600000,
            folder: '学习'
          },
          {
            id: '4',
            title: '旅行计划 - 周末短途游',
            content: '周末旅行安排：\n\n目的地：杭州西湖\n日期：4月19-20日\n\n行程安排：\n第一天：\n- 上午：游览西湖十景\n- 中午：品尝当地美食\n- 下午：参观博物馆\n- 晚上：逛河坊街\n\n第二天：\n- 上午：灵隐寺\n- 中午：返程',
            createTime: Date.now() - 86400000,
            modifyTime: Date.now() - 7200000,
            folder: '生活'
          },
          {
            id: '5',
            title: '读书笔记 - 《人类简史》',
            content: '《人类简史》读书笔记\n\n主要观点：\n1. 认知革命 - 约7万年前\n2. 农业革命 - 约1.2万年前\n3. 科学革命 - 约500年前\n\n感悟：\n人类的发展历程充满了偶然性和必然性。每一次革命都深刻改变了人类社会的组织方式和思维模式。',
            createTime: Date.now() - 86400000 * 10,
            modifyTime: Date.now() - 86400000 * 4,
            folder: '学习'
          },
          {
            id: '6',
            title: '项目需求文档',
            content: '项目名称：智能办公系统\n\n核心功能：\n1. 文档管理\n2. 任务分配\n3. 团队协作\n4. 数据统计\n\n技术栈：\n- 前端：React + TypeScript\n- 后端：Node.js + Express\n- 数据库：PostgreSQL',
            createTime: Date.now() - 86400000 * 12,
            modifyTime: Date.now() - 86400000 * 5,
            folder: '工作'
          },
          {
            id: '7',
            title: '健身计划',
            content: '每周健身安排：\n\n周一/三/五：\n- 热身 10分钟\n- 力量训练 30分钟\n- 有氧运动 20分钟\n\n周二/四/六：\n- 瑜伽/拉伸 30分钟\n- 慢跑 30分钟\n\n周日：休息',
            createTime: Date.now() - 86400000 * 6,
            modifyTime: Date.now() - 86400000 * 3,
            folder: '生活'
          },
          {
            id: '8',
            title: 'JavaScript进阶知识点',
            content: 'JavaScript高级概念：\n\n1. 闭包（Closure）\n2. 原型链（Prototype Chain）\n3. 异步编程（Promise, async/await）\n4. 事件循环（Event Loop）\n5. 模块化（ES6 Modules）\n\n重点理解：\n- 执行上下文\n- 作用域链\n- this绑定',
            createTime: Date.now() - 86400000 * 8,
            modifyTime: Date.now() - 86400000 * 6,
            folder: '学习'
          }
        ];
        resolve({ notes: allNotes });
      }, 2000);
    });
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('xiaomi-settings', JSON.stringify(newSettings));
    toast.success('设置已保存');
  };

  const handlePasswordVerified = () => {
    setIsAuthenticated(true);
    if (settings.authCookie) {
      // 将用户设置的authCookie值保存到浏览器Cookie，有效期365天
      setCookie('xiaomi-notes-auth', settings.authCookie, 365);
      toast.success('登录成功，已保存登录状态');
    } else {
      toast.success('登录成功');
    }
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
        onOpenSettings={() => setShowSettings(true)}
      />
      
      <main className="flex-1 container mx-auto px-4 py-6 md:py-8 max-w-6xl">
        <NotesList 
          notes={notes} 
          settings={settings}
          onUpdateNote={(updatedNote) => {
            const updatedNotes = notes.map(n => n.id === updatedNote.id ? updatedNote : n);
            setNotes(updatedNotes);
            localStorage.setItem('xiaomi-notes', JSON.stringify(updatedNotes));
          }}
          onDeleteNote={(noteId) => {
            const updatedNotes = notes.filter(n => n.id !== noteId);
            setNotes(updatedNotes);
            localStorage.setItem('xiaomi-notes', JSON.stringify(updatedNotes));
            toast.success('笔记已删除');
          }}
        />
      </main>

      <Footer />
      
      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={handleSaveSettings}
        allFolders={Array.from(new Set(notes.map(n => n.folder).filter(Boolean))) as string[]}
      />
    </div>
  );
}
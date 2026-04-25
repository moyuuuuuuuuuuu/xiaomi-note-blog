import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Lock, FolderOpen, Eye, EyeOff, Save, Shield, Image, KeyRound } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { NotePasswordDialog } from './NotePasswordDialog';
import type { Settings } from '../App';
import { fetchAdminSession, loginAdmin, saveMiCookie, verifyProtectedPassword } from '../lib/api';
import { toast } from 'sonner';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onAdminAuthenticated: () => void;
  allFolders: string[];
}

export function SettingsDialog({ open, onClose, settings, onSave, onAdminAuthenticated, allFolders }: SettingsDialogProps) {
  const [siteName, setSiteName] = useState(settings.siteName);
  const [siteDescription, setSiteDescription] = useState(settings.siteDescription);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [password, setPassword] = useState(settings.password);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<string[]>(settings.selectedFolders);
  const [folderPasswords, setFolderPasswords] = useState<{ [folder: string]: string }>(settings.folderPasswords || {});
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminConfigured, setAdminConfigured] = useState(true);
  const [miCookieInput, setMiCookieInput] = useState('');
  const [isSavingMiCookie, setIsSavingMiCookie] = useState(false);
  const [confirmPasswordDialog, setConfirmPasswordDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onVerified: (password: string) => void | Promise<void>;
  }>({
    open: false,
    title: '',
    description: '',
    onVerified: () => {},
  });

  useEffect(() => {
    if (open) {
      setSiteName(settings.siteName);
      setSiteDescription(settings.siteDescription);
      setLogoUrl(settings.logoUrl);
      setPassword(settings.password);
      setSelectedFolders(settings.selectedFolders);
      setFolderPasswords(settings.folderPasswords || {});
      setAdminPassword('');
      setMiCookieInput('');
      setShowPassword(false);
      setConfirmPasswordDialog(prev => ({ ...prev, open: false }));
      fetchAdminSession()
        .then((session) => {
          setIsAdminAuthenticated(Boolean(session.authenticated));
          setAdminConfigured(Boolean(session.adminConfigured));
        })
        .catch(() => {
          setIsAdminAuthenticated(false);
          setAdminConfigured(false);
        });
    }
  }, [open, settings]);

  const handleFolderToggle = (folder: string) => {
    setSelectedFolders(prev => 
      prev.includes(folder)
        ? prev.filter(f => f !== folder)
        : [...prev, folder]
    );
  };

  const handleFolderPasswordChange = (folder: string, password: string) => {
    setFolderPasswords(prev => ({
      ...prev,
      [folder]: password
    }));
  };

  const handleRemoveFolderPassword = (folder: string) => {
    setFolderPasswords(prev => {
      const newPasswords = { ...prev };
      delete newPasswords[folder];
      return newPasswords;
    });
  };

  const handleSave = () => {
    onSave({
      siteName,
      siteDescription,
      logoUrl,
      password,
      selectedFolders,
      folderPasswords
    });
    onClose();
  };

  const handleClearPassword = () => {
    if (!settings.password) {
      setPassword('');
      return;
    }

    setConfirmPasswordDialog({
      open: true,
      title: '验证访问密码',
      description: '请输入当前站点访问密码以清除密码保护',
      onVerified: (inputPassword) => {
        if (inputPassword !== settings.password) {
          throw new Error('原密码错误，请重试');
        }
        setPassword('');
        setConfirmPasswordDialog(prev => ({ ...prev, open: false }));
        toast.success('访问密码已清除，保存设置后生效');
      },
    });
  };

  const handleClearFolderPassword = (folder: string) => {
    const savedPassword = settings.folderPasswords?.[folder] || '';
    if (!savedPassword) {
      handleRemoveFolderPassword(folder);
      return;
    }

    setConfirmPasswordDialog({
      open: true,
      title: `验证分类密码：${folder}`,
      description: '请输入当前分类密码以清除密码保护',
      onVerified: async (inputPassword) => {
        await verifyProtectedPassword({
          scope: 'folder',
          id: folder,
          password: inputPassword,
        });
        handleRemoveFolderPassword(folder);
        setConfirmPasswordDialog(prev => ({ ...prev, open: false }));
        toast.success('分类密码已清除，保存设置后生效');
      },
    });
  };

  const handleAdminLogin = async () => {
    try {
      await loginAdmin(adminPassword);
      setAdminPassword('');
      setIsAdminAuthenticated(true);
      onAdminAuthenticated();
      toast.success('管理员认证成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '管理员认证失败');
    }
  };

  const handleSaveMiCookie = async () => {
    setIsSavingMiCookie(true);
    try {
      const updatedSettings = await saveMiCookie(miCookieInput);
      setMiCookieInput('');
      onSave(updatedSettings);
      toast.success('小米云 Cookie 已更新');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存 Cookie 失败');
    } finally {
      setIsSavingMiCookie(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="size-5" />
            系统设置
          </DialogTitle>
          <DialogDescription>
            配置访问密码、分类密码和同步分类
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="site" className="py-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="site">站点</TabsTrigger>
            <TabsTrigger value="access">访问密码</TabsTrigger>
            <TabsTrigger value="folder-password">分类密码</TabsTrigger>
            <TabsTrigger value="sync">同步设置</TabsTrigger>
          </TabsList>

          <TabsContent value="site" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Image className="size-5 text-blue-600" />
                <h3 className="font-semibold">站点信息</h3>
              </div>

              <div className="space-y-3 pl-7">
                <div className="space-y-2">
                  <Label htmlFor="siteName">站点名称</Label>
                  <Input
                    id="siteName"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="我的笔记博客"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteDescription">站点描述</Label>
                  <Input
                    id="siteDescription"
                    value={siteDescription}
                    onChange={(e) => setSiteDescription(e.target.value)}
                    placeholder="从小米笔记同步来的日常记录"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-gray-500">
                    留空时使用默认图标
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 访问密码 */}
          <TabsContent value="access" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="size-5 text-blue-600" />
                <h3 className="font-semibold">访问密码</h3>
              </div>
              
              <div className="space-y-3 pl-7">
                <div className="space-y-2">
                  <Label htmlFor="password">设置密码</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="留空表示不设置密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                {settings.password && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600">✓ 当前已设置密码</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearPassword}
                      className="h-auto py-1 px-2"
                    >
                      清除密码
                    </Button>
                  </div>
                )}

                <p className="text-sm text-gray-500">
                  设置密码后，每次访问都需要输入密码验证
                </p>

              </div>
            </div>
          </TabsContent>

          {/* 分类密码 */}
          <TabsContent value="folder-password" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="size-5 text-purple-600" />
                <h3 className="font-semibold">分类密码保护</h3>
              </div>
              
              <div className="space-y-3 pl-7">
                <p className="text-sm text-gray-500">
                  为特定分类设置密码，访问该分类下的笔记时需要输入密码
                </p>

                {allFolders.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
                    暂无可用分类，请先同步笔记
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allFolders.map(folder => (
                      <div key={folder} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="size-4 text-gray-600" />
                            <span className="font-medium">{folder}</span>
                          </div>
                          {folderPasswords[folder] && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              已设置密码
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Input
                            type="password"
                            placeholder="留空表示不设置密码"
                            value={folderPasswords[folder] || ''}
                            onChange={(e) => handleFolderPasswordChange(folder, e.target.value)}
                            className="flex-1"
                          />
                          {folderPasswords[folder] && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleClearFolderPassword(folder)}
                            >
                              清除
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* 同步设置 */}
          <TabsContent value="sync" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="size-5 text-orange-600" />
                <h3 className="font-semibold">同步分类</h3>
              </div>
              
              <div className="space-y-3 pl-7">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label>小米云 Cookie</Label>
                      <p className="text-xs text-gray-500 mt-1">
                        {settings.hasMiCookie
                          ? `已配置${settings.miCookieUpdatedAt ? `，更新于 ${new Date(settings.miCookieUpdatedAt).toLocaleString('zh-CN')}` : ''}`
                          : '未配置'}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${settings.hasMiCookie ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {settings.hasMiCookie ? '已配置' : '未配置'}
                    </span>
                  </div>

                  {!adminConfigured && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                      服务器未配置 ADMIN_PASSWORD，无法修改小米云 Cookie
                    </div>
                  )}

                  {adminConfigured && !isAdminAuthenticated && (
                    <div className="space-y-2 border rounded-lg p-3">
                      <Label htmlFor="adminPassword">管理员密码</Label>
                      <div className="flex gap-2">
                        <Input
                          id="adminPassword"
                          type="password"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          placeholder="输入管理员密码后才能更新 Cookie"
                        />
                        <Button onClick={handleAdminLogin} disabled={!adminPassword} className="gap-2">
                          <KeyRound className="size-4" />
                          认证
                        </Button>
                      </div>
                    </div>
                  )}

                  {adminConfigured && isAdminAuthenticated && (
                    <div className="space-y-2 border rounded-lg p-3 min-w-0 max-w-full">
                      <Label htmlFor="miCookieInput">更新小米云 Cookie</Label>
                      <Textarea
                        id="miCookieInput"
                        value={miCookieInput}
                        onChange={(e) => setMiCookieInput(e.target.value)}
                        placeholder="粘贴新的完整 Cookie。提交后不会显示、不会返回到前端。"
                        className="min-h-24 min-w-0 max-w-full [field-sizing:fixed] resize-y break-all"
                      />
                      <div className="flex justify-end">
                        <Button onClick={handleSaveMiCookie} disabled={!miCookieInput.trim() || isSavingMiCookie}>
                          {isSavingMiCookie ? '保存中...' : '保存 Cookie'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <p className="text-sm text-gray-500">
                  选择需要同步的笔记分类（不选表示同步所有分类）
                </p>

                {allFolders.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
                    暂无可用分类，请先同步笔记
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allFolders.map(folder => (
                      <div key={folder} className="flex items-center gap-2">
                        <Checkbox
                          id={`folder-${folder}`}
                          checked={selectedFolders.includes(folder)}
                          onCheckedChange={() => handleFolderToggle(folder)}
                        />
                        <Label
                          htmlFor={`folder-${folder}`}
                          className="cursor-pointer flex-1 py-2"
                        >
                          {folder}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}

                {selectedFolders.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <span>已选择 {selectedFolders.length} 个分类</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFolders([])}
                      className="h-auto py-1 px-2"
                    >
                      清空选择
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 gap-2"
          >
            <Save className="size-4" />
            保存设置
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <NotePasswordDialog
      open={confirmPasswordDialog.open}
      onClose={() => setConfirmPasswordDialog(prev => ({ ...prev, open: false }))}
      onVerified={confirmPasswordDialog.onVerified}
      title={confirmPasswordDialog.title}
      description={confirmPasswordDialog.description}
    />
    </>
  );
}

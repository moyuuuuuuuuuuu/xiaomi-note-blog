import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Lock, FolderOpen, Eye, EyeOff, Save, Shield, Cookie, UserCog, ImageIcon, FileText, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card } from './ui/card';
import type { Settings } from '../App';
import { verifyAdminPassword, fetchAdminStatus } from '../lib/auth-api';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
  allFolders: string[];
  isAdmin: boolean;
  onAdminVerified: () => void;
}

interface RemoveConfirmState {
  type: 'access' | 'folder';
  folder?: string;
  input: string;
  error: string;
  showInput: boolean;
}

export function SettingsDialog({ open, onClose, settings, onSave, allFolders, isAdmin, onAdminVerified }: SettingsDialogProps) {
  const [password, setPassword] = useState(settings.password);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<string[]>(settings.selectedFolders);
  const [folderPasswords, setFolderPasswords] = useState<{ [folder: string]: string }>(settings.folderPasswords || {});
  const [authCookie, setAuthCookie] = useState(settings.authCookie || '');
  const [miCookie, setMiCookie] = useState(settings.miCookie || '');
  const [siteName, setSiteName] = useState(settings.siteName || '');
  const [siteDescription, setSiteDescription] = useState(settings.siteDescription || '');
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');
  const [adminInput, setAdminInput] = useState('');
  const [adminError, setAdminError] = useState('');
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirmState | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [isBanned, setIsBanned] = useState(false);
  const [banMinutes, setBanMinutes] = useState(30);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword(settings.password);
      setSelectedFolders(settings.selectedFolders);
      setFolderPasswords(settings.folderPasswords || {});
      setAuthCookie(settings.authCookie || '');
      setMiCookie(settings.miCookie || '');
      setSiteName(settings.siteName || '');
      setSiteDescription(settings.siteDescription || '');
      setLogoUrl(settings.logoUrl || '');
      setShowPassword(false);
      setAdminInput('');
      setAdminError('');
      setShowAdminInput(false);
      setRemoveConfirm(null);
      // 查询管理员认证状态
      checkAdminStatus();
    }
  }, [open, settings]);

  const checkAdminStatus = async () => {
    setCheckingStatus(true);
    try {
      const status = await fetchAdminStatus();
      setIsBanned(status.banned);
      setRemainingAttempts(status.remainingAttempts);
      setBanMinutes(status.banMinutes);
    } catch {
      // ignore
    }
    setCheckingStatus(false);
  };

  const handleFolderToggle = (folder: string) => {
    setSelectedFolders(prev =>
      prev.includes(folder)
        ? prev.filter(f => f !== folder)
        : [...prev, folder]
    );
  };

  const handleFolderPasswordChange = (folder: string, pwd: string) => {
    setFolderPasswords(prev => ({
      ...prev,
      [folder]: pwd
    }));
  };

  const handleRemoveFolderPassword = (folder: string) => {
    const currentPwd = settings.folderPasswords?.[folder];
    if (!currentPwd) {
      setFolderPasswords(prev => {
        const next = { ...prev };
        delete next[folder];
        return next;
      });
      return;
    }
    setRemoveConfirm({ type: 'folder', folder, input: '', error: '', showInput: false });
  };

  const handleClearAccessPassword = () => {
    if (!settings.password) {
      setPassword('');
      return;
    }
    setRemoveConfirm({ type: 'access', input: '', error: '', showInput: false });
  };

  const handleConfirmRemove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!removeConfirm) return;

    if (removeConfirm.type === 'access') {
      if (removeConfirm.input === settings.password) {
        setPassword('');
        setRemoveConfirm(null);
      } else {
        setRemoveConfirm(prev => prev ? { ...prev, error: '原密码错误，无法移除', input: '' } : null);
      }
    } else if (removeConfirm.type === 'folder' && removeConfirm.folder) {
      const currentPwd = settings.folderPasswords?.[removeConfirm.folder];
      if (removeConfirm.input === currentPwd) {
        setFolderPasswords(prev => {
          const next = { ...prev };
          delete next[removeConfirm.folder!];
          return next;
        });
        setRemoveConfirm(null);
      } else {
        setRemoveConfirm(prev => prev ? { ...prev, error: '原密码错误，无法移除', input: '' } : null);
      }
    }
  };

  const handleSave = () => {
    const cleanedFolderPasswords: { [folder: string]: string } = {};
    Object.entries(folderPasswords).forEach(([folder, pwd]) => {
      if (pwd && pwd.trim()) {
        cleanedFolderPasswords[folder] = pwd;
      }
    });

    onSave({
      password,
      selectedFolders,
      folderPasswords: cleanedFolderPasswords,
      authCookie,
      miCookie,
      siteName: siteName || undefined,
      siteDescription: siteDescription || undefined,
      logoUrl: logoUrl || undefined
    });
    onClose();
  };

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBanned || !adminInput) return;

    const result = await verifyAdminPassword(adminInput);

    if (result.banned) {
      setIsBanned(true);
      setRemainingAttempts(0);
      setAdminError(`尝试次数过多，IP 已被封禁 ${banMinutes} 分钟`);
      setAdminInput('');
      return;
    }

    if (result.success) {
      setAdminError('');
      setRemainingAttempts(result.remainingAttempts || 5);
      onAdminVerified();
    } else {
      setRemainingAttempts(result.remainingAttempts || 0);
      setAdminError(result.error || '管理员密码错误');
      setAdminInput('');
    }
  };

  const needsAdminAuth = !!import.meta.env.VITE_ADMIN_PASSWORD && !isAdmin;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="size-5" />
            系统设置
          </DialogTitle>
          <DialogDescription>
            {needsAdminAuth ? '需要管理员密码才能查看和修改设置' : '配置访问密码、分类密码和同步分类'}
          </DialogDescription>
        </DialogHeader>

        {needsAdminAuth ? (
          <div className="py-8">
            <Card className="p-6">
              <div className="flex flex-col items-center gap-4">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 rounded-full">
                  <UserCog className="size-8 text-white" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900">管理员认证</h3>
                  <p className="text-sm text-gray-500 mt-1">请输入管理员密码以继续</p>
                </div>

                {isBanned && (
                  <div className="w-full max-w-sm bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle className="size-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">
                      IP 已被封禁，请 {banMinutes} 分钟后再试
                    </p>
                  </div>
                )}

                {!isBanned && remainingAttempts < 5 && (
                  <p className="text-sm text-amber-600">
                    剩余尝试次数：{remainingAttempts}
                  </p>
                )}

                <form onSubmit={handleAdminVerify} className="w-full max-w-sm space-y-3">
                  <div className="relative">
                    <Input
                      type={showAdminInput ? 'text' : 'password'}
                      placeholder="请输入管理员密码"
                      value={adminInput}
                      onChange={(e) => {
                        setAdminInput(e.target.value);
                        setAdminError('');
                      }}
                      className="pr-10"
                      autoFocus
                      disabled={isBanned}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminInput(!showAdminInput)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showAdminInput ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {adminError && (
                    <p className="text-sm text-red-500">{adminError}</p>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    disabled={!adminInput || isBanned}
                  >
                    验证管理员身份
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        ) : (
          <>
            <Tabs defaultValue="access" className="py-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="site">站点信息</TabsTrigger>
                <TabsTrigger value="access">访问密码</TabsTrigger>
                <TabsTrigger value="folder-password">分类密码</TabsTrigger>
                <TabsTrigger value="sync">同步设置</TabsTrigger>
              </TabsList>

              {/* 站点信息 */}
              <TabsContent value="site" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="size-5 text-pink-600" />
                    <h3 className="font-semibold">站点信息</h3>
                  </div>

                  <div className="space-y-4 pl-7">
                    <div className="space-y-2">
                      <Label htmlFor="siteName">站点名称</Label>
                      <Input
                        id="siteName"
                        type="text"
                        placeholder="小米笔记导出工具"
                        value={siteName}
                        onChange={(e) => setSiteName(e.target.value)}
                      />
                      <p className="text-xs text-gray-500">
                        显示在页面顶部标题栏和浏览器标签页
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="siteDescription">站点标语 / Slogan</Label>
                      <Input
                        id="siteDescription"
                        type="text"
                        placeholder="轻松同步和管理您的笔记"
                        value={siteDescription}
                        onChange={(e) => setSiteDescription(e.target.value)}
                      />
                      <p className="text-xs text-gray-500">
                        显示在站点名称下方的副标题
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="logoUrl">Logo 图片 URL</Label>
                      <Input
                        id="logoUrl"
                        type="text"
                        placeholder="https://example.com/logo.png"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                      />
                      <p className="text-xs text-gray-500">
                        留空则使用默认图标。支持网络图片地址
                      </p>
                    </div>

                    <div className="border rounded-lg p-4 bg-gray-50">
                      <p className="text-xs text-gray-400 mb-2">预览</p>
                      <div className="flex items-center gap-3">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="logo"
                            className="size-10 rounded-xl object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl">
                            <FileText className="size-5 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{siteName || '小米笔记导出工具'}</p>
                          <p className="text-xs text-gray-500">{siteDescription || '轻松同步和管理您的笔记'}</p>
                        </div>
                      </div>
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
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {settings.password && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-600">✓ 当前已设置密码</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearAccessPassword}
                          className="h-auto py-1 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          移除密码
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
                              {settings.folderPasswords?.[folder] && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveFolderPassword(folder)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  移除
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
                  {/* 小米同步Cookie设置 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Cookie className="size-5 text-green-600" />
                      <h3 className="font-semibold">小米同步Cookie</h3>
                    </div>

                    <div className="space-y-2 pl-7">
                      <Label htmlFor="miCookie">小米云服务Cookie</Label>
                      <Input
                        id="miCookie"
                        type="password"
                        placeholder={settings.miCookie ? '已设置，输入新值可覆盖' : '输入小米云服务Cookie以同步笔记'}
                        value={miCookie}
                        onChange={(e) => setMiCookie(e.target.value)}
                      />
                      {settings.miCookie && settings.miCookieUpdatedAt && (
                        <p className="text-xs text-gray-400">
                          上次更新时间：{new Date(settings.miCookieUpdatedAt).toLocaleString('zh-CN')}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        设置后点击"同步笔记"即可同步小米笔记到本地
                      </p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex items-center gap-2">
                    <FolderOpen className="size-5 text-orange-600" />
                    <h3 className="font-semibold">同步分类</h3>
                  </div>

                  <div className="space-y-3 pl-7">
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
          </>
        )}

        {/* 移除密码二次确认对话框 */}
        {removeConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-md p-6 mx-4">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-3">
                    <Lock className="size-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {removeConfirm.type === 'access' ? '移除访问密码' : `移除「${removeConfirm.folder}」分类密码`}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    请输入原密码以确认移除操作
                  </p>
                </div>

                <form onSubmit={handleConfirmRemove} className="space-y-3">
                  <div className="relative">
                    <Input
                      type={removeConfirm.showInput ? 'text' : 'password'}
                      placeholder="请输入原密码"
                      value={removeConfirm.input}
                      onChange={(e) => setRemoveConfirm(prev => prev ? { ...prev, input: e.target.value, error: '' } : null)}
                      className="pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setRemoveConfirm(prev => prev ? { ...prev, showInput: !prev.showInput } : null)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {removeConfirm.showInput ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>

                  {removeConfirm.error && (
                    <p className="text-sm text-red-500">{removeConfirm.error}</p>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setRemoveConfirm(null)}
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      disabled={!removeConfirm.input}
                    >
                      确认移除
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

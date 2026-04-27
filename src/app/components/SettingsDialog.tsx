import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Lock, FolderOpen, Eye, EyeOff, Save, Shield, Cookie } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import type { Settings } from '../App';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
  allFolders: string[];
}

export function SettingsDialog({ open, onClose, settings, onSave, allFolders }: SettingsDialogProps) {
  const [password, setPassword] = useState(settings.password);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<string[]>(settings.selectedFolders);
  const [folderPasswords, setFolderPasswords] = useState<{ [folder: string]: string }>(settings.folderPasswords || {});
  const [authCookie, setAuthCookie] = useState(settings.authCookie || '');

  useEffect(() => {
    if (open) {
      setPassword(settings.password);
      setSelectedFolders(settings.selectedFolders);
      setFolderPasswords(settings.folderPasswords || {});
      setAuthCookie(settings.authCookie || '');
      setShowPassword(false);
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
      password,
      selectedFolders,
      folderPasswords,
      authCookie
    });
    onClose();
  };

  const handleClearPassword = () => {
    setPassword('');
  };

  return (
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

        <Tabs defaultValue="access" className="py-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="access">访问密码</TabsTrigger>
            <TabsTrigger value="folder-password">分类密码</TabsTrigger>
            <TabsTrigger value="sync">同步设置</TabsTrigger>
          </TabsList>

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

                <Separator className="my-4" />

                {/* Cookie设置 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Cookie className="size-5 text-green-600" />
                    <h3 className="font-semibold">Cookie设置</h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="authCookie">自定义认证Cookie</Label>
                    <Input
                      id="authCookie"
                      type="text"
                      placeholder="输入自定义Cookie值以免密登录"
                      value={authCookie}
                      onChange={(e) => setAuthCookie(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      设置后，浏览器将保存此Cookie值，下次访问时如果Cookie值匹配则自动登录
                    </p>
                  </div>
                </div>
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
                              onClick={() => handleRemoveFolderPassword(folder)}
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
  );
}
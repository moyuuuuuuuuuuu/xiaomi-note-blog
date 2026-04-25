import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import type { Note } from '../App';

interface SetNotePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSetPassword: (password: string) => void | Promise<void>;
  note: Note | null;
}

export function SetNotePasswordDialog({ 
  open, 
  onClose, 
  onSetPassword, 
  note
}: SetNotePasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setError('');
      setShowPassword(false);
      setIsSaving(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('请输入密码');
      return;
    }

    if (password.length < 4) {
      setError('密码至少需要4个字符');
      return;
    }

    setIsSaving(true);
    try {
      await onSetPassword(password);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存密码失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setPassword('');
    setError('');
    onClose();
  };

  if (!note) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-5 text-blue-600" />
            {note.password ? '修改笔记密码' : '设置笔记密码'}
          </DialogTitle>
          <DialogDescription>
            为笔记 "{note.title}" 设置访问密码
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">密码</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码（至少4个字符）"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="pr-10"
                autoFocus
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

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {note.password && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                💡 此笔记已设置密码，保存后将使用新密码
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 gap-2"
            >
              <Save className="size-4" />
              {isSaving ? '保存中...' : '保存密码'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';

interface AdminPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onVerified: (password: string) => void | Promise<void>;
}

export function AdminPasswordDialog({ open, onClose, onVerified }: AdminPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsVerifying(true);
    try {
      await onVerified(password);
      setPassword('');
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : '管理员认证失败');
      setPassword('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    if (isVerifying) return;
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-blue-600" />
            管理员认证
          </DialogTitle>
          <DialogDescription>
            请输入管理员密码以打开系统设置
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入管理员密码"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
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
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button
              type="submit"
              disabled={!password || isVerifying}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {isVerifying ? '认证中...' : '认证'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

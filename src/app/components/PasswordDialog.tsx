import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';

interface PasswordDialogProps {
  expectedPassword: string;
  onVerified: () => void;
}

export function PasswordDialog({ expectedPassword, onVerified }: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === expectedPassword) {
      setError('');
      onVerified();
    } else {
      setError('密码错误，请重试');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center gap-6">
          {/* Logo */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full blur-xl opacity-20 animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-full">
              <Lock className="size-12 text-white" />
            </div>
          </div>

          {/* 标题 */}
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">访问验证</h1>
            <p className="text-gray-500">请输入密码以继续访问</p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入访问密码"
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
              
              {error && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              disabled={!password}
            >
              验证访问
            </Button>
          </form>

          {/* 提示 */}
          <p className="text-sm text-gray-400 text-center">
            如果忘记密码，请清除浏览器缓存或联系管理员
          </p>
        </div>
      </Card>
    </div>
  );
}
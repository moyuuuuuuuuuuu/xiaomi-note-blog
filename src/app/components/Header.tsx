import { FileText, RefreshCw, Settings } from 'lucide-react';
import { Button } from './ui/button';

interface HeaderProps {
  onSync: () => void;
  isSyncing: boolean;
  onOpenSettings: () => void;
}

export function Header({ onSync, isSyncing, onOpenSettings }: HeaderProps) {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 rounded-xl">
              <FileText className="size-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-xl text-gray-900">小米笔记导出工具</h1>
              <p className="text-sm text-gray-500">轻松同步和管理您的笔记</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={onOpenSettings}
              className="gap-2"
            >
              <Settings className="size-4" />
              <span className="hidden md:inline">设置</span>
            </Button>
            
            <Button
              onClick={onSync}
              disabled={isSyncing}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 gap-2"
            >
              <RefreshCw className={`size-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? '同步中...' : '同步笔记'}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

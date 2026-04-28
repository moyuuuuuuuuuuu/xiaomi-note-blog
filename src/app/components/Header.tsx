import { FileText, RefreshCw, Settings, ImageIcon } from 'lucide-react';
import { Button } from './ui/button';

interface HeaderProps {
  onSync: () => void;
  isSyncing: boolean;
  onOpenSettings: () => void;
  showSyncButton: boolean;
  siteName?: string;
  siteDescription?: string;
  logoUrl?: string;
}

export function Header({ onSync, isSyncing, onOpenSettings, showSyncButton, siteName, siteDescription, logoUrl }: HeaderProps) {
  const displayName = siteName || '小米笔记导出工具';
  const displaySlogan = siteDescription || '轻松同步和管理您的笔记';

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={displayName}
                className="size-11 rounded-xl object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 rounded-xl">
                <FileText className="size-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="font-semibold text-xl text-gray-900">{displayName}</h1>
              <p className="text-sm text-gray-500">{displaySlogan}</p>
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
            
            {showSyncButton && (
              <Button
                onClick={onSync}
                disabled={isSyncing}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 gap-2"
              >
                <RefreshCw className={`size-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? '同步中...' : '同步笔记'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

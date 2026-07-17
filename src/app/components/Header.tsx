import { RefreshCw, Settings } from 'lucide-react';
import { Button } from './ui/button';

interface HeaderProps {
  onSync: () => void;
  isSyncing: boolean;
  canSync: boolean;
  onOpenSettings: () => void;
  siteName: string;
  siteDescription: string;
  logoUrl?: string;
}

export function Header({ onSync, isSyncing, canSync, onOpenSettings, siteName, logoUrl }: HeaderProps) {
  return (
    <header className="minimal-header">
      <div className="editorial-container minimal-header-inner">
        <div className="minimal-brand">
          <div className="minimal-brand-mark">
            {logoUrl ? <img src={logoUrl} alt={siteName} /> : <span aria-hidden="true" />}
          </div>
          <a href="/" className="minimal-brand-name" aria-label={`${siteName}首页`}>{siteName}</a>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onOpenSettings} className="minimal-action gap-2">
            <Settings className="size-4" />
            <span className="hidden md:inline">设置</span>
          </Button>
          {canSync && (
            <Button onClick={onSync} disabled={isSyncing} className="minimal-sync gap-2">
              <RefreshCw className={`size-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? '同步中...' : '同步笔记'}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';

export interface NoteSummary {
  id: string;
  title: string;
  createTime: number;
  modifyTime: number;
  folder: string;
  noteProtected: boolean;
  folderProtected: boolean;
}

export interface NoteDetail extends NoteSummary {
  content: string;
}

export type NoteUpdate = { id: string } & Partial<Pick<NoteDetail, 'title' | 'content' | 'folder' | 'createTime' | 'modifyTime'>> & {
  password?: string;
};

export interface Settings {
  siteName: string;
  siteDescription: string;
  logoUrl: string;
  password: string;
  selectedFolders: string[];
  folderPasswords: { [folder: string]: string }; // 分类密码
  protectedFolders: string[];
  hasMiCookie?: boolean;
  miCookieUpdatedAt?: number | null;
  miCookieStatus?: 'unchecked' | 'valid' | 'invalid';
  miCookieLastCheckedAt?: number | null;
  miCookieLastRefreshedAt?: number | null;
  miCookieLastError?: string;
}

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

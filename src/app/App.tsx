import { useState, useEffect } from 'react';
import { NotesList } from './components/NotesList';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { PasswordDialog } from './components/PasswordDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';

export interface Note {
  id: string;
  title: string;
  content: string;
  createTime: number;
  modifyTime: number;
  folder?: string;
  password?: string; // 单个笔记的密码
}

export interface Settings {
  password: string;
  selectedFolders: string[];
  folderPasswords: { [folder: string]: string }; // 分类密码
  authCookie?: string; // 用户自定义的认证Cookie
}

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
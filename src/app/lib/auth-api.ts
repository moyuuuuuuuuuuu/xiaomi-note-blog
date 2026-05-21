// 客户端认证 API 封装
// 所有密码验证通过服务端端点进行，客户端仅存储解锁状态（sessionStorage）

const AUTH_KEY = 'xiaomi-auth';
const ADMIN_KEY = 'xiaomi-admin';

export async function verifyAccessPassword(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/verify-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem(AUTH_KEY, 'true');
    }
    return data;
  } catch {
    return { success: false, error: '网络错误' };
  }
}

export async function verifyFolderPassword(folder: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/verify-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, password })
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem(`xiaomi-folder-${folder}`, 'true');
    }
    return data;
  } catch {
    return { success: false, error: '网络错误' };
  }
}

export async function verifyNotePassword(noteId: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/verify-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId, password })
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem(`xiaomi-note-${noteId}`, 'true');
    }
    return data;
  } catch {
    return { success: false, error: '网络错误' };
  }
}

export async function verifyAdminPassword(password: string): Promise<{
  success: boolean;
  error?: string;
  banned?: boolean;
  remainingAttempts?: number;
}> {
  try {
    const res = await fetch('/api/auth/verify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem(ADMIN_KEY, 'true');
    }
    return data;
  } catch {
    return { success: false, error: '网络错误' };
  }
}

export async function fetchAdminStatus(): Promise<{
  banned: boolean;
  remainingAttempts: number;
  maxAttempts: number;
  banMinutes: number;
}> {
  try {
    const res = await fetch('/api/auth/admin-status');
    return await res.json();
  } catch {
    return { banned: false, remainingAttempts: 5, maxAttempts: 5, banMinutes: 30 };
  }
}

// ============ 状态查询（仅读取 sessionStorage，不访问密码）============

export function isAccessAuthenticated(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

export function isFolderUnlocked(folder: string): boolean {
  return sessionStorage.getItem(`xiaomi-folder-${folder}`) === 'true';
}

export function isNoteUnlocked(noteId: string): boolean {
  return sessionStorage.getItem(`xiaomi-note-${noteId}`) === 'true';
}

export function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem(ADMIN_KEY) === 'true';
}

// ============ 清除状态 ============

export function clearAccessAuth() {
  sessionStorage.removeItem(AUTH_KEY);
}

export function clearFolderAuth(folder: string) {
  sessionStorage.removeItem(`xiaomi-folder-${folder}`);
}

export function clearNoteAuth(noteId: string) {
  sessionStorage.removeItem(`xiaomi-note-${noteId}`);
}

export function clearAdminAuth() {
  sessionStorage.removeItem(ADMIN_KEY);
}

export function clearAllAuth() {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(ADMIN_KEY);
  // 清除所有分类和笔记的解锁状态
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key && (key.startsWith('xiaomi-folder-') || key.startsWith('xiaomi-note-'))) {
      sessionStorage.removeItem(key);
    }
  }
}

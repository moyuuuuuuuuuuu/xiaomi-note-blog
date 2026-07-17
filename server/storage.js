import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const defaultSettings = {
  siteName: '小米笔记博客',
  siteDescription: '从小米笔记同步来的日常记录',
  logoUrl: '',
  password: '',
  selectedFolders: [],
  folderPasswords: {},
  miCookie: '',
  miCookieUpdatedAt: null,
};

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8');
}

export function getPublicSettings(settings) {
  return {
    siteName: settings.siteName || defaultSettings.siteName,
    siteDescription: settings.siteDescription || defaultSettings.siteDescription,
    logoUrl: settings.logoUrl || '',
    password: settings.password || '',
    selectedFolders: settings.selectedFolders || [],
    folderPasswords: {},
    protectedFolders: Object.entries(settings.folderPasswords || {})
      .filter(([, password]) => Boolean(password))
      .map(([folder]) => folder),
    hasMiCookie: Boolean(settings.miCookie),
    miCookieUpdatedAt: settings.miCookieUpdatedAt || null,
  };
}

export function getAdminSettings(settings) {
  return {
    ...getPublicSettings(settings),
    folderPasswords: { ...(settings.folderPasswords || {}) },
  };
}

export function mergeSyncedNotes(currentNotes, syncedNotes) {
  const currentById = new Map(currentNotes.map((note) => [note.id, note]));
  return syncedNotes.map((note) => {
    const current = currentById.get(note.id);
    return current?.password ? { ...note, password: current.password } : note;
  });
}

export function createDataStore(dataDir) {
  const settingsPath = join(dataDir, 'settings.json');
  const notesPath = join(dataDir, 'notes.json');

  async function ensureDataDir() {
    await mkdir(dataDir, { recursive: true });
  }

  return {
    async readSettings() {
      await ensureDataDir();
      return {
        ...defaultSettings,
        ...(await readJson(settingsPath, defaultSettings)),
      };
    },

    async updateSettings(patch) {
      const current = await this.readSettings();
      const next = {
        ...current,
        ...patch,
      };
      if (Object.hasOwn(patch, 'miCookie')) {
        next.miCookie = patch.miCookie?.trim() || '';
        next.miCookieUpdatedAt = next.miCookie ? Date.now() : null;
      }
      await ensureDataDir();
      await writeJson(settingsPath, next);
      return next;
    },

    async readNotes() {
      await ensureDataDir();
      return readJson(notesPath, []);
    },

    async writeNotes(notes) {
      await ensureDataDir();
      await writeJson(notesPath, notes);
      return notes;
    },
  };
}

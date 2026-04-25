import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSession, getClearSessionCookie, getSessionCookie, isSessionCookieValid, verifyAdminPassword } from './auth.js';
import { loadEnvFile } from './env.js';
import { createPasswordAttemptLimiter, getClientIp, verifyProtectedPassword } from './passwordLock.js';
import { createDataStore, getPublicSettings, mergeSyncedNotes } from './storage.js';
import { fetchXiaomiNoteImage, syncXiaomiNotesFromServer } from './xiaomi.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
await loadEnvFile(join(rootDir, '.env'));

const dataDir = resolve(process.env.DATA_DIR || join(rootDir, 'data'));
const distDir = resolve(process.env.DIST_DIR || join(rootDir, 'dist'));
const port = Number(process.env.PORT || 8787);
const adminPassword = process.env.ADMIN_PASSWORD || '';
const sessionTtlMs = 12 * 60 * 60 * 1000;
const sessions = new Map();
const passwordLimiter = createPasswordAttemptLimiter({
  maxAttempts: Number(process.env.PASSWORD_LOCK_MAX_ATTEMPTS || 5),
  lockMs: Number(process.env.PASSWORD_LOCK_MS || 24 * 60 * 60 * 1000),
});
const store = createDataStore(dataDir);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function sendPasswordVerifyResult(res, result) {
  if (result.ok) {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (result.locked) {
    sendJson(res, 423, {
      error: '密码错误次数过多，当前 IP 已被锁定，请明天再试',
      locked: true,
      lockedUntil: result.lockedUntil,
    });
    return;
  }
  sendJson(res, 401, {
    error: `密码错误，还可尝试 ${result.remainingAttempts} 次`,
    remainingAttempts: result.remainingAttempts,
  });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function requireAdmin(req, res) {
  if (isSessionCookieValid(req.headers.cookie || '', sessions)) return true;
  sendError(res, 401, '需要管理员认证后才能执行此操作');
  return false;
}

async function handleApi(req, res, url) {
  try {
    const imageMatch = url.pathname.match(/^\/api\/xiaomi-image\/([^/]+)$/);
    if (req.method === 'GET' && imageMatch) {
      const settings = await store.readSettings();
      const image = await fetchXiaomiNoteImage(settings.miCookie, decodeURIComponent(imageMatch[1]));
      res.writeHead(200, {
        'content-type': image.contentType,
        'cache-control': 'private, max-age=3600',
      });
      res.end(image.body);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/session') {
      sendJson(res, 200, {
        authenticated: isSessionCookieValid(req.headers.cookie || '', sessions),
        adminConfigured: Boolean(adminPassword),
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/login') {
      const body = await readBody(req);
      if (!verifyAdminPassword(body.password, adminPassword)) {
        sendError(res, 401, adminPassword ? '管理员密码错误' : '服务器未配置 ADMIN_PASSWORD');
        return;
      }
      const session = createSession(sessions, sessionTtlMs);
      sendJson(res, 200, { ok: true, expiresAt: session.expiresAt }, { 'set-cookie': getSessionCookie(session.token) });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
      sendJson(res, 200, { ok: true }, { 'set-cookie': getClearSessionCookie() });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/password/verify') {
      const body = await readBody(req);
      const ip = getClientIp(req);
      const settings = await store.readSettings();
      let expectedPassword = '';

      if (body.scope === 'note') {
        const notes = await store.readNotes();
        const note = notes.find((item) => item.id === String(body.id || ''));
        expectedPassword = note?.password || '';
      } else if (body.scope === 'folder') {
        expectedPassword = settings.folderPasswords?.[String(body.id || '')] || '';
      } else {
        sendError(res, 400, '密码验证类型无效');
        return;
      }

      if (!expectedPassword) {
        sendError(res, 404, '未找到需要验证的密码');
        return;
      }

      sendPasswordVerifyResult(res, verifyProtectedPassword({
        limiter: passwordLimiter,
        ip,
        inputPassword: body.password,
        expectedPassword,
      }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/settings') {
      sendJson(res, 200, getPublicSettings(await store.readSettings()));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/settings') {
      const body = await readBody(req);
      const settings = await store.updateSettings({
        siteName: body.siteName,
        siteDescription: body.siteDescription,
        logoUrl: body.logoUrl,
        password: body.password,
        selectedFolders: Array.isArray(body.selectedFolders) ? body.selectedFolders : [],
        folderPasswords: body.folderPasswords && typeof body.folderPasswords === 'object' ? body.folderPasswords : {},
      });
      sendJson(res, 200, getPublicSettings(settings));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/settings/mi-cookie') {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const settings = await store.updateSettings({ miCookie: body.cookie || '' });
      sendJson(res, 200, getPublicSettings(settings));
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/api/settings/mi-cookie') {
      if (!requireAdmin(req, res)) return;
      const settings = await store.updateSettings({ miCookie: '' });
      sendJson(res, 200, getPublicSettings(settings));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/notes') {
      sendJson(res, 200, { notes: await store.readNotes() });
      return;
    }

    const noteMatch = url.pathname.match(/^\/api\/notes\/([^/]+)$/);
    if (req.method === 'GET' && noteMatch) {
      const notes = await store.readNotes();
      const note = notes.find((item) => item.id === decodeURIComponent(noteMatch[1]));
      if (!note) {
        sendError(res, 404, '笔记不存在');
        return;
      }
      sendJson(res, 200, { note });
      return;
    }

    if (req.method === 'PUT' && noteMatch) {
      if (!requireAdmin(req, res)) return;
      const id = decodeURIComponent(noteMatch[1]);
      const body = await readBody(req);
      const notes = await store.readNotes();
      const nextNotes = notes.map((note) => (note.id === id ? { ...note, ...body, id } : note));
      await store.writeNotes(nextNotes);
      sendJson(res, 200, { note: nextNotes.find((note) => note.id === id) });
      return;
    }

    if (req.method === 'DELETE' && noteMatch) {
      if (!requireAdmin(req, res)) return;
      const id = decodeURIComponent(noteMatch[1]);
      const notes = await store.readNotes();
      await store.writeNotes(notes.filter((note) => note.id !== id));
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/sync') {
      if (!requireAdmin(req, res)) return;
      const settings = await store.readSettings();
      const notes = await syncXiaomiNotesFromServer(settings.miCookie);
      const selectedFolders = settings.selectedFolders || [];
      const syncedNotes = selectedFolders.length > 0
        ? notes.filter((note) => selectedFolders.includes(note.folder || ''))
        : notes;
      const mergedNotes = mergeSyncedNotes(await store.readNotes(), syncedNotes);
      await store.writeNotes(mergedNotes);
      sendJson(res, 200, { notes: mergedNotes });
      return;
    }

    sendError(res, 404, '接口不存在');
  } catch (error) {
    console.error(error);
    sendError(res, 500, error instanceof Error ? error.message : '服务器内部错误');
  }
}

async function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname);
  const isHtmlRequest = pathname === '/' || pathname.endsWith('.html') || !extname(pathname);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = resolve(join(distDir, requestedPath));
  
  if (!filePath.startsWith(distDir)) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  let fileExists = false;
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) {
      fileExists = true;
    }
  } catch {
    // 忽略错误，后面会处理 fallback 到 index.html
  }

  if (!fileExists && isHtmlRequest) {
    filePath = join(distDir, 'index.html');
  } else if (!fileExists) {
    sendError(res, 404, 'Not Found');
    return;
  }

  const ext = extname(filePath);
  res.writeHead(200, {
    'content-type': contentTypes[ext] || 'application/octet-stream',
  });

  // 如果是 index.html，进行标题注入
  if (filePath === join(distDir, 'index.html')) {
    try {
      let content = await readFile(filePath, 'utf-8');
      const settings = await store.readSettings();
      let title = settings.siteName || '小米笔记博客';

      // 检查是否是详情页
      const noteMatch = pathname.match(/^\/note\/([^/]+)$/);
      if (noteMatch) {
        const notes = await store.readNotes();
        const note = notes.find(n => n.id === decodeURIComponent(noteMatch[1]));
        if (note && note.title) {
          title = `${note.title} - ${settings.siteName || '小米笔记博客'}`;
        }
      }

      content = content.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
      res.end(content);
      return;
    } catch (error) {
      console.error('处理 index.html 失败:', error);
      // 如果出错，回退到流式传输原始文件
    }
  }

  createReadStream(filePath).pipe(res);
}

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    await handleApi(req, res, url);
    return;
  }
  await serveStatic(req, res, url);
}).listen(port,'0.0.0.0', () => {
  console.log(`xiaominote server listening on http://127.0.0.1:${port}`);
  console.log(`data directory: ${dataDir}`);
  if (!adminPassword) {
    console.warn('ADMIN_PASSWORD is not set. Cookie management will be disabled.');
  }
});

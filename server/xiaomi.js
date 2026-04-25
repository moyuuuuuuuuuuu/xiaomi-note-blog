import { normalizeXiaomiNote } from '../src/app/lib/xiaomiNotes.js';

const XIAOMI_BASE = 'https://i.mi.com';
const DEFAULT_LIMIT = 200;

async function readXiaomiJson(response, context) {
  if (response.status === 401 && response.url.startsWith('https://s010.i.mi.com')) {
    response = await fetch(response.url, {
      headers: response.requestHeaders,
    });
  }
  if (!response.ok) {
    throw new Error(`${context}失败：HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!data?.data) {
    throw new Error(`${context}失败，请检查服务器保存的小米云 Cookie 是否有效或已过期`);
  }
  return data;
}

async function requestXiaomiJson(pathname, cookie, context) {
  const headers = {
    cookie,
    referer: 'https://i.mi.com/note/h5',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0',
  };
  const response = await fetch(`${XIAOMI_BASE}${pathname}`, { headers });
  response.requestHeaders = headers;
  return readXiaomiJson(response, context);
}

export async function syncXiaomiNotesFromServer(cookie, { limit = DEFAULT_LIMIT } = {}) {
  if (!cookie?.trim()) {
    throw new Error('服务器还没有配置小米云 Cookie');
  }

  const entries = [];
  let folders = {};
  let syncTag = '';
  let lastPage = false;

  while (!lastPage) {
    const search = new URLSearchParams({
      ts: String(Date.now()),
      limit: String(limit),
      syncTag,
    });
    const data = await requestXiaomiJson(`/note/full/page/?${search}`, cookie, '获取笔记列表');
    const pageData = data.data;
    const pageFolders = Object.fromEntries(
      (pageData.folders || []).map((folder) => [String(folder.id), folder.subject || '未分类']),
    );
    folders = { ...folders, ...pageFolders };
    entries.push(...(pageData.entries || []));
    lastPage = Boolean(pageData.lastPage);
    syncTag = pageData.syncTag || '';
  }

  const notes = [];
  for (const entry of entries) {
    const search = new URLSearchParams({ ts: String(Date.now()) });
    const data = await requestXiaomiJson(`/note/note/${entry.id}/?${search}`, cookie, `获取笔记详情 ${entry.id}`);
    notes.push(normalizeXiaomiNote(data.data.entry || entry, folders));
  }

  return notes;
}

export async function fetchXiaomiNoteImage(cookie, fileId) {
  if (!cookie?.trim()) {
    throw new Error('服务器还没有配置小米云 Cookie');
  }
  if (!fileId?.trim()) {
    throw new Error('缺少图片文件 ID');
  }

  const search = new URLSearchParams({
    type: 'note_img',
    fileid: fileId,
  });
  const response = await fetch(`${XIAOMI_BASE}/file/full?${search}`, {
    headers: {
      cookie,
      referer: 'https://i.mi.com/note/h5',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0',
    },
  });

  if (!response.ok) {
    throw new Error(`获取图片失败：HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    const text = await response.text();
    throw new Error(text || '获取图片失败：小米云没有返回图片内容');
  }

  return {
    contentType,
    body: Buffer.from(await response.arrayBuffer()),
  };
}

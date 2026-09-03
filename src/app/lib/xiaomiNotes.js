const DEFAULT_LIMIT = 200;
const PROXY_BASE = '/xiaomi-cloud';

function safeJsonDecode(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, '');
}

function normalizeNoteTitle(value) {
  return stripTags(String(value))
    .replace(/!?(?:\[([^\]]*)\])\((?:[^()]|\([^)]*\))*\)/g, '$1')
    .trim();
}

function decodeHtmlAttribute(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getTagAttribute(tag, names) {
  for (const name of names) {
    const match = tag.match(new RegExp(`${name}=(["'])(.*?)\\1`, 'i'));
    if (match?.[2]) return decodeHtmlAttribute(match[2]);
  }
  return '';
}

function normalizeImageTag(tag) {
  const fileId = getTagAttribute(tag, ['fileid', 'fileId']);
  if (fileId) return normalizeXiaomiImage(fileId);
  const src = getTagAttribute(tag, ['src', 'url', 'href']);
  if (!src) return '';
  const alt = getTagAttribute(tag, ['alt', 'title']) || '图片';
  return `![${alt}](${src})`;
}

function normalizeLinkTag(tag, inner = '') {
  const href = getTagAttribute(tag, ['href', 'url']);
  const label = stripTags(inner).trim() || href;
  if (!href || !label) return label;
  return `[${label.replace(/[\[\]]/g, '')}](${href})`;
}

function normalizeXiaomiImage(fileId) {
  return `![图片](/api/xiaomi-image/${encodeURIComponent(fileId)})`;
}

export function normalizeNoteContent(content = '') {
  return content
    .replace(/<new-format\s*\/>/g, '')
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (tag, inner) => normalizeLinkTag(tag, inner))
    .replace(/<(?:img|image|photo|picture)\b[^>]*\/?>/gi, normalizeImageTag)
    .replace(/(?:^|\s)☺\s+([0-9]+[.][A-Za-z0-9_-]+)/g, (_match, fileId) => normalizeXiaomiImage(fileId))
    .replace(/<hr\s*\/>/g, '---')
    .replace(/<quote>(.*?)<\/quote>/gs, '> $1')
    .replace(/<b>(.*?)<\/b>/g, '**$1**')
    .replace(/<i>(.*?)<\/i>/g, '*$1*')
    .replace(/<u>(.*?)<\/u>/g, '$1')
    .replace(/<delete>(.*?)<\/delete>/g, '~~$1~~')
    .replace(/<size>(.*?)<\/size>/g, '# $1')
    .replace(/<mid-size>(.*?)<\/mid-size>/g, '## $1')
    .replace(/<h3-size>(.*?)<\/h3-size>/g, '### $1')
    .replace(/<order indent="(\d+)" inputNumber="\d+"\s*\/>/g, (_, indent) => `${'  '.repeat(Math.max(Number(indent) - 1, 0))}- `)
    .replace(/<bullet indent="(\d+)"\s*\/>/g, (_, indent) => `${'  '.repeat(Math.max(Number(indent) - 1, 0))}- `)
    .replace(/<input type="checkbox" indent="\d+" level="\d+" checked="true"\s*\/>/g, '- [x] ')
    .replace(/<input type="checkbox" indent="\d+" level="\d+"\s*\/>/g, '- [ ] ')
    .replace(/<input type="checkbox" checked="true"\s*\/>/g, '- [x] ')
    .replace(/<input type="checkbox"\s*\/>/g, '- [ ] ')
    .replace(/<text indent="\d+">(.*?)<\/text>/gs, '$1')
    .replace(/<(?:left|right|center)>(.*?)<\/(?:left|right|center)>/gs, '$1')
    .replace(/<background color="[^"]+">(.*?)<\/background>/gs, '$1')
    .split('\n')
    .map((line) => stripTags(line).trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeXiaomiNote(rawNote, folders = {}) {
  const extraInfo = safeJsonDecode(rawNote.extraInfo);
  const rawContent = extraInfo.mind_content || rawNote.content || rawNote.snippet || '';
  const content = normalizeNoteContent(rawContent);
  const title = extraInfo.title || rawNote.subject || content.split('\n')[0] || rawNote.snippet || '未命名';
  const folderId = String(rawNote.folderId ?? '');

  return {
    id: String(rawNote.id),
    title: normalizeNoteTitle(title) || '未命名',
    content,
    createTime: Number(rawNote.createDate || rawNote.createTime || 0),
    modifyTime: Number(rawNote.modifyDate || rawNote.modifyTime || rawNote.createDate || 0),
    folder: folders[folderId],
  };
}

function buildApiUrl(pathname, params = {}) {
  const origin = globalThis.window?.location?.origin || 'http://localhost';
  const url = new URL(`${PROXY_BASE}${pathname}`, origin);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value == null ? '' : String(value));
  });
  return url;
}

async function readJsonResponse(response, context) {
  if (!response.ok) {
    throw new Error(`${context}失败：HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data?.data) {
    throw new Error(`${context}失败，请检查小米云 Cookie 是否有效或已过期`);
  }
  return data;
}

async function requestJson(fetcher, url, cookie, context) {
  const response = await fetcher(url, {
    headers: {
      'x-mi-cookie': cookie,
      'x-requested-with': 'xiaomi-notes-sync',
    },
  });
  return readJsonResponse(response, context);
}

export async function syncXiaomiNotes({
  cookie,
  fetcher = fetch,
  limit = DEFAULT_LIMIT,
  includeDetails = false,
} = {}) {
  if (!cookie?.trim()) {
    throw new Error('请先在「设置 > 同步设置 > 小米云 Cookie」里填写从 i.mi.com 复制的完整 Cookie');
  }

  const notes = [];
  let folders = {};
  let syncTag = '';
  let lastPage = false;

  while (!lastPage) {
    const url = buildApiUrl('/note/full/page/', {
      ts: Date.now(),
      limit,
      syncTag,
    });
    const data = await requestJson(fetcher, url, cookie, '获取笔记列表');
    const pageData = data.data;
    const pageFolders = Object.fromEntries(
      (pageData.folders || []).map((folder) => [String(folder.id), folder.subject || '未分类']),
    );
    folders = { ...folders, ...pageFolders };
    notes.push(...(pageData.entries || []));
    lastPage = Boolean(pageData.lastPage);
    syncTag = pageData.syncTag || '';
  }

  if (!includeDetails) {
    return {
      notes: notes.map((entry) => normalizeXiaomiNote(entry, folders)),
      folders,
    };
  }

  const detailedNotes = [];
  for (const entry of notes) {
    const detailUrl = buildApiUrl(`/note/note/${entry.id}/`, { ts: Date.now() });
    const data = await requestJson(fetcher, detailUrl, cookie, `获取笔记详情 ${entry.id}`);
    detailedNotes.push(normalizeXiaomiNote(data.data.entry || entry, folders));
  }

  return {
    notes: detailedNotes,
    folders,
  };
}

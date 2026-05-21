const TOKEN_PREFIX = '@@NOTE_MARKDOWN_TOKEN_';
const TOKEN_SUFFIX = '@@';

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  if (trimmed.startsWith('#')) return true;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'blob:') return true;
    if (parsed.protocol === 'data:') return trimmed.startsWith('data:image/');
    return false;
  } catch {
    return false;
  }
}

function createTokenStore() {
  const tokens = [];
  return {
    add(html) {
      const token = `${TOKEN_PREFIX}${tokens.length}${TOKEN_SUFFIX}`;
      tokens.push(html);
      return token;
    },
    restore(html) {
      return html.replace(new RegExp(`${TOKEN_PREFIX}(\\d+)${TOKEN_SUFFIX}`, 'g'), (_match, index) => {
        return tokens[Number(index)] || '';
      });
    },
  };
}

function preserveAllowedHtml(value, addToken) {
  let next = value;
  next = next.replace(/<u>([\s\S]*?)<\/u>/gi, (_match, inner) => addToken(`<u>${renderInline(inner)}</u>`));
  next = next.replace(/<center>([\s\S]*?)<\/center>/gi, (_match, inner) => addToken(`<center>${renderInline(inner)}</center>`));
  next = next.replace(
    /<div\s+align=(["'])(left|right)\1\s*>([\s\S]*?)<\/div>/gi,
    (_match, _quote, align, inner) => addToken(`<div align="${align.toLowerCase()}">${renderInline(inner)}</div>`),
  );
  next = next.replace(
    /<span\s+style=(["'])\s*background-color:\s*(#[0-9a-f]{3,8})\s*;?\s*\1\s*>([\s\S]*?)<\/span>/gi,
    (_match, _quote, color, inner) => addToken(`<span style="background-color: ${color.toLowerCase()};">${renderInline(inner)}</span>`),
  );
  return next;
}

function preserveMarkdownLinks(value, addToken) {
  let next = value;
  next = next.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (raw, alt, src) => {
    if (!isSafeUrl(src)) return raw;
    return addToken(`<img src="${escapeHtml(src)}" alt="${escapeHtml(alt || '图片')}" loading="lazy" />`);
  });
  next = next.replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g, (raw, label, href) => {
    if (!isSafeUrl(href)) return raw;
    return addToken(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  });
  return next;
}

function renderInline(value) {
  const store = createTokenStore();
  let html = value;

  html = html.replace(/`([^`]+)`/g, (_match, code) => store.add(`<code>${escapeHtml(code)}</code>`));
  html = preserveAllowedHtml(html, store.add);
  html = preserveMarkdownLinks(html, store.add);
  html = escapeHtml(html);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  return store.restore(html);
}

function isListLine(line) {
  return /^\s*-\s+/.test(line);
}

function isBlockStart(line) {
  return /^(#{1,6})\s+/.test(line)
    || /^>\s?/.test(line)
    || /^-{3,}\s*$/.test(line)
    || isListLine(line);
}

function renderList(lines) {
  const items = lines.map((line) => {
    const content = line.replace(/^\s*-\s+/, '');
    const task = content.match(/^\[( |x|X)\]\s+(.*)$/);
    if (task) {
      const checked = task[1].toLowerCase() === 'x' ? ' checked' : '';
      return `<li class="task-list-item"><input type="checkbox"${checked} disabled /> ${renderInline(task[2])}</li>`;
    }
    return `<li>${renderInline(content)}</li>`;
  });
  return `<ul>${items.join('')}</ul>`;
}

export function renderNoteMarkdown(content) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index++;
      continue;
    }

    if (/^-{3,}\s*$/.test(line)) {
      blocks.push('<hr />');
      index++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quotes = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quotes.push(lines[index].replace(/^>\s?/, ''));
        index++;
      }
      blocks.push(`<blockquote>${quotes.map(renderInline).join('<br />')}</blockquote>`);
      continue;
    }

    if (isListLine(line)) {
      const listLines = [];
      while (index < lines.length && isListLine(lines[index])) {
        listLines.push(lines[index]);
        index++;
      }
      blocks.push(renderList(listLines));
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index]);
      index++;
    }
    blocks.push(`<p>${paragraph.map(renderInline).join('<br />')}</p>`);
  }

  return blocks.join('\n');
}

export function stripNoteMarkdown(content) {
  return String(content || '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, (_match, alt) => alt || '图片')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<\/?(u|center|div|span)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*-\s+\[( |x|X)\]\s+/gm, '')
    .replace(/^\s*-\s+/gm, '')
    .replace(/(\*\*|~~|`)/g, '')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

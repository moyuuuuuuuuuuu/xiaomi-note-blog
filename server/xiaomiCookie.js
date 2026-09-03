const DEFAULT_CHECK_URL = 'https://i.mi.com/note/full/page/?limit=1&syncTag=';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const combined = headers.get('set-cookie');
  return combined ? combined.split(/,(?=\s*[^;,=]+=[^;,]*)/) : [];
}

export function mergeCookieHeader(currentCookie, setCookieHeaders = []) {
  const cookies = new Map();
  for (const part of String(currentCookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    cookies.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }

  for (const header of setCookieHeaders) {
    const [pair, ...attributes] = String(header).split(';');
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    const shouldDelete = !value || attributes.some((attribute) => /^\s*max-age\s*=\s*0\s*$/i.test(attribute));
    if (shouldDelete) cookies.delete(name);
    else cookies.set(name, value);
  }

  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}

export async function checkXiaomiCookie(cookie, {
  fetcher = fetch,
  url = DEFAULT_CHECK_URL,
  maxRedirects = 5,
} = {}) {
  if (!cookie?.trim()) throw new Error('服务器还没有配置小米云 Cookie');

  let currentCookie = cookie.trim();
  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetcher(currentUrl, {
      redirect: 'manual',
      headers: {
        cookie: currentCookie,
        referer: 'https://i.mi.com/note/h5',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0',
      },
    });
    currentCookie = mergeCookieHeader(currentCookie, getSetCookieHeaders(response.headers));

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Cookie 检测重定向缺少地址：HTTP ${response.status}`);
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (!response.ok) throw new Error(`Cookie 检测失败：HTTP ${response.status}`);

    const data = await response.json();
    if (!data?.data) throw new Error('Cookie 已失效或小米云未返回有效数据');
    return { cookie: currentCookie, refreshed: currentCookie !== cookie.trim() };
  }

  throw new Error('Cookie 检测重定向次数过多');
}

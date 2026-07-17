import crypto from 'node:crypto';

const COOKIE_NAME = 'xiao_note_unlock';

function readToken(cookieHeader = '') {
  const prefix = `${COOKIE_NAME}=`;
  const cookie = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  return cookie ? cookie.slice(prefix.length) : '';
}

export function createUnlockSessionStore({
  ttlMs,
  now = () => Date.now(),
  tokenFactory = () => crypto.randomBytes(24).toString('hex'),
}) {
  const records = new Map();

  function getSession(cookieHeader, ip) {
    const token = readToken(cookieHeader);
    const record = records.get(token);

    if (!record) return null;
    if (record.expiresAt <= now()) {
      records.delete(token);
      return null;
    }
    if (record.ip !== ip) return null;

    return { token, record };
  }

  return {
    grant({ cookieHeader, ip, scope }) {
      const current = getSession(cookieHeader, ip);
      const token = current?.token || tokenFactory();
      const record = current?.record || { ip, scopes: new Set() };

      record.scopes.add(scope);
      record.expiresAt = now() + ttlMs;
      records.set(token, record);

      return { token };
    },

    has({ cookieHeader, ip, scope }) {
      return Boolean(getSession(cookieHeader, ip)?.record.scopes.has(scope));
    },
  };
}

export function getUnlockSessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`;
}

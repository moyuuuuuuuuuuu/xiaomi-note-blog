import { randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'xiao_admin_session';

export function verifyAdminPassword(inputPassword, expectedPassword) {
  if (!expectedPassword) return false;
  const input = Buffer.from(String(inputPassword || ''));
  const expected = Buffer.from(String(expectedPassword));
  if (input.length !== expected.length) return false;
  return timingSafeEqual(input, expected);
}

export function createSession(sessions, ttlMs) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + ttlMs;
  sessions.set(token, expiresAt);
  return { token, expiresAt };
}

export function getSessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax`;
}

export function getClearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function isSessionCookieValid(cookieHeader = '', sessions) {
  const cookies = Object.fromEntries(
    cookieHeader
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf('=');
        return index === -1 ? [item, ''] : [item.slice(0, index), item.slice(index + 1)];
      }),
  );
  const token = cookies[SESSION_COOKIE];
  if (!token) return false;

  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

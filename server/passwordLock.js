import { timingSafeEqual } from 'node:crypto';

export function getClientIp(req, { trustedProxyHops = 0 } = {}) {
  const remoteAddress = req.socket?.remoteAddress || 'unknown';
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops <= 0) {
    return remoteAddress;
  }

  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded !== 'string' || !forwarded.trim()) return remoteAddress;

  const chain = [
    ...forwarded.split(',').map((item) => item.trim()).filter(Boolean),
    remoteAddress,
  ];
  return chain[Math.max(chain.length - trustedProxyHops - 1, 0)] || remoteAddress;
}

function safePasswordEqual(inputPassword, expectedPassword) {
  const input = Buffer.from(String(inputPassword || ''));
  const expected = Buffer.from(String(expectedPassword || ''));
  if (input.length !== expected.length) return false;
  return timingSafeEqual(input, expected);
}

export function createPasswordAttemptLimiter({ maxAttempts = 5, lockMs = 24 * 60 * 60 * 1000, now = () => Date.now() } = {}) {
  const attempts = new Map();

  function getFreshState(ip) {
    const current = attempts.get(ip) || { failures: 0, lockedUntil: null };
    if (current.lockedUntil && current.lockedUntil <= now()) {
      attempts.delete(ip);
      return { failures: 0, lockedUntil: null };
    }
    return current;
  }

  return {
    getStatus(ip) {
      const state = getFreshState(ip);
      const locked = Boolean(state.lockedUntil && state.lockedUntil > now());
      return {
        locked,
        remainingAttempts: locked ? 0 : Math.max(maxAttempts - state.failures, 0),
        lockedUntil: locked ? state.lockedUntil : null,
      };
    },

    recordFailure(ip) {
      const state = getFreshState(ip);
      const failures = state.failures + 1;
      const lockedUntil = failures >= maxAttempts ? now() + lockMs : null;
      attempts.set(ip, { failures, lockedUntil });
      return this.getStatus(ip);
    },

    clear(ip) {
      attempts.delete(ip);
    },
  };
}

export function verifyProtectedPassword({ limiter, ip, inputPassword, expectedPassword }) {
  const status = limiter.getStatus(ip);
  if (status.locked) {
    return { ok: false, ...status };
  }

  if (safePasswordEqual(inputPassword, expectedPassword)) {
    limiter.clear(ip);
    return { ok: true, ...limiter.getStatus(ip) };
  }

  return { ok: false, ...limiter.recordFailure(ip) };
}

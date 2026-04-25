import assert from 'node:assert/strict';
import {
  createPasswordAttemptLimiter,
  getClientIp,
  verifyProtectedPassword,
} from './passwordLock.js';

let now = 1000;
const limiter = createPasswordAttemptLimiter({
  maxAttempts: 3,
  lockMs: 100,
  now: () => now,
});

assert.deepEqual(limiter.getStatus('1.2.3.4'), { locked: false, remainingAttempts: 3, lockedUntil: null });

assert.deepEqual(verifyProtectedPassword({ limiter, ip: '1.2.3.4', inputPassword: 'bad', expectedPassword: 'secret' }), {
  ok: false,
  locked: false,
  remainingAttempts: 2,
  lockedUntil: null,
});

assert.equal(verifyProtectedPassword({ limiter, ip: '1.2.3.4', inputPassword: 'bad', expectedPassword: 'secret' }).remainingAttempts, 1);

const locked = verifyProtectedPassword({ limiter, ip: '1.2.3.4', inputPassword: 'bad', expectedPassword: 'secret' });
assert.equal(locked.ok, false);
assert.equal(locked.locked, true);
assert.equal(locked.lockedUntil, 1100);

const stillLocked = verifyProtectedPassword({ limiter, ip: '1.2.3.4', inputPassword: 'secret', expectedPassword: 'secret' });
assert.equal(stillLocked.ok, false);
assert.equal(stillLocked.locked, true);

now = 1101;
assert.equal(verifyProtectedPassword({ limiter, ip: '1.2.3.4', inputPassword: 'secret', expectedPassword: 'secret' }).ok, true);
assert.deepEqual(limiter.getStatus('1.2.3.4'), { locked: false, remainingAttempts: 3, lockedUntil: null });

verifyProtectedPassword({ limiter, ip: '5.6.7.8', inputPassword: 'bad', expectedPassword: 'secret' });
assert.equal(verifyProtectedPassword({ limiter, ip: '5.6.7.8', inputPassword: 'secret', expectedPassword: 'secret' }).ok, true);
assert.equal(limiter.getStatus('5.6.7.8').remainingAttempts, 3);

assert.equal(getClientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 8.8.8.8' }, socket: { remoteAddress: '127.0.0.1' } }), '9.9.9.9');
assert.equal(getClientIp({ headers: {}, socket: { remoteAddress: '::1' } }), '::1');

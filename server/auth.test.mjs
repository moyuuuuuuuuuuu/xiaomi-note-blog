import assert from 'node:assert/strict';
import {
  createSession,
  getSessionCookie,
  isSessionCookieValid,
  verifyAdminPassword,
} from './auth.js';

assert.equal(verifyAdminPassword('secret', 'secret'), true);
assert.equal(verifyAdminPassword('wrong', 'secret'), false);
assert.equal(verifyAdminPassword('anything', ''), false);

const sessions = new Map();
const session = createSession(sessions, 1000);
assert.equal(typeof session.token, 'string');
assert.equal(session.token.length > 20, true);

const cookieHeader = getSessionCookie(session.token);
assert.match(cookieHeader, /HttpOnly/);
assert.match(cookieHeader, /SameSite=Lax/);

assert.equal(isSessionCookieValid(`xiao_admin_session=${session.token}`, sessions), true);
assert.equal(isSessionCookieValid('xiao_admin_session=missing', sessions), false);

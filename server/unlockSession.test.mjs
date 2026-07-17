import assert from 'node:assert/strict';
import {
  createUnlockSessionStore,
  getUnlockSessionCookie,
} from './unlockSession.js';

let time = 1000;
let tokenIndex = 0;
const sessions = createUnlockSessionStore({
  ttlMs: 100,
  now: () => time,
  tokenFactory: () => `token-${++tokenIndex}`,
});

const firstGrant = sessions.grant({
  cookieHeader: '',
  ip: '127.0.0.1',
  scope: 'folder:Work',
});
assert.equal(firstGrant.token, 'token-1');
assert.match(getUnlockSessionCookie(firstGrant.token), /HttpOnly/);
assert.match(getUnlockSessionCookie(firstGrant.token), /SameSite=Lax/);

const cookieHeader = 'theme=light; xiao_note_unlock=token-1';
assert.equal(
  sessions.has({ cookieHeader, ip: '127.0.0.1', scope: 'folder:Work' }),
  true,
);
assert.equal(
  sessions.has({ cookieHeader, ip: '127.0.0.2', scope: 'folder:Work' }),
  false,
);

time = 1050;
const secondGrant = sessions.grant({
  cookieHeader,
  ip: '127.0.0.1',
  scope: 'note:n1',
});
assert.equal(secondGrant.token, 'token-1');
assert.equal(
  sessions.has({ cookieHeader, ip: '127.0.0.1', scope: 'folder:Work' }),
  true,
);
assert.equal(
  sessions.has({ cookieHeader, ip: '127.0.0.1', scope: 'note:n1' }),
  true,
);

time = 1151;
assert.equal(
  sessions.has({ cookieHeader, ip: '127.0.0.1', scope: 'folder:Work' }),
  false,
);

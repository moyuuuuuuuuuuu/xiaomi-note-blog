import assert from 'node:assert/strict';
import { getXiaomiSyncCookie } from './settings.js';

assert.equal(
  getXiaomiSyncCookie({ miCookie: ' serviceToken=from-mi-cookie ', authCookie: 'serviceToken=from-auth-cookie' }),
  'serviceToken=from-mi-cookie',
);

assert.equal(
  getXiaomiSyncCookie({ miCookie: '', authCookie: ' userId=123; serviceToken=abc ' }),
  'userId=123; serviceToken=abc',
);

assert.equal(
  getXiaomiSyncCookie({ miCookie: '', authCookie: 'local-login-token' }),
  '',
);

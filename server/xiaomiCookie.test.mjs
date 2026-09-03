import assert from 'node:assert/strict';
import { checkXiaomiCookie, mergeCookieHeader } from './xiaomiCookie.js';

assert.equal(
  mergeCookieHeader('userId=1; serviceToken=old; keep=yes', [
    'serviceToken=new; Path=/; HttpOnly',
    'obsolete=; Max-Age=0; Path=/',
  ]),
  'userId=1; serviceToken=new; keep=yes',
);

const requests = [];
const result = await checkXiaomiCookie('userId=1; serviceToken=old', {
  url: 'https://i.mi.com/check',
  fetcher: async (url, options) => {
    requests.push({ url, cookie: options.headers.cookie, redirect: options.redirect });
    if (requests.length === 1) {
      return new Response(null, {
        status: 302,
        headers: {
          location: 'https://s010.i.mi.com/check',
          'set-cookie': 'serviceToken=new; Path=/; HttpOnly',
        },
      });
    }
    return new Response(JSON.stringify({ data: { entries: [] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  },
});

assert.deepEqual(result, { cookie: 'userId=1; serviceToken=new', refreshed: true });
assert.equal(requests[1].cookie, 'userId=1; serviceToken=new');
assert.equal(requests[0].redirect, 'manual');

await assert.rejects(
  () => checkXiaomiCookie('expired', {
    fetcher: async () => new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  }),
  /Cookie 已失效/,
);

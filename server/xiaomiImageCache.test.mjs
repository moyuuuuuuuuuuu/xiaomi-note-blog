import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createXiaomiImageCache,
  extractXiaomiImageFileIds,
  warmXiaomiImageCache,
} from './xiaomiImageCache.js';

const dataDir = await mkdtemp(join(tmpdir(), 'xiaominote-image-cache-'));

try {
  assert.deepEqual(
    extractXiaomiImageFileIds('A ![图片](/api/xiaomi-image/1467191683.2fOcCzWhjDJQdHZ_IyKyPw) B'),
    ['1467191683.2fOcCzWhjDJQdHZ_IyKyPw'],
  );
  assert.deepEqual(
    extractXiaomiImageFileIds('![图片](/api/xiaomi-image/a%20b) ![图片](/api/xiaomi-image/a%20b)'),
    ['a b'],
  );

  const cache = createXiaomiImageCache(dataDir);
  assert.equal(await cache.read('missing'), null);

  await cache.write('image.1', {
    contentType: 'image/jpeg',
    body: Buffer.from('jpeg-body'),
  });

  const cached = await cache.read('image.1');
  assert.equal(cached.contentType, 'image/jpeg');
  assert.equal(cached.body.toString(), 'jpeg-body');

  const fetched = [];
  const failures = await warmXiaomiImageCache({
    notes: [
      { content: '![图片](/api/xiaomi-image/image.1)' },
      { content: '![图片](/api/xiaomi-image/image.2)' },
    ],
    cache,
    cookie: 'serviceToken=ok',
    fetchImage: async (_cookie, fileId) => {
      fetched.push(fileId);
      return {
        contentType: 'image/png',
        body: Buffer.from(`body:${fileId}`),
      };
    },
  });

  assert.deepEqual(failures, []);
  assert.deepEqual(fetched, ['image.2']);
  assert.equal((await cache.read('image.2')).body.toString(), 'body:image.2');
} finally {
  await rm(dataDir, { recursive: true, force: true });
}

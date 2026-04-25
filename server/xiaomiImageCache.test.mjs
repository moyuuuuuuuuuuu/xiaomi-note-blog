import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createXiaomiImageCache,
  extractXiaomiImageFileIds,
  prepareSyncedNotesWithImageCache,
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

  const prepared = await prepareSyncedNotesWithImageCache({
    notes: [
      { id: 'note-a', content: 'first ![图片](/api/xiaomi-image/image.3)' },
      { id: 'note-b', content: 'second ![图片](/api/xiaomi-image/image.4)' },
    ],
    cache,
    cookie: 'serviceToken=ok',
    fetchImage: async (_cookie, fileId) => ({
      contentType: 'image/jpeg',
      body: Buffer.from(`cached:${fileId}`),
    }),
    now: 1000,
  });

  assert.equal(prepared.failures.length, 0);
  assert.match(prepared.notes[0].content, /\/api\/images\//);
  assert.doesNotMatch(prepared.notes[0].content, /\/api\/xiaomi-image\//);
  const image3 = await cache.read('image.3');
  assert.equal(image3.body.toString(), 'cached:image.3');
  assert.deepEqual((await cache.readMeta('image.3')).referencedBy, ['note-a']);
  assert.deepEqual((await cache.readMeta('image.4')).referencedBy, ['note-b']);

  const swapped = await prepareSyncedNotesWithImageCache({
    notes: [
      { id: 'note-a', content: 'updated ![图片](/api/xiaomi-image/image.4)' },
    ],
    cache,
    cookie: 'serviceToken=ok',
    fetchImage: async () => {
      throw new Error('should use cached image');
    },
    now: 2000,
  });

  assert.equal(swapped.failures.length, 0);
  assert.deepEqual((await cache.readMeta('image.4')).referencedBy, ['note-a']);
  assert.equal((await cache.readMeta('image.4')).orphanedAt, null);
  assert.deepEqual((await cache.readMeta('image.3')).referencedBy, []);
  assert.equal((await cache.readMeta('image.3')).orphanedAt, 2000);

  await cache.updateReferences([{ id: 'legacy-note', content: 'legacy ![图片](/api/xiaomi-image/image.3)' }], { now: 2500 });
  assert.deepEqual((await cache.readMeta('image.3')).referencedBy, ['legacy-note']);
  assert.equal((await cache.readMeta('image.3')).orphanedAt, null);

  const failed = await prepareSyncedNotesWithImageCache({
    notes: [
      { id: 'note-c', content: 'missing ![图片](/api/xiaomi-image/image.5)' },
    ],
    cache,
    cookie: 'expired',
    fetchImage: async () => {
      throw new Error('HTTP 401');
    },
    now: 3000,
  });

  assert.equal(failed.failures.length, 1);
  assert.match(failed.notes[0].content, /\/api\/xiaomi-image\/image\.5/);

  await cache.updateReferences([], { now: 3000 + 30 * 24 * 60 * 60 * 1000, orphanRetentionMs: 30 * 24 * 60 * 60 * 1000 });
  assert.equal(await cache.read('image.3'), null);
  assert.equal(await cache.read('image.4'), null);
} finally {
  await rm(dataDir, { recursive: true, force: true });
}

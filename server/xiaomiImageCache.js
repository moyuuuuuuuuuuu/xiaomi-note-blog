import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function getImageCacheKey(fileId) {
  return Buffer.from(fileId).toString('base64url');
}

export function extractXiaomiImageFileIds(content = '') {
  const ids = new Set();
  const pattern = /\/api\/xiaomi-image\/([^)\s]+)/g;
  let match;

  while ((match = pattern.exec(content))) {
    try {
      ids.add(decodeURIComponent(match[1]));
    } catch {
      ids.add(match[1]);
    }
  }

  return [...ids];
}

export function createXiaomiImageCache(dataDir) {
  const imageDir = join(dataDir, 'xiaomi-images');

  function getPaths(fileId) {
    const key = getImageCacheKey(fileId);
    return {
      bodyPath: join(imageDir, `${key}.bin`),
      metaPath: join(imageDir, `${key}.json`),
    };
  }

  return {
    async read(fileId) {
      const paths = getPaths(fileId);
      try {
        const [body, rawMeta] = await Promise.all([
          readFile(paths.bodyPath),
          readFile(paths.metaPath, 'utf8'),
        ]);
        const meta = JSON.parse(rawMeta);
        if (!meta.contentType?.startsWith('image/')) return null;
        return {
          contentType: meta.contentType,
          body,
        };
      } catch {
        return null;
      }
    },

    async write(fileId, image) {
      await mkdir(imageDir, { recursive: true });
      const paths = getPaths(fileId);
      await Promise.all([
        writeFile(paths.bodyPath, image.body),
        writeFile(paths.metaPath, JSON.stringify({
          contentType: image.contentType,
          cachedAt: Date.now(),
        })),
      ]);
    },
  };
}

export async function warmXiaomiImageCache({ notes, cache, cookie, fetchImage }) {
  const fileIds = new Set();
  for (const note of notes) {
    for (const fileId of extractXiaomiImageFileIds(note.content || '')) {
      fileIds.add(fileId);
    }
  }

  const failures = [];
  for (const fileId of fileIds) {
    if (await cache.read(fileId)) continue;
    try {
      const image = await fetchImage(cookie, fileId);
      await cache.write(fileId, image);
    } catch (error) {
      failures.push({
        fileId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return failures;
}

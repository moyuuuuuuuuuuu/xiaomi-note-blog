import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_ORPHAN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function getImageCacheKey(fileId) {
  return Buffer.from(fileId).toString('base64url');
}

function fileIdFromCacheKey(cacheKey) {
  return Buffer.from(cacheKey, 'base64url').toString('utf8');
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

function replaceCachedImageUrls(content, cachedFileIds) {
  return content.replace(/\/api\/xiaomi-image\/([^)\s]+)/g, (raw, encodedFileId) => {
    let fileId = encodedFileId;
    try {
      fileId = decodeURIComponent(encodedFileId);
    } catch {
      // Keep the raw value if decoding fails.
    }

    if (!cachedFileIds.has(fileId)) return raw;
    return `/api/images/${getImageCacheKey(fileId)}`;
  });
}

function extractLocalImageCacheKeys(content = '') {
  const keys = new Set();
  const pattern = /\/api\/images\/([^)\s]+)/g;
  let match;

  while ((match = pattern.exec(content))) {
    keys.add(match[1]);
  }

  return [...keys];
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

  function getPathsByKey(key) {
    return {
      bodyPath: join(imageDir, `${key}.bin`),
      metaPath: join(imageDir, `${key}.json`),
    };
  }

  async function readMetaByKey(key) {
    try {
      const rawMeta = await readFile(getPathsByKey(key).metaPath, 'utf8');
      return JSON.parse(rawMeta);
    } catch {
      return null;
    }
  }

  async function writeMetaByKey(key, meta) {
    await mkdir(imageDir, { recursive: true });
    await writeFile(getPathsByKey(key).metaPath, JSON.stringify(meta));
  }

  return {
    async read(fileId) {
      return this.readByKey(getImageCacheKey(fileId));
    },

    async readByKey(key) {
      const paths = getPathsByKey(key);
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

    async readMeta(fileId) {
      return readMetaByKey(getImageCacheKey(fileId));
    },

    async write(fileId, image) {
      await mkdir(imageDir, { recursive: true });
      const paths = getPaths(fileId);
      const existingMeta = await readMetaByKey(getImageCacheKey(fileId));
      await Promise.all([
        writeFile(paths.bodyPath, image.body),
        writeFile(paths.metaPath, JSON.stringify({
          sourceFileId: fileId,
          contentType: image.contentType,
          cachedAt: existingMeta?.cachedAt || Date.now(),
          lastReferencedAt: existingMeta?.lastReferencedAt || null,
          orphanedAt: existingMeta?.orphanedAt ?? null,
          referencedBy: existingMeta?.referencedBy || [],
        })),
      ]);
    },

    async updateReferences(notes, { now = Date.now(), orphanRetentionMs = DEFAULT_ORPHAN_RETENTION_MS } = {}) {
      await mkdir(imageDir, { recursive: true });
      const files = await readdir(imageDir).catch(() => []);
      const metaKeys = files
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.slice(0, -'.json'.length));
      const referencesByKey = new Map();

      for (const note of notes) {
        for (const key of extractLocalImageCacheKeys(note.content || '')) {
          const references = referencesByKey.get(key) || new Set();
          references.add(String(note.id || ''));
          referencesByKey.set(key, references);
        }
        for (const fileId of extractXiaomiImageFileIds(note.content || '')) {
          const key = getImageCacheKey(fileId);
          const references = referencesByKey.get(key) || new Set();
          references.add(String(note.id || ''));
          referencesByKey.set(key, references);
        }
      }

      for (const key of metaKeys) {
        const meta = await readMetaByKey(key);
        if (!meta) continue;

        const referencedBy = [...(referencesByKey.get(key) || [])].filter(Boolean).sort();
        const nextMeta = {
          ...meta,
          sourceFileId: meta.sourceFileId || fileIdFromCacheKey(key),
          referencedBy,
          lastReferencedAt: referencedBy.length > 0 ? now : meta.lastReferencedAt || null,
          orphanedAt: referencedBy.length > 0 ? null : meta.orphanedAt || now,
        };

        if (
          referencedBy.length === 0
          && nextMeta.orphanedAt
          && now - nextMeta.orphanedAt >= orphanRetentionMs
        ) {
          await Promise.all([
            rm(getPathsByKey(key).bodyPath, { force: true }),
            rm(getPathsByKey(key).metaPath, { force: true }),
          ]);
          continue;
        }

        await writeMetaByKey(key, nextMeta);
      }
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

export async function prepareSyncedNotesWithImageCache({
  notes,
  cache,
  cookie,
  fetchImage,
  now = Date.now(),
  orphanRetentionMs = DEFAULT_ORPHAN_RETENTION_MS,
  updateReferences = true,
}) {
  const cachedFileIds = new Set();
  const failures = await warmXiaomiImageCache({ notes, cache, cookie, fetchImage });

  for (const note of notes) {
    for (const fileId of extractXiaomiImageFileIds(note.content || '')) {
      if (await cache.read(fileId)) cachedFileIds.add(fileId);
    }
  }

  const preparedNotes = notes.map((note) => ({
    ...note,
    content: replaceCachedImageUrls(note.content || '', cachedFileIds),
  }));

  if (updateReferences) {
    await cache.updateReferences(preparedNotes, { now, orphanRetentionMs });
  }

  return {
    notes: preparedNotes,
    failures,
  };
}

import assert from 'node:assert/strict';
import { normalizeXiaomiNote, syncXiaomiNotes } from './xiaomiNotes.js';

const folders = {
  '10': 'work_notes',
};

const note = normalizeXiaomiNote(
  {
    id: 123,
    createDate: 1000,
    modifyDate: 2000,
    folderId: 10,
    snippet: 'Fallback title\nbody',
    content: '<new-format/><text indent="1">Hello</text>\n<input type="checkbox" checked="true" />Done',
    extraInfo: JSON.stringify({ title: 'Real Title' }),
  },
  folders,
);

assert.deepEqual(note, {
  id: '123',
  title: 'Real Title',
  content: 'Hello\n- [x] Done',
  createTime: 1000,
  modifyTime: 2000,
  folder: 'work_notes',
});

const imageNote = normalizeXiaomiNote(
  {
    id: 'image-note',
    createDate: 1,
    modifyDate: 2,
    content: '<new-format/><text indent="1">Before</text>\n<img src="https://example.com/a.jpg" />\n<text indent="1">After</text>',
    extraInfo: '{}',
  },
  {},
);

assert.equal(imageNote.content, 'Before\n![图片](https://example.com/a.jpg)\nAfter');

const webLinkNote = normalizeXiaomiNote(
  {
    id: 'web-link-note',
    createDate: 1,
    modifyDate: 2,
    content: '<new-format/><a href="https://www.filemail.com/d/example?id=1&amp;source=note"><text indent="1">网页链接</text></a>',
    extraInfo: '{}',
  },
  {},
);

assert.equal(
  webLinkNote.content,
  '[网页链接](https://www.filemail.com/d/example?id=1&source=note)',
);
assert.equal(webLinkNote.title, '网页链接');

const legacyImageNote = normalizeXiaomiNote(
  {
    id: 'legacy-image-note',
    createDate: 1,
    modifyDate: 2,
    content: '☺ 1467191683.2fOcCzWhjDJQdHZ_IyKyPw',
    extraInfo: '{}',
  },
  {},
);

assert.equal(
  legacyImageNote.content,
  '![图片](/api/xiaomi-image/1467191683.2fOcCzWhjDJQdHZ_IyKyPw)',
);

const requestedUrls = [];
const synced = await syncXiaomiNotes({
  cookie: 'serviceToken=abc',
  fetcher: async (url) => {
    requestedUrls.push(url.toString());
    if (url.searchParams.get('syncTag') === '') {
      return {
        ok: true,
        json: async () => ({
          data: {
            entries: [{ id: '1', createDate: 1, modifyDate: 2, folderId: 0, snippet: 'A', extraInfo: '{}' }],
            folders: [],
            lastPage: false,
            syncTag: 'next-page',
          },
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        data: {
          entries: [{ id: '2', createDate: 3, modifyDate: 4, folderId: 0, snippet: 'B', extraInfo: '{}' }],
          folders: [],
          lastPage: true,
          syncTag: '',
        },
      }),
    };
  },
});

assert.equal(requestedUrls.length, 2);
assert.equal(new URL(requestedUrls[1]).searchParams.get('syncTag'), 'next-page');
assert.deepEqual(synced.notes.map((item) => item.id), ['1', '2']);

await assert.rejects(
  () => syncXiaomiNotes({ cookie: '', fetcher: async () => ({ ok: true, json: async () => ({}) }) }),
  /小米云 Cookie/,
);

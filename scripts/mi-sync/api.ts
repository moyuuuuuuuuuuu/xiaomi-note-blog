import type { NoteDetailResponse, NoteListResponse } from "./typing";
import { saveImage } from "./utils";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0";

async function get<T>(url: string, cookie: string): Promise<T | undefined> {
  try {
    const res = await fetch(url, {
      headers: {
        cookie,
        referrer: "https://i.mi.com/note/h5",
        "user-agent": USER_AGENT,
      },
    });

    if (
      res.status === 401 &&
      res.url.startsWith("https://s010.i.mi.com")
    ) {
      // 自动重试
      const retryRes = await fetch(url, {
        headers: {
          cookie,
          "user-agent": USER_AGENT,
        },
      });
      return (await retryRes.json()) as T;
    }

    return (await res.json()) as T;
  } catch (e) {
    console.error("❌ 网络异常：", e);
    return undefined;
  }
}

async function downloadFile(
  url: string,
  cookie: string
): Promise<Buffer | undefined> {
  try {
    const res = await fetch(url, {
      headers: {
        cookie,
        referrer: "https://i.mi.com/note/h5",
        "user-agent": USER_AGENT,
      },
    });
    if (!res.ok) {
      console.error(`❌ 下载失败: ${res.status} ${res.statusText}`);
      return undefined;
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    console.error("❌ 下载异常：", e);
    return undefined;
  }
}

export async function getNoteList(
  cookie: string,
  syncTag?: string,
  limit = 200
) {
  const res = await get<NoteListResponse>(
    `https://i.mi.com/note/full/page/?ts=${Date.now()}&limit=${limit}&syncTag=${syncTag || ""}`,
    cookie
  );

  if (!res?.data?.entries) {
    const divider =
      "-----------------------------------------------------------------------";
    const tips = `\n${divider}\n👉 获取 Cookie 教程: https://github.com/idootop/mi-note-export/issues/4\n${divider}`;
    if (!cookie || cookie.startsWith("xxx") || cookie === "123") {
      throw new Error(
        `❌ Cookie 未设置，请在 data/settings.json 中设置 miCookie 后重试。${tips}`
      );
    }
    throw new Error(
      `❌ 获取笔记列表失败\n当前 Cookie 无效或已过期，请更新 Cookie 后重试。${tips}`
    );
  }

  const folders: Record<string, string> = { "0": "未分类" };
  for (const folder of res.data.folders) {
    folders[folder.id] = folder.subject;
  }

  return {
    syncTag: res.data.lastPage ? undefined : res.data.syncTag,
    entries: res.data.entries,
    folders,
  };
}

export async function getNoteDetail(id: string, cookie: string) {
  const res = await get<NoteDetailResponse>(
    `https://i.mi.com/note/note/${id}/?ts=${Date.now()}`,
    cookie
  );
  if (!res?.data?.entry) {
    throw new Error(`获取笔记详情失败 ${id}`);
  }
  return res.data.entry;
}

export async function downloadImage(
  fileId: string,
  mimeType: string,
  cookie: string
): Promise<boolean> {
  const url = `https://i.mi.com/file/full?fileid=${fileId}&type=note_img`;
  const buffer = await downloadFile(url, cookie);
  if (!buffer) {
    return false;
  }
  await saveImage(fileId, mimeType, buffer);
  return true;
}

import * as fs from "node:fs";
import { getNoteDetail, getNoteList, downloadImage } from "./api";
import {
  createEmptyState,
  loadState,
  saveState,
  type SyncState,
} from "./state";
import type { NoteDetail, NoteEntry, ProjectNote } from "./typing";
import {
  NOTES_PATH,
  SETTINGS_PATH,
  parseNoteRawData,
  noteToProjectNote,
  imageExists,
  ensureDir,
} from "./utils";

async function getNoteEntries(cookie: string, limit = 200) {
  console.log("🔥 获取笔记列表中...");
  let entries: NoteEntry[] = [];
  let folders: Record<string, string> = { "0": "未分类" };
  let syncTag: string | undefined = "";
  while (syncTag != null) {
    const res = await getNoteList(cookie, syncTag, limit);
    syncTag = res.syncTag;
    entries = [...entries, ...res.entries];
    folders = { ...folders, ...res.folders };
    console.log(`🚗 已获取 ${entries.length} 条笔记...`);
  }
  return { entries, folders };
}

export async function syncNotes() {
  // 1. 读取 settings.json 获取 Cookie
  if (!fs.existsSync(SETTINGS_PATH)) {
    throw new Error(
      `❌ 未找到设置文件: ${SETTINGS_PATH}\n请先创建并配置 miCookie。`
    );
  }

  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  const cookie = settings.miCookie as string | undefined;

  if (!cookie || cookie === "123" || cookie.startsWith("xxx")) {
    throw new Error(
      `❌ 请在 data/settings.json 中设置有效的 miCookie\n👉 获取 Cookie 教程: https://github.com/idootop/mi-note-export/issues/4`
    );
  }

  // 2. 加载同步状态
  let state = await loadState();
  if (!state) {
    state = createEmptyState();
    console.log("🚗 开始同步笔记");
  } else {
    console.log("♻️ 检测到之前的同步记录，将进行增量更新");
    console.log(`📊 已有 ${Object.keys(state.notes).length} 条笔记`);
  }

  // 3. 获取最新笔记列表
  const { entries, folders } = await getNoteEntries(cookie);

  // 4. 清理已删除的笔记
  await updateNotes(state, entries);

  // 5. 更新文件夹信息
  state.folders = folders;

  // 6. 筛选需要同步的笔记（新增或修改的）
  const toSync: NoteEntry[] = [];
  let skipped = 0;

  for (const entry of entries) {
    const parsed = parseNoteRawData(entry, folders);
    const existingNote = state.notes[parsed.id];
    if (!existingNote || existingNote.modifyDate < parsed.modifyDate) {
      toSync.push(entry);
    } else {
      skipped++;
    }
  }

  if (toSync.length > 0) {
    console.log(`🔥 需要同步 ${toSync.length} 条笔记`);
  }
  if (skipped > 0) {
    console.log(`⏭️  跳过 ${skipped} 条未修改的笔记`);
  }

  // 7. 同步笔记详情
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < toSync.length; i++) {
    const entry = toSync[i];
    if (!entry) continue;
    const progress = (((i + 1) / toSync.length) * 100).toFixed(2);
    console.log(
      `🔥 正在同步第 ${i + 1}/${toSync.length} 条笔记 (${progress}%)...`
    );

    try {
      // 获取笔记详情
      const rawDetail = await getNoteDetail(entry.id, cookie);
      const note = parseNoteRawData(rawDetail, folders);

      // 下载附件
      if (note.files && note.files.length > 0) {
        for (const file of note.files) {
          if (!imageExists(file.rawId)) {
            console.log(`  📎 下载附件: ${file.name}`);
            const success = await downloadImage(
              file.rawId,
              file.type + "/" + file.suffix,
              cookie
            );
            if (!success) {
              console.warn(`  ⚠️  下载附件失败: ${file.rawId}`);
            }
          }
        }
      }

      // 更新状态
      state.notes[note.id] = note;
      synced++;

      // 每同步 10 条保存一次状态
      if ((i + 1) % 10 === 0) {
        state.lastSyncTime = Date.now();
        await saveState(state);
      }
    } catch (e) {
      console.error(`❌ 同步笔记 ${entry.id} 失败:`, e);
      failed++;
    }
  }

  // 8. 保存最终状态
  state.lastSyncTime = Date.now();
  await saveState(state);

  // 9. 输出 notes.json
  await outputNotesJson(state, folders);

  // 10. 输出统计
  console.log("\n✅ 同步完毕");
  console.log(`  - 总笔记数: ${entries.length}`);
  console.log(`  - 本次同步: ${synced}`);
  if (skipped > 0) {
    console.log(`  - 跳过: ${skipped}`);
  }
  if (failed > 0) {
    console.log(`  - 失败: ${failed}`);
  }
}

async function updateNotes(
  state: SyncState,
  entries: NoteEntry[]
): Promise<void> {
  const currentNoteIds = new Set(entries.map((e) => e.id.toString()));
  const deletedNotes: string[] = [];

  for (const noteId of Object.keys(state.notes)) {
    if (!currentNoteIds.has(noteId)) {
      deletedNotes.push(noteId);
    }
  }

  if (deletedNotes.length > 0) {
    console.log(`🗑️ 清理 ${deletedNotes.length} 个已删除的笔记`);
    for (const noteId of deletedNotes) {
      delete state.notes[noteId];
    }
  }
}

async function outputNotesJson(
  state: SyncState,
  folders: Record<string, string>
): Promise<void> {
  ensureDir(NOTES_PATH.replace(/\/[^/]+$/, ""));

  const notes: ProjectNote[] = [];
  for (const note of Object.values(state.notes)) {
    notes.push(noteToProjectNote(note, folders));
  }

  // 按修改时间倒序排列
  notes.sort((a, b) => b.modifyTime - a.modifyTime);

  await fs.promises.writeFile(NOTES_PATH, JSON.stringify(notes, null, 2));
  console.log(`📝 已保存 ${notes.length} 条笔记到 ${NOTES_PATH}`);
}

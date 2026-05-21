import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { NoteDetail, NoteEntry, NoteFile, ProjectNote } from "./typing";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, "../..");
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const IMAGES_DIR = path.join(DATA_DIR, "xiaomi-images");
export const NOTES_PATH = path.join(DATA_DIR, "notes.json");
export const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
export const STATE_PATH = path.join(DATA_DIR, "sync-state.json");

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseNoteFiles(note: NoteEntry): NoteFile[] {
  const files = note.setting?.data ?? [];
  const result: NoteFile[] = [];
  for (const file of files) {
    const date = formatDate(note.createDate);
    const id = file.fileId.split(".")[1] ?? file.fileId;
    const type = file.mimeType.split("/")[0] ?? "file";
    const suffix = file.mimeType.split("/")[1] ?? "bin";
    const name = `${type}_${date}_${id}.${suffix}`;
    result.push({ name, id, type, suffix, rawId: file.fileId });
  }
  return result;
}

export function sanitizePath(filename: string): string {
  return filename
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
}

export function parseNoteRawData(
  _note: NoteEntry,
  _folders?: Record<string, string>
): NoteDetail {
  const note = _note as NoteDetail;
  let extraInfo: NoteExtraInfo = {};
  try {
    extraInfo =
      typeof note.extraInfo === "string"
        ? JSON.parse(note.extraInfo)
        : note.extraInfo ?? {};
  } catch {
    extraInfo = {};
  }
  note.id = note.id.toString();
  note.folderId = note.folderId.toString();
  note.extraInfo = extraInfo;
  if (!note.content) {
    note.content = note.snippet;
  }
  if (extraInfo.mind_content) {
    note.content = extraInfo.mind_content;
  }
  note.subject =
    extraInfo.title || note.content.split("\n")[0].slice(0, 50) || "未命名";
  if (note.setting?.data) {
    note.files = parseNoteFiles(note);
  } else {
    note.files = [];
  }
  return note;
}

export function noteToProjectNote(
  note: NoteDetail,
  folders: Record<string, string>
): ProjectNote {
  let content = convertNoteContent(note);

  const folderName = folders[note.folderId];

  const result: ProjectNote = {
    id: note.id,
    title: note.subject,
    content,
    createTime: note.createDate,
    modifyTime: note.modifyDate,
  };

  if (folderName && folderName !== "未分类") {
    result.folder = folderName;
  }

  return result;
}

function convertNoteContent(note: NoteDetail): string {
  let content = note.content;

  // 1. 去掉 <new-format/> 标签
  content = content.replace(/<new-format\s*\/>/g, "");

  // 2. 处理分割线
  content = content.replace(/<hr\s*\/>/g, "---");

  // 3. 处理引用块
  content = content.replace(/<quote>(.*?)<\/quote>/gs, "> $1");

  // 4. 处理文本样式标签
  content = content.replace(/<b>(.*?)<\/b>/g, "**$1**");
  content = content.replace(/<i>(.*?)<\/i>/g, "*$1*");
  content = content.replace(/<u>(.*?)<\/u>/g, "<u>$1</u>");
  content = content.replace(/<delete>(.*?)<\/delete>/g, "~~$1~~");

  // 5. 处理对齐标签
  content = content.replace(
    /<center>(.*?)<\/center>/g,
    "<center>$1</center>"
  );
  content = content.replace(
    /<left>(.*?)<\/left>/g,
    '<div align="left">$1</div>'
  );
  content = content.replace(
    /<right>(.*?)<\/right>/g,
    '<div align="right">$1</div>'
  );

  // 6. 处理背景色
  content = content.replace(
    /<background color="([^"]+)">(.*?)<\/background>/g,
    (_, color, text) => {
      const hex = `#${color.slice(3)}${color.slice(1, 3)}`;
      return `<span style="background-color: ${hex};">${text}</span>`;
    }
  );

  // 7. 处理字体大小标签
  content = content.replace(/<size>(.*?)<\/size>/g, "# $1");
  content = content.replace(/<mid-size>(.*?)<\/mid-size>/g, "## $1");
  content = content.replace(/<h3-size>(.*?)<\/h3-size>/g, "### $1");

  // 8. 处理有序列表
  content = content.replace(
    /<order indent="(\d+)" inputNumber="\d+" \/>/g,
    (_, indentStr) => {
      const indentCount = parseInt(indentStr, 10) - 1;
      const spaces = "  ".repeat(indentCount);
      return `${spaces}- `;
    }
  );

  // 9. 处理无序列表
  content = content.replace(
    /<bullet indent="(\d+)" \/>/g,
    (_, indentStr) => {
      const indentCount = parseInt(indentStr, 10) - 1;
      const spaces = "  ".repeat(indentCount);
      return `${spaces}- `;
    }
  );

  // 10. 处理复选框
  content = content.replace(
    /<input type="checkbox" indent="(\d+)" level="\d+"(?: checked="true")? \/>/g,
    (match, indentStr) => {
      const indentCount = parseInt(indentStr, 10) - 1;
      const spaces = "  ".repeat(indentCount);
      const checked = match.includes('checked="true"') ? "x" : " ";
      return `${spaces}- [${checked}] `;
    }
  );

  // 11. 处理文件（图片、音频、视频）
  for (const file of note.files ?? []) {
    // 优先使用本地路径，如果本地不存在则使用远程 URL
    const localExists = imageExists(file.rawId);
    const imagePath = localExists
      ? `/data/xiaomi-images/${Buffer.from(file.rawId).toString("base64")}.bin`
      : `https://i.mi.com/file/full?fileid=${file.rawId}&type=note_img`;

    // 处理图片
    content = content.replace(
      new RegExp(`<img fileid="${file.rawId}"[^>]*>`, "g"),
      `![图片](${imagePath})`
    );

    // 处理音频
    content = content.replace(
      new RegExp(`<sound fileid="${file.rawId}"[^>]*>`, "g"),
      `[🎵 ${file.name}](${imagePath})`
    );

    // 处理视频
    content = content.replace(
      new RegExp(`<video fileid="${file.rawId}"[^>]*>`, "g"),
      `[🎬 ${file.name}](${imagePath})`
    );

    // 处理文件 ID 占位符
    content = content.replace(
      new RegExp(`☺ ${file.rawId}`, "g"),
      `![图片](${imagePath})`
    );
  }

  // 12. 处理 <text> 标签
  content = content.replace(
    /<text indent="(\d+)">(.*?)<\/text>/gs,
    (_, indentStr, text) => {
      const indentCount = parseInt(indentStr, 10) - 1;
      const spaces = "  ".repeat(indentCount);
      return spaces + text;
    }
  );

  // 13. 处理简单 checkbox
  content = content.replaceAll(
    '<input type="checkbox" checked="true" />',
    "- [x] "
  );
  content = content.replaceAll('<input type="checkbox" />', "- [ ] ");

  // 14. 处理换行
  content = content.replaceAll("\n", "\n\n");
  content = content.replace(/- (.*?)\n\n- /g, "- $1\n- ");
  content = content.replace(/\n{3,}/g, "\n\n");

  return content.trim();
}

export function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function imageExists(fileId: string): boolean {
  const base64Name = Buffer.from(fileId).toString("base64");
  return fs.existsSync(path.join(IMAGES_DIR, `${base64Name}.bin`));
}

export async function saveImage(
  fileId: string,
  mimeType: string,
  buffer: Buffer
): Promise<void> {
  ensureDir(IMAGES_DIR);
  const base64Name = Buffer.from(fileId).toString("base64");
  const binPath = path.join(IMAGES_DIR, `${base64Name}.bin`);
  const metaPath = path.join(IMAGES_DIR, `${base64Name}.json`);

  await fs.promises.writeFile(binPath, buffer);
  await fs.promises.writeFile(
    metaPath,
    JSON.stringify({ contentType: mimeType, cachedAt: Date.now() }, null, 2)
  );
}

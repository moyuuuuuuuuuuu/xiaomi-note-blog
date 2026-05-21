import * as fs from "node:fs";
import { STATE_PATH } from "./utils";
import type { SyncState } from "./typing";

export function loadState(): SyncState | null {
  if (!fs.existsSync(STATE_PATH)) {
    return null;
  }
  try {
    const data = fs.readFileSync(STATE_PATH, "utf-8");
    return JSON.parse(data) as SyncState;
  } catch {
    console.warn("⚠️  读取状态文件失败，将重新开始同步");
    return null;
  }
}

export async function saveState(state: SyncState): Promise<void> {
  await fs.promises.writeFile(STATE_PATH, JSON.stringify(state, null, 2));
}

export function createEmptyState(): SyncState {
  return {
    lastSyncTime: 0,
    notes: {},
    folders: { "0": "未分类" },
  };
}

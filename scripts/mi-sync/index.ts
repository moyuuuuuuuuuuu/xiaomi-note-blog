#!/usr/bin/env node
import { syncNotes } from "./sync";

async function main() {
  console.log("🚀 小米笔记同步工具");
  console.log("====================\n");

  try {
    await syncNotes();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ 同步失败:");
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();

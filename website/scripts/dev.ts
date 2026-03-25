#!/usr/bin/env bun

/**
 * Dev script: Watches for changes and rebuilds
 * For quick development iteration
 */

import { watch } from "fs";
import { spawn } from "child_process";
import { join } from "path";

const SRC_DIR = join(import.meta.dir, "../src");

console.log("👀 Watching for changes...");
console.log(`📁 Watching: ${SRC_DIR}\n`);

let buildProcess: ReturnType<typeof spawn> | null = null;

function rebuild() {
  if (buildProcess) {
    buildProcess.kill();
  }

  console.log("🔄 Rebuilding...");
  buildProcess = spawn("bun", ["run", join(import.meta.dir, "build.ts")], {
    stdio: "inherit",
  });
}

watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
  if (eventType === "change" || eventType === "rename") {
    console.log(`\n📝 ${filename} changed`);
    rebuild();
  }
});

// Initial build
rebuild();

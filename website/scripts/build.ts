#!/usr/bin/env bun

/**
 * Build script: Copies website files from src/ to docs/ directory
 * Bun-based asset building for axagent website
 */

import { mkdir, copyFile, readdir } from "fs/promises";
import { join, extname } from "path";

const SRC_DIR = join(import.meta.dir, "../src");
const DOCS_DIR = join(import.meta.dir, "../../docs");

async function build() {
  try {
    console.log("🔨 Building axagent website...");
    console.log(`📁 Source: ${SRC_DIR}`);
    console.log(`📁 Output: ${DOCS_DIR}`);

    // Create docs directory if it doesn't exist
    await mkdir(DOCS_DIR, { recursive: true });
    console.log("✓ Docs directory ready");

    // Copy all files from src to docs
    const files = await readdir(SRC_DIR);

    for (const file of files) {
      const srcPath = join(SRC_DIR, file);
      const docPath = join(DOCS_DIR, file);

      // Copy file
      await copyFile(srcPath, docPath);
      console.log(`✓ Copied: ${file}`);
    }

    console.log("\n✨ Build complete!");
    console.log(`\n📖 Serve with:\n  bun run serve\n`);
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

build();

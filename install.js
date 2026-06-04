#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = __dirname;
const skillNames = [
  "wechat-channels-download",
  "wechat-channels-search",
  "wechat-channels-profile",
];
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const skillsDir = path.join(codexHome, "skills");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

fs.mkdirSync(skillsDir, { recursive: true });

for (const name of skillNames) {
  const src = path.join(repoRoot, name);
  if (!fs.existsSync(path.join(src, "SKILL.md"))) {
    throw new Error(`Missing skill folder: ${src}`);
  }
  const dest = path.join(skillsDir, name);
  fs.rmSync(dest, { recursive: true, force: true });
  copyDir(src, dest);
  for (const script of fs.readdirSync(path.join(dest, "scripts"))) {
    if (script.endsWith(".js")) {
      try {
        fs.chmodSync(path.join(dest, "scripts", script), 0o755);
      } catch {}
    }
  }
  console.log(`Installed ${name} -> ${dest}`);
}

console.log("");
console.log("Set TIKHUB_WECHAT_MCP_TOKEN before using these skills.");

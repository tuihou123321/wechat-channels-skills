#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function usage() {
  console.error(`Usage:
  node extract_wechat_channels_copy.js "视频号标题" [--out-dir DIR] [--work-dir DIR] [--model MODEL] [--index N] [--force] [--print-json]

Options:
  --out-dir DIR     Markdown output directory. Default: ./outputs
  --work-dir DIR    Cache/work directory. Default: ./work/wechat-channels-copy
  --model MODEL     Whisper model. Default: small
  --index N         Use the Nth search result, 1-based
  --force           Redownload/retranscribe even if cache files exist
  --print-json      Print machine-readable result JSON
`);
}

function parseArgs(argv) {
  const args = {
    title: "",
    outDir: path.resolve(process.cwd(), "outputs"),
    workDir: path.resolve(process.cwd(), "work", "wechat-channels-copy"),
    model: process.env.WHISPER_MODEL || "small",
    index: 1,
    force: false,
    printJson: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out-dir") args.outDir = path.resolve(argv[++i]);
    else if (arg === "--work-dir") args.workDir = path.resolve(argv[++i]);
    else if (arg === "--model") args.model = argv[++i];
    else if (arg === "--index") args.index = Number(argv[++i]);
    else if (arg === "--force") args.force = true;
    else if (arg === "--print-json") args.printJson = true;
    else if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    } else positional.push(arg);
  }
  args.title = positional.join(" ").trim();
  if (!args.title || !Number.isInteger(args.index) || args.index < 1) {
    usage();
    process.exit(2);
  }
  return args;
}

function run(command, argv, options = {}) {
  const result = spawnSync(command, argv, {
    cwd: options.cwd || process.cwd(),
    encoding: options.encoding || "utf8",
    maxBuffer: options.maxBuffer || 1024 * 1024 * 80,
    stdio: options.stdio || "pipe",
  });
  if (result.status !== 0) {
    const message = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`${command} failed (${result.status}): ${message}`);
  }
  return result;
}

function fileOk(filePath, minBytes = 1) {
  try {
    return fs.statSync(filePath).size >= minBytes;
  } catch {
    return false;
  }
}

function safeFileName(text) {
  return String(text || "wechat-video")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120)
    .replace(/[._-]+$/g, "") || "wechat-video";
}

function siblingSkillScript(skillName, scriptName) {
  return path.resolve(__dirname, "..", "..", skillName, "scripts", scriptName);
}

function downloadVideo(args, slug) {
  fs.mkdirSync(args.workDir, { recursive: true });
  const videoPath = path.join(args.workDir, `${slug}.mp4`);
  const metaPath = path.join(args.workDir, `${slug}.download.json`);
  if (!args.force && fileOk(videoPath, 1024 * 100) && fileOk(metaPath)) {
    return { videoPath, meta: JSON.parse(fs.readFileSync(metaPath, "utf8")), cached: true };
  }

  const downloadScript = siblingSkillScript("wechat-channels-download", "download_wechat_channel_video.js");
  const argv = [downloadScript, args.title, "--out", videoPath, "--index", String(args.index), "--print-json"];
  const result = run(process.execPath, argv, { maxBuffer: 1024 * 1024 * 20 });
  const meta = JSON.parse(result.stdout);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
  return { videoPath, meta, cached: false };
}

function extractAudio(args, slug, videoPath) {
  const audioPath = path.join(args.workDir, `${slug}.wav`);
  if (!args.force && fileOk(audioPath, 1024 * 100)) return { audioPath, cached: true };
  run("ffmpeg", [
    "-nostdin",
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-i", videoPath,
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    audioPath,
  ]);
  return { audioPath, cached: false };
}

function transcribe(args, slug, audioPath) {
  const transcriptDir = path.join(args.workDir, "whisper");
  const transcriptPath = path.join(transcriptDir, `${slug}.txt`);
  if (!args.force && fileOk(transcriptPath)) {
    return { transcriptPath, text: fs.readFileSync(transcriptPath, "utf8"), cached: true };
  }
  fs.mkdirSync(transcriptDir, { recursive: true });
  run("whisper", [
    audioPath,
    "--model", args.model,
    "--language", "Chinese",
    "--task", "transcribe",
    "--output_dir", transcriptDir,
    "--output_format", "txt",
    "--fp16", "False",
    "--verbose", "False",
    "--initial_prompt", "这是中文短视频口播，主题可能包含 AI、智能体、Karpathy、LLM Wiki、RAG、Claude Code、OpenCode、AGENTS.md、CLAUDE.md。",
  ], { maxBuffer: 1024 * 1024 * 20 });

  if (!fileOk(transcriptPath)) {
    const basename = path.basename(audioPath, path.extname(audioPath));
    const fallback = path.join(transcriptDir, `${basename}.txt`);
    if (fileOk(fallback)) fs.renameSync(fallback, transcriptPath);
  }
  if (!fileOk(transcriptPath)) throw new Error(`Whisper did not create transcript: ${transcriptPath}`);
  return { transcriptPath, text: fs.readFileSync(transcriptPath, "utf8"), cached: false };
}

function cleanTranscript(rawText) {
  let text = String(rawText || "").replace(/\r/g, "\n");
  const replacements = [
    [/\bCapathy\b/gi, "Karpathy"],
    [/\bKapathy\b/gi, "Karpathy"],
    [/\bRAA\b/g, "RAG"],
    [/\bCloud Code\b/g, "Claude Code"],
    [/\bOpen Code\b/g, "OpenCode"],
    [/\bCLADE DMD\b/g, "CLAUDE.md"],
    [/\bCLAUDE DMD\b/g, "CLAUDE.md"],
    [/\bAgents\.md\b/g, "AGENTS.md"],
    [/肉偶原始资料层/g, "raw 原始资料层"],
    [/是raw/g, "是 raw"],
    [/Rally 的资料/g, "raw 里的资料"],
    [/Ingest 社区/g, "Ingest，摄取"],
    [/Lint 寻减/g, "Lint，巡检"],
    [/日致/g, "日志"],
    [/归当/g, "归档"],
    [/死练/g, "死链"],
    [/孤导笔记/g, "孤岛笔记"],
    [/盲毒/g, "盲读"],
    [/持续提减/g, "持续体检"],
    [/波克文本/g, "播客文本"],
    [/在深读目标文件/g, "再深读目标文件"],
    [/死链 孤岛笔记/g, "死链、孤岛笔记"],
  ];
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function writeMarkdown(args, slug, meta, transcriptText) {
  fs.mkdirSync(args.outDir, { recursive: true });
  const title = meta.title || args.title;
  const source = meta.source ? String(meta.source).replace(/<[^>]+>/g, "") : "";
  const outPath = path.join(args.outDir, `${slug}-copy.md`);
  const body = [
    `# ${title}`,
    source ? `来源：视频号「${source}」` : "",
    cleanTranscript(transcriptText),
  ].filter(Boolean).join("\n\n") + "\n";
  fs.writeFileSync(outPath, body, "utf8");
  return outPath;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = safeFileName(args.title);
  const video = downloadVideo(args, slug);
  const audio = extractAudio(args, slug, video.videoPath);
  const transcript = transcribe(args, slug, audio.audioPath);
  const markdownPath = writeMarkdown(args, slug, video.meta, transcript.text);
  const result = {
    title: video.meta.title || args.title,
    source: video.meta.source || "",
    model: args.model,
    videoPath: video.videoPath,
    audioPath: audio.audioPath,
    transcriptPath: transcript.transcriptPath,
    markdownPath,
    cached: {
      video: video.cached,
      audio: audio.cached,
      transcript: transcript.cached,
    },
  };
  if (args.printJson) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Markdown: ${markdownPath}`);
    console.log(`Video: ${video.videoPath}${video.cached ? " (cached)" : ""}`);
    console.log(`Transcript: ${transcript.transcriptPath}${transcript.cached ? " (cached)" : ""}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message.replace(/Bearer\s+[A-Za-z0-9+/=_-]+/g, "Bearer ***REDACTED***"));
  process.exit(1);
}

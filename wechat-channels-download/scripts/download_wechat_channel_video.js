#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const DEFAULT_MCP_URL = "https://mcp.tikhub.io/wechat/mcp";
const RESOLVE_IPS = ["104.26.2.227", "104.26.3.227", "172.67.75.115"];

function usage() {
  console.error(`Usage:
  node download_wechat_channel_video.js "视频标题" [--dir DIR] [--out FILE] [--index N] [--print-json]

Options:
  --dir DIR       Output directory. Default: ~/Downloads
  --out FILE      Exact output file path
  --index N       Use the Nth search result, 1-based
  --print-json    Print machine-readable result JSON
`);
}

function parseArgs(argv) {
  const args = { title: "", dir: path.join(os.homedir(), "Downloads"), out: "", index: 1, printJson: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dir") args.dir = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--index") args.index = Number(argv[++i]);
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

function readWechatMcpConfig() {
  const envToken = process.env.TIKHUB_WECHAT_MCP_TOKEN || process.env.TIKHUB_MCP_TOKEN || "";
  if (envToken.trim()) {
    return {
      token: envToken.replace(/^Bearer\s+/i, "").trim(),
      url: process.env.TIKHUB_WECHAT_MCP_URL || DEFAULT_MCP_URL,
    };
  }

  const configPath = path.join(os.homedir(), ".codex", "config.toml");
  if (!fs.existsSync(configPath)) {
    throw new Error("Missing TikHub token. Set TIKHUB_WECHAT_MCP_TOKEN or configure [mcp_servers.tikhub-wechat] in ~/.codex/config.toml");
  }
  const text = fs.readFileSync(configPath, "utf8");
  const block = text.match(/\[mcp_servers\.tikhub-wechat\][\s\S]*?(?=\n\[mcp_servers\.|$)/);
  if (!block) throw new Error(`Missing TikHub token. Set TIKHUB_WECHAT_MCP_TOKEN or add [mcp_servers.tikhub-wechat] in ${configPath}`);
  const auth = block[0].match(/Authorization: Bearer ([^"\]]+)/);
  if (!auth) throw new Error("Missing tikhub-wechat Authorization bearer token in Codex config");
  const url = block[0].match(/https:\/\/mcp\.tikhub\.io\/wechat\/mcp/);
  return { token: auth[1], url: url ? url[0] : DEFAULT_MCP_URL };
}

function tmpFile(prefix) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wechat-channels-")), prefix);
}

function curl(args, opts = {}) {
  const result = spawnSync("curl", args, {
    encoding: opts.encoding || "utf8",
    maxBuffer: opts.maxBuffer || 1024 * 1024 * 40,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(`curl failed (${result.status}): ${err}`);
  }
  return result;
}

function curlWithResolve(baseArgs, opts = {}) {
  const errors = [];
  for (const ip of RESOLVE_IPS) {
    try {
      return curl(["--resolve", `mcp.tikhub.io:443:${ip}`, ...baseArgs], opts);
    } catch (error) {
      errors.push(error.message);
    }
  }
  try {
    return curl(baseArgs, opts);
  } catch (error) {
    errors.push(error.message);
  }
  throw new Error(errors.join("\n"));
}

function parseHeaders(headerText) {
  const headers = {};
  for (const line of headerText.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) headers[line.slice(0, idx).toLowerCase()] = line.slice(idx + 1).trim();
  }
  return headers;
}

function parseJsonRpcBody(text) {
  const dataLines = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6));
  return JSON.parse(dataLines.length ? dataLines.join("\n") : text);
}

function mcpPost(config, sessionId, body, options = {}) {
  const headerFile = tmpFile("headers.txt");
  const bodyFile = tmpFile("body.txt");
  const args = [
    "--connect-timeout", "10",
    "--max-time", String(options.maxTime || 90),
    "-sS",
    "-D", headerFile,
    "-o", bodyFile,
    "-X", "POST",
    config.url,
    "-H", `Authorization: Bearer ${config.token}`,
    "-H", "Content-Type: application/json",
    "-H", "Accept: application/json, text/event-stream",
    "--data", JSON.stringify(body),
  ];
  if (sessionId) args.splice(args.indexOf("--data"), 0, "-H", `mcp-session-id: ${sessionId}`);
  curlWithResolve(args);
  const headers = parseHeaders(fs.readFileSync(headerFile, "utf8"));
  const text = fs.readFileSync(bodyFile, "utf8");
  try {
    fs.rmSync(path.dirname(headerFile), { recursive: true, force: true });
  } catch {}
  try {
    fs.rmSync(path.dirname(bodyFile), { recursive: true, force: true });
  } catch {}
  return { headers, text };
}

function initializeMcp(config) {
  const init = mcpPost(config, "", {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "codex-wechat-channels-downloader", version: "1.0.0" },
    },
  }, { maxTime: 60 });
  const sessionId = init.headers["mcp-session-id"];
  if (!sessionId) throw new Error("MCP initialize response did not include mcp-session-id");
  mcpPost(config, sessionId, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  }, { maxTime: 30 });
  return sessionId;
}

function callTool(config, sessionId, name, toolArgs) {
  const response = mcpPost(config, sessionId, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name, arguments: toolArgs },
  }, { maxTime: 120 });
  const rpc = parseJsonRpcBody(response.text);
  if (rpc.error) throw new Error(`MCP tool error: ${JSON.stringify(rpc.error)}`);
  const text = rpc.result?.structuredContent?.result || rpc.result?.content?.[0]?.text;
  if (!text) throw new Error("MCP tool returned no text result");
  const payload = JSON.parse(text);
  if (payload.code && payload.code !== 200) throw new Error(`TikHub API error ${payload.code}: ${payload.message || payload.message_zh || ""}`);
  return payload;
}

function stripTags(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function baseTitle(text) {
  return stripTags(text).replace(/\s*#.*$/s, "").trim();
}

function norm(text) {
  return stripTags(text)
    .toLowerCase()
    .replace(/[，,:：、《》“”"'\s#_\-]/g, "")
    .trim();
}

function selectItem(items, title, index) {
  if (!items.length) throw new Error("No WeChat Channels search results returned");
  if (index > 1) {
    const selected = items[index - 1];
    if (!selected) throw new Error(`Search result index ${index} is out of range; only ${items.length} result(s)`);
    return selected;
  }
  const target = norm(title);
  const scored = items.map((item, i) => {
    const clean = baseTitle(item.title);
    const n = norm(clean);
    let score = 0;
    if (n === target) score = 100;
    else if (n.startsWith(target)) score = 90;
    else if (target.startsWith(n)) score = 80;
    else if (n.includes(target)) score = 70;
    return { item, score, i };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored[0].item;
}

function safeFileName(title) {
  return baseTitle(title)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120)
    .replace(/[._-]+$/g, "");
}

function download(url, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  curl([
    "-L",
    "--fail",
    "--retry", "3",
    "--connect-timeout", "20",
    "--max-time", "300",
    "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "-o", outPath,
    url,
  ], { maxBuffer: 1024 * 1024 * 8 });
}

function probe(outPath) {
  const ffprobe = spawnSync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,width,height,duration",
    "-show_entries", "format=duration,size",
    "-of", "json",
    outPath,
  ], { encoding: "utf8" });
  if (ffprobe.status === 0) {
    try {
      const data = JSON.parse(ffprobe.stdout);
      return {
        codec: data.streams?.[0]?.codec_name || "",
        width: data.streams?.[0]?.width || 0,
        height: data.streams?.[0]?.height || 0,
        duration: Number(data.format?.duration || data.streams?.[0]?.duration || 0),
        size: Number(data.format?.size || fs.statSync(outPath).size),
      };
    } catch {}
  }
  const file = spawnSync("file", [outPath], { encoding: "utf8" });
  return { file: file.stdout.trim(), size: fs.statSync(outPath).size };
}

function maybeGetDetailVideoUrl(config, sessionId, item) {
  if (item.videoUrl) return item.videoUrl;
  const detail = callTool(config, sessionId, "wechat_channels_fetch_video_detail", {
    id: item.docID || "",
    exportId: item.exportId || "",
  });
  const data = detail.data || {};
  return data.videoUrl || data.objectDesc?.media?.[0]?.url || data.objectDesc?.media?.[0]?.url_list?.[0] || "";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = readWechatMcpConfig();
  const sessionId = initializeMcp(config);
  const search = callTool(config, sessionId, "wechat_channels_fetch_search_ordinary", { keywords: args.title });
  const items = search.data?.items || [];
  const item = selectItem(items, args.title, args.index);
  const videoUrl = maybeGetDetailVideoUrl(config, sessionId, item);
  if (!videoUrl) throw new Error("Selected result did not include a downloadable video URL");

  const title = baseTitle(item.title) || args.title;
  const outPath = path.resolve(args.out || path.join(args.dir, `视频号-${safeFileName(title)}.mp4`));
  download(videoUrl, outPath);
  const media = probe(outPath);
  const result = {
    outPath,
    title,
    source: item.source?.title || "",
    durationText: item.duration || "",
    exportId: item.exportId || "",
    media,
  };

  if (args.printJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Downloaded: ${outPath}`);
    console.log(`Title: ${title}`);
    if (result.source) console.log(`Source: ${result.source}`);
    if (result.durationText) console.log(`Duration: ${result.durationText}`);
    if (media.width && media.height) console.log(`Media: ${media.codec || "video"} ${media.width}x${media.height}, ${Math.round(media.duration)}s, ${media.size} bytes`);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message.replace(/Bearer\s+[A-Za-z0-9+/=_-]+/g, "Bearer ***REDACTED***"));
  process.exit(1);
}

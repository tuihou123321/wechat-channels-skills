#!/usr/bin/env node

const { callTool, stripTags, baseTitle } = require("./wechat_mcp_common");

function usage() {
  console.error(`Usage:
  node search_wechat_channels.js "关键词" [--latest] [--limit N] [--print-json]
`);
}

function parseArgs(argv) {
  const args = { keyword: "", latest: false, limit: 10, printJson: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--latest") args.latest = true;
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg === "--print-json") args.printJson = true;
    else if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    } else positional.push(arg);
  }
  args.keyword = positional.join(" ").trim();
  if (!args.keyword || !Number.isInteger(args.limit) || args.limit < 1) {
    usage();
    process.exit(2);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const tool = args.latest ? "wechat_channels_fetch_search_latest" : "wechat_channels_fetch_search_ordinary";
  const payload = callTool(tool, { keywords: args.keyword });
  const items = (payload.data?.items || []).slice(0, args.limit).map((item, index) => ({
    index: index + 1,
    title: baseTitle(item.title) || stripTags(item.title),
    source: stripTags(item.source?.title || ""),
    duration: item.duration || "",
    dateTime: item.dateTime || "",
    likeNum: item.likeNum || "",
    exportId: item.exportId || "",
    docID: item.docID || "",
    width: item.width || 0,
    height: item.height || 0,
    videoUrl: item.videoUrl || "",
  }));

  if (args.printJson) {
    console.log(JSON.stringify({ keyword: args.keyword, mode: args.latest ? "latest" : "ordinary", items }, null, 2));
    return;
  }
  for (const item of items) {
    console.log(`${item.index}. ${item.title}`);
    if (item.source || item.duration || item.dateTime) console.log(`   ${[item.source, item.duration, item.dateTime].filter(Boolean).join(" | ")}`);
    if (item.exportId) console.log(`   exportId: ${item.exportId}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message.replace(/Bearer\s+[A-Za-z0-9+/=_-]+/g, "Bearer ***REDACTED***"));
  process.exit(1);
}

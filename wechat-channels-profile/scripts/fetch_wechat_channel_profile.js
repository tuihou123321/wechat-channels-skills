#!/usr/bin/env node

const { callTool, stripTags, baseTitle } = require("./wechat_mcp_common");

function usage() {
  console.error(`Usage:
  node fetch_wechat_channel_profile.js "博主名或关键词" [--page N] [--limit N] [--print-json]
`);
}

function parseArgs(argv) {
  const args = { keyword: "", page: 1, limit: 10, printJson: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--page") args.page = Number(argv[++i]);
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg === "--print-json") args.printJson = true;
    else if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    } else positional.push(arg);
  }
  args.keyword = positional.join(" ").trim();
  if (!args.keyword || !Number.isInteger(args.page) || args.page < 1 || !Number.isInteger(args.limit) || args.limit < 1) {
    usage();
    process.exit(2);
  }
  return args;
}

function firstDefined(obj, keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function normalizeUser(item, index) {
  const rawName = firstDefined(item, ["nickname", "nickName", "username", "userName", "finderUsername", "source.title", "title"]);
  return {
    index: index + 1,
    name: stripTags(rawName),
    wxUsername: firstDefined(item, ["username", "userName", "finderUsername", "finder_user_name", "finderUsername"]),
    exportId: firstDefined(item, ["exportId", "encryptedUsername", "encrypted_username"]),
    description: stripTags(firstDefined(item, ["signature", "description", "desc", "profile.desc"])),
    avatar: firstDefined(item, ["avatar", "avatarUrl", "headUrl", "iconUrl", "source.iconUrl"]),
    fansCount: firstDefined(item, ["fansCount", "followerCount", "followCount", "profile.fansCount"]),
    raw: item,
  };
}

function collectUsers(data) {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

function profilesFromVideoSearch(keyword, limit) {
  const payload = callTool("wechat_channels_fetch_search_ordinary", { keywords: keyword });
  const items = payload.data?.items || [];
  const byName = new Map();
  for (const item of items) {
    const name = stripTags(item.source?.title || "");
    if (!name) continue;
    if (!byName.has(name)) {
      byName.set(name, {
        name,
        avatar: item.source?.iconUrl || "",
        videos: [],
      });
    }
    byName.get(name).videos.push({
      title: baseTitle(item.title) || stripTags(item.title),
      duration: item.duration || "",
      dateTime: item.dateTime || "",
      likeNum: item.likeNum || "",
      exportId: item.exportId || "",
      docID: item.docID || "",
    });
  }
  return Array.from(byName.values())
    .sort((a, b) => b.videos.length - a.videos.length)
    .slice(0, limit)
    .map((profile, index) => ({
      index: index + 1,
      method: "video_search_fallback",
      ...profile,
      recentVideoCount: profile.videos.length,
      recentVideos: profile.videos.slice(0, 5),
    }));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let users = [];
  let method = "user_search";
  let warning = "";
  try {
    const payload = callTool("wechat_channels_fetch_user_search", {
      keywords: args.keyword,
      page: args.page,
    });
    users = collectUsers(payload.data).slice(0, args.limit).map(normalizeUser);
  } catch (error) {
    warning = `user_search failed; used video search fallback. ${error.message}`;
    method = "video_search_fallback";
    users = profilesFromVideoSearch(args.keyword, args.limit);
  }

  if (args.printJson) {
    console.log(JSON.stringify({ keyword: args.keyword, page: args.page, method, warning, users }, null, 2));
    return;
  }
  if (warning) console.log(`Warning: ${warning}`);
  for (const user of users) {
    console.log(`${user.index}. ${user.name || "(unknown)"}`);
    const details = [
      user.wxUsername && `username: ${user.wxUsername}`,
      user.exportId && `exportId: ${user.exportId}`,
      user.fansCount && `fans: ${user.fansCount}`,
      user.recentVideoCount && `matched videos: ${user.recentVideoCount}`,
    ].filter(Boolean);
    if (details.length) console.log(`   ${details.join(" | ")}`);
    if (user.description) console.log(`   ${user.description}`);
    if (user.avatar) console.log(`   avatar: ${user.avatar}`);
    if (user.recentVideos?.length) console.log(`   latest: ${user.recentVideos[0].title}`);
  }
  if (!users.length) console.log("No matching WeChat Channels users found.");
}

try {
  main();
} catch (error) {
  console.error(error.message.replace(/Bearer\s+[A-Za-z0-9+/=_-]+/g, "Bearer ***REDACTED***"));
  process.exit(1);
}

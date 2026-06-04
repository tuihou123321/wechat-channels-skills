---
name: wechat-channels-profile
description: Find WeChat Channels creator/profile information by blogger name or keyword through TikHub WeChat MCP user search. Use when the user asks for 视频号博主主页/账号信息/创作者信息/作者主页, or wants to identify a WeChat Channels account by name.
---

# WeChat Channels Profile

## Quick Start

Run the bundled script, resolving the path relative to this `SKILL.md`:

```bash
node scripts/fetch_wechat_channel_profile.js "博主名或关键词"
```

Useful options:

```bash
node scripts/fetch_wechat_channel_profile.js "博主名" --page 2
node scripts/fetch_wechat_channel_profile.js "博主名" --limit 20
node scripts/fetch_wechat_channel_profile.js "博主名" --print-json
```

## Requirements

Configure one of these before first use:

```bash
TIKHUB_WECHAT_MCP_TOKEN=your_token
```

or `~/.codex/config.toml` with `[mcp_servers.tikhub-wechat]`.

## Workflow

1. Search the creator/profile keyword with the script.
2. Return likely accounts with name, username/exportId, fan count, description, and avatar when available.
3. If TikHub user search fails, use the script's video-search fallback and return creators grouped from matching video results, including avatar and recent matched videos.
4. If the user needs a specific creator and multiple results match, ask which result or rerun with a refined keyword.

Note: TikHub's currently exposed `wechat_channels_fetch_home_page` MCP tool has no input schema, so this skill uses user search first and video-search fallback for arbitrary creator lookup.

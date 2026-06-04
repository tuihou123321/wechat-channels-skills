---
name: wechat-channels-downloader
description: Download WeChat Channels videos by title through the configured TikHub WeChat MCP service. Use when the user gives a 视频号/微信视频号 title, asks to download/extract/save a Channels video, or wants faster repeat downloads from 视频号 search results.
---

# WeChat Channels Downloader

## Quick Start

Use the bundled script instead of manually starting `mcp-remote`:

```bash
node /Users/xz/.codex/skills/wechat-channels-downloader/scripts/download_wechat_channel_video.js "视频标题"
```

By default it saves to `/Users/xz/Downloads/视频号-<title>.mp4`.

Before first use on a new machine, configure either:

```bash
export TIKHUB_WECHAT_MCP_TOKEN="你的 TikHub token"
```

or an existing Codex MCP config at `~/.codex/config.toml`:

```toml
[mcp_servers.tikhub-wechat]
command = "npx"
args = ["mcp-remote", "https://mcp.tikhub.io/wechat/mcp", "--header", "Authorization: Bearer YOUR_TOKEN"]
```

Optional custom endpoint:

```bash
export TIKHUB_WECHAT_MCP_URL="https://mcp.tikhub.io/wechat/mcp"
```

Useful options:

```bash
node /Users/xz/.codex/skills/wechat-channels-downloader/scripts/download_wechat_channel_video.js "视频标题" --dir /Users/xz/Downloads
node /Users/xz/.codex/skills/wechat-channels-downloader/scripts/download_wechat_channel_video.js "视频标题" --out /absolute/path/video.mp4
node /Users/xz/.codex/skills/wechat-channels-downloader/scripts/download_wechat_channel_video.js "视频标题" --index 2
node /Users/xz/.codex/skills/wechat-channels-downloader/scripts/download_wechat_channel_video.js "视频标题" --print-json
```

## Workflow

1. Run the script with the exact title from the user.
2. If multiple matches are possible, inspect the printed `source`, `duration`, `title`, and rerun with `--index N` if needed.
3. Return the final local file path and basic validation info.

## Implementation Notes

- The script reads `TIKHUB_WECHAT_MCP_TOKEN` first, then falls back to `TIKHUB_MCP_TOKEN`, then to the `tikhub-wechat` MCP server config in `~/.codex/config.toml`.
- It uses Streamable HTTP JSON-RPC directly, preserving `mcp-session-id`, instead of launching `mcp-remote`.
- It calls `wechat_channels_fetch_search_ordinary` and uses the first strong title match.
- It avoids calling `wechat_channels_fetch_video_detail` unless the search result lacks a direct `videoUrl`.
- It pins Cloudflare resolve IPs for `mcp.tikhub.io` when needed to avoid slow local resolver failures.
- Do not print bearer tokens or full MCP headers in user-facing output.

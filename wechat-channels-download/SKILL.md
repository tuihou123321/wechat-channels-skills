---
name: wechat-channels-download
description: Download a specific WeChat Channels video by title through TikHub WeChat MCP. Use when the user asks to 下载/保存/提取 a 视频号/微信视频号 video or gives a WeChat Channels title and wants the video file saved locally.
---

# WeChat Channels Download

## Quick Start

Run the bundled script, resolving the path relative to this `SKILL.md`:

```bash
node scripts/download_wechat_channel_video.js "视频号标题"
```

Useful options:

```bash
node scripts/download_wechat_channel_video.js "视频号标题" --dir ~/Downloads
node scripts/download_wechat_channel_video.js "视频号标题" --out /absolute/path/video.mp4
node scripts/download_wechat_channel_video.js "视频号标题" --index 2
node scripts/download_wechat_channel_video.js "视频号标题" --print-json
```

## Requirements

Configure one of these before first use:

```bash
TIKHUB_WECHAT_MCP_TOKEN=your_token
```

or `~/.codex/config.toml` with `[mcp_servers.tikhub-wechat]`.

Optional endpoint override:

```bash
TIKHUB_WECHAT_MCP_URL=https://mcp.tikhub.io/wechat/mcp
```

## Workflow

1. Run the script with the exact title.
2. If the match is wrong, inspect the printed source/title and rerun with `--index N`.
3. Return the local file path and media validation.

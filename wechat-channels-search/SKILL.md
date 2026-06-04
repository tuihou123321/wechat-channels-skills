---
name: wechat-channels-search
description: Search WeChat Channels videos by keyword through TikHub WeChat MCP. Use when the user asks to 搜索/查找/检索 视频号内容, wants keyword search results, latest videos, titles, authors, durations, or export IDs from WeChat Channels.
---

# WeChat Channels Search

## Quick Start

Run the bundled script, resolving the path relative to this `SKILL.md`:

```bash
node scripts/search_wechat_channels.js "关键词"
```

Useful options:

```bash
node scripts/search_wechat_channels.js "关键词" --latest
node scripts/search_wechat_channels.js "关键词" --limit 20
node scripts/search_wechat_channels.js "关键词" --print-json
```

## Requirements

Configure one of these before first use:

```bash
TIKHUB_WECHAT_MCP_TOKEN=your_token
```

or `~/.codex/config.toml` with `[mcp_servers.tikhub-wechat]`.

## Workflow

1. Search with the user keyword.
2. For recency-focused requests, add `--latest`.
3. Return concise results: title, source, duration/date, and `exportId` when useful.

# WeChat Channels Downloader Skill

Codex skill for downloading WeChat Channels videos by title through TikHub WeChat MCP.

## Install Prompt

Send this to Codex after downloading the ZIP:

```text
请帮我安装桌面上的 `wechat-channels-downloader-skill.zip` 这个 Codex skill，解压并放到当前系统 Codex 可识别的 skills 目录里。

这个 skill 需要配置 API 环境变量：`TIKHUB_WECHAT_MCP_TOKEN=这里填你的 TikHub Token`，可选环境变量：`TIKHUB_WECHAT_MCP_URL=https://mcp.tikhub.io/wechat/mcp`。
```

## Required Environment

- Node.js
- `curl`
- A TikHub token with WeChat MCP access

Optional: `ffprobe` for richer media validation.

## Direct Usage

```bash
node scripts/download_wechat_channel_video.js "视频号标题"
```

The script saves videos to `~/Downloads` by default.

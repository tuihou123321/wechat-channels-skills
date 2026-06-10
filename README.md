# WeChat Channels Skills

Codex skill package for common WeChat Channels workflows through TikHub WeChat MCP.

## Included Skills

- `wechat-channels-copy-extract`: download and locally transcribe a video by title into Markdown copy
- `wechat-channels-download`: download a specific video by title
- `wechat-channels-search`: search videos by keyword
- `wechat-channels-profile`: find creator/profile information by blogger name

## Install Prompt

Send this to Codex after downloading the ZIP or cloning the repo:

```text
请帮我安装这个视频号 Codex skill 包，把里面的多个子 skill 都放到当前系统 Codex 可识别的 skills 目录里。

这个 skill 包需要配置 API 环境变量：`TIKHUB_WECHAT_MCP_TOKEN=这里填你的 TikHub Token`，可选环境变量：`TIKHUB_WECHAT_MCP_URL=https://mcp.tikhub.io/wechat/mcp`。
```

Codex can also run the bundled installer:

```bash
node install.js
```

## Requirements

- Node.js
- `curl`
- A TikHub token with WeChat MCP access

Optional:

- `ffprobe` for richer media validation when downloading
- `ffmpeg` and local `whisper` for `wechat-channels-copy-extract`

## Direct Commands

```bash
node wechat-channels-copy-extract/scripts/extract_wechat_channels_copy.js "视频号标题"
node wechat-channels-download/scripts/download_wechat_channel_video.js "视频号标题"
node wechat-channels-search/scripts/search_wechat_channels.js "关键词"
node wechat-channels-profile/scripts/fetch_wechat_channel_profile.js "博主名"
```

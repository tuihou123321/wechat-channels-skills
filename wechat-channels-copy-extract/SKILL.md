---
name: wechat-channels-copy-extract
description: One-command WeChat Channels copy extraction. Use when the user asks to 提取/转写/整理 视频号文案, gives a WeChat Channels title, or wants the spoken copy/script from a 视频号 video saved as Markdown.
---

# WeChat Channels Copy Extract

## Quick Start

Run the bundled script with the exact video title:

```bash
node scripts/extract_wechat_channels_copy.js "视频号标题"
```

Useful options:

```bash
node scripts/extract_wechat_channels_copy.js "视频号标题" --out-dir ./outputs
node scripts/extract_wechat_channels_copy.js "视频号标题" --work-dir ./work/wechat-copy
node scripts/extract_wechat_channels_copy.js "视频号标题" --model small
node scripts/extract_wechat_channels_copy.js "视频号标题" --index 2
node scripts/extract_wechat_channels_copy.js "视频号标题" --print-json
```

## Fixed Workflow

Use this skill instead of separately loading the search, download, and transcript skills.

1. Download the exact WeChat Channels video through `wechat-channels-download`.
2. Reuse existing downloaded video/audio/transcript files when present.
3. Extract 16 kHz mono WAV with `ffmpeg`.
4. Transcribe locally with `whisper` in Chinese.
5. Apply common ASR term corrections for AI/agent videos.
6. Save a Markdown copy draft to `outputs/`.

Default model is `small` for a quality/speed balance. Use `--model tiny` for quick drafts or `--model large-v3-turbo` when quality matters more than time.

## Requirements

- TikHub WeChat MCP token configured for the existing `wechat-channels-download` skill.
- `ffmpeg`.
- Local `whisper` command.

## Notes

- The script does not upload the video/audio to cloud services.
- If the same title is processed again with the same work directory, it skips files that already exist.
- For polished marketing copy, first extract with this skill, then rewrite separately.
